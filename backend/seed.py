"""
Run this once to seed the database with default users:
  cd backend
  python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime
from database import SessionLocal
from auth import hash_password, generate_id, generate_emp_code
import models


def seed():
    db = SessionLocal()
    try:
        # Admin user
        admin = db.query(models.User).filter(models.User.email == "admin@mediflow.com").first()
        if not admin:
            admin = models.User(
                id=generate_id(),
                name="System Admin",
                email="admin@mediflow.com",
                passwordHash=hash_password("Admin@1234"),
                roles=["SUPER_ADMIN"],
                isActive=True,
            )
            db.add(admin)
            db.flush()
            print("[OK]Admin user created: admin@mediflow.com / Admin@1234")
        else:
            print("  Admin user already exists — skipping.")

        # Sample doctor user
        doctor_user = db.query(models.User).filter(models.User.email == "doctor@mediflow.com").first()
        if not doctor_user:
            doctor_user = models.User(
                id=generate_id(),
                name="Dr. Ahmad Al-Mansouri",
                email="doctor@mediflow.com",
                passwordHash=hash_password("Doctor@1234"),
                roles=["DOCTOR"],
                isActive=True,
            )
            db.add(doctor_user)
            db.flush()

            doctor = models.Doctor(
                id=generate_id(),
                userId=doctor_user.id,
                specialization="Internal Medicine",
                consultationFee=150,
                isAvailable=True,
            )
            db.add(doctor)
            print("[OK]Doctor user created: doctor@mediflow.com / Doctor@1234")
        else:
            print("  Doctor user already exists — skipping.")

        db.commit()
        print("\nSeed complete.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
