from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import shutil
import os
import re
import uuid
import hashlib
import json
from datetime import datetime
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from database.connection import engine, Base, get_db
from database.models import PurchaseOrderRecord

from extractor.ingestion import extract_and_chunk_pdf
from extractor.extraction import extract_contract_profile_with_combined_pipeline

Base.metadata.create_all(bind=engine)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

PERMANENT_STORAGE_DIR = "document_storage"
os.makedirs(PERMANENT_STORAGE_DIR, exist_ok=True)

# ═══════════════════════════════════════════════════════════════════════════
#  CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════
BUILT_IN_COLS = {
    "po_number", "vendor_name", "vendor_contact_address", "effective_date",
    "lapse_expiry_date", "total_value", "conditions_of_agreement",
    "conditions_of_payment", "authorising_signatory"
}

SCHEMA_FILE = "data/custom_fields.json"
os.makedirs("data", exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════
#  SCHEMA HELPERS
# ═══════════════════════════════════════════════════════════════════════════
def _load_schema() -> list:
    if os.path.exists(SCHEMA_FILE):
        try:
            with open(SCHEMA_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return []

def _save_schema(fields: list):
    with open(SCHEMA_FILE, "w") as f:
        json.dump(fields, f, indent=2)


# ═══════════════════════════════════════════════════════════════════════════
#  PROFILE RECONSTRUCTION HELPER
# ═══════════════════════════════════════════════════════════════════════════
def _build_profile_from_record(record: PurchaseOrderRecord) -> dict:
    quotes       = record.source_quotes or {}
    full_history = record.edit_history  or []
    custom_data  = record.custom_fields or {}

    def get_hist(field_name):
        return [h for h in full_history if h.get("field") == field_name]

    profile = {
        "po_number":               {"value": record.po_number,               "source_quote": quotes.get("po_number", ""),               "history": get_hist("po_number")},
        "vendor_name":             {"value": record.vendor_name,             "source_quote": quotes.get("vendor_name", ""),             "history": get_hist("vendor_name")},
        "vendor_contact_address":  {"value": record.vendor_contact_address,  "source_quote": quotes.get("vendor_contact_address", ""),  "history": get_hist("vendor_contact_address")},
        "effective_date":          {"value": record.effective_date,          "source_quote": quotes.get("effective_date", ""),          "history": get_hist("effective_date")},
        "lapse_expiry_date":       {"value": record.lapse_expiry_date,       "source_quote": quotes.get("lapse_expiry_date", ""),       "history": get_hist("lapse_expiry_date")},
        "total_value":             {"value": record.total_value,             "source_quote": quotes.get("total_value", ""),             "history": get_hist("total_value")},
        "conditions_of_agreement": {"value": record.conditions_of_agreement, "source_quote": quotes.get("conditions_of_agreement", ""), "history": get_hist("conditions_of_agreement")},
        "conditions_of_payment":   {"value": record.conditions_of_payment,   "source_quote": quotes.get("conditions_of_payment", ""),   "history": get_hist("conditions_of_payment")},
        "authorising_signatory":   {"value": record.authorising_signatory,   "source_quote": quotes.get("authorising_signatory", ""),   "history": get_hist("authorising_signatory")},
        "line_items":              {"status": "found" if record.line_items else "not_found", "value": record.line_items},
    }

    if "_deep_analysis" in custom_data:
        profile["_deep_analysis"] = custom_data["_deep_analysis"]

    custom_schema = _load_schema()
    for cf in custom_schema:
        k = cf["key"]
        entry = custom_data.get(k, {})
        profile[k] = {
            "value":       entry.get("value", "not_found") if isinstance(entry, dict) else "not_found",
            "source_quote": entry.get("source_quote", "")  if isinstance(entry, dict) else "",
            "history":     get_hist(k),
            "_custom":     True,
            "_meta":       cf,
        }

    return profile


# ═══════════════════════════════════════════════════════════════════════════
#  PIPELINE PROGRESS TRACKING & BACKGROUND TASK
# ═══════════════════════════════════════════════════════════════════════════
task_progress = {}

@app.get("/api/upload-status/{task_id}")
async def get_upload_status(task_id: str):
    """Frontend polls this endpoint to get the real-time progress."""
    return task_progress.get(task_id, {"status": "Not Found", "progress": 0})

def run_pipeline_task(task_id: str, file_path: str, run_deep: bool, filename: str, file_hash: str):
    """Background task that runs the AI pipeline safely."""
    # Create a fresh database session bound directly to the engine
    db_session = Session(bind=engine)
    
    try:
        def update(msg, prog):
            task_progress[task_id] = {"status": msg, "progress": prog}
            
        update("Extracting and chunking PDF...", 10)
        chunks = extract_and_chunk_pdf(file_path)
        
        update("Analyzing with Gemini & Groq AI...", 40)
        result = extract_contract_profile_with_combined_pipeline(chunks, filename, run_deep_analysis=run_deep)
        
        if run_deep:
            update("Running Deep Contract Analysis...", 80)
            
        update("Finalizing Database Record...", 95)
        
        if result.get("status") == "failed":
            raise Exception(result.get("message", "Extraction failed"))

        profile = result.get("profile", {})
        deep_analysis = result.get("deep_analysis", {})
        
        def get_val(field):
            return profile.get(field, {}).get("value", "not_found")
        def get_quote(field):
            return profile.get(field, {}).get("source_quote", "Quote missing")

        quotes_dict = {f: get_quote(f) for f in BUILT_IN_COLS}

        initial_custom_fields = {"_extraction_mode": "deep" if run_deep else "primary"}
        if deep_analysis:
            initial_custom_fields["_deep_analysis"] = deep_analysis

        db_record = PurchaseOrderRecord(
            filename=filename,
            file_hash=file_hash,
            pdf_file_path=file_path,
            po_number=get_val("po_number"),
            vendor_name=get_val("vendor_name"),
            vendor_contact_address=get_val("vendor_contact_address"),
            effective_date=get_val("effective_date"),
            lapse_expiry_date=get_val("lapse_expiry_date"),
            total_value=get_val("total_value"),
            conditions_of_agreement=get_val("conditions_of_agreement"),
            conditions_of_payment=get_val("conditions_of_payment"),
            authorising_signatory=get_val("authorising_signatory"),
            line_items=get_val("line_items"),
            source_quotes=quotes_dict,
            custom_fields=initial_custom_fields,
            status="Pending Review"
        )
        
        db_session.add(db_record)
        db_session.commit()
        db_session.refresh(db_record)
        
        # We pass the db_id back here so the frontend can load it instantly
        task_progress[task_id] = {"status": "Complete", "progress": 100, "db_id": db_record.id}
    except Exception as e:
        print(f"Background Task Error: {str(e)}")
        task_progress[task_id] = {"status": f"Error: {str(e)}", "progress": -1}
    finally:
        db_session.close()


# ═══════════════════════════════════════════════════════════════════════════
#  ROUTES — Document ingestion
# ═══════════════════════════════════════════════════════════════════════════
@app.post("/api/view-chunks")
async def view_chunks(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF extensions are supported.")
    file_path = os.path.join(PERMANENT_STORAGE_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        chunks = extract_and_chunk_pdf(file_path)
        return {"filename": file.filename, "total_chunks_created": len(chunks), "chunks": chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@app.post("/api/upload")
async def process_contract_profile(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    extraction_mode: str = Form("primary"),
    db: Session = Depends(get_db)
):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF extensions are supported.")

    run_deep = (extraction_mode == "deep")
    file_bytes = await file.read()
    file_hash  = hashlib.sha256(file_bytes).hexdigest()
    await file.seek(0)

    # 1. Check Cache
    existing_record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.file_hash == file_hash).first()
    if existing_record:
        existing_custom = existing_record.custom_fields or {}
        has_deep_cached = "_deep_analysis" in existing_custom

        # Upgrade cached record synchronously if requested
        if run_deep and not has_deep_cached:
            try:
                if existing_record.pdf_file_path and os.path.exists(existing_record.pdf_file_path):
                    chunks = extract_and_chunk_pdf(existing_record.pdf_file_path)
                    all_text = "\n--- PAGE SEPARATOR ---\n".join(c['text'] for c in chunks)
                    from extractor.extraction import _run_deep_analysis
                    deep_analysis = _run_deep_analysis(all_text)
                    if deep_analysis:
                        from sqlalchemy.orm.attributes import flag_modified
                        existing_custom["_deep_analysis"] = deep_analysis
                        existing_record.custom_fields = existing_custom
                        flag_modified(existing_record, "custom_fields")
                        db.commit()
                        db.refresh(existing_record)
            except Exception as e:
                print(f"⚠️ Deep-analysis upgrade failed: {e}")

        # Tell the frontend it was cached so it can instantly load it
        return {"db_id": existing_record.id, "cached": True}

    # 2. Setup Background Task for new files
    task_id = str(uuid.uuid4())
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(PERMANENT_STORAGE_DIR, unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    task_progress[task_id] = {"status": "Initializing Pipeline...", "progress": 5}
    background_tasks.add_task(run_pipeline_task, task_id, file_path, run_deep, file.filename, file_hash)
    
    return {"task_id": task_id}


# ═══════════════════════════════════════════════════════════════════════════
#  ROUTES — PO history / CRUD
# ═══════════════════════════════════════════════════════════════════════════
@app.get("/api/pos")
async def get_po_history(db: Session = Depends(get_db)):
    records = db.query(PurchaseOrderRecord).order_by(PurchaseOrderRecord.created_at.desc()).all()
    return [
        {
            "id":               r.id,
            "filename":         r.filename,
            "status":           r.status,
            "po_number":        r.po_number,
            "lapse_expiry_date": r.lapse_expiry_date
        }
        for r in records
    ]


def _is_real_date(date_str):
    if not date_str:
        return False
    s = str(date_str).strip().lower()
    return s not in ("", "null", "none", "not_found", "n/a")


@app.get("/api/calendar-events")
async def get_calendar_events(db: Session = Depends(get_db)):
    records = db.query(PurchaseOrderRecord).all()
    events = []

    for r in records:
        label_base = r.po_number or r.filename

        # Expiry gets urgency coloring on frontend
        if _is_real_date(r.lapse_expiry_date):
            events.append({
                "po_id": r.id, "field_key": "lapse_expiry_date",
                "label": f"Expiry — {label_base}", "date": r.lapse_expiry_date,
                "source": "lapse_expiry_date",
            })
        
        # Effective date gets its own category color
        if _is_real_date(r.effective_date):
            events.append({
                "po_id": r.id, "field_key": "effective_date",
                "label": f"Effective — {label_base}", "date": r.effective_date,
                "source": "effective_date",
            })

        # Deep Analysis deadlines mapped dynamically to categories
        deep = (r.custom_fields or {}).get("_deep_analysis", {})
        for idx, dl in enumerate(deep.get("deadlines", []) or []):
            if _is_real_date(dl.get("computed_date")):
                label_text = dl.get('label', '').lower()
                
                source_cat = "deadline" # Default
                if any(k in label_text for k in ["payment", "invoice", "advance", "retention"]):
                    source_cat = "payment"
                elif any(k in label_text for k in ["delivery", "dispatch", "shipment"]):
                    source_cat = "delivery"
                elif any(k in label_text for k in ["warranty", "guarantee", "dlp", "defect"]):
                    source_cat = "warranty"

                events.append({
                    "po_id": r.id, "field_key": f"deadline_{idx}",
                    "label": f"{dl.get('label') or 'Deadline'} — {label_base}",
                    "date": dl["computed_date"],
                    "source": source_cat,
                })

    return events


@app.get("/api/pos/{po_id}")
async def get_po_details(po_id: int, db: Session = Depends(get_db)):
    record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.id == po_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="PO not found")
    return {
        "filename":          record.filename,
        "db_id":             record.id,
        "extraction_result": {"status": "success", "profile": _build_profile_from_record(record)}
    }


@app.delete("/api/pos/{po_id}")
async def delete_purchase_order(po_id: int, db: Session = Depends(get_db)):
    record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.id == po_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="PO not found")
    if record.pdf_file_path and os.path.exists(record.pdf_file_path):
        try:
            os.remove(record.pdf_file_path)
        except Exception as e:
            print(f"⚠️ Warning: Could not delete physical file: {e}")
    db.delete(record)
    db.commit()
    return {"status": "success", "message": f"PO {po_id} deleted successfully"}


@app.patch("/api/pos/{po_id}/field")
async def update_po_field(po_id: int, payload: dict, db: Session = Depends(get_db)):
    record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.id == po_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="PO not found")

    field     = payload.get("field")
    new_value = payload.get("value")

    if field in BUILT_IN_COLS:
        old_value = getattr(record, field, None)
        setattr(record, field, new_value)
    elif field == "_deep_analysis":
        from sqlalchemy.orm.attributes import flag_modified
        custom = record.custom_fields or {}
        old_value = "Deadline updated manually"
        custom["_deep_analysis"] = new_value 
        record.custom_fields = custom
        flag_modified(record, "custom_fields")
    else:
        from sqlalchemy.orm.attributes import flag_modified
        custom    = record.custom_fields or {}
        entry     = custom.get(field, {})
        old_value = entry.get("value") if isinstance(entry, dict) else entry
        custom[field] = {**(entry if isinstance(entry, dict) else {}), "value": new_value}
        record.custom_fields = custom
        flag_modified(record, "custom_fields")

    history_log = record.edit_history or []
    history_log.append({
        "field":     field,
        "old_value": old_value,
        "new_value": new_value,
        "timestamp": datetime.utcnow().isoformat()
    })
    record.edit_history = history_log
    record.status = "Manually Verified"

    db.commit()
    return {"status": "success", "message": f"{field} updated"}


# ═══════════════════════════════════════════════════════════════════════════
#  ROUTES — PDF serving & page finder
# ═══════════════════════════════════════════════════════════════════════════
@app.get("/api/pos/{po_id}/pdf")
async def get_po_pdf(po_id: int, db: Session = Depends(get_db)):
    record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.id == po_id).first()
    if not record or not record.pdf_file_path or not os.path.exists(record.pdf_file_path):
        raise HTTPException(status_code=404, detail="PDF file not found on server.")
    return FileResponse(record.pdf_file_path, media_type="application/pdf")


def _normalize_ws(s):
    return re.sub(r"\s+", " ", s or "").strip().lower()


def _split_quote_into_chunks(quote, max_chunks=25, min_words=4, min_chars=15):
    quote = (quote or "").strip()
    if not quote:
        return []
    if len(quote) <= 150:
        return [quote]

    raw_pieces = re.split(r"(?<=[.;:])\s+|\n+", quote)
    chunks = []
    seen = set()
    for piece in raw_pieces:
        piece = piece.strip()
        if not piece or len(piece) < min_chars or len(piece.split()) < min_words:
            continue
        piece = piece[:300]
        key = re.sub(r"\s+", " ", piece).strip().lower()
        if key in seen:
            continue
        seen.add(key)
        chunks.append(piece)
        if len(chunks) >= max_chunks:
            break
    return chunks or [quote[:300]]


class FindPageRequest(BaseModel):
    quote: str


@app.post("/api/pos/{po_id}/find-page")
async def find_quote_page(po_id: int, payload: FindPageRequest, db: Session = Depends(get_db)):
    import fitz
    record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.id == po_id).first()
    if not record or not record.pdf_file_path or not os.path.exists(record.pdf_file_path):
        raise HTTPException(status_code=404, detail="PDF file not found on server.")

    chunks = _split_quote_into_chunks(payload.quote)
    if not chunks:
        return {"matches": [], "page": 1}

    try:
        doc = fitz.open(record.pdf_file_path)
        pages_norm = [_normalize_ws(page.get_text("text")) for page in doc]
    except Exception as e:
        print(f"⚠️ find-page error opening PDF: {e}")
        return {"matches": [], "page": 1}

    matches = []
    for chunk in chunks:
        norm_chunk = _normalize_ws(chunk)
        if not norm_chunk:
            continue
        found_page = None
        for i, page_text in enumerate(pages_norm):
            if norm_chunk in page_text:
                found_page = i + 1
                break
        if found_page is None:
            short = norm_chunk[:60]
            for i, page_text in enumerate(pages_norm):
                if short and short in page_text:
                    found_page = i + 1
                    break
        if found_page is not None:
            matches.append({"quote": chunk, "page": found_page})

    return {
        "matches": matches,
        "page": matches[0]["page"] if matches else 1
    }


