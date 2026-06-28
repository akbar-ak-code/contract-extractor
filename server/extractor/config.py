import os
from dotenv import load_dotenv

load_dotenv()

CACHE_FILE = "po_cache.json"
LOCAL_MODEL_NAME = "akdeniz27/roberta-base-cuad"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

FIELD_MODEL_MAP = {
    "po_number": "gemini",
    "vendor_name": "gemini",
    "vendor_contact_address": "gemini",
    "effective_date": "gemini",
    "lapse_expiry_date": "gemini",
    "conditions_of_agreement": "gemini",
    "conditions_of_payment": "gemini",
    "line_items": "gemini",
    "total_value": "gemini",
    "authorising_signatory": "gemini"
}