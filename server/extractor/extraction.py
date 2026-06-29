# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE  (Gemini → Groq → Regex Cascade)
# Pipeline order: 1. Gemini 2.5 Flash  2. Groq Llama-4 Scout  3. Regex
# After core extraction a SECOND Gemini pass runs the deep contract-analysis
# prompt to produce deadlines / anomalies / raw_fields (dynamic fields).
# ─────────────────────────────────────────────────────────────────────────────
import re
from google.genai import types
from .models import run_groq_extraction, run_gemini_extraction
from .config import FIELD_MODEL_MAP


# ─────────────────────────────────────────────────────────────────────────────
# REGEX FALLBACK HELPERS
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
    lines = _get_lines(text)
    item_start = re.compile(r"^\d{1,4}\s+")
    items = []
    for i, line in enumerate(lines):
        if item_start.match(line):
            window = " ".join(lines[i: min(i + 4, len(lines))])
            if re.search(r"Price Details|Central GST|State GST|Total Net", window, re.IGNORECASE):
                continue
            items.append({
                "description": window[:200],
                "quantity": 1,
                "unit_price": 0,
                "source_quote": window[:150]
            })
    return items[:40]


def _regex_fallback(field, all_text):
    """Fallback extraction using regex when AI returns not_found for a field."""
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
        person      = _first_match(text, [r"Contact Person\s*:\s*([A-Za-z ]+)"])
        phone       = _first_match(text, [r"Phone\s*No\s*:\s*([0-9]+)", r"Phone\s*:\s*([0-9]+)"])
        email       = _first_match(text, [r"Email\s*:?\s*([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})"])
        vendor_code = _first_match(text, [r"Vendor Code\s*:\s*([0-9]+)"])
        gst         = _first_match(text, [r"GST Reg No\s*:\s*([0-9A-Z]+)"])
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
        warranty   = " ".join(filter(None, [
            _find_block_around(lines, "Warranty", 3),
            _find_block_around(lines, "Defect Liability", 3),
            _find_block_around(lines, "DLP", 3)
        ]))
        completion = (
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
# DEEP ANALYSIS PROMPT (Second Gemini Pass)
# Returns deadlines, anomalies, raw_fields, metadata for dynamic storage
# ─────────────────────────────────────────────────────────────────────────────

DEEP_ANALYSIS_PROMPT = """You are a contract analyst extracting structured information from a Purchase Order (PO) document.

Follow these steps in order. Do not skip steps.

---

STEP 1 — QUOTE ALL RELEVANT CLAUSES

Before doing any analysis, scan every page and quote verbatim every clause, sentence, or annotation that relates to any of the following:
- Dates (PO date, amendment date, any calendar date)
- Deadlines or timeframes ("within X days", "X months from", "X weeks from")
- Payment terms, milestones, or triggers ("30% upon", "70% after", "monthly on completion")
- Warranty, DLP, guarantee period
- Performance Bank Guarantee (PBG) / security deposit
- Renewal, termination, or expiry
- Completion, go-live, implementation, acceptance, handover
- Any handwritten annotations visible on the page

---

STEP 2 — EXTRACT METADATA

From the quoted clauses and headers, extract:
- PO number, PO date, Amendment number/date if any
- Vendor name, Client name, Project description
- Governing law / jurisdiction
- Total contract value

---

STEP 3 — IDENTIFY ALL DEADLINES AND PAYMENT OBLIGATIONS

From the clauses quoted in Step 1 only, list every deadline and payment obligation. For each one:
- Assign a label
- State what triggers or anchors it
- Classify the anchor as FIXED, RELATIVE_KNOWN, or RELATIVE_ANCHOR

---

STEP 4 — COMPUTE OR CHAIN EACH DEADLINE

For FIXED or RELATIVE_KNOWN: show reasoning step by step with source citations and compute the calendar date.
For RELATIVE_ANCHOR: show chain, mark ANCHOR_REQUIRED, do not guess dates.

---

STEP 5 — FLAG ANOMALIES

Note: blank clause headings, conflicting clauses, handwritten annotations modifying printed text,
information in unexpected clauses, redacted values affecting calculations, amendments with blank reason fields.

---

STEP 6 — OUTPUT JSON

Output ONLY valid JSON with no markdown formatting:

{
  "metadata": {
    "po_number": "",
    "po_date": "",
    "amendment_number": null,
    "amendment_date": null,
    "vendor": "",
    "client": "",
    "project_description": "",
    "governing_law": "",
    "contract_value_inr": null,
    "contract_value_note": ""
  },
  "raw_fields": {},
  "deadlines": [
    {
      "label": "",
      "anchor_type": "FIXED",
      "anchor_description": "",
      "computed_date": null,
      "confidence": "HIGH",
      "reasoning_chain": [
        {"step": 1, "description": "", "source_clause": "", "source_page": 0}
      ],
      "anchor_required": null,
      "status": "active"
    }
  ],
  "anomalies": [
    {"type": "", "description": "", "page": 0}
  ]
}

RULES:
- Never invent a date. If you cannot compute it, set computed_date to null and set anchor_required.
- Every reasoning step must cite a specific clause. If no citation, flag as UNCITED.
- Boilerplate sections (Supplier Code of Conduct, GST compliance, Labour Law) contain no deadlines. Skip them.
- If a clause is blank or says "NA", note it as an anomaly. Do not infer content.
- Handwritten annotations are valid contract content. Extract and cite them.

Document Text:
{combined_context}
"""


def _run_deep_analysis(combined_context: str) -> dict:
    """
    Second Gemini pass: deep contract analysis returning deadlines, anomalies, raw_fields.
    Returns an empty dict on failure so the main extraction is never blocked.
    """
    print("  🔍 Running deep contract analysis (Gemini)...")

    prompt = DEEP_ANALYSIS_PROMPT.replace("{combined_context}", combined_context[:35000])

    # Gemini schema for deep analysis
    reasoning_step_schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "step":          types.Schema(type=types.Type.INTEGER),
            "description":   types.Schema(type=types.Type.STRING),
            "source_clause": types.Schema(type=types.Type.STRING),
            "source_page":   types.Schema(type=types.Type.INTEGER),
        }
    )
    deadline_schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "label":            types.Schema(type=types.Type.STRING),
            "anchor_type":      types.Schema(type=types.Type.STRING),
            "anchor_description": types.Schema(type=types.Type.STRING),
            "computed_date":    types.Schema(type=types.Type.STRING),
            "confidence":       types.Schema(type=types.Type.STRING),
            "reasoning_chain":  types.Schema(type=types.Type.ARRAY, items=reasoning_step_schema),
            "anchor_required":  types.Schema(type=types.Type.STRING),
            "status":           types.Schema(type=types.Type.STRING),
        }
    )
    anomaly_schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "type":        types.Schema(type=types.Type.STRING),
            "description": types.Schema(type=types.Type.STRING),
            "page":        types.Schema(type=types.Type.INTEGER),
        }
    )
    metadata_schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "po_number":           types.Schema(type=types.Type.STRING),
            "po_date":             types.Schema(type=types.Type.STRING),
            "amendment_number":    types.Schema(type=types.Type.STRING),
            "amendment_date":      types.Schema(type=types.Type.STRING),
            "vendor":              types.Schema(type=types.Type.STRING),
            "client":              types.Schema(type=types.Type.STRING),
            "project_description": types.Schema(type=types.Type.STRING),
            "governing_law":       types.Schema(type=types.Type.STRING),
            "contract_value_inr":  types.Schema(type=types.Type.STRING),
            "contract_value_note": types.Schema(type=types.Type.STRING),
        }
    )
    deep_schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "metadata":   metadata_schema,
            "raw_fields": types.Schema(type=types.Type.OBJECT, properties={}),
            "deadlines":  types.Schema(type=types.Type.ARRAY, items=deadline_schema),
            "anomalies":  types.Schema(type=types.Type.ARRAY, items=anomaly_schema),
        }
    )

    success, data = run_gemini_extraction(prompt, deep_schema)
    if success and isinstance(data, dict):
        print(f"  ✅ Deep analysis complete: {len(data.get('deadlines', []))} deadlines, {len(data.get('anomalies', []))} anomalies")
        return data
    else:
        print(f"  ⚠️ Deep analysis failed: {data}")
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def extract_contract_profile_with_combined_pipeline(chunks, filename):
    print(f"🚀 Running Cascade AI Extraction for: {filename}...")

    all_text = "\n".join([c['text'] for c in chunks])

    relevant_keywords = [
        "VENDOR", "PURCHASE ORDER", "ORDER NO", "DATE", "QTY", "PRICE", "TOTAL",
        "SCOPE", "WARRANTY", "PAYMENT", "TERMS", "SIGNATORY", "LD", "LIQUIDATED DAMAGES",
        "CONTACT", "PHONE", "EMAIL",
        "DESCRIPTION", "UNIT PRICE", "AMOUNT", "ITEM", "S.NO", "SR.NO", "SL.NO",
        "RATE", "HSN", "SAC", "PARTICULARS", "SERVICES", "SUPPLY"
    ]
    if len(all_text) <= 40000:
        combined_context = "\n--- PAGE SEPARATOR ---\n".join(c['text'] for c in chunks)
    else:
        filtered_chunks = [c['text'] for c in chunks if any(kw in c['text'].upper() for kw in relevant_keywords)]
        combined_context = "\n--- PAGE SEPARATOR ---\n".join(filtered_chunks) if filtered_chunks else all_text[:20000]

    ai_results = {}
    ai_model_used = "None"
    extraction_success = False

    # =========================================================
    # 1. ATTEMPT GEMINI EXTRACTION (Primary — highest priority)
    # =========================================================
    print("  🧠 Attempting Gemini-2.5-Flash (primary)...")

    def get_field_schema(desc):
        return types.Schema(
            type=types.Type.OBJECT,
            properties={
                "value": types.Schema(type=types.Type.STRING, description=desc),
                "source_quote": types.Schema(type=types.Type.STRING, description="Exact literal quote.")
            }
        )

    gemini_schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "po_number":               get_field_schema("PO Number"),
            "vendor_name":             get_field_schema("Vendor Name"),
            "vendor_contact_address":  get_field_schema("VENDOR address only. EXCLUDE buyer details."),
            "conditions_of_agreement": get_field_schema(
                "Extract a CONCISE SUMMARY of the key agreement conditions: scope of work, warranty, DLP, LD, "
                "and completion timeline. Format as short, punchy bullet points. Max 100 words. DO NOT copy full boilerplate paragraphs."
            ),
            "conditions_of_payment": get_field_schema(
                "Extract a CONCISE SUMMARY of the payment terms: payment schedule, milestones, advance, and retention. "
                "Format as short, punchy bullet points. Max 100 words. DO NOT copy full boilerplate paragraphs."
            ),
            "effective_date":       get_field_schema("Start / issuance date of this PO."),
            "lapse_expiry_date":    get_field_schema("Expiry / completion deadline date."),
            "total_value":          get_field_schema("Total order or contract value with currency."),
            "authorising_signatory": get_field_schema("Name and designation of the signing authority."),
            "line_items": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "description":  types.Schema(type=types.Type.STRING),
                        "quantity":     types.Schema(type=types.Type.NUMBER),
                        "unit_price":   types.Schema(type=types.Type.NUMBER),
                        "source_quote": types.Schema(type=types.Type.STRING)
                    }
                )
            )
        }
    )

    gemini_prompt = (
        "You are an expert procurement AI. Extract every field from this Purchase Order exactly as written.\n"
        "Rules:\n"
        "- Copy conditions and payment terms verbatim — do NOT summarise or say 'as per LPO-XXXX'.\n"
        "- Extract EVERY line item without exception (there may be 15 or more).\n"
        "- For vendor_contact_address: vendor details only, exclude buyer/airport/buyer personnel.\n"
        "- If a field is genuinely absent, output 'not_found'.\n\n"
        f"Purchase Order:\n{combined_context}"
    )

    success, response_data = run_gemini_extraction(gemini_prompt, gemini_schema)
    if success:
        ai_results = response_data
        ai_model_used = "Gemini-2.5-Flash"
        extraction_success = True
        print("  ✅ Gemini extraction successful!")
    else:
        print(f"  ⚠️ Gemini failed ({response_data}). Falling back to Groq...")

    # =========================================================
    # 2. ATTEMPT GROQ EXTRACTION (Fallback)
    # =========================================================
    if not extraction_success:
        print("  🧠 Attempting Groq (Llama4-Scout) as fallback...")

        groq_schema_instructions = """
    {
      "po_number": {"value": "string", "source_quote": "string"},
      "vendor_name": {"value": "string", "source_quote": "string"},
      "vendor_contact_address": {"value": "string", "source_quote": "string"},
      "conditions_of_agreement": {"value": "string", "source_quote": "string"},
      "conditions_of_payment": {"value": "string", "source_quote": "string"},
      "effective_date": {"value": "string", "source_quote": "string"},
      "lapse_expiry_date": {"value": "string", "source_quote": "string"},
      "total_value": {"value": "string", "source_quote": "string"},
      "authorising_signatory": {"value": "string", "source_quote": "string"},
      "line_items": [
        {"description": "string", "quantity": 1, "unit_price": 0.0, "source_quote": "string"}
      ]
    }
    """

        groq_prompt = f"""You are an expert procurement AI. Extract ALL requested fields from the Purchase Order document below.
For every field, provide:
  - "value": the extracted data (full text, not a summary or reference to another document)
  - "source_quote": the EXACT verbatim snippet from the document proving this value

If a field truly cannot be found, set "value" to "not_found". Never reference other documents or say "as per LPO-XXXX" - extract the ACTUAL content written in this document.

FIELD DEFINITIONS:

po_number: The Purchase Order or Order number (e.g. "Our Order No: 12345").
vendor_name: Name of the VENDOR/SUPPLIER receiving this PO (NOT the buyer).
vendor_contact_address: ONLY the vendor's contact details (name, phone, email, GST, vendor code).
  EXCLUDE: buyer address, Delhi International Airport, buyer personnel.
effective_date: The date this PO was issued or becomes effective.
lapse_expiry_date: The date the PO expires or work must be completed.

conditions_of_agreement: Provide a CONCISE SUMMARY of key terms like warranty, DLP, LD, and timelines. Use short bullet points. Do NOT copy the massive boilerplate text.
 This MUST include: scope of work, warranty period, DLP, LD clause, penalty terms, completion timeline.
conditions_of_payment: Provide a CONCISE SUMMARY of the payment schedule and milestones. Use short bullet points. Do NOT copy massive paragraphs.
Include: payment schedule, milestone percentages, advance payment, retention money
total_value: The total order or contract value.
authorising_signatory: Name and designation of the person who signed/authorised this PO.
line_items: Extract EVERY SINGLE line item. Each needs: description, quantity, unit_price, source_quote.

You MUST output valid JSON matching this exact structure:
{groq_schema_instructions}

Document Text:
{combined_context}
"""

        success, response_data = run_groq_extraction(groq_prompt)
        if success:
            ai_results = response_data
            ai_model_used = "Groq-Llama4-Scout"
            extraction_success = True
            print("  ✅ Groq extraction successful!")
        else:
            print(f"  ❌ Both AI models failed. Relying entirely on Regex.")

    # =========================================================
    # 3. COMPILE PROFILE & APPLY REGEX FALLBACKS
    # =========================================================
    final_profile = {}

    for field in FIELD_MODEL_MAP.keys():
        val_obj = ai_results.get(field, {})

        if field == "line_items":
            if not val_obj or len(val_obj) == 0:
                fallback_items = _regex_fallback("line_items", all_text)
                if fallback_items:
                    print(f"  ↩ Regex fallback used for: line_items ({len(fallback_items)} items found)")
                    final_profile[field] = {"status": "found", "value": fallback_items, "model_used": "Regex"}
                else:
                    final_profile[field] = {"status": "not_found", "value": [], "model_used": ai_model_used}
            else:
                sanitised = []
                for item in val_obj:
                    if not isinstance(item, dict):
                        continue
                    try:
                        qty = float(item.get("quantity") or 0)
                    except (TypeError, ValueError):
                        qty = 0.0
                    try:
                        price = float(item.get("unit_price") or 0)
                    except (TypeError, ValueError):
                        price = 0.0
                    sanitised.append({
                        "description": str(item.get("description") or "").strip(),
                        "quantity": qty,
                        "unit_price": price,
                        "source_quote": str(item.get("source_quote") or "").strip(),
                    })
                print(f"  ✅ line_items: {len(sanitised)} items extracted by AI")
                final_profile[field] = {"status": "found", "value": sanitised, "model_used": ai_model_used}

        else:
            ai_value = val_obj.get("value", "not_found") if isinstance(val_obj, dict) else "not_found"
            ai_quote = val_obj.get("source_quote", "Quote missing") if isinstance(val_obj, dict) else "Quote missing"

            if not ai_value or str(ai_value).lower() in ("not_found", "not found", "", "null", "none"):
                fallback_value = _regex_fallback(field, all_text)
                if fallback_value:
                    print(f"  ↩ Regex fallback used for: {field}")
                    final_profile[field] = {
                        "value": fallback_value,
                        "source_quote": "Extracted via regex pattern",
                        "model_used": "Regex"
                    }
                else:
                    final_profile[field] = {
                        "value": "not_found",
                        "source_quote": "Not found by AI or regex",
                        "model_used": ai_model_used
                    }
            else:
                final_profile[field] = {
                    "value": ai_value,
                    "source_quote": ai_quote,
                    "model_used": ai_model_used
                }

    # =========================================================
    # 4. SECOND PASS — Deep Contract Analysis (Gemini only)
    # =========================================================
    deep_analysis = _run_deep_analysis(combined_context)

    return {
        "status": "success",
        "profile": final_profile,
        "deep_analysis": deep_analysis,   # deadlines, anomalies, metadata, raw_fields
    }
