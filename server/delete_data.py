import sqlite3
import os

# 🚀 Path ko fix kar diya: pehle 'data' folder mein jao, phir file dhundo
db_path = os.path.join("data", "po_database.db") 

# Connect karo
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 3. View the records first
print("--- Current Records ---")
cursor.execute("SELECT id, filename FROM purchase_orders")
for row in cursor.fetchall():
    print(f"ID: {row[0]} | Filename: {row[1]}")

# 4. Ask which ID to delete
target_id = input("\nEnter the ID of the record you want to delete (or type 'all' to clear everything): ")

if target_id.lower() == 'all':
    cursor.execute("DELETE FROM purchase_orders")
    print("Wiped all records.")
else:
    cursor.execute("DELETE FROM purchase_orders WHERE id = ?", (target_id,))
    print(f"Deleted record {target_id}.")

conn.commit()
conn.close()
print("Done!")