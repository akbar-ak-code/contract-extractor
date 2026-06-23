import os
import csv
import ast
import pandas as pd


# 🛠️ Updated import to pull your new combined pipeline
from extractor.ingestion import extract_and_chunk_pdf
from extractor.extraction import extract_contract_profile_with_combined_pipeline

TEST_DIR = "test_contracts"
OUTPUT_CSV = "combined_emoji_matrix.csv"
MASTER_CSV = "master_clauses.csv"

# 🧠 THE AUTO-GRADER LOGIC (Unchanged)
def evaluate_match(extracted, gt_val):
    ext_missing = not extracted or extracted == "Not found in contract" or extracted == "N/A"
    
    gt_missing = True
    gt_text = ""
    
    if pd.notna(gt_val) and str(gt_val).strip() not in ["", "nan", "[]"]:
        gt_missing = False
        try:
            if str(gt_val).startswith("["):
                parsed_list = ast.literal_eval(str(gt_val))
                gt_text = " ".join(parsed_list).lower()
            else:
                gt_text = str(gt_val).lower()
        except:
            gt_text = str(gt_val).lower()

    if ext_missing and gt_missing:
        return "✅" # Both agree it's missing
    elif ext_missing and not gt_missing:
        return "❌" # Model missed it
    elif not ext_missing and gt_missing:
        return "❌" # Model hallucinated/false positive
    else:
        ext_clean = extracted.lower()
        
        if ext_clean in gt_text or gt_text in ext_clean:
            return "✅" # Perfect substring match
            
        ext_words = set(ext_clean.split())
        gt_words = set(gt_text.split())
        
        if not ext_words or not gt_words: return "❌"
            
        overlap_ratio = len(ext_words.intersection(gt_words)) / min(len(ext_words), len(gt_words))
        
        if overlap_ratio > 0.5: return "✅" # High overlap
        elif overlap_ratio > 0.15: return "⚠️" # Partial match
        else: return "❌" # Completely different

def run_combined_auto_eval():
    print(f"Loading Ground Truth from {MASTER_CSV}...")
    master_df = pd.read_csv(MASTER_CSV)
    
    pdf_files = [f for f in os.listdir(TEST_DIR) if f.lower().endswith('.pdf')]
    print(f"🚀 Starting Auto-Graded COMBINED Evaluation on {len(pdf_files)} contracts...\n")

    headers = ["Contract", "Party Names", "Effective Date", "Expiration Date", "Renewal", "Payment", "Termination", "Governing Law", "Penalties"]

    with open(OUTPUT_CSV, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(headers)

        for idx, filename in enumerate(pdf_files):
            print(f"📄 Processing [{idx + 1}/{len(pdf_files)}]: {filename}")
            
            # Find Ground Truth Row
            gt_row = master_df[master_df['Filename'] == filename]
            if gt_row.empty:
                print("   ⚠️ No Ground Truth found in master CSV. Skipping.")
                writer.writerow([filename] + ["❓"] * 8)
                continue
                
            gt = gt_row.iloc[0]
            
            try:
                chunks = extract_and_chunk_pdf(os.path.join(TEST_DIR, filename))
                
                # 🛠️ Calling the newly refactored Smart Pipeline
                result = extract_contract_profile_with_combined_pipeline(chunks, filename)
                
                if result.get("status") == "success":
                    p = result["profile"]
                    
                    # 🤖 Compare against specific Master Clauses columns using safe .get() calls
                    parties_emoji = evaluate_match(p.get('party_names', {}).get('value', ''), gt.get('Parties'))
                    
                    eff_gt = gt.get('Effective Date') if str(gt.get('Effective Date')) not in ["nan", "[]"] else gt.get('Agreement Date')
                    eff_emoji = evaluate_match(p.get('effective_date', {}).get('value', ''), eff_gt)
                    
                    exp_emoji = evaluate_match(p.get('expiration_date', {}).get('value', ''), gt.get('Expiration Date'))
                    ren_emoji = evaluate_match(p.get('renewal', {}).get('value', ''), gt.get('Renewal Term'))
                    
                    pay_gt = str(gt.get('Revenue/Profit Sharing', '')) + " " + str(gt.get('Minimum Commitment', ''))
                    pay_emoji = evaluate_match(p.get('payment_terms', {}).get('value', ''), pay_gt)
                    
                    term_emoji = evaluate_match(p.get('termination_for_cause', {}).get('value', ''), gt.get('Termination For Convenience'))
                    law_emoji = evaluate_match(p.get('governing_law', {}).get('value', ''), gt.get('Governing Law'))
                    pen_emoji = evaluate_match(p.get('penalties', {}).get('value', ''), gt.get('Liquidated Damages'))
                    
                    writer.writerow([filename, parties_emoji, eff_emoji, exp_emoji, ren_emoji, pay_emoji, term_emoji, law_emoji, pen_emoji])
                else:
                    writer.writerow([filename] + ["❌"] * 8)

            except Exception as e:
                print(f"   ❌ Error on {filename}: {e}")
                writer.writerow([filename] + ["❌"] * 8)

    print(f"\n✅ Combined Auto-Graded Matrix Complete! Open '{OUTPUT_CSV}'.")

if __name__ == "__main__":
    run_combined_auto_eval()