import os
import json
from google.genai import types
from .config import FIELD_MODEL_MAP
from .models import run_smart_sliding_window_extraction, run_gemini_extraction


def extract_contract_profile_with_combined_pipeline(chunks, filename):
    print(f"Running fresh AI Extraction for: {filename}...")

    all_text = "\n".join([c['text'] for c in chunks])
    
    relevant_keywords = ["VENDOR", "PURCHASE ORDER", "ORDER NO", "DATE", "QTY", "PRICE", "TOTAL", "SCOPE", "WARRANTY", "PAYMENT", "TERMS", "SIGNATORY", "LD", "LIQUIDATED DAMAGES", "CONTACT", "PHONE", "EMAIL"]    
    filtered_chunks = [c['text'] for c in chunks if any(kw in c['text'].upper() for kw in relevant_keywords)]
    combined_context_gemini = "\n--- PAGE SEPARATOR ---\n".join(filtered_chunks) if filtered_chunks else all_text[:8000]

    # --- Local RoBERTa Execution ---
    local_results = {}
    if "roberta" in FIELD_MODEL_MAP.values():
        if FIELD_MODEL_MAP.get("effective_date") == "roberta":
            local_results["effective_date"] = run_smart_sliding_window_extraction(all_text, "What is the dated or order date?")
        if FIELD_MODEL_MAP.get("lapse_expiry_date") == "roberta":
            local_results["lapse_expiry_date"] = run_smart_sliding_window_extraction(all_text, "What is the completion date or duration of the works?")
        if FIELD_MODEL_MAP.get("total_value") == "roberta":
            local_results["total_value"] = run_smart_sliding_window_extraction(all_text, "What is the Total Order Value in INR?")

   # --- Cloud Gemini Execution ---
    gemini_results = {}
    if "gemini" in FIELD_MODEL_MAP.values():
        prompt = f"You are an expert procurement AI analyzing a Purchase Order. Extract ALL requested fields. For every field, you MUST also provide the 'source_quote', which is the EXACT, literal snippet of text from the document that proves your answer. If missing, output 'not_found'. \nPO Context:\n{combined_context_gemini}"
        
        # Helper function to keep our schema clean
        def get_field_schema(desc):
            return types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "value": types.Schema(type=types.Type.STRING, description=desc),
                    "source_quote": types.Schema(type=types.Type.STRING, description="The EXACT, literal quote from the text.")
                }
            )

        po_schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "po_number": get_field_schema("The Purchase Order Number or Order No."),
                "vendor_name": get_field_schema("The Vendor's Name"),
                
                # 🛑 NEGATIVE CONSTRAINTS ADDED HERE 🛑
                "vendor_contact_address": get_field_schema(
                    "CRITICAL: Extract ONLY the VENDOR'S address and contact details. "
                    "You MUST EXCLUDE all buyer/receiver details. "
                    "DO NOT extract Delhi International Airport, Sujit Biswas, or @gmrgroup.in emails."
                ),
                
                "conditions_of_agreement": get_field_schema("Scope of work, warranty, DLP terms, and LD."),
                "conditions_of_payment": get_field_schema("Payment terms."),
                "effective_date": get_field_schema("The start date."),
                "lapse_expiry_date": get_field_schema("The end date."),
                "total_value": get_field_schema("Total order value."),
                "authorising_signatory": get_field_schema("Who signed it?"),
                "line_items": types.Schema(
                    type=types.Type.ARRAY,
                    description="List of purchased items or recurring charges.",
                    items=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "description": types.Schema(type=types.Type.STRING),
                            "quantity": types.Schema(type=types.Type.NUMBER),
                            "unit_price": types.Schema(type=types.Type.NUMBER),
                            "source_quote": types.Schema(type=types.Type.STRING, description="Exact text row.")
                        }
                    )
                )
            },
            required=["po_number", "vendor_name"]
        )
        success, response_data = run_gemini_extraction(prompt, po_schema)
        if success:
            gemini_results = response_data
        else:
            print(f"❌ Gemini API Failure: {response_data}")

    # --- Compile Final Profile ---
    final_profile = {}
    for field, preferred_model in FIELD_MODEL_MAP.items():
        if preferred_model == "gemini":
            val_obj = gemini_results.get(field, {})
            
            if field == "line_items":
                # Handle array of line items
                if not val_obj or len(val_obj) == 0:
                    final_profile[field] = {"status": "not_found", "value": [], "model_used": "gemini"}
                else:
                    final_profile[field] = {"status": "found", "value": val_obj, "model_used": "gemini"}
            else:
                # Handle standard fields
                final_profile[field] = {
                    "value": val_obj.get("value", "not_found") if isinstance(val_obj, dict) else "not_found", 
                    "source_quote": val_obj.get("source_quote", "Quote missing") if isinstance(val_obj, dict) else "Quote missing",
                    "model_used": "Gemini-3.5-Flash"
                }

    # ❌ REMOVED save_cache() execution here
    output_payload = {"status": "success", "profile": final_profile}
    
    return output_payload
