"""
ArogyaNova Domain Layer — Concrete User Types (Inheritance + Polymorphism)

OOP Principles:
- INHERITANCE: Doctor, Patient, Pharmacist, Administrator all extend BaseUser
- POLYMORPHISM: get_permissions() and can_create_prescription() behave differently per subclass
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from app.domain.base_user import BaseUser, UserRole


class Doctor(BaseUser):
    """
    Represents a licensed medical doctor who can author prescriptions.

    OOP: Inheritance from BaseUser
    OOP: Polymorphism via get_permissions() override
    """

    PERMISSIONS = {
        "prescription:create",
        "prescription:read:own",
        "prescription:edit:draft",
        "prescription:finalize",
        "prescription:cancel",
        "patient:read:authorized",
        "medication:read",
        "schedule:read",
        "analytics:read:own",
        "notification:read",
        "ai:ocr",
        "ai:interaction_check",
    }

    def __init__(
        self,
        user_id: uuid.UUID,
        email: str,
        first_name: str,
        last_name: str,
        license_number: str,
        specialization: Optional[str] = None,
        is_active: bool = True,
        created_at: Optional[datetime] = None,
    ) -> None:
        super().__init__(user_id, email, first_name, last_name, UserRole.DOCTOR, is_active, created_at)
        self._license_number = license_number
        self._specialization = specialization

    @property
    def license_number(self) -> str:
        return self._license_number

    @property
    def specialization(self) -> Optional[str]:
        return self._specialization

    def get_permissions(self) -> set[str]:
        return self.PERMISSIONS.copy()

    def can_create_prescription(self) -> bool:
        return self._is_active

    @property
    def display_title(self) -> str:
        return f"Dr. {self.full_name}"


class Patient(BaseUser):
    """
    Represents a patient who can view their own prescriptions and log adherence.

    OOP: Inheritance from BaseUser
    OOP: Polymorphism via overridden methods
    """

    PERMISSIONS = {
        "prescription:read:own",
        "schedule:read:own",
        "schedule:log",
        "notification:read",
        "profile:edit:own",
    }

    def __init__(
        self,
        user_id: uuid.UUID,
        email: str,
        first_name: str,
        last_name: str,
        date_of_birth: Optional[datetime] = None,
        phone: Optional[str] = None,
        address: Optional[str] = None,
        blood_group: Optional[str] = None,
        is_active: bool = True,
        created_at: Optional[datetime] = None,
    ) -> None:
        super().__init__(user_id, email, first_name, last_name, UserRole.PATIENT, is_active, created_at)
        self._date_of_birth = date_of_birth
        self._phone = phone
        self._address = address
        self._blood_group = blood_group

    @property
    def date_of_birth(self) -> Optional[datetime]:
        return self._date_of_birth

    @property
    def phone(self) -> Optional[str]:
        return self._phone

    @property
    def blood_group(self) -> Optional[str]:
        return self._blood_group

    def get_permissions(self) -> set[str]:
        return self.PERMISSIONS.copy()

    def can_create_prescription(self) -> bool:
        # Patients never create prescriptions
        return False


class Pharmacist(BaseUser):
    """
    Represents a licensed pharmacist who reviews prescriptions.

    OOP: Inheritance from BaseUser
    """

    PERMISSIONS = {
        "prescription:read:authorized",
        "prescription:review",
        "prescription:flag",
        "medication:read",
        "notification:read",
    }

    def __init__(
        self,
        user_id: uuid.UUID,
        email: str,
        first_name: str,
        last_name: str,
        license_number: str,
        pharmacy_name: Optional[str] = None,
        is_active: bool = True,
        created_at: Optional[datetime] = None,
    ) -> None:
        super().__init__(user_id, email, first_name, last_name, UserRole.PHARMACIST, is_active, created_at)
        self._license_number = license_number
        self._pharmacy_name = pharmacy_name

    @property
    def license_number(self) -> str:
        return self._license_number

    def get_permissions(self) -> set[str]:
        return self.PERMISSIONS.copy()

    def can_create_prescription(self) -> bool:
        return False


class Administrator(BaseUser):
    """
    System administrator with user and catalogue management rights.

    OOP: Inheritance from BaseUser
    Note: Clinical data access is NOT automatically granted — must be explicit.
    """

    PERMISSIONS = {
        "user:read",
        "user:create",
        "user:edit",
        "user:deactivate",
        "medication:create",
        "medication:edit",
        "medication:deactivate",
        "audit:read",
        "analytics:read:all",
        "notification:read",
        "prescription:read:summary",
    }

    def __init__(
        self,
        user_id: uuid.UUID,
        email: str,
        first_name: str,
        last_name: str,
        is_active: bool = True,
        created_at: Optional[datetime] = None,
    ) -> None:
        super().__init__(user_id, email, first_name, last_name, UserRole.ADMINISTRATOR, is_active, created_at)

    def get_permissions(self) -> set[str]:
        return self.PERMISSIONS.copy()

    def can_create_prescription(self) -> bool:
        return False
