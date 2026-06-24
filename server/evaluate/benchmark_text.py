import os
import csv
import json
from extractor.ingestion import extract_and_chunk_pdf
from extractor.extraction import extract_contract_profile_with_combined_pipeline

def process_directory_to_csv(input_dir="test_contracts", output_csv="po_extraction_results.csv"):
    """
    Automates the extraction of Purchase Orders from a directory and writes the structured output to a CSV.
    """
    if not os.path.exists(input_dir):
        print(f"Directory '{input_dir}' not found. Creating it now. Please add PDFs and re-run.")
        os.makedirs(input_dir)
        return

    # Define the CSV headers based on our PO schema
    csv_headers = [
        "Filename",
        "PO Number",
        "Vendor Name",
        "Contact & Address",
        "Effective Date",
        "Lapse / Expiry Date",
        "Total Value",
        "Conditions of Agreement",
        "Conditions of Payment",
        "Authorising Signatory",
        "Line Items (JSON String)",
        "Status"
    ]

    with open(output_csv, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(csv_headers)

        # Loop through all PDFs in the target folder
        for filename in os.listdir(input_dir):
            if filename.lower().endswith(".pdf"):
                filepath = os.path.join(input_dir, filename)
                print(f"⏳ Processing: {filename}...")

                try:
                    # 1. Chunk the PDF using the page-based chunker
                    chunks = extract_and_chunk_pdf(filepath)

                    # 2. Run the smart extraction pipeline
                    result = extract_contract_profile_with_combined_pipeline(chunks, filename)

                    # 3. Parse results and write to CSV
                    if result.get("status") == "success":
                        profile = result.get("profile", {})
                        
                        # Helper to safely extract values from the profile dict
                        def get_val(field):
                            return profile.get(field, {}).get("value", "not_found")

                        # Format line items as a clean JSON string for the CSV cell
                        line_items_raw = get_val("line_items")
                        if isinstance(line_items_raw, list):
                            line_items_str = json.dumps(line_items_raw) 
                        else:
                            line_items_str = str(line_items_raw)

                        # Write the row
                        writer.writerow([
                            filename,
                            get_val("po_number"),
                            get_val("vendor_name"),
                            get_val("vendor_contact_address"),
                            get_val("effective_date"),
                            get_val("lapse_expiry_date"),
                            get_val("total_value"),
                            get_val("conditions_of_agreement"),
                            get_val("conditions_of_payment"),
                            get_val("authorising_signatory"),
                            line_items_str,
                            "Success"
                        ])
                        print(f"✅ Successfully extracted: {filename}")
                    else:
                        writer.writerow([filename] + [""] * 9 + ["Extraction Failed"])
                        print(f"❌ Failed to extract: {filename}")

                except Exception as e:
                    print(f"⚠️ Error processing {filename}: {str(e)}")
                    writer.writerow([filename] + [""] * 9 + [f"System Error: {str(e)}"])

    print(f"\n🎉 Batch processing complete! Results saved to '{output_csv}'")

if __name__ == "__main__":
    # You can change the folder name or output file name here
    process_directory_to_csv(input_dir="test_contracts", output_csv="po_extraction_results.csv")