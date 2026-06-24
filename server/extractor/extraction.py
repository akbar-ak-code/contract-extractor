import os
import json
from google.genai import types
from .config import CACHE_FILE, FIELD_MODEL_MAP
from .models import run_smart_sliding_window_extraction, run_gemini_extraction

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_cache(cache_data):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache_data, f, indent=4)

def extract_contract_profile_with_combined_pipeline(chunks, filename):
    cache = load_cache()
    cache_key = f"{filename}_po_pipeline_v2" 
    
    if cache_key in cache:
        print(f"🎯 Cache Hit! Returning pre-processed data for {filename}")
        return cache[cache_key]

    all_text = "\n".join([c['text'] for c in chunks])
    
    # Added keywords to ensure we capture the PO Number, Emails, Phones, and LD clauses
    relevant_keywords = ["VENDOR", "PURCHASE ORDER", "ORDER NO", "DATE", "QTY", "PRICE", "TOTAL", "SCOPE", "WARRANTY", "PAYMENT", "TERMS", "SIGNATORY", "LD", "LIQUIDATED DAMAGES", "CONTACT", "PHONE", "EMAIL"]    
    filtered_chunks = [c['text'] for c in chunks if any(kw in c['text'].upper() for kw in relevant_keywords)]
    combined_context_gemini = "\n--- PAGE SEPARATOR ---\n".join(filtered_chunks) if filtered_chunks else all_text[:8000]

    local_results = {}
    # Kept for backward compatibility if you ever route fields back to RoBERTa
    if "roberta" in FIELD_MODEL_MAP.values():
        if FIELD_MODEL_MAP.get("effective_date") == "roberta":
            local_results["effective_date"] = run_smart_sliding_window_extraction(all_text, "What is the dated or order date?")
        if FIELD_MODEL_MAP.get("lapse_expiry_date") == "roberta":
            local_results["lapse_expiry_date"] = run_smart_sliding_window_extraction(all_text, "What is the completion date or duration of the works?")
        if FIELD_MODEL_MAP.get("total_value") == "roberta":
            local_results["total_value"] = run_smart_sliding_window_extraction(all_text, "What is the Total Order Value in INR?")

    gemini_results = {}
    if "gemini" in FIELD_MODEL_MAP.values():
        prompt = f"You are an expert procurement AI analyzing a Purchase Order. Extract ALL requested fields exactly as they appear. If a field is missing, output 'not_found'. For line_items, extract each item row from the table into the array. \nPO Context:\n{combined_context_gemini}"
        
        po_schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "po_number": types.Schema(type=types.Type.STRING, description="The Purchase Order Number or Order No."),
                "vendor_name": types.Schema(type=types.Type.STRING),
                # Inside extraction.py -> po_schema

"vendor_contact_address": types.Schema(
    type=types.Type.STRING, 
    description="Extract ONLY the address and contact details specifically belonging to the Vendor (the 'To' section). Do NOT include the Buyer's contact details, and strictly exclude anyone with a @gmrgroup.in email or listed under the buyer's reference."
),
                "conditions_of_agreement": types.Schema(type=types.Type.STRING, description="Scope of work, warranty, DLP terms, and Liquidated Damages (LD)."),
                "conditions_of_payment": types.Schema(type=types.Type.STRING),
                "effective_date": types.Schema(type=types.Type.STRING),
                "lapse_expiry_date": types.Schema(type=types.Type.STRING),
                "total_value": types.Schema(type=types.Type.STRING),
                "authorising_signatory": types.Schema(type=types.Type.STRING),
                "line_items": types.Schema(
                    type=types.Type.ARRAY,
                    description="List of purchased items or recurring charges.",
                    items=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "description": types.Schema(type=types.Type.STRING),
                            "quantity": types.Schema(type=types.Type.NUMBER),
                            "unit_price": types.Schema(type=types.Type.NUMBER)
                        }
                    )
                )
            },
            required=["po_number", "vendor_name", "vendor_contact_address", "line_items", "conditions_of_payment"]
        )
        
        success, response_data = run_gemini_extraction(prompt, po_schema)
        if success:
            gemini_results = response_data
        else:
            print(f"❌ Gemini API Failure: {response_data}")

    final_profile = {}
    for field, preferred_model in FIELD_MODEL_MAP.items():
        if preferred_model == "roberta":
            final_profile[field] = {
                "value": local_results.get(field, {}).get("value", "not_found"), 
                "model_used": "RoBERTa-CUAD"
            }
        elif preferred_model == "gemini":
            val = gemini_results.get(field)
            if field == "line_items":
                if not val or len(val) == 0:
                    final_profile[field] = {"status": "not_found", "value": [], "model_used": "gemini"}
                else:
                    final_profile[field] = {"status": "found", "value": val, "model_used": "gemini"}
            else:
                final_profile[field] = {
                    "value": val if val else "not_found", 
                    "model_used": "Gemini-3.5-Flash"
                }

    output_payload = {"status": "success", "profile": final_profile}
    cache[cache_key] = output_payload
    save_cache(cache)
    
    return output_payload