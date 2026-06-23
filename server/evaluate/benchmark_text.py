import os
import csv
# Using your new clean architecture imports!
from extractor.ingestion import extract_and_chunk_pdf
from extractor.extraction import extract_contract_profile_with_combined_pipeline

TEST_DIR = "test_contracts"
OUTPUT_CSV = "combined_actual_text_matrix.csv"

def run_actual_text_eval():
    pdf_files = [f for f in os.listdir(TEST_DIR) if f.lower().endswith('.pdf')]
    print(f"🚀 Starting Actual Text Extraction Evaluation on {len(pdf_files)} contracts...\n")

    # CSV Headers
    headers = [
        "Contract", "Party Names", "Effective Date", "Expiration Date", 
        "Renewal", "Payment Terms", "Termination", "Governing Law", "Penalties"
    ]

    with open(OUTPUT_CSV, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(headers)

        for idx, filename in enumerate(pdf_files):
            print(f"📄 Processing [{idx + 1}/{len(pdf_files)}]: {filename}")
            
            try:
                chunks = extract_and_chunk_pdf(os.path.join(TEST_DIR, filename))
                
                # Running the pipeline
                result = extract_contract_profile_with_combined_pipeline(chunks, filename)
                
                if result.get("status") == "success":
                    p = result["profile"]
                    
                    # 🤖 Extracting the ACTUAL text values safely
                    parties = p.get('party_names', {}).get('value', 'Not found in contract')
                    eff_date = p.get('effective_date', {}).get('value', 'Not found in contract')
                    exp_date = p.get('expiration_date', {}).get('value', 'Not found in contract')
                    renewal = p.get('renewal', {}).get('value', 'Not found in contract')
                    payment = p.get('payment_terms', {}).get('value', 'Not found in contract')
                    term = p.get('termination_for_cause', {}).get('value', 'Not found in contract')
                    law = p.get('governing_law', {}).get('value', 'Not found in contract')
                    penalties = p.get('penalties', {}).get('value', 'Not found in contract')
                    
                    # Write the raw extracted text to the CSV
                    writer.writerow([filename, parties, eff_date, exp_date, renewal, payment, term, law, penalties])
                else:
                    writer.writerow([filename] + ["EXTRACTION FAILED"] * 8)

            except Exception as e:
                print(f"   ❌ Error on {filename}: {e}")
                writer.writerow([filename] + ["ERROR"] * 8)

    print(f"\n✅ Actual Text Matrix Complete! Open '{OUTPUT_CSV}'.")

if __name__ == "__main__":
    run_actual_text_eval()