# ═══════════════════════════════════════════════════════════════════════════
#  DYNAMIC SCHEMA — Custom Field Management
# ═══════════════════════════════════════════════════════════════════════════

class CustomFieldCreate(BaseModel):
    name:        str
    key:         str
    description: str
    example:     Optional[str] = ""

class CustomFieldUpdate(BaseModel):
    name:        Optional[str]  = None
    description: Optional[str]  = None
    example:     Optional[str]  = None
    rerun:       Optional[bool] = False


def _gemini_extract_custom(all_text: str, field: dict) -> dict:
    from extractor.models import run_gemini_extraction
    from google.genai import types

    prompt = (
        f"You are an expert procurement AI. Extract the following field from this Purchase Order.\n"
        f"Field: {field['name']}\n"
        f"Description: {field['description']}\n"
        + (f"Example of what it looks like: {field['example']}\n" if field.get('example') else "")
        + "If the field is not present, output 'not_found'.\n"
        "Also provide the exact literal source_quote from the document.\n\n"
        f"Document Text:\n{all_text[:12000]}"
    )
    schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "value":        types.Schema(type=types.Type.STRING),
            "source_quote": types.Schema(type=types.Type.STRING),
        }
    )
    success, data = run_gemini_extraction(prompt, schema)
    if success and isinstance(data, dict):
        return {"value": data.get("value", "not_found"), "source_quote": data.get("source_quote", "")}
    return {"value": "not_found", "source_quote": ""}


