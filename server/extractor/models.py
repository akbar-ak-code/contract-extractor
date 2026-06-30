# extractor/models.py
import time
import json
from google.genai import Client
from google.genai import types
from groq import Groq
from .config import GEMINI_API_KEY, GROQ_API_KEY

def run_groq_extraction(prompt):
    """Executes extraction using Groq (Llama 4 Scout) with strict JSON mode."""
    if not GROQ_API_KEY:
        return False, "GROQ_API_KEY not configured"
        
    client = Groq(api_key=GROQ_API_KEY)
    last_error = "Unknown"
    
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a precise data extraction AI. You MUST return ONLY a valid JSON object. Do not include markdown formatting like ```json or any conversational text."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model="meta-llama/llama-4-scout-17b-16e-instruct", 
                temperature=0.0,
                response_format={"type": "json_object"}  # Forces strict JSON
            )
            
            content = response.choices[0].message.content
            return True, json.loads(content)
            
        except Exception as e:
            last_error = str(e)
            if any(err in last_error for err in ["429", "503", "rate limit"]):
                time.sleep(2 * (2 ** attempt))
            else:
                break
                
    return False, last_error


def run_gemini_extraction(prompt, schema):
    """Executes the cloud generative model request with structured JSON enforcement and exponential backoff."""
    if not GEMINI_API_KEY:
        return False, "GEMINI_API_KEY not configured"
        
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
