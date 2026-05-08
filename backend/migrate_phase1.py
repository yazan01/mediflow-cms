"""
Phase 1 migration — adds new columns to the `branches` table.
Run ONCE after pulling Phase 1 changes:

    cd backend
    python migrate_phase1.py

Safe to run multiple times (idempotent via IF NOT EXISTS).
"""
import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    sys.exit("DATABASE_URL not set in backend/.env")

engine = create_engine(DATABASE_URL)

ALTER_STATEMENTS = [
    "ALTER TABLE branches ADD COLUMN description TEXT",
    "ALTER TABLE branches ADD COLUMN country VARCHAR(50)",
    "ALTER TABLE branches ADD COLUMN city VARCHAR(100)",
]

with engine.connect() as conn:
    for stmt in ALTER_STATEMENTS:
        col = stmt.split("COLUMN ")[1].split(" ")[0]
        try:
            conn.execute(text(stmt))
            conn.commit()
            print(f"  [OK] Added column: {col}")
        except Exception as e:
            if "Duplicate column name" in str(e) or "already exists" in str(e):
                print(f"  [--] Skipped (already exists): {col}")
            else:
                print(f"  [!!] Error on {col}: {e}")

print("\nNew tables (branch_settings, clinics, smtp_configs, settings_history)")
print("are created automatically when the backend starts — no action needed.\n")
print("Migration complete.")
