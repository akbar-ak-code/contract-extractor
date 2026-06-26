# main.py
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel
import shutil
import os
import uuid
import hashlib

from database.connection import engine, Base, get_db
from database.models import PurchaseOrderRecord, CustomField
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

# ---------------------------------------------------------
# 🆕 FEATURE A: SCHEMA MANAGEMENT & BACKFILL LOGIC
# ---------------------------------------------------------
class CustomFieldCreate(BaseModel):
    name: str
    description: str
    example: str = None

def backfill_new_field(field_id: int, db: Session):
    print(f"🔄 Starting backfill for field ID {field_id}...")
    field = db.query(CustomField).filter(CustomField.id == field_id).first()
    if not field: return
    
    all_pos = db.query(PurchaseOrderRecord).all()
    for po in all_pos:
        try:
            chunks = extract_and_chunk_pdf(po.pdf_file_path)
            # Run extraction just passing the new field
            result = extract_contract_profile_with_combined_pipeline(
                chunks, po.filename, [{"name": field.name, "description": field.description, "example": field.example}]
            )
            
            # Merge old custom data with new
            current_custom_data = dict(po.custom_extracted_data) if po.custom_extracted_data else {}
            new_custom_data = result.get("custom_profile", {})
            current_custom_data.update(new_custom_data)
            
            po.custom_extracted_data = current_custom_data
            flag_modified(po, "custom_extracted_data") # Force SQLAlchemy to save JSON update
            db.commit()
            print(f"✅ Backfilled PO ID {po.id}")
        except Exception as e:
            print(f"⚠️ Backfill failed for PO ID {po.id}: {e}")
            db.rollback()

@app.get("/api/schema")
async def get_schema(db: Session = Depends(get_db)):
    fields = db.query(CustomField).all()
    return [{"id": f.id, "name": f.name, "description": f.description, "example": f.example} for f in fields]

