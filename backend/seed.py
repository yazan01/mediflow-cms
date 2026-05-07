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

        # Default departments
        dept_names = ["Medical", "Nursing", "Administration", "Finance", "Human Resources", "Pharmacy", "Laboratory", "Radiology"]
        dept_ids = {}
        for name in dept_names:
            existing = db.query(models.Department).filter(models.Department.name == name).first()
            if not existing:
                dept = models.Department(id=generate_id(), name=name, code=name[:3].upper())
                db.add(dept)
                db.flush()
                dept_ids[name] = dept.id
            else:
                dept_ids[name] = existing.id
        if dept_ids:
            print(f"[OK]Departments seeded: {', '.join(dept_names)}")

        # Default branch (Main)
        main_branch = db.query(models.Branch).filter(models.Branch.code == "MAIN").first()
        if not main_branch:
            main_branch = models.Branch(
                id=generate_id(),
                name="Main Branch",
                code="MAIN",
                timezone="Asia/Amman",
                isActive=True,
            )
            db.add(main_branch)
            db.flush()
            print("[OK]Default branch created: Main Branch (MAIN)")

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
