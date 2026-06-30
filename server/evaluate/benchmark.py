import pandas as pd
import os
import time
from google.genai import Client
from dotenv import load_dotenv  # Add this import

# Load environment variables from the .env file
load_dotenv()

# Initialize Gemini Client
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
client = Client(api_key=GEMINI_API_KEY)

# ... [rest of the code remains exactly the same]
def grade_extraction(extracted_text, ground_truth_text):
    """Uses Gemini to evaluate the extraction against the ground truth."""
    if pd.isna(extracted_text) and pd.isna(ground_truth_text):
        return "✅"
    
    prompt = f"""
    You are evaluating an AI data extraction pipeline. Compare the Extracted Value to the Ground Truth Value.
    Reply ONLY with one of these three symbols:
    ✅ - if the extracted value perfectly matches the ground truth (ignoring minor whitespace/caps).
    ⚠️ - if it is mostly correct but misses a detail, has extra noise, or has a different format (e.g., "Rs 400" vs "400").
    ❌ - if it is completely wrong, hallucinated, or totally missing.
    
    Extracted Value: {extracted_text}
    Ground Truth Value: {ground_truth_text}
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=prompt
        )
        symbol = response.text.strip()
        if symbol in ["✅", "⚠️", "❌"]:
            return symbol
        return "⚠️" # Fallback
    except Exception as e:
        print(f"API Error: {e}")
        time.sleep(2)
        return "⚠️"

def create_benchmark_excel():
    print("⏳ Loading CSV files...")
    # Load your two CSVs (Update the filenames if they differ exactly on your machine)
    extracted_df = pd.read_csv("po_extraction_results.csv")
    truth_df = pd.read_excel("WAISLcorrectPO.xlsx")

    # Rename ground truth columns to match extracted columns for easier merging
    truth_df.rename(columns={
        "PO number": "PO Number",
        "Vendor name": "Vendor Name",
        "Vendor contact / address": "Contact & Address",
        "Effective date": "Effective Date",
        "Lapse / expiry date": "Lapse / Expiry Date",
        "Conditions of agreement": "Conditions of Agreement",
        "Conditions of payment": "Conditions of Payment",
        "Total value": "Total Value",
        "Authorising signatory": "Authorising Signatory"
    }, inplace=True)

    # Convert PO Numbers to strings to ensure they merge correctly
    extracted_df['PO Number'] = extracted_df['PO Number'].astype(str).str.strip()
    truth_df['PO Number'] = truth_df['PO Number'].astype(str).str.strip()

    # Merge the dataframes on PO Number
    merged_df = pd.merge(extracted_df, truth_df, on="PO Number", suffixes=('_Extracted', '_Truth'))

    # The columns we want to benchmark
    columns_to_check = [
        "Vendor Name", "Contact & Address", "Effective Date", "Lapse / Expiry Date", 
        "Conditions of Agreement", "Conditions of Payment", "Total Value", "Authorising Signatory"
    ]

    # Create a new DataFrame for the final Excel output
    final_results = []

    print(f"🔍 Benchmarking {len(merged_df)} Purchase Orders...")

    for index, row in merged_df.iterrows():
        po_result = {"PO Number": row["PO Number"]}
        print(f"Evaluating PO: {row['PO Number']}")
        
        for col in columns_to_check:
            extracted_val = row[f"{col}_Extracted"]
            truth_val = row[f"{col}_Truth"]
            
            # Grade it using the LLM
            grade = grade_extraction(extracted_val, truth_val)
            po_result[col] = grade
            
            # Print to console so you can watch it work
            print(f"  {col}: {grade}")
            
        final_results.append(po_result)

    # Save to Excel
    output_df = pd.DataFrame(final_results)
    output_filename = "Final_PO_Benchmark_Results.xlsx"
    output_df.to_excel(output_filename, index=False)
    
    print(f"\n🎉 Done! Created Excel file: {output_filename}")

if __name__ == "__main__":
    create_benchmark_excel()