import sqlite3
import os

# Point to your database
db_path = os.path.join("data", "po_database.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Force SQLite to add the missing column
    cursor.execute("ALTER TABLE purchase_orders ADD COLUMN edit_history JSON;")
    print("✅ Column 'edit_history' added successfully!")
except Exception as e:
    print(f"⚠️ Error: {e}")

conn.commit()
conn.close()