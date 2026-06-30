<div align="center">

# 📄 Contract Extractor

### AI-Powered Legal Contract Analysis using Gemini + RoBERTa

Extract key legal clauses, contract metadata, and important information from contracts with a Hybrid AI Pipeline.

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite)
![Gemini](https://img.shields.io/badge/Gemini-AI-4285F4?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

### 🚀 Intelligent Hybrid Legal Contract Extraction

</div>

---

# ✨ Features

✅ Upload Legal Contracts (PDF)

✅ Hybrid AI Pipeline

✅ Gemini 2.5 Flash Integration

✅ RoBERTa CUAD Legal Clause Extraction

✅ Semantic Routing

✅ Source Verification

✅ Editable Extracted Fields

✅ CSV Export

✅ JSON API

✅ Responsive React Dashboard

✅ FastAPI Backend

---

# 🧠 AI Architecture

```
                     Legal Contract PDF
                              │
                              ▼
                  PDF Text Extraction
                              │
                              ▼
                  Intelligent AI Router
                     ┌──────────────┐
                     │              │
                     ▼              ▼
            Gemini 2.5 Flash   RoBERTa CUAD
                     │              │
                     └──────┬───────┘
                            ▼
               Combined Structured Output
                            │
                            ▼
      React Dashboard • CSV Export • REST API
```

---

# 📑 Supported Contracts

- Employment Agreement
- Service Agreement
- NDA
- Lease Agreement
- Purchase Agreement
- SaaS Agreement
- Vendor Agreement
- Licensing Agreement
- Consulting Agreement
- Partnership Agreement
- Subscription Agreement
- Supply Agreement

---

# 🔍 Extracted Information

The system automatically extracts

- Party Names
- Effective Date
- Expiration Date
- Renewal Terms
- Payment Terms
- Governing Law
- Termination Clause
- Confidentiality
- Liability
- Penalties
- Indemnification
- Assignment Clause
- Insurance
- Notice Clause
- Intellectual Property
- Dispute Resolution

---

# ⚙️ Tech Stack

| Category | Technology |
|----------|------------|
| Backend | FastAPI |
| Frontend | React + Vite |
| AI | Gemini 2.5 Flash |
| NLP | RoBERTa (CUAD) |
| Database | SQLAlchemy |
| Language | Python |
| Styling | Tailwind CSS |

---

# 📂 Project Structure

```
contract-extractor
│
├── client
│   ├── src
│   ├── public
│   └── package.json
│
├── server
│   ├── models
│   ├── routes
│   ├── services
│   ├── evaluate
│   ├── main.py
│   └── requirements.txt
│
└── README.md
```

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/contract-extractor.git

cd contract-extractor
```

---

## Backend

```bash
cd server

python -m venv venv
```

### Windows

```bash
venv\Scripts\activate
```

### Linux / Mac

```bash
source venv/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

Create a `.env`

```env
GEMINI_API_KEY=YOUR_API_KEY
```

---

## Frontend

```bash
cd ../client

npm install
```

---

# ▶️ Run Project

### Backend

```bash
cd server

venv\Scripts\activate

uvicorn main:app --reload
```

Runs on

```
http://localhost:8000
```

---

### Frontend

```bash
cd client

npm run dev
```

Runs on

```
http://localhost:5173
```

---

# 📊 Benchmark

Generate benchmark

```bash
python -m evaluate.benchmark
```

Generate extracted text matrix

```bash
python -m evaluate.benchmark_text
```

---

# 📤 Sample Output

```json
{
  "contract.pdf": {
    "status": "success",
    "profile": {
      "party_names": {
        "value": "ABC Ltd & XYZ Pvt Ltd",
        "model_used": "Gemini-2.5-Flash"
      },
      "effective_date": {
        "value": "01 January 2025",
        "model_used": "Gemini-2.5-Flash"
      },
      "governing_law": {
        "value": "State of California",
        "model_used": "RoBERTa-CUAD"
      }
    }
  }
}
```

---

# 💡 Use Cases

- Contract Review
- Legal Document Analysis
- Due Diligence
- Enterprise Automation
- Procurement
- Compliance
- Legal AI Research
- Document Intelligence

---

# 📈 Future Enhancements

- OCR Support
- DOCX Support
- Confidence Score
- Multi-language Contracts
- Batch Processing
- Clause Comparison
- Risk Analysis
- Contract Summarization

---

# 🤝 Contributing

Pull requests are welcome!

If you'd like to improve the project, feel free to fork the repository and submit a PR.

---

# ⭐ Support

If you found this project useful, don't forget to ⭐ the repository!

---

<div align="center">

Made with ❤️ using FastAPI, React, Gemini AI & RoBERTa

</div>