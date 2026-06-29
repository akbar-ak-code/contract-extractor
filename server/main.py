from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import shutil
import os
import uuid
import hashlib
from datetime import datetime
from fastapi.responses import FileResponse

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

@app.post("/api/view-chunks")
async def view_chunks(file: UploadFile = File(...)):
    """Handles PDF upload and returns the segmented text chunks for review."""
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
    """Ingests a PDF, checks the cryptographic hash for caching, and processes via AI if new."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF extensions are supported.")
    
    # 1. 🔐 Cryptographic Hashing (The Cache Engine)
    file_bytes = await file.read()
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    
    # Reset the file pointer back to the beginning so we can save it to disk later!
    await file.seek(0) 
    
    # 2. 🔍 Check Database for a Cache Hit
    existing_record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.file_hash == file_hash).first()
    
    if existing_record:
        print(f"🎯 DATABASE CACHE HIT: File '{file.filename}' already processed. Skipping AI.")
        
        # Safely fetch the quotes JSON from the DB
        quotes = existing_record.source_quotes or {}
        
        # Reconstruct the profile exactly how the React frontend expects it (now with quotes!)
        cached_profile = {
            "po_number": {"value": existing_record.po_number, "source_quote": quotes.get("po_number", ""), "model_used": "Database Cache"},
            "vendor_name": {"value": existing_record.vendor_name, "source_quote": quotes.get("vendor_name", ""), "model_used": "Database Cache"},
            "vendor_contact_address": {"value": existing_record.vendor_contact_address, "source_quote": quotes.get("vendor_contact_address", ""), "model_used": "Database Cache"},
            "effective_date": {"value": existing_record.effective_date, "source_quote": quotes.get("effective_date", ""), "model_used": "Database Cache"},
            "lapse_expiry_date": {"value": existing_record.lapse_expiry_date, "source_quote": quotes.get("lapse_expiry_date", ""), "model_used": "Database Cache"},
            "total_value": {"value": existing_record.total_value, "source_quote": quotes.get("total_value", ""), "model_used": "Database Cache"},
            "conditions_of_agreement": {"value": existing_record.conditions_of_agreement, "source_quote": quotes.get("conditions_of_agreement", ""), "model_used": "Database Cache"},
            "conditions_of_payment": {"value": existing_record.conditions_of_payment, "source_quote": quotes.get("conditions_of_payment", ""), "model_used": "Database Cache"},
            "authorising_signatory": {"value": existing_record.authorising_signatory, "source_quote": quotes.get("authorising_signatory", ""), "model_used": "Database Cache"},
            "line_items": {"status": "found" if existing_record.line_items else "not_found", "value": existing_record.line_items, "model_used": "Database Cache"}
        }
        
        return {
            "filename": existing_record.filename, 
            "db_id": existing_record.id,
            "extraction_result": {"status": "success", "profile": cached_profile}
        }


    print(f"⚙️ NO CACHE FOUND. Running AI Pipeline for: {file.filename}")
    
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(PERMANENT_STORAGE_DIR, unique_filename)
    
    try:
        # Save the physical file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Run AI Extraction
        chunks = extract_and_chunk_pdf(file_path)
        result = extract_contract_profile_with_combined_pipeline(chunks, file.filename)
        
        if result.get("status") == "failed":
            raise HTTPException(status_code=500, detail=result.get("message"))
            
        profile = result.get("profile", {})
        
        def get_val(field):
            return profile.get(field, {}).get("value", "not_found")
            
        def get_quote(field):
            return profile.get(field, {}).get("source_quote", "Quote missing")

        # 🔎 Pack all quotes into one dictionary
        quotes_dict = {
            "po_number": get_quote("po_number"),
            "vendor_name": get_quote("vendor_name"),
            "vendor_contact_address": get_quote("vendor_contact_address"),
            "effective_date": get_quote("effective_date"),
            "lapse_expiry_date": get_quote("lapse_expiry_date"),
            "total_value": get_quote("total_value"),
            "conditions_of_agreement": get_quote("conditions_of_agreement"),
            "conditions_of_payment": get_quote("conditions_of_payment"),
            "authorising_signatory": get_quote("authorising_signatory"),
        }
            
        # Insert into Database WITH THE NEW HASH AND QUOTES
        db_record = PurchaseOrderRecord(
            filename=file.filename,
            file_hash=file_hash, # <--- 🔐 Saving the hash!
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
            source_quotes=quotes_dict, # <--- 🔎 Saving the quotes to the DB!
            status="Pending Review"
        )
        
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        
        return {
            "filename": file.filename, 
            "db_id": db_record.id,
            "extraction_result": result
        }
        
    except Exception as e:
        print(f"🔴 System Level Error: {str(e)}")
        if os.path.exists(file_path): 
            os.remove(file_path)
        raise HTTPException(status_code=500, detail="An internal server error occurred during extraction.")
@app.get("/api/pos")
async def get_po_history(db: Session = Depends(get_db)):
    """Fetches history AND the extracted dates for the Calendar UI."""
    records = db.query(PurchaseOrderRecord).order_by(PurchaseOrderRecord.created_at.desc()).all()
    return [
        {
            "id": r.id, 
            "filename": r.filename, 
            "status": r.status,
            "po_number": r.po_number,                
            "lapse_expiry_date": r.lapse_expiry_date 
        } for r in records
    ]

@app.delete("/api/pos/{po_id}")
async def delete_purchase_order(po_id: int, db: Session = Depends(get_db)):
    """Deletes a PO from the database and removes the physical file."""
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
    """Updates a single field and logs the change in edit_history."""
    record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.id == po_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="PO not found")

    field = payload.get("field")
    new_value = payload.get("value")

    # Determine if this is a built-in column or a custom JSON field
    BUILT_IN_COLS = {"po_number","vendor_name","vendor_contact_address","effective_date",
                     "lapse_expiry_date","total_value","conditions_of_agreement",
                     "conditions_of_payment","authorising_signatory"}

    if field in BUILT_IN_COLS:
        old_value = getattr(record, field, None)
        setattr(record, field, new_value)
    else:
        # Custom field — stored in the custom_fields JSON column
        custom = record.custom_fields or {}
        old_value = custom.get(field, {}).get("value", None) if isinstance(custom.get(field), dict) else custom.get(field)
        custom[field] = {**(custom.get(field) or {}), "value": new_value}
        record.custom_fields = custom
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(record, "custom_fields")
    history_log = record.edit_history or []
    history_log.append({
        "field": field,
        "old_value": old_value,
        "new_value": new_value,
        "timestamp": datetime.utcnow().isoformat()
    })

    # Update the actual column and the history JSON
    setattr(record, field, new_value)
    record.edit_history = history_log
    
    # Optional: Change status to indicate human review
    record.status = "Manually Verified" 

    db.commit()
    return {"status": "success", "message": f"{field} updated"}
@app.get("/api/pos/{po_id}")
async def get_po_details(po_id: int, db: Session = Depends(get_db)):
    """Fetches the full extracted details of a specific PO, including edit history."""
    record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.id == po_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="PO not found")
        
    quotes = record.source_quotes or {}
    full_history = record.edit_history or []

    # Helper function to grab history for just one specific field
    def get_hist(field_name):
        return [h for h in full_history if h.get("field") == field_name]
    
    # Reconstruct the profile with the new history array attached to every field!
    cached_profile = {
        "po_number": {"value": record.po_number, "source_quote": quotes.get("po_number", ""), "history": get_hist("po_number")},
        "vendor_name": {"value": record.vendor_name, "source_quote": quotes.get("vendor_name", ""), "history": get_hist("vendor_name")},
        "vendor_contact_address": {"value": record.vendor_contact_address, "source_quote": quotes.get("vendor_contact_address", ""), "history": get_hist("vendor_contact_address")},
        "effective_date": {"value": record.effective_date, "source_quote": quotes.get("effective_date", ""), "history": get_hist("effective_date")},
        "lapse_expiry_date": {"value": record.lapse_expiry_date, "source_quote": quotes.get("lapse_expiry_date", ""), "history": get_hist("lapse_expiry_date")},
        "total_value": {"value": record.total_value, "source_quote": quotes.get("total_value", ""), "history": get_hist("total_value")},
        "conditions_of_agreement": {"value": record.conditions_of_agreement, "source_quote": quotes.get("conditions_of_agreement", ""), "history": get_hist("conditions_of_agreement")},
        "conditions_of_payment": {"value": record.conditions_of_payment, "source_quote": quotes.get("conditions_of_payment", ""), "history": get_hist("conditions_of_payment")},
        "authorising_signatory": {"value": record.authorising_signatory, "source_quote": quotes.get("authorising_signatory", ""), "history": get_hist("authorising_signatory")},
        "line_items": {"status": "found" if record.line_items else "not_found", "value": record.line_items}
    }
    
    # Attach any custom fields stored on this record
    custom_schema = _load_schema()
    custom_data = record.custom_fields or {}
    for cf in custom_schema:
        k = cf["key"]
        entry = custom_data.get(k, {})
        cached_profile[k] = {
            "value": entry.get("value", "not_found"),
            "source_quote": entry.get("source_quote", ""),
            "history": get_hist(k),
            "_custom": True,   # flag so frontend knows it's custom
            "_meta": cf,       # pass name/description through
        }

    return {"filename": record.filename, "db_id": record.id, "extraction_result": {"status": "success", "profile": cached_profile}}

@app.get("/api/pos/{po_id}/pdf")
async def get_po_pdf(po_id: int, db: Session = Depends(get_db)):
    """Serves the physical PDF file for the in-app viewer."""
    record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.id == po_id).first()
    
    if not record or not record.pdf_file_path or not os.path.exists(record.pdf_file_path):
        raise HTTPException(status_code=404, detail="PDF file not found on server.")
        
    return FileResponse(record.pdf_file_path, media_type="application/pdf")

@app.get("/api/pos/{po_id}/find-page")
async def find_quote_page(po_id: int, quote: str, db: Session = Depends(get_db)):
    """Searches the PDF text layer to find which page number contains the given quote."""
    import fitz
    record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.id == po_id).first()
    
    if not record or not record.pdf_file_path or not os.path.exists(record.pdf_file_path):
        raise HTTPException(status_code=404, detail="PDF file not found on server.")

    search_snippet = quote.strip()[:60].lower()
    if not search_snippet:
        return {"page": 1}

    try:
        doc = fitz.open(record.pdf_file_path)
        # First pass: try matching first 60 chars
        for i, page in enumerate(doc):
            page_text = page.get_text("text").lower()
            if search_snippet in page_text:
                return {"page": i + 1}
        # Second pass: try shorter 30-char snippet (handles minor whitespace differences)
        short_snippet = search_snippet[:30]
        for i, page in enumerate(doc):
            page_text = page.get_text("text").lower()
            if short_snippet in page_text:
                return {"page": i + 1}
    except Exception as e:
        print(f"⚠️ find-page error: {e}")

    return {"page": 1}


# ═══════════════════════════════════════════════════════════════════════════
#  DYNAMIC SCHEMA — Custom Field Management
# ═══════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel
from typing import Optional

class CustomFieldCreate(BaseModel):
    name: str          # human-readable label, e.g. "Warranty Period"
    key: str           # snake_case identifier, e.g. "warranty_period"
    description: str   # prompt / hint for Gemini
    example: Optional[str] = ""  # optional example string

class CustomFieldUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    example: Optional[str] = None
    rerun: Optional[bool] = False   # if True, re-extract across all POs

# ── In-memory + file persistence for custom fields ───────────────────────
# We use a simple JSON file so no schema migration is needed on the DB.
SCHEMA_FILE = "data/custom_fields.json"
os.makedirs("data", exist_ok=True)

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

import json

# ── Helper: extract a single custom field from text via Gemini ────────────
def _gemini_extract_custom(all_text: str, field: dict) -> dict:
    """Ask Gemini to extract one custom field; returns {value, source_quote}."""
    from extractor.models import run_gemini_extraction
    from google.genai import types

    prompt = (
        f"You are an expert procurement AI. Extract the following field from this Purchase Order.\n"
        f"Field: {field['name']}\n"
        f"Description: {field['description']}\n"
        + (f"Example of what it looks like: {field['example']}\n" if field.get('example') else "")
        + f"If the field is not present, output 'not_found'.\n"
        f"Also provide the exact literal source_quote from the document.\n\n"
        f"Document Text:\n{all_text[:12000]}"
    )
    schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "value": types.Schema(type=types.Type.STRING),
            "source_quote": types.Schema(type=types.Type.STRING),
        }
    )
    success, data = run_gemini_extraction(prompt, schema)
    if success and isinstance(data, dict):
        return {"value": data.get("value", "not_found"), "source_quote": data.get("source_quote", "")}
    return {"value": "not_found", "source_quote": ""}


@app.get("/api/schema")
def get_schema():
    """Return all custom fields."""
    return _load_schema()


@app.post("/api/schema")
async def create_custom_field(payload: CustomFieldCreate, db: Session = Depends(get_db)):
    """
    Add a new custom field and immediately back-fill it for all existing POs.
    """
    fields = _load_schema()

    # Guard: key must be unique and not shadow a built-in
    BUILT_IN_KEYS = {"po_number","vendor_name","vendor_contact_address","effective_date",
                     "lapse_expiry_date","total_value","conditions_of_agreement",
                     "conditions_of_payment","authorising_signatory","line_items"}
    if payload.key in BUILT_IN_KEYS:
        raise HTTPException(status_code=400, detail="Cannot shadow a built-in field key.")
    if any(f["key"] == payload.key for f in fields):
        raise HTTPException(status_code=409, detail="A custom field with that key already exists.")

    new_field = {
        "key": payload.key,
        "name": payload.name,
        "description": payload.description,
        "example": payload.example or "",
        "created_at": datetime.utcnow().isoformat(),
    }
    fields.append(new_field)
    _save_schema(fields)

    # Back-fill: extract this field for every PO that has a stored PDF
    records = db.query(PurchaseOrderRecord).all()
    updated = 0
    for record in records:
        if not record.pdf_file_path or not os.path.exists(record.pdf_file_path):
            continue
        try:
            from extractor.ingestion import extract_and_chunk_pdf
            chunks = extract_and_chunk_pdf(record.pdf_file_path)
            all_text = "\n".join(c["text"] for c in chunks)
            extracted = _gemini_extract_custom(all_text, new_field)

            custom = record.custom_fields or {}
            custom[payload.key] = extracted
            record.custom_fields = custom
            # trigger SQLAlchemy change detection on JSON column
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(record, "custom_fields")
            updated += 1
        except Exception as e:
            print(f"⚠️ Back-fill failed for PO {record.id}: {e}")

    db.commit()
    return {"status": "created", "field": new_field, "backfilled": updated}


@app.patch("/api/schema/{field_key}")
async def update_custom_field(field_key: str, payload: CustomFieldUpdate, db: Session = Depends(get_db)):
    """
    Edit a custom field's name/description/example.
    If payload.rerun is True, re-extract from all POs.
    """
    fields = _load_schema()
    idx = next((i for i, f in enumerate(fields) if f["key"] == field_key), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Custom field not found.")

    if payload.name:        fields[idx]["name"] = payload.name
    if payload.description: fields[idx]["description"] = payload.description
    if payload.example is not None: fields[idx]["example"] = payload.example
    _save_schema(fields)

    rerun_count = 0
    if payload.rerun:
        records = db.query(PurchaseOrderRecord).all()
        for record in records:
            if not record.pdf_file_path or not os.path.exists(record.pdf_file_path):
                continue
            try:
                from extractor.ingestion import extract_and_chunk_pdf
                chunks = extract_and_chunk_pdf(record.pdf_file_path)
                all_text = "\n".join(c["text"] for c in chunks)
                extracted = _gemini_extract_custom(all_text, fields[idx])
                custom = record.custom_fields or {}
                custom[field_key] = extracted
                record.custom_fields = custom
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(record, "custom_fields")
                rerun_count += 1
            except Exception as e:
                print(f"⚠️ Re-extract failed for PO {record.id}: {e}")
        db.commit()

    return {"status": "updated", "field": fields[idx], "rerun_count": rerun_count}


@app.delete("/api/schema/{field_key}")
async def delete_custom_field(field_key: str, db: Session = Depends(get_db)):
    """Delete a custom field and scrub it from all PO records."""
    fields = _load_schema()
    before = len(fields)
    fields = [f for f in fields if f["key"] != field_key]
    if len(fields) == before:
        raise HTTPException(status_code=404, detail="Custom field not found.")
    _save_schema(fields)

    # Remove from every PO's custom_fields JSON
    records = db.query(PurchaseOrderRecord).all()
    for record in records:
        custom = record.custom_fields or {}
        if field_key in custom:
            custom.pop(field_key)
            record.custom_fields = custom
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(record, "custom_fields")
    db.commit()

    return {"status": "deleted", "key": field_key}
