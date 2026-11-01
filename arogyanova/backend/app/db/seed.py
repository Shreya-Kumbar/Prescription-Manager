"""
ArogyaNova — Database Seed Script
Creates demo accounts and sample data for development.
Idempotent: safe to call multiple times — skips if data already exists.

Run with: python -m app.db.seed
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import AsyncSessionLocal, engine
from app.models.models import (
    Base, DoctorProfileModel, MedicationModel, MedicationScheduleModel,
    NotificationModel, PatientProfileModel, PharmacistProfileModel,
    PrescriptionItemModel, PrescriptionModel, UserModel,
)
from app.security.passwords import hash_password

MEDICATIONS = [
    {"generic_name": "Amoxicillin", "brand_name": "Amoxil", "strength": "500mg", "dosage_form": "Capsule", "category": "Antibiotic"},
    {"generic_name": "Paracetamol", "brand_name": "Crocin", "strength": "500mg", "dosage_form": "Tablet", "category": "Analgesic"},
    {"generic_name": "Metformin", "brand_name": "Glycomet", "strength": "500mg", "dosage_form": "Tablet", "category": "Antidiabetic"},
    {"generic_name": "Atorvastatin", "brand_name": "Lipitor", "strength": "10mg", "dosage_form": "Tablet", "category": "Statin"},
    {"generic_name": "Lisinopril", "brand_name": "Zestril", "strength": "5mg", "dosage_form": "Tablet", "category": "ACE Inhibitor"},
    {"generic_name": "Omeprazole", "brand_name": "Omez", "strength": "20mg", "dosage_form": "Capsule", "category": "PPI"},
    {"generic_name": "Cetirizine", "brand_name": "Zyrtec", "strength": "10mg", "dosage_form": "Tablet", "category": "Antihistamine"},
    {"generic_name": "Azithromycin", "brand_name": "Zithromax", "strength": "250mg", "dosage_form": "Tablet", "category": "Antibiotic"},
    {"generic_name": "Ibuprofen", "brand_name": "Brufen", "strength": "400mg", "dosage_form": "Tablet", "category": "NSAID"},
    {"generic_name": "Amlodipine", "brand_name": "Norvasc", "strength": "5mg", "dosage_form": "Tablet", "category": "Calcium Channel Blocker"},
    {"generic_name": "Salbutamol", "brand_name": "Ventolin", "strength": "100mcg", "dosage_form": "Inhaler", "category": "Bronchodilator"},
    {"generic_name": "Pantoprazole", "brand_name": "Pantocid", "strength": "40mg", "dosage_form": "Tablet", "category": "PPI"},
    {"generic_name": "Clopidogrel", "brand_name": "Plavix", "strength": "75mg", "dosage_form": "Tablet", "category": "Antiplatelet"},
    {"generic_name": "Metoprolol", "brand_name": "Betaloc", "strength": "50mg", "dosage_form": "Tablet", "category": "Beta Blocker"},
    {"generic_name": "Doxycycline", "brand_name": "Vibramycin", "strength": "100mg", "dosage_form": "Capsule", "category": "Antibiotic"},
]


async def seed() -> None:
    """Idempotent seed — skips if users already exist in the database."""

    # --- Idempotency check ---
    async with AsyncSessionLocal() as check_db:
        count = (
            await check_db.execute(select(func.count()).select_from(UserModel))
        ).scalar_one()
        if count > 0:
            print("* Database already seeded — skipping.")
            return

    print("* Starting ArogyaNova seed...")

    async with AsyncSessionLocal() as db:
        # Create medications
        med_ids: dict[str, uuid.UUID] = {}
        print("  Creating medication catalogue...")
        for m in MEDICATIONS:
            mid = uuid.uuid4()
            med_ids[m["generic_name"]] = mid
            db.add(MedicationModel(id=mid, **m, is_active=True))

        # Admin
        admin_id = uuid.uuid4()
        db.add(UserModel(
            id=admin_id,
            email="admin@arogyanova.dev",
            hashed_password=hash_password("Demo@Admin123"),
            first_name="Arjun",
            last_name="Kumar",
            role="administrator",
        ))

        # Doctors
        dr_sharma_id = uuid.uuid4()
        db.add(UserModel(
            id=dr_sharma_id,
            email="dr.sharma@arogyanova.dev",
            hashed_password=hash_password("Demo@Doctor123"),
            first_name="Priya",
            last_name="Sharma",
            role="doctor",
        ))
        db.add(DoctorProfileModel(
            user_id=dr_sharma_id,
            license_number="MCI-2024-01847",
            specialization="General Medicine",
            hospital_affiliation="Apollo Hospital, Mumbai",
            phone="+91-9876543210",
        ))

        dr_patel_id = uuid.uuid4()
        db.add(UserModel(
            id=dr_patel_id,
            email="dr.patel@arogyanova.dev",
            hashed_password=hash_password("Demo@Doctor123"),
            first_name="Rahul",
            last_name="Patel",
            role="doctor",
        ))
        db.add(DoctorProfileModel(
            user_id=dr_patel_id,
            license_number="MCI-2024-02934",
            specialization="Cardiology",
            hospital_affiliation="Fortis Hospital, Delhi",
            phone="+91-9876543220",
        ))

        # Patients
        patient_ravi_id = uuid.uuid4()
        db.add(UserModel(
            id=patient_ravi_id,
            email="patient.ravi@arogyanova.dev",
            hashed_password=hash_password("Demo@Patient123"),
            first_name="Ravi",
            last_name="Verma",
            role="patient",
        ))
        db.add(PatientProfileModel(
            user_id=patient_ravi_id,
            date_of_birth=date(1985, 6, 15),
            phone="+91-9898989898",
            address="123 MG Road, Bengaluru 560001",
            blood_group="O+",
            emergency_contact="Sunita Verma: +91-9898989800",
            allergies="Penicillin",
        ))

        patient_priya_id = uuid.uuid4()
        db.add(UserModel(
            id=patient_priya_id,
            email="patient.priya@arogyanova.dev",
            hashed_password=hash_password("Demo@Patient123"),
            first_name="Priya",
            last_name="Nair",
            role="patient",
        ))
        db.add(PatientProfileModel(
            user_id=patient_priya_id,
            date_of_birth=date(1992, 3, 22),
            phone="+91-9787878787",
            blood_group="A+",
        ))

        # Pharmacist
        pharma_id = uuid.uuid4()
        db.add(UserModel(
            id=pharma_id,
            email="pharma.anil@arogyanova.dev",
            hashed_password=hash_password("Demo@Pharma123"),
            first_name="Anil",
            last_name="Menon",
            role="pharmacist",
        ))
        db.add(PharmacistProfileModel(
            user_id=pharma_id,
            license_number="PH-2024-00345",
            pharmacy_name="MedCare Pharmacy",
            phone="+91-9765432100",
        ))

        # Sample prescriptions
        today = date.today()

        # Prescription 1: Active (finalized)
        pres1_id = uuid.uuid4()
        db.add(PrescriptionModel(
            id=pres1_id,
            patient_id=patient_ravi_id,
            doctor_id=dr_sharma_id,
            status="active",
            issue_date=today - timedelta(days=7),
            follow_up_date=today + timedelta(days=21),
            diagnosis="Acute upper respiratory tract infection",
            clinical_notes="Patient presents with sore throat, mild fever (38.2 C). No known drug allergies except penicillin. Prescribed amoxicillin with caution.",
        ))
        item1a_id = uuid.uuid4()
        item1b_id = uuid.uuid4()
        db.add(PrescriptionItemModel(
            id=item1a_id,
            prescription_id=pres1_id,
            medication_id=med_ids["Amoxicillin"],
            strength="500mg",
            dosage="1 capsule",
            route="oral",
            frequency="Three times daily",
            duration_days=7,
            quantity="21 capsules",
            instructions="Take with food. Complete the full course.",
            start_date=today - timedelta(days=7),
            end_date=today,
        ))
        db.add(PrescriptionItemModel(
            id=item1b_id,
            prescription_id=pres1_id,
            medication_id=med_ids["Paracetamol"],
            strength="500mg",
            dosage="1-2 tablets",
            route="oral",
            frequency="As needed for fever/pain (max 4 times daily)",
            duration_days=7,
            quantity="28 tablets",
            instructions="Do not exceed 8 tablets (4g) in 24 hours.",
            start_date=today - timedelta(days=7),
        ))

        # Add schedule entries
        for day in range(7):
            for time_hour in [8, 14, 20]:
                sched_time = datetime.now(timezone.utc).replace(hour=time_hour, minute=0, second=0) - timedelta(days=7-day)
                db.add(MedicationScheduleModel(
                    patient_id=patient_ravi_id,
                    prescription_item_id=item1a_id,
                    scheduled_at=sched_time,
                    medication_name="Amoxicillin",
                    dosage="1 capsule",
                    instructions="Take with food.",
                ))

        # Prescription 2: Draft
        pres2_id = uuid.uuid4()
        db.add(PrescriptionModel(
            id=pres2_id,
            patient_id=patient_priya_id,
            doctor_id=dr_patel_id,
            status="draft",
            issue_date=today,
            diagnosis="Hypertension Stage 1",
            clinical_notes="BP 145/92 mmHg on two readings. Started on low-dose antihypertensive.",
        ))
        db.add(PrescriptionItemModel(
            id=uuid.uuid4(),
            prescription_id=pres2_id,
            medication_id=med_ids["Amlodipine"],
            strength="5mg",
            dosage="1 tablet",
            route="oral",
            frequency="Once daily (morning)",
            duration_days=30,
            quantity="30 tablets",
            instructions="Take at the same time each day. Monitor BP weekly.",
            start_date=today,
        ))

        # Prescription 3: Completed
        pres3_id = uuid.uuid4()
        db.add(PrescriptionModel(
            id=pres3_id,
            patient_id=patient_ravi_id,
            doctor_id=dr_sharma_id,
            status="completed",
            issue_date=today - timedelta(days=45),
            diagnosis="Type 2 Diabetes Mellitus initial management",
        ))
        db.add(PrescriptionItemModel(
            id=uuid.uuid4(),
            prescription_id=pres3_id,
            medication_id=med_ids["Metformin"],
            strength="500mg",
            dosage="1 tablet",
            route="oral",
            frequency="Twice daily with meals",
            duration_days=30,
            quantity="60 tablets",
            instructions="Take with food to reduce GI side effects.",
            start_date=today - timedelta(days=45),
            end_date=today - timedelta(days=15),
        ))

        # Notifications
        db.add(NotificationModel(
            user_id=patient_ravi_id,
            title="Welcome to ArogyaNova",
            message="Your account has been created successfully. You can view your prescriptions and medication schedule here.",
            priority="normal",
            is_read=False,
        ))
        db.add(NotificationModel(
            user_id=dr_sharma_id,
            title="Demo Environment Ready",
            message="ArogyaNova demo data has been loaded. You can create and manage prescriptions for demo patients.",
            priority="normal",
            is_read=False,
        ))

        await db.commit()
        print("* Seed complete!")
        print("\n* Demo Accounts:")
        print("  admin@arogyanova.dev         | Demo@Admin123    | Administrator")
        print("  dr.sharma@arogyanova.dev     | Demo@Doctor123   | Doctor")
        print("  dr.patel@arogyanova.dev      | Demo@Doctor123   | Doctor")
        print("  patient.ravi@arogyanova.dev  | Demo@Patient123  | Patient")
        print("  patient.priya@arogyanova.dev | Demo@Patient123  | Patient")
        print("  pharma.anil@arogyanova.dev   | Demo@Pharma123   | Pharmacist")


if __name__ == "__main__":
    asyncio.run(seed())
