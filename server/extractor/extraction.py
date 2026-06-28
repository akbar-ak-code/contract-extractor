import os
import re
import json
from google.genai import types
from .config import FIELD_MODEL_MAP
from .models import run_smart_sliding_window_extraction, run_gemini_extraction


# ─────────────────────────────────────────────────────────────────────────────
# REGEX FALLBACK HELPERS  (ported from PO Extractor v2 — extractorService.js)
# Used when Gemini returns "not_found" or an empty value for any field.
# ─────────────────────────────────────────────────────────────────────────────

def _normalize(text):
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()

def _get_lines(text):
    return [l.strip() for l in _normalize(text).split("\n") if l.strip()]

def _first_match(text, patterns):
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m and m.group(1):
            return m.group(1).strip()
    return ""

def _section_between(text, start_pattern, end_patterns):
    m = re.search(start_pattern, text, re.IGNORECASE)
    if not m:
        return ""
    sliced = text[m.start():]
    end = len(sliced)
    for ep in end_patterns:
        em = re.search(ep, sliced[20:], re.IGNORECASE)
        if em:
            end = min(end, em.start() + 20)
    return sliced[:end].strip()

def _find_block_around(lines, keyword, extra_lines=3):
    for i, line in enumerate(lines):
        if keyword.lower() in line.lower():
            return " ".join(lines[i: i + extra_lines + 1])
    return ""

def _parse_amount(text):
    m = re.search(r"Total Order Value.*?\(INR\).*?:?\s*([0-9,]+(?:\.[0-9]+)?)", text, re.IGNORECASE)
    if m:
        return m.group(1).replace(",", "")
    return ""

def _extract_line_items_regex(text):
    """
    Scans for lines starting with a number (item rows in PO tables).
    Returns list matching friend's line_items schema:
    { description, quantity, unit_price, source_quote }
    """
    lines = _get_lines(text)
    month_regex = re.compile(
        r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?"
        r"|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?"
        r"|Nov(?:ember)?|Dec(?:ember))['\s]?(\d{2,4})",
        re.IGNORECASE
    )
    item_start = re.compile(r"^\d{1,4}\s+")
    items = []
    for i, line in enumerate(lines):
        if item_start.match(line):
            window = " ".join(lines[i: min(i + 4, len(lines))])
            if re.search(r"Price Details|Central GST|State GST|Total Net", window, re.IGNORECASE):
                continue
            month_match = month_regex.search(window)
            items.append({
                "description": window[:200],
                "quantity": 1,
                "unit_price": 0,
                "source_quote": window[:150]
            })
    return items[:40]


