"""
ArogyaNova Domain Layer — Prescription Domain Classes

OOP Principles:
- ENCAPSULATION: Prescription controls its own state transitions
- COMPOSITION: Prescription contains PrescriptionItems
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum
from typing import Optional

from app.domain.base_user import UserRole


class PrescriptionStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class RouteOfAdministration(str, Enum):
    ORAL = "oral"
    TOPICAL = "topical"
    INTRAVENOUS = "intravenous"
    INTRAMUSCULAR = "intramuscular"
    SUBCUTANEOUS = "subcutaneous"
    INHALATION = "inhalation"
    SUBLINGUAL = "sublingual"
    RECTAL = "rectal"
    OPHTHALMIC = "ophthalmic"
    NASAL = "nasal"
    OTHER = "other"


class PrescriptionItem:
    """
    Represents a single medication line within a prescription.

    OOP: Composition — a Prescription is COMPOSED of PrescriptionItems.
    OOP: Encapsulation — internal fields exposed via properties.
    """

    def __init__(
        self,
        item_id: uuid.UUID,
        medication_id: uuid.UUID,
        medication_name: str,
        strength: str,
        dosage: str,
        route: RouteOfAdministration,
        frequency: str,
        duration_days: int,
        quantity: str,
        instructions: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> None:
        self._item_id = item_id
        self._medication_id = medication_id
        self._medication_name = medication_name
        self._strength = strength
        self._dosage = dosage
        self._route = route
        self._frequency = frequency
        self._duration_days = duration_days
        self._quantity = quantity
        self._instructions = instructions
        self._start_date = start_date
        self._end_date = end_date

    @property
    def item_id(self) -> uuid.UUID:
        return self._item_id

    @property
    def medication_id(self) -> uuid.UUID:
        return self._medication_id

    @property
    def medication_name(self) -> str:
        return self._medication_name

    @property
    def strength(self) -> str:
        return self._strength

    @property
    def dosage(self) -> str:
        return self._dosage

    @property
    def route(self) -> RouteOfAdministration:
        return self._route

    @property
    def frequency(self) -> str:
        return self._frequency

    @property
    def duration_days(self) -> int:
        return self._duration_days

    @property
    def quantity(self) -> str:
        return self._quantity

    @property
    def instructions(self) -> Optional[str]:
        return self._instructions

    @property
    def start_date(self) -> Optional[date]:
        return self._start_date

    @property
    def end_date(self) -> Optional[date]:
        return self._end_date

    def to_dict(self) -> dict:
        return {
            "item_id": str(self._item_id),
            "medication_id": str(self._medication_id),
            "medication_name": self._medication_name,
            "strength": self._strength,
            "dosage": self._dosage,
            "route": self._route.value,
            "frequency": self._frequency,
            "duration_days": self._duration_days,
            "quantity": self._quantity,
            "instructions": self._instructions,
            "start_date": self._start_date.isoformat() if self._start_date else None,
            "end_date": self._end_date.isoformat() if self._end_date else None,
        }


class Prescription:
    """
    Core domain class for a medical prescription.

    OOP: ENCAPSULATION — status transitions are controlled via domain methods.
    Status cannot be arbitrarily changed from outside; only valid transitions
    are permitted. Prescription items are managed through dedicated methods.

    OOP: COMPOSITION — a Prescription contains a list of PrescriptionItems.
    """

    # Valid state transitions: {current: [allowed_next_states]}
    _VALID_TRANSITIONS: dict[PrescriptionStatus, list[PrescriptionStatus]] = {
        PrescriptionStatus.DRAFT: [PrescriptionStatus.ACTIVE, PrescriptionStatus.CANCELLED],
        PrescriptionStatus.ACTIVE: [PrescriptionStatus.COMPLETED, PrescriptionStatus.CANCELLED, PrescriptionStatus.EXPIRED],
        PrescriptionStatus.COMPLETED: [],
        PrescriptionStatus.CANCELLED: [],
        PrescriptionStatus.EXPIRED: [],
    }

    def __init__(
        self,
        prescription_id: uuid.UUID,
        patient_id: uuid.UUID,
        doctor_id: uuid.UUID,
        issue_date: date,
        diagnosis: Optional[str] = None,
        clinical_notes: Optional[str] = None,
        follow_up_date: Optional[date] = None,
        status: PrescriptionStatus = PrescriptionStatus.DRAFT,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ) -> None:
        self._prescription_id = prescription_id
        self._patient_id = patient_id
        self._doctor_id = doctor_id
        self._issue_date = issue_date
        self._diagnosis = diagnosis
        self._clinical_notes = clinical_notes
        self._follow_up_date = follow_up_date
        self._status = status
        self._created_at = created_at or datetime.utcnow()
        self._updated_at = updated_at or datetime.utcnow()
        self._items: list[PrescriptionItem] = []

    # --- Properties (Encapsulation: read-only access) ---

    @property
    def prescription_id(self) -> uuid.UUID:
        return self._prescription_id

    @property
    def patient_id(self) -> uuid.UUID:
        return self._patient_id

    @property
    def doctor_id(self) -> uuid.UUID:
        return self._doctor_id

    @property
    def status(self) -> PrescriptionStatus:
        return self._status

    @property
    def issue_date(self) -> date:
        return self._issue_date

    @property
    def diagnosis(self) -> Optional[str]:
        return self._diagnosis

    @property
    def clinical_notes(self) -> Optional[str]:
        return self._clinical_notes

    @property
    def follow_up_date(self) -> Optional[date]:
        return self._follow_up_date

    @property
    def created_at(self) -> datetime:
        return self._created_at

    @property
    def updated_at(self) -> datetime:
        return self._updated_at

    @property
    def items(self) -> list[PrescriptionItem]:
        """Return a defensive copy to prevent external mutation."""
        return list(self._items)

    @property
    def item_count(self) -> int:
        return len(self._items)

    @property
    def is_draft(self) -> bool:
        return self._status == PrescriptionStatus.DRAFT

    @property
    def is_active(self) -> bool:
        return self._status == PrescriptionStatus.ACTIVE

    @property
    def is_editable(self) -> bool:
        """Only draft prescriptions may be modified."""
        return self._status == PrescriptionStatus.DRAFT

    # --- Domain Methods (Encapsulation: controlled state changes) ---

    def add_item(self, item: PrescriptionItem) -> None:
        """Add a medication item. Only permitted while draft."""
        if not self.is_editable:
            raise ValueError(f"Cannot add items to a prescription in '{self._status}' status.")
        self._items.append(item)
        self._touch()

    def remove_item(self, item_id: uuid.UUID) -> None:
        """Remove a medication item by ID. Only permitted while draft."""
        if not self.is_editable:
            raise ValueError(f"Cannot remove items from a prescription in '{self._status}' status.")
        self._items = [i for i in self._items if i.item_id != item_id]
        self._touch()

    def finalize(self) -> None:
        """Transition from DRAFT → ACTIVE. Requires at least one medication."""
        if not self._items:
            raise ValueError("A prescription must have at least one medication before it can be finalized.")
        self._transition_to(PrescriptionStatus.ACTIVE)

    def cancel(self, reason: Optional[str] = None) -> None:
        """Cancel this prescription."""
        self._transition_to(PrescriptionStatus.CANCELLED)

    def complete(self) -> None:
        """Mark this prescription as completed."""
        self._transition_to(PrescriptionStatus.COMPLETED)

    def expire(self) -> None:
        """Mark this prescription as expired."""
        self._transition_to(PrescriptionStatus.EXPIRED)

    def update_clinical_info(
        self,
        diagnosis: Optional[str] = None,
        clinical_notes: Optional[str] = None,
        follow_up_date: Optional[date] = None,
    ) -> None:
        """Update clinical fields — only allowed while in draft."""
        if not self.is_editable:
            raise ValueError("Cannot update clinical information on a non-draft prescription.")
        if diagnosis is not None:
            self._diagnosis = diagnosis
        if clinical_notes is not None:
            self._clinical_notes = clinical_notes
        if follow_up_date is not None:
            self._follow_up_date = follow_up_date
        self._touch()

    def _transition_to(self, new_status: PrescriptionStatus) -> None:
        """Internal: validate and execute a status transition."""
        allowed = self._VALID_TRANSITIONS.get(self._status, [])
        if new_status not in allowed:
            raise ValueError(
                f"Invalid status transition: '{self._status}' → '{new_status}'. "
                f"Allowed transitions: {[s.value for s in allowed]}"
            )
        self._status = new_status
        self._touch()

    def _touch(self) -> None:
        """Update the modification timestamp."""
        self._updated_at = datetime.utcnow()

    def __repr__(self) -> str:
        return (
            f"<Prescription id={self._prescription_id} "
            f"status={self._status.value} items={len(self._items)}>"
        )
