from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os

from extractor.ingestion import extract_and_chunk_pdf
from extractor.extraction import extract_contract_profile_with_combined_pipeline

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/view-chunks")
async def view_chunks(file: UploadFile = File(...)):
    """Handles PDF upload and returns the segmented text chunks for review."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF extensions are supported.")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
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
async def process_contract_profile(file: UploadFile = File(...)):
    """Ingests a PDF contract and processes it through the hybrid extraction pipeline."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF extensions are supported.")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        chunks = extract_and_chunk_pdf(file_path)
        
        # Dispatch to the smart-routing pipeline
        result = extract_contract_profile_with_combined_pipeline(chunks, file.filename)
        
        if result.get("status") == "failed":
            raise HTTPException(status_code=500, detail=result.get("message"))
            
        return {"filename": file.filename, "extraction_result": result}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"🔴 System Level Error: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal server error occurred during extraction.")
    finally:
        if os.path.exists(file_path): 
            os.remove(file_path)