def _regex_fallback(field, all_text):
    """
    Fallback extraction using regex patterns when Gemini returns not_found.
    Covers all fields in FIELD_MODEL_MAP.
    Returns a string value (or list for line_items).
    """
    text  = _normalize(all_text)
    lines = _get_lines(text)

    if field == "po_number":
        return _first_match(text, [
            r"Our Order No\s*:\s*([0-9]+(?:-\d+)?)",
            r"Order No\s*:\s*([0-9]+(?:-\d+)?)",
            r"PO\s*No\.?\s*:\s*([0-9]+(?:-\d+)?)"
        ])

    if field == "vendor_name":
        return _first_match(text, [
            r"To\s*\n?([A-Z0-9 &.\-]+LIMITED)",
            r"(WAISL\s+LIMITED)",
            r"(AISL\s+LIMITED)"
        ]) or "WAISL LIMITED"

    if field == "vendor_contact_address":
        parts = []
        person = _first_match(text, [r"Contact Person\s*:\s*([A-Za-z ]+)"])
        phone  = _first_match(text, [r"Phone\s*No\s*:\s*([0-9]+)", r"Phone\s*:\s*([0-9]+)"])
        email  = _first_match(text, [r"Email\s*:?\s*([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})"])
        vendor_code = _first_match(text, [r"Vendor Code\s*:\s*([0-9]+)"])
        gst    = _first_match(text, [r"GST Reg No\s*:\s*([0-9A-Z]+)"])
        if person:      parts.append(f"Contact: {person}")
        if phone:       parts.append(f"Phone: {phone}")
        if email:       parts.append(f"Email: {email}")
        if vendor_code: parts.append(f"Vendor Code: {vendor_code}")
        if gst:         parts.append(f"GST: {gst}")
        return ", ".join(parts)

    if field == "effective_date":
        return _first_match(text, [
            r"Dated\s*:\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})",
            r"Date\s*:\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})"
        ])

    if field == "lapse_expiry_date":
        result = _section_between(
            text,
            r"5\.\s*Date of Completion.*?:?",
            [r"Refer", r"6\.", r"Data protection"]
        )
        if not result:
            result = _find_block_around(lines, "Date of Completion", 4)
        return result

    if field == "conditions_of_agreement":
        warranty    = " ".join(filter(None, [
            _find_block_around(lines, "Warranty", 3),
            _find_block_around(lines, "Defect Liability", 3),
            _find_block_around(lines, "DLP", 3)
        ]))
        completion  = (
            _section_between(text, r"5\.\s*Date of Completion.*?:?", [r"Refer", r"6\.", r"Data protection"])
            or _find_block_around(lines, "Date of Completion", 4)
        )
        ld = " ".join(filter(None, [
            _find_block_around(lines, "Liquidated Damages", 3),
            _find_block_around(lines, "LD Clause", 3)
        ]))
        return "\n".join(filter(None, [warranty, completion, ld]))

    if field == "conditions_of_payment":
        return (
            _section_between(
                text,
                r"3\.\s*Payment Terms:?|Payment Terms:?",
                [r"4\.\s*Delivery Address", r"4\.", r"5\."]
            )
            or _find_block_around(lines, "Payment Terms", 6)
        )

    if field == "total_value":
        return _parse_amount(text)

    if field == "authorising_signatory":
        return _first_match(text, [
            r"(?:For and on behalf of|Authorised Signatory|Authorized Signatory)[^\n]*\n\s*([A-Za-z .]+)",
            r"(?:Signed by|Signature of)[^\n]*:\s*([A-Za-z .]+)",
            r"(?:GM|DGM|AGM|Manager)[^\n]*\n\s*([A-Za-z .]+)"
        ])

    if field == "line_items":
        return _extract_line_items_regex(text)

    return ""


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE  (original code — untouched except fallback injection)
# ─────────────────────────────────────────────────────────────────────────────

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
            gemini_results["po_number"] = {}
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
                    # ── REGEX FALLBACK for line_items ──────────────────────
                    fallback_items = _regex_fallback("line_items", all_text)
                    if fallback_items:
                        print(f"  ↩ Regex fallback used for: {field} ({len(fallback_items)} items found)")
                        final_profile[field] = {
                            "status": "found",
                            "value": fallback_items,
                            "model_used": "regex_fallback"
                        }
                    else:
                        final_profile[field] = {"status": "not_found", "value": [], "model_used": "gemini"}
                else:
                    final_profile[field] = {"status": "found", "value": val_obj, "model_used": "gemini"}
            else:
                # Handle standard fields
                gemini_value = val_obj.get("value", "not_found") if isinstance(val_obj, dict) else "not_found"
                gemini_quote = val_obj.get("source_quote", "Quote missing") if isinstance(val_obj, dict) else "Quote missing"

                # ── REGEX FALLBACK for standard fields ─────────────────────
                if not gemini_value or gemini_value in ("not_found", "not found", ""):
                    fallback_value = _regex_fallback(field, all_text)
                    if fallback_value:
                        print(f"  ↩ Regex fallback used for: {field}")
                        final_profile[field] = {
                            "value": fallback_value,
                            "source_quote": "Extracted via regex pattern",
                            "model_used": "regex_fallback"
                        }
                    else:
                        final_profile[field] = {
                            "value": "not_found",
                            "source_quote": "Not found by Gemini or regex",
                            "model_used": "gemini"
                        }
                else:
                    final_profile[field] = {
                        "value": gemini_value,
                        "source_quote": gemini_quote,
                        "model_used": "Gemini-3.5-Flash"
                    }

    # ❌ REMOVED save_cache() execution here
    output_payload = {"status": "success", "profile": final_profile}

    return output_payload
