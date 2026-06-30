# 📄 Contract Extractor

An end-to-end, full-stack application designed to ingest, analyze, and extract structured data from complex Purchase Order (PO) and contract PDFs. This system utilizes a highly resilient **Hybrid AI Cascade Extraction Pipeline** (Gemini 2.5 Flash → Groq Llama-4 Scout → Regex Fallback) to guarantee data extraction accuracy, coupled with a sleek React frontend that allows users to visually verify AI-extracted fields directly against the source document.

---

## ✨ Key Features

* **🧠 Hybrid AI Cascade Pipeline:** Prioritizes Gemini 2.5 Flash for initial extraction. If it fails, falls back to Groq's Llama-4 Scout, and finally relies on robust Regex patterns for ultimate fault tolerance.
* **🔍 Deep Contract Analysis:** A secondary AI pass dedicated to identifying complex project deadlines, payment obligations, missing clauses (anomalies), and generating PO-specific dynamic fields.
* **🎯 Source Verification Engine:** Click on any extracted field to open a React-PDF viewer that uses a sliding-window text-matching algorithm to highlight the exact clause, sentence, or word the AI used to extract the data.
* **⏱️ Interactive Deadline Calculator:** Automatically calculates contract deadlines based on relative anchors (e.g., "30 days after invoice"). Unresolved triggers can be manually adjusted via an interactive UI.
* **⚙️ Dynamic Custom Schema Management:** Administrators can define new custom fields globally. The system will retroactively back-fill this new data across all previously processed documents.
* **📊 Tabular Line Item Extraction:** Extracts complex tabular data while preserving row integrity via intelligent, page-level PDF chunking using PyMuPDF.
* **📅 Calendar Dashboard:** A centralized calendar view mapping out all upcoming contract expiry dates and critical milestones across the enterprise.

---

## 🛠️ Architecture & Tech Stack

### Backend (Python)
| Technology | Purpose |
| :--- | :--- |
| **FastAPI** | High-performance asynchronous API framework for handling uploads and CRUD operations. |
| **SQLAlchemy (SQLite)** | Database ORM. DB is stored locally at `./data/po_database.db`. |
| **PyMuPDF (fitz)** | Rapid, page-level PDF text extraction to preserve tabular data structures. |
| **Google GenAI SDK** | Primary extraction engine using `gemini-2.5-flash` with strict JSON schema enforcement. |
| **Groq SDK** | Fallback extraction engine using `meta-llama/llama-4-scout-17b-16e-instruct`. |

### Frontend (React)
| Technology | Purpose |
| :--- | :--- |
| **React** | Component-based UI architecture. |
| **React-PDF** | Renders uploaded PDFs directly in the browser for visual source verification. |
| **React-Big-Calendar** | Visualizes extracted contract dates and deadlines. |
| **Lucide React** | Consistent, modern iconography. |
| **Tailwind CSS** | Utility-first styling for complex, responsive dashboards. |

---

## 📂 Project Structure

```text
contract-extractor/
├── backend/
│   ├── main.py                  # FastAPI application entry point
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # API Keys (Gemini, Groq)
│   ├── database/
│   │   ├── connection.py        # SQLite engine & session configuration
│   │   └── models.py            # SQLAlchemy PurchaseOrderRecord schema
│   ├── extractor/
│   │   ├── config.py            # System configuration & field mappings
│   │   ├── extraction.py        # Core AI Cascade (Gemini -> Groq -> Regex)
│   │   └── ingestion.py         # PyMuPDF chunking logic
│   ├── data/                    # Generated automatically
│   │   ├── po_database.db       # Local SQLite Database
│   │   └── custom_fields.json   # Dynamic schema configurations
│   └── document_storage/        # Local storage for uploaded PDF files
│
└── frontend/
    ├── package.json
    └── src/
        ├── App.jsx              # Main React dashboard shell
        ├── components/          # ExtractionView, CalendarView, SourceSidebar, etc.
        └── utils/               # Date parsing and UI helpers