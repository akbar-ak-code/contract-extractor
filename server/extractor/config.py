# extractor/config.py
import os
from dotenv import load_dotenv

load_dotenv()

CACHE_FILE = "po_cache.json"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY") # 🆕 Added Groq Key

FIELD_MODEL_MAP = {
    "po_number": "cascade",
    "vendor_name": "cascade",
    "vendor_contact_address": "cascade",
    "effective_date": "cascade",
    "lapse_expiry_date": "cascade",
    "conditions_of_agreement": "cascade",
    "conditions_of_payment": "cascade",
    "line_items": "cascade",
    "total_value": "cascade",
    "authorising_signatory": "cascade"
}