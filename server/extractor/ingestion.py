import fitz  # PyMuPDF

def extract_and_chunk_pdf(file_path: str):
    """Extracts text from a PO by chunking at the PAGE level to preserve tabular row integrity."""
    doc = fitz.open(file_path)
    cleaned_chunks = []
    
    for index, page in enumerate(doc):
        # Extracting text page-by-page prevents breaking tabular line items across chunks
        chunk_text = page.get_text("text").strip()
        
        if not chunk_text:
            continue
            
        first_line = chunk_text.split('\n')[0][:50]
        
        cleaned_chunks.append({
            "chunk_id": index,
            "heading": f"Page {index + 1}: {first_line}",
            "text": chunk_text
        })
        
    return cleaned_chunks