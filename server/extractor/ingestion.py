import fitz  # PyMuPDF
import re

def extract_and_chunk_pdf(file_path: str):
    """Extracts text from a PDF and segments it into semantic chunks based on contract structure."""
    
    doc = fitz.open(file_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text("text") + "\n"

    # Regex pattern to identify standard legal contract section boundaries 
    # (e.g., "Section 1", "ARTICLE II", numbered clauses like "1.1", and capitalized headings).
    section_pattern = re.compile(
        r'(?=\b(?:Section|Article|SECTION|ARTICLE)\s+[\dIVX]+\b|\b\d+\.\d+\s+[A-Z]|\n[A-Z\s]{5,}\n)'
    )
    
    raw_chunks = section_pattern.split(full_text)
    cleaned_chunks = []
    
    for index, chunk in enumerate(raw_chunks):
        chunk_text = chunk.strip()
        if not chunk_text:
            continue
            
        # Extract a brief title for the chunk from its first line for debugging/UI purposes
        first_line = chunk_text.split('\n')[0][:50]
        
        cleaned_chunks.append({
            "chunk_id": index,
            "heading": first_line if len(first_line) > 5 else f"Chunk {index}",
            "text": chunk_text
        })
        
    return cleaned_chunks