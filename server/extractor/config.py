import os
from dotenv import load_dotenv

load_dotenv()

CACHE_FILE = "contract_cache.json"
LOCAL_MODEL_NAME = "akdeniz27/roberta-base-cuad"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# Configuration map for the hybrid routing architecture.
# Directs structural/complex fields to the generative cloud LLM (Gemini) 
# and highly specific temporal/monetary fields to the local extractive model (RoBERTa).
FIELD_MODEL_MAP = {
    "party_names": "gemini",
    "effective_date": "gemini",
    "expiration_date": "roberta",  
    "renewal": "roberta",           
    "payment_terms": "gemini",
    "termination_for_cause": "gemini",
    "governing_law": "gemini",
    "penalties": "roberta"
}