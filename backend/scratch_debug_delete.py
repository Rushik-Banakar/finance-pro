import sqlite3

conn = sqlite3.connect("money_manager.db")
cursor = conn.cursor()

print("--- Transactions by Category ID ---")
cursor.execute("""
    SELECT t.category_id, c.name, c.user_id, COUNT(*) 
    FROM transactions t 
    LEFT JOIN categories c ON t.category_id = c.id 
    GROUP BY t.category_id
""")
for row in cursor.fetchall():
    print(row)

conn.close()
