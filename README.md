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
##How do I run the benchmark evaluation?
To run the automated bulk evaluation pipeline and generate performance matrices, navigate to your server directory (with the virtual environment activated) and run:

# Generates the accuracy pass/fail matrix (combined_emoji_matrix.csv)
python -m evaluate.benchmark
# Generates the raw extracted text dataset (combined_actual_text_matrix.csv)
python -m evaluate.benchmark_text
## What does the output look like?

When the backend successfully processes a contract via the hybrid pipeline, it returns a structured JSON profile identifying both the extracted value and which model routed the answer:
```{
  "filename": "sample_corporate_agreement.pdf",
  "extraction_result": {
    "status": "success",
    "profile": {
      "party_names": {
        "value": "Acme Corporation and Innovatech Solutions Inc.",
        "model_used": "Gemini-3.5-Flash"
      },
      "effective_date": {
        "value": "October 24, 2025",
        "model_used": "Gemini-3.5-Flash"
      },
      "expiration_date": {
        "value": "October 24, 2028",
        "model_used": "RoBERTa-CUAD"
      },
      "governing_law": {
        "value": "State of Delaware",
        "model_used": "Gemini-3.5-Flash"
      }
    }
  }
}