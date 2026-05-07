"""
Wipes and recreates the database schema, then seeds default users.
  cd backend
  python reset_db.py --confirm

The --confirm flag is REQUIRED to prevent accidental execution.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

if "--confirm" not in sys.argv:
    print("ERROR: This script permanently destroys all data.")
    print("Re-run with --confirm to proceed:")
    print("  python reset_db.py --confirm")
    sys.exit(1)

from sqlalchemy import text
from database import engine, Base
import models  # noqa: F401 — registers all models on Base
from seed import seed

print("WARNING: Dropping all tables in 3 seconds... Press Ctrl+C to abort.")
import time
time.sleep(3)

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
