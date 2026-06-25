from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import shutil
import os
import uuid
import hashlib

# Updated Imports using the new folder structure
from database.connection import engine, Base, get_db
from database.models import PurchaseOrderRecord

from extractor.ingestion import extract_and_chunk_pdf
from extractor.extraction import extract_contract_profile_with_combined_pipeline

# Automatically create the database tables if they don't exist
Base.metadata.create_all(bind=engine)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# 1. 🆕 Change to permanent storage so the frontend can request the PDF later!
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

    # ==========================================
    # IF NO CACHE HIT: Proceed with AI Extraction
    # ==========================================
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
    """Fetches a lightweight list of all processed POs for the sidebar."""
    records = db.query(PurchaseOrderRecord).order_by(PurchaseOrderRecord.created_at.desc()).all()
    return [{"id": r.id, "filename": r.filename, "status": r.status} for r in records]

@app.get("/api/pos/{po_id}")
async def get_po_details(po_id: int, db: Session = Depends(get_db)):
    """Fetches the full extracted details of a specific PO."""
    record = db.query(PurchaseOrderRecord).filter(PurchaseOrderRecord.id == po_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="PO not found")
        
    quotes = record.source_quotes or {}
    
    # Reconstruct the profile
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
    
    return {"filename": record.filename, "db_id": record.id, "extraction_result": {"status": "success", "profile": cached_profile}}