@app.get("/api/schema")
def get_schema():
    return _load_schema()


@app.post("/api/schema")
async def create_custom_field(payload: CustomFieldCreate, db: Session = Depends(get_db)):
    fields = _load_schema()

    BUILT_IN_KEYS = BUILT_IN_COLS | {"line_items"}
    if payload.key in BUILT_IN_KEYS:
        raise HTTPException(status_code=400, detail="Cannot shadow a built-in field key.")
    if payload.key.startswith("_"):
        raise HTTPException(status_code=400, detail="Keys starting with '_' are reserved.")
    if any(f["key"] == payload.key for f in fields):
        raise HTTPException(status_code=409, detail="A custom field with that key already exists.")

    new_field = {
        "key":        payload.key,
        "name":       payload.name,
        "description": payload.description,
        "example":    payload.example or "",
        "created_at": datetime.utcnow().isoformat(),
    }
    fields.append(new_field)
    _save_schema(fields)

    records = db.query(PurchaseOrderRecord).all()
    updated = 0
    for record in records:
        if not record.pdf_file_path or not os.path.exists(record.pdf_file_path):
            continue
        try:
            from extractor.ingestion import extract_and_chunk_pdf
            from sqlalchemy.orm.attributes import flag_modified
            chunks   = extract_and_chunk_pdf(record.pdf_file_path)
            all_text = "\n".join(c["text"] for c in chunks)
            extracted = _gemini_extract_custom(all_text, new_field)
            custom = record.custom_fields or {}
            custom[payload.key] = extracted
            record.custom_fields = custom
            flag_modified(record, "custom_fields")
            updated += 1
        except Exception as e:
            print(f"⚠️ Back-fill failed for PO {record.id}: {e}")

    db.commit()
    return {"status": "created", "field": new_field, "backfilled": updated}


