import time
import json
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForQuestionAnswering
from google.genai import Client
from google.genai import types
from .config import LOCAL_MODEL_NAME, GEMINI_API_KEY

print("⏳ Initializing Local CUAD RoBERTa Model...")
try:
    local_tokenizer = AutoTokenizer.from_pretrained(LOCAL_MODEL_NAME)
    local_model = AutoModelForQuestionAnswering.from_pretrained(LOCAL_MODEL_NAME)
    print("🟢 Local Model Successfully Mounted.")
except Exception as e:
    print(f"🔴 Local Model failed to load: {e}")
    local_model = None

def run_local_extraction(text, query):
    if not local_model or not text.strip():
        return {"value": "Not found in contract", "confidence": 0.0}
        
    try:
        inputs = local_tokenizer(query, text, return_tensors="pt", truncation=True, max_length=512)
        with torch.no_grad():
            outputs = local_model(**inputs)
            
        start_probs = F.softmax(outputs.start_logits, dim=-1)[0]
        end_probs = F.softmax(outputs.end_logits, dim=-1)[0]
        
        start_idx = torch.argmax(start_probs)
        end_idx = torch.argmax(end_probs)
        
        confidence = (start_probs[start_idx] * end_probs[end_idx]).item() * 100
        
        if start_idx > end_idx or start_idx == 0:
            return {"value": "Not found in contract", "confidence": 0.0}
            
        tokens = inputs.input_ids[0, start_idx : end_idx + 1]
        val = local_tokenizer.decode(tokens, skip_special_tokens=True).strip()
        
        return {"value": val if val else "Not found in contract", "confidence": round(confidence, 1)}
    except Exception as e:
        print(f"⚠️ Local Extraction Error: {e}")
        return {"value": "Not found in contract", "confidence": 0.0}

def run_smart_sliding_window_extraction(full_text, query):
    words = full_text.split()
    CHUNK_SIZE = 350 
    OVERLAP = 50
    best_result = {"value": "Not found in contract", "confidence": 0.0}
    
    for i in range(0, len(words), max(1, CHUNK_SIZE - OVERLAP)):
        chunk_text = " ".join(words[i : i + CHUNK_SIZE])
        current_result = run_local_extraction(chunk_text, query)
        
        if current_result["confidence"] > best_result["confidence"]:
            best_result = current_result
            
    return best_result

def run_gemini_extraction(prompt, schema):
    client = Client(api_key=GEMINI_API_KEY)
    last_error = "Unknown"
    
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model='gemini-3.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=schema, temperature=0.1)
            )
            return True, json.loads(response.text)
        except Exception as e:
            last_error = str(e)
            if any(err in last_error for err in ["429", "ResourceExhausted", "503", "UNAVAILABLE"]):
                time.sleep(2 * (2 ** attempt))
            else:
                break
                
    return False, last_error
