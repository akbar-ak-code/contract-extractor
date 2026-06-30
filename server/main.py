from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
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
    """
    Reconstruct the full profile dict the React frontend expects from a DB record.
    Includes built-in fields, dynamic/deep-analysis fields, and user custom fields.
    """
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

    # ── Deep analysis (deadlines / anomalies / metadata) ─────────────────
    if "_deep_analysis" in custom_data:
        profile["_deep_analysis"] = custom_data["_deep_analysis"]

    # ── User-defined custom fields ────────────────────────────────────────
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
async def process_contract_profile(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Ingests a PDF, checks hash for caching, and processes via AI if new."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF extensions are supported.")

    file_bytes = await file.read()
    file_hash  = hashlib.sha256(file_bytes).hexdigest()
    await file.seek(0)

    # ── Cache hit ──────────────────────────────────────────────────────────
    existing_record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.file_hash == file_hash).first()
    if existing_record:
        print(f"🎯 DATABASE CACHE HIT: {file.filename}")
        return {
            "filename": existing_record.filename,
            "db_id":    existing_record.id,
            "extraction_result": {
                "status":  "success",
                "profile": _build_profile_from_record(existing_record)
            }
        }

    print(f"⚙️ NO CACHE FOUND. Running AI Pipeline for: {file.filename}")

    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(PERMANENT_STORAGE_DIR, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        chunks = extract_and_chunk_pdf(file_path)
        result = extract_contract_profile_with_combined_pipeline(chunks, file.filename)

        if result.get("status") == "failed":
            raise HTTPException(status_code=500, detail=result.get("message"))

        profile      = result.get("profile", {})
        deep_analysis = result.get("deep_analysis", {})

        def get_val(field):
            return profile.get(field, {}).get("value", "not_found")

        def get_quote(field):
            return profile.get(field, {}).get("source_quote", "Quote missing")

        quotes_dict = {f: get_quote(f) for f in BUILT_IN_COLS}

        # Store deep analysis inside custom_fields JSON under reserved key
        initial_custom_fields = {}
        if deep_analysis:
            initial_custom_fields["_deep_analysis"] = deep_analysis

        db_record = PurchaseOrderRecord(
            filename=file.filename,
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

        db.add(db_record)
        db.commit()
        db.refresh(db_record)

        # Attach deep_analysis to the profile before returning so UI shows it immediately
        if deep_analysis:
            profile["_deep_analysis"] = deep_analysis

        return {
            "filename": file.filename,
            "db_id":    db_record.id,
            "extraction_result": {"status": "success", "profile": profile}
        }

    except Exception as e:
        print(f"🔴 System Level Error: {str(e)}")
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail="An internal server error occurred during extraction.")


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
            print(f"🗑️ Deleted physical file: {record.pdf_file_path}")
        except Exception as e:
            print(f"⚠️ Warning: Could not delete physical file: {e}")
    db.delete(record)
    db.commit()
    return {"status": "success", "message": f"PO {po_id} deleted successfully"}


@app.patch("/api/pos/{po_id}/field")
async def update_po_field(po_id: int, payload: dict, db: Session = Depends(get_db)):
    """Updates a single field value and appends to edit_history."""
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
        custom["_deep_analysis"] = new_value  # Save directly, no {"value": ...} wrapper
        record.custom_fields = custom
        flag_modified(record, "custom_fields")
    else:
        # Custom JSON field — never call setattr on a non-column name
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
    """Collapses all whitespace runs to a single space. Real PDFs frequently break
    label/value pairs and table cells across lines (e.g. 'Our Order No: \\n4800178856-4'),
    which makes raw substring search against AI-extracted quotes fail even when the
    quote is genuinely verbatim. Normalizing both sides before comparing fixes that."""
    return re.sub(r"\s+", " ", s or "").strip().lower()


def _split_quote_into_chunks(quote, max_chunks=25, min_words=4, min_chars=15):
    """Splits a (possibly long) AI-extracted quote into sentence-level pieces.

    Long composite quotes (e.g. conditions_of_agreement) are often assembled by the
    AI from several non-contiguous clauses scattered across the document, so they
    can almost never be located as a single span. Short quotes are already a single
    locatable unit and are returned unchanged. This is pure text splitting — it does
    not call the AI and does not change what was extracted, only how it's searched for."""
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
        # Skip duplicate sentences (e.g. Gemini sometimes repeats an amendment note
        # verbatim within the same quote). Without this, the same text would appear
        # as two separate "excerpts" pointing at the identical highlighted location.
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
    """
    Locates an AI-extracted quote inside the source PDF. The quote is split into
    sentence-level chunks and matched against each page with whitespace normalized
    on both sides. Returns every chunk that was actually found, each tagged with its
    page — so a long composite quote resolves to several correctly-placed highlights
    instead of one unreliable single-page jump, and short quotes resolve exactly as
    before (just more reliably, since whitespace differences no longer break the match).

    POST + body (not GET + query param) so the full quote can be sent regardless of
    length — the previous GET version had to truncate to 100 chars to avoid HTTP 414,
    which silently dropped everything past that point.
    """
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
    """Ask Gemini to extract one custom field; returns {value, source_quote}."""
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

    # Back-fill across all existing POs
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
