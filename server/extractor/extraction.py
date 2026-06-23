import os
import json
from google.genai import types
from .config import CACHE_FILE, FIELD_MODEL_MAP
from .models import run_smart_sliding_window_extraction, run_gemini_extraction

def load_cache():
    """Retrieves locally cached extraction results to minimize redundant API calls."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_cache(cache_data):
    """Persists extraction results to the local cache storage."""
    with open(CACHE_FILE, "w") as f:
        json.dump(cache_data, f, indent=4)

def extract_contract_profile_with_combined_pipeline(chunks, filename):
    """Orchestrates the extraction process by routing target fields to their designated models."""
    cache = load_cache()
    cache_key = f"{filename}_combined_v2" 
    
    if cache_key in cache:
        print(f"🎯 Cache Hit! Returning pre-processed data for {filename}")
        return cache[cache_key]

    all_text = "\n".join([c['text'] for c in chunks])
    
    # Pre-process text to reduce token usage and improve LLM accuracy by filtering for relevant clauses.
    relevant_keywords = ["TERM ", "TERMINAT", "RENEW", "COMMENCE", "EXPIR", "EFFECTIVE", "GOVERN", "JURISDICTION", "VENUE", "LAW", "PENALTY", "INTEREST", "INVOICE", "PAYMENT", "BREACH", "DEFAULT", "LIABIL"]    
    filtered_chunks = [c['text'] for c in chunks if any(kw in c['text'].upper() for kw in relevant_keywords)]
    combined_context_gemini = "\n--- SECTION SEPARATOR ---\n".join(filtered_chunks) if filtered_chunks else all_text[:8000]

    # Model Execution: Extractive Layer (Local RoBERTa)
    local_results = {}
    if "roberta" in FIELD_MODEL_MAP.values():
        if FIELD_MODEL_MAP.get("expiration_date") == "roberta":
            local_results["expiration_date"] = run_smart_sliding_window_extraction(all_text, "Highlight the parts (if any) of this contract related to: Expiration Date")
        if FIELD_MODEL_MAP.get("renewal") == "roberta":
            local_results["renewal"] = run_smart_sliding_window_extraction(all_text, "Highlight the parts (if any) of this contract related to: Renewal Term")
        if FIELD_MODEL_MAP.get("penalties") == "roberta":
            local_results["penalties"] = run_smart_sliding_window_extraction(all_text, "Highlight the parts (if any) of this contract related to: Liquidated Damages")

    # Model Execution: Generative Layer (Cloud Gemini API)
    gemini_results = {}
    if "gemini" in FIELD_MODEL_MAP.values():
        prompt = f"You are an expert corporate legal counsel analyzing an enterprise agreement. Extract ALL requested fields comprehensively. If a field is missing, output 'Not found in contract'. Do NOT hallucinate.\nContract Context:\n{combined_context_gemini}"
        contract_schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "party_names": types.Schema(type=types.Type.STRING),
                "effective_date": types.Schema(type=types.Type.STRING),
                "payment_terms": types.Schema(type=types.Type.STRING),
                "termination_for_cause": types.Schema(type=types.Type.STRING),
                "governing_law": types.Schema(type=types.Type.STRING)
            },
            required=["party_names", "effective_date", "payment_terms", "termination_for_cause", "governing_law"]
        )
        
        success, response_data = run_gemini_extraction(prompt, contract_schema)
        if success:
            gemini_results = response_data
        else:
            print(f"❌ Gemini API Failure: {response_data}")

    # Compile the final standardized response profile
    final_profile = {}
    for field, preferred_model in FIELD_MODEL_MAP.items():
        if preferred_model == "roberta":
            final_profile[field] = {
                "value": local_results.get(field, {}).get("value", "Not found in contract"), 
                "model_used": "RoBERTa-CUAD"
            }
        elif preferred_model == "gemini":
            final_profile[field] = {
                "value": gemini_results.get(field, "Not found in contract"), 
                "model_used": "Gemini-3.5-Flash"
            }

    output_payload = {"status": "success", "profile": final_profile}
    cache[cache_key] = output_payload
    save_cache(cache)
    
    return output_payload