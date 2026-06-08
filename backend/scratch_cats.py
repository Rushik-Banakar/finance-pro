import sqlite3

conn = sqlite3.connect('money_manager.db')
cursor = conn.cursor()
cursor.execute("SELECT id, name, type, planned_outlay, is_custom, user_id FROM categories;")
rows = cursor.fetchall()
for r in rows:
    print(f"ID: {r[0]}, Name: {r[1]}, Type: {r[2]}, Outlay: {r[3]}, Custom: {r[4]}, UserID: {r[5]}")
conn.close()
