import sqlite3

conn = sqlite3.connect('money_manager.db')
cursor = conn.cursor()
cursor.execute("SELECT id, amount, date, type, category_id, description, user_id FROM transactions ORDER BY id DESC LIMIT 20;")
rows = cursor.fetchall()
for r in rows:
    print(f"ID: {r[0]}, Amount: {r[1]}, Date: {r[2]}, Type: {r[3]}, CategoryID: {r[4]}, Desc: {r[5]}, UserID: {r[6]}")
conn.close()