@app.post("/api/schema")
async def add_custom_field(field: CustomFieldCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    new_field = CustomField(name=field.name, description=field.description, example=field.example)
    db.add(new_field)
    db.commit()
    db.refresh(new_field)
    
    # Trigger Backfill in background
    background_tasks.add_task(backfill_new_field, new_field.id, db)
    return {"status": "success", "message": f"Field '{new_field.name}' added. Backfilling started."}

@app.delete("/api/schema/{field_id}")
async def delete_custom_field(field_id: int, db: Session = Depends(get_db)):
    field = db.query(CustomField).filter(CustomField.id == field_id).first()
    if not field: raise HTTPException(status_code=404, detail="Field not found")
    db.delete(field)
    db.commit()
    return {"status": "success", "message": "Field deleted."}

# ---------------------------------------------------------
# CORE API ENDPOINTS
# ---------------------------------------------------------
@app.post("/api/view-chunks")
async def view_chunks(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'): raise HTTPException(status_code=400, detail="Invalid file type.")
    file_path = os.path.join(PERMANENT_STORAGE_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
        chunks = extract_and_chunk_pdf(file_path)
        return {"filename": file.filename, "total_chunks_created": len(chunks), "chunks": chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_path): os.remove(file_path)

@app.post("/api/upload")
async def process_contract_profile(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith('.pdf'): raise HTTPException(status_code=400, detail="Invalid file type.")
    
    file_bytes = await file.read()
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    await file.seek(0) 
    
    existing_record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.file_hash == file_hash).first()
    
    if existing_record:
        print(f"🎯 DATABASE CACHE HIT: File '{file.filename}'")
        quotes = existing_record.source_quotes or {}
        cached_profile = {
            "po_number": {"value": existing_record.po_number, "source_quote": quotes.get("po_number", ""), "model_used": "Database"},
            "vendor_name": {"value": existing_record.vendor_name, "source_quote": quotes.get("vendor_name", ""), "model_used": "Database"},
            "vendor_contact_address": {"value": existing_record.vendor_contact_address, "source_quote": quotes.get("vendor_contact_address", ""), "model_used": "Database"},
            "effective_date": {"value": existing_record.effective_date, "source_quote": quotes.get("effective_date", ""), "model_used": "Database"},
            "lapse_expiry_date": {"value": existing_record.lapse_expiry_date, "source_quote": quotes.get("lapse_expiry_date", ""), "model_used": "Database"},
            "total_value": {"value": existing_record.total_value, "source_quote": quotes.get("total_value", ""), "model_used": "Database"},
            "conditions_of_agreement": {"value": existing_record.conditions_of_agreement, "source_quote": quotes.get("conditions_of_agreement", ""), "model_used": "Database"},
            "conditions_of_payment": {"value": existing_record.conditions_of_payment, "source_quote": quotes.get("conditions_of_payment", ""), "model_used": "Database"},
            "authorising_signatory": {"value": existing_record.authorising_signatory, "source_quote": quotes.get("authorising_signatory", ""), "model_used": "Database"},
            "line_items": {"status": "found" if existing_record.line_items else "not_found", "value": existing_record.line_items, "model_used": "Database"}
        }
        # Merge Custom Fields into profile for frontend
        custom_data = existing_record.custom_extracted_data or {}
        cached_profile.update(custom_data)
        
        return {"filename": existing_record.filename, "db_id": existing_record.id, "extraction_result": {"status": "success", "profile": cached_profile}}

    # NO CACHE HIT
    print(f"⚙️ NO CACHE FOUND. Running AI Pipeline for: {file.filename}")
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(PERMANENT_STORAGE_DIR, unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 🆕 Fetch Custom Fields
        custom_fields_db = db.query(CustomField).all()
        custom_fields_list = [{"name": f.name, "description": f.description, "example": f.example} for f in custom_fields_db]

        chunks = extract_and_chunk_pdf(file_path)
        result = extract_contract_profile_with_combined_pipeline(chunks, file.filename, custom_fields_list)
        
        if result.get("status") == "failed": raise HTTPException(status_code=500, detail="Extraction failed")
            
        profile = result.get("profile", {})
        custom_profile = result.get("custom_profile", {}) # 🆕 Get custom results
        
        def get_val(field): return profile.get(field, {}).get("value", "not_found")
        def get_quote(field): return profile.get(field, {}).get("source_quote", "Quote missing")

        quotes_dict = {
            "po_number": get_quote("po_number"), "vendor_name": get_quote("vendor_name"),
            "vendor_contact_address": get_quote("vendor_contact_address"), "effective_date": get_quote("effective_date"),
            "lapse_expiry_date": get_quote("lapse_expiry_date"), "total_value": get_quote("total_value"),
            "conditions_of_agreement": get_quote("conditions_of_agreement"), "conditions_of_payment": get_quote("conditions_of_payment"),
            "authorising_signatory": get_quote("authorising_signatory"),
        }
            
        db_record = PurchaseOrderRecord(
            filename=file.filename, file_hash=file_hash, pdf_file_path=file_path,
            po_number=get_val("po_number"), vendor_name=get_val("vendor_name"),
            vendor_contact_address=get_val("vendor_contact_address"), effective_date=get_val("effective_date"),
            lapse_expiry_date=get_val("lapse_expiry_date"), total_value=get_val("total_value"),
            conditions_of_agreement=get_val("conditions_of_agreement"), conditions_of_payment=get_val("conditions_of_payment"),
            authorising_signatory=get_val("authorising_signatory"), line_items=get_val("line_items"),
            source_quotes=quotes_dict, status="Pending Review",
            custom_extracted_data=custom_profile # 🆕 Save custom data
        )
        
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        
        # Merge for initial response
        result["profile"].update(custom_profile)
        
        return {"filename": file.filename, "db_id": db_record.id, "extraction_result": result}
        
    except Exception as e:
        print(f"🔴 System Level Error: {str(e)}")
        if os.path.exists(file_path): os.remove(file_path)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/pos")
async def get_po_history(db: Session = Depends(get_db)):
    records = db.query(PurchaseOrderRecord).order_by(PurchaseOrderRecord.created_at.desc()).all()
    return [{"id": r.id, "filename": r.filename, "status": r.status, "po_number": r.po_number, "lapse_expiry_date": r.lapse_expiry_date} for r in records]

@app.get("/api/pos/{po_id}")
async def get_po_details(po_id: int, db: Session = Depends(get_db)):
    record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.id == po_id).first()
    if not record: raise HTTPException(status_code=404, detail="PO not found")
        
    quotes = record.source_quotes or {}
    cached_profile = {
        "po_number": {"value": record.po_number, "source_quote": quotes.get("po_number", ""), "model_used": "Database"},
        "vendor_name": {"value": record.vendor_name, "source_quote": quotes.get("vendor_name", ""), "model_used": "Database"},
        "vendor_contact_address": {"value": record.vendor_contact_address, "source_quote": quotes.get("vendor_contact_address", ""), "model_used": "Database"},
        "effective_date": {"value": record.effective_date, "source_quote": quotes.get("effective_date", ""), "model_used": "Database"},
        "lapse_expiry_date": {"value": record.lapse_expiry_date, "source_quote": quotes.get("lapse_expiry_date", ""), "model_used": "Database"},
        "total_value": {"value": record.total_value, "source_quote": quotes.get("total_value", ""), "model_used": "Database"},
        "conditions_of_agreement": {"value": record.conditions_of_agreement, "source_quote": quotes.get("conditions_of_agreement", ""), "model_used": "Database"},
        "conditions_of_payment": {"value": record.conditions_of_payment, "source_quote": quotes.get("conditions_of_payment", ""), "model_used": "Database"},
        "authorising_signatory": {"value": record.authorising_signatory, "source_quote": quotes.get("authorising_signatory", ""), "model_used": "Database"},
        "line_items": {"status": "found" if record.line_items else "not_found", "value": record.line_items, "model_used": "Database"}
    }
    
    # 🆕 Merge Custom Fields for frontend
    custom_data = record.custom_extracted_data or {}
    cached_profile.update(custom_data)
    
    return {"filename": record.filename, "db_id": record.id, "extraction_result": {"status": "success", "profile": cached_profile}}