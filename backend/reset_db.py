"""
Wipes and recreates the database schema, then seeds default users.
  cd backend
  python reset_db.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from database import engine, Base
import models  # noqa: F401 — registers all models on Base
from seed import seed

print("Dropping all tables...")
with engine.connect() as conn:
    conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
    for table in reversed(Base.metadata.sorted_tables):
        conn.execute(text(f"DROP TABLE IF EXISTS `{table.name}`"))
    conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    conn.commit()

print("Recreating schema...")
Base.metadata.create_all(bind=engine)
print("Seeding default users...")
seed()
print("\nReset complete.")
