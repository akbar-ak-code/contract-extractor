# check_db.py
from database.connection import SessionLocal
from database.models import PurchaseOrderRecord

# Open a session to the correct database
db = SessionLocal()

# Query all records
records = db.query(PurchaseOrderRecord).all()

print(f"🔍 Found {len(records)} records in the database!")

for record in records:
    print("-" * 40)
    print(f"ID: {record.id}")
    print(f"Filename: {record.filename}")
    print(f"Vendor: {record.vendor_name}")
    print(f"PDF Path: {record.pdf_file_path}")

db.close()