@app.patch("/api/schema/{field_key}")
async def update_custom_field(field_key: str, payload: CustomFieldUpdate, db: Session = Depends(get_db)):
    fields = _load_schema()
    idx = next((i for i, f in enumerate(fields) if f["key"] == field_key), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Custom field not found.")

    if payload.name:                      fields[idx]["name"]        = payload.name
    if payload.description:               fields[idx]["description"] = payload.description
    if payload.example is not None:       fields[idx]["example"]     = payload.example
    _save_schema(fields)

    rerun_count = 0
    if payload.rerun:
        from sqlalchemy.orm.attributes import flag_modified
        records = db.query(PurchaseOrderRecord).all()
        for record in records:
            if not record.pdf_file_path or not os.path.exists(record.pdf_file_path):
                continue
            try:
                from extractor.ingestion import extract_and_chunk_pdf
                chunks   = extract_and_chunk_pdf(record.pdf_file_path)
                all_text = "\n".join(c["text"] for c in chunks)
                extracted = _gemini_extract_custom(all_text, fields[idx])
                custom = record.custom_fields or {}
                custom[field_key] = extracted
                record.custom_fields = custom
                flag_modified(record, "custom_fields")
                rerun_count += 1
            except Exception as e:
                print(f"⚠️ Re-extract failed for PO {record.id}: {e}")
        db.commit()

    return {"status": "updated", "field": fields[idx], "rerun_count": rerun_count}


@app.delete("/api/schema/{field_key}")
async def delete_custom_field(field_key: str, db: Session = Depends(get_db)):
    fields = _load_schema()
    before = len(fields)
    fields = [f for f in fields if f["key"] != field_key]
    if len(fields) == before:
        raise HTTPException(status_code=404, detail="Custom field not found.")
    _save_schema(fields)

    from sqlalchemy.orm.attributes import flag_modified
    records = db.query(PurchaseOrderRecord).all()
    for record in records:
        custom = record.custom_fields or {}
        if field_key in custom:
            custom.pop(field_key)
            record.custom_fields = custom
            flag_modified(record, "custom_fields")
    db.commit()
    return {"status": "deleted", "key": field_key}