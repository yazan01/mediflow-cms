"""
Run this once to create the default admin user:
  cd backend
  python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from auth import hash_password, generate_id
import models

def seed():
    db = SessionLocal()
    try:
        existing = db.query(models.User).filter(models.User.email == "admin@mediflow.com").first()
        if existing:
            print("Admin user already exists — skipping.")
            return

        admin = models.User(
            id=generate_id(),
            name="System Admin",
            email="admin@mediflow.com",
            passwordHash=hash_password("Admin@1234"),
            roles=["SUPER_ADMIN"],
            isActive=True,
        )
        db.add(admin)
        db.commit()
        print("Admin user created: admin@mediflow.com / Admin@1234")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
