# Contract-Extractor

## What does this project do?
This project is a hybrid full-stack microservice that automatically extracts core metadata from legal contracts using intelligent semantic routing. It optimizes speed and accuracy by directing complex structural clauses to a cloud generative AI (Gemini 3.5 Flash) while parsing strict temporal data locally using an extractive model (RoBERTa).

## What are the prerequisites?
To run this project locally, you will need:
* **Python:** Version 3.10 or higher.
* **Node.js:** Installed to run the frontend client.
* **Gemini API Key:** Required for the cloud generative routing. 
  * *How to get it:* Go to [Google AI Studio](https://aistudio.google.com/), sign in with a Google account, and click "Get API key" to generate a free token.

## How do I install it?
Run the following exact commands in your terminal to set up the complete monorepo:

bash
# 1. Clone the repository
git clone [https://github.com/akbar-ak-code/contract-extractor.git](https://github.com/akbar-ak-code/contract-extractor.git)
cd contract-extractor

# 2. Set up the Backend
cd server
python -m venv venv
# Activate Windows: .\venv\Scripts\activate | Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
echo "GEMINI_API_KEY=your_actual_api_key_here" > .env
cd ..

# 3. Set up the Frontend
cd client
npm install
## How do I run it on a single contract?
You can run the full visual application by spinning up both the backend and frontend servers. 

Open two separate terminal windows:
1. **In terminal 1 (Backend):** Navigate to the `server` folder, activate your `venv`, and run:
   ```bash
   uvicorn main:app --reload
In terminal 2 (Frontend): Navigate to the client folder and run:
   npm run dev
## How do I run the benchmark evaluation?
To run the automated bulk evaluation pipeline and generate performance matrices, navigate to your server directory (with the virtual environment activated) and run:

# Generates the accuracy pass/fail matrix (combined_emoji_matrix.csv)
python -m evaluate.benchmark
# Generates the raw extracted text dataset (combined_actual_text_matrix.csv)
python -m evaluate.benchmark_text
## What does the output look like?

When the backend successfully processes a contract via the hybrid pipeline, it returns a structured JSON profile identifying both the extracted value and which model routed the answer:
```{
  "DYNTEKINC_07_30_1999-EX-10-ONLINE HOSTING AGREEMENT.PDF_combined_v2": {
        "status": "success",
        "profile": {
            "party_names": {
                "value": "Diplomat Direct Marketing Corporation and Tadeo E-Commerce Corp.",
                "model_used": "Gemini-2.5-Flash"
            },
            "effective_date": {
                "value": "June 1, 1999",
                "model_used": "Gemini-2.5-Flash"
            },
            "expiration_date": {
                "value": "The term of this Agreement shall begin on the date hereof (the \"Effective Date\") and shall continue for a period of 12 months thereafter (the \"Period\") in full force and effect until it is terminated in accordance with this Section 3.",
                "model_used": "RoBERTa-CUAD"
            },
            "renewal": {
                "value": "Diplomat or Tadeo, if such party is not in default of the terms of this Agreement, may extend the term of this Agreement for an additional one year (\"Additional Period\"), provided the extending party gives the other party at least sixty (60) days advance written notice before the end of the Period.",
                "model_used": "RoBERTa-CUAD"
            },
            "payment_terms": {
                "value": "Tadeo will invoice Diplomat within 15 days of the end of each month for Services rendered in such month. Diplomat will pay such invoice within 30 days of receipt. Late payments shall accrue interest at a rate equal to fifteen (15%) percent per annum.",
                "model_used": "Gemini-2.5-Flash"
            },
            "termination_for_cause": {
                "value": "Either party may terminate the agreement if the other party is in material breach (not cured within 5 days of written notice), upon bankruptcy or insolvency proceedings not dismissed within 60 days, involuntary dissolution, or judicial adjudication of insolvency.",
                "model_used": "Gemini-2.5-Flash"
            },
            "governing_law": {
                "value": "State of New York",
                "model_used": "Gemini-2.5-Flash"
            },
            "penalties": {
                "value": "The Web Agreement is terminated by any of Tadeo, Diplomat, or any other party thereto [in the event the rights and obligations of any party(ies) to such Web Agreement have been duly assigned to a third party(ies) under the terms thereof] in accordance with the terms of the Web Agreement, but not if the Web Agreement is terminated by Diplomat or its assignee(s) other than in accordance with the terms of the Web Agreement\u037e",
                "model_used": "RoBERTa-CUAD"
            }
        }
    }
}