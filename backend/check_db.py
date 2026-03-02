import sqlite3
conn = sqlite3.connect("mistakes.db")
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
print("当前 mistakes.db 里包含的表有:", cursor.fetchall())