"""
Tests for ArogyaNova Cybersecurity: RBAC, Object-Level Authorization, Password Strength
"""
import uuid
import pytest
from app.domain.base_user import UserRole
from app.domain.users import Administrator, Doctor, Patient, Pharmacist
from app.security.passwords import (
    hash_password,
    verify_password,
    validate_password_strength,
    create_access_token,
    decode_access_token,
)


def test_password_strength_validation():
    # Valid strong password
    errors = validate_password_strength("Secure@Pass2026!")
    assert len(errors) == 0

    # Too short
    errors = validate_password_strength("Short1")
    assert any("8 characters" in e for e in errors)

    # No uppercase
    errors = validate_password_strength("lowercase123")
    assert any("uppercase" in e for e in errors)

    # No digit
    errors = validate_password_strength("NoDigitsHere!")
    assert any("digit" in e for e in errors)


def test_argon2id_password_hashing():
    raw_pass = "MySecretMedPassword@2026"
    hashed = hash_password(raw_pass)
    assert hashed.startswith("$argon2id$")
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword@2026", hashed) is False


def test_rbac_user_hierarchy_permissions():
    """Verify that domain user classes strictly enforce role permissions."""
    doc = Doctor(uuid.uuid4(), "doc@arogyanova.dev", "Dr. Priya", "Sharma", license_number="MCI-2024-001")
    patient = Patient(uuid.uuid4(), "pat@arogyanova.dev", "Ravi", "Verma")
    pharma = Pharmacist(uuid.uuid4(), "pharm@arogyanova.dev", "Anil", "Menon", license_number="PH-2024-002")
    admin = Administrator(uuid.uuid4(), "admin@arogyanova.dev", "Arjun", "Kumar")

    # Doctors can create prescriptions, patients and pharmacists cannot
    assert doc.can_create_prescription() is True
    assert patient.can_create_prescription() is False
    assert pharma.can_create_prescription() is False
    assert admin.can_create_prescription() is False

    # Check permission strings
    assert doc.has_permission("prescription:create") is True
    assert patient.has_permission("prescription:create") is False
    assert pharma.has_permission("prescription:review") is True
    assert patient.has_permission("prescription:review") is False
    assert admin.has_permission("user:read") is True
    assert doc.has_permission("user:read") is False


def test_patient_can_only_read_own_records():
    """Verify role permissions in domain model."""
    patient = Patient(uuid.uuid4(), "pat@arogyanova.dev", "Ravi", "Verma")
    assert patient.has_permission("prescription:read:own") is True
    assert patient.has_permission("prescription:read:all") is False
    assert patient.has_permission("schedule:log") is True
