"""
ArogyaNova Domain Layer — Pharmacy Review (verification & dispensing)

OOP Principles:
- ENCAPSULATION: the review status is private and only changes through
  verify(), flag() and dispense(), which enforce the pharmacy rules.
- STATE PATTERN (table-driven): _VALID_TRANSITIONS lists every legal move.
- ABSTRACTION: callers ask "can this be dispensed?" via properties instead of
  re-implementing the rules in the API or UI.

Workflow:
    PENDING ──verify──▶ VERIFIED ──dispense──▶ DISPENSED
       │                   │
       └──flag(reason)──▶ FLAGGED ──verify──▶ VERIFIED
"""
from __future__ import annotations

from enum import Enum
from typing import Optional


class PharmacyStatus(str, Enum):
    PENDING = "pending"      # waiting for a pharmacist
    VERIFIED = "verified"    # checked and safe to dispense
    FLAGGED = "flagged"      # problem found; doctor notified
    DISPENSED = "dispensed"  # medicines handed to the patient


class PharmacyAction(str, Enum):
    VERIFY = "verify"
    FLAG = "flag"
    DISPENSE = "dispense"


class PharmacyReview:
    """Pharmacist review of one prescription."""

    _VALID_TRANSITIONS: dict[PharmacyStatus, list[PharmacyStatus]] = {
        PharmacyStatus.PENDING: [PharmacyStatus.VERIFIED, PharmacyStatus.FLAGGED],
        PharmacyStatus.FLAGGED: [PharmacyStatus.VERIFIED],
        PharmacyStatus.VERIFIED: [PharmacyStatus.DISPENSED, PharmacyStatus.FLAGGED],
        PharmacyStatus.DISPENSED: [],
    }

    def __init__(self, prescription_status: str, status: PharmacyStatus = PharmacyStatus.PENDING) -> None:
        self._prescription_status = prescription_status
        self._status = PharmacyStatus(status)

    # --- read-only properties ---
    @property
    def status(self) -> PharmacyStatus:
        return self._status

    @property
    def can_dispense(self) -> bool:
        return self._status == PharmacyStatus.VERIFIED and self._prescription_status == "active"

    @property
    def is_closed(self) -> bool:
        return self._status == PharmacyStatus.DISPENSED

    # --- behaviour ---
    def verify(self) -> None:
        self._require_active()
        self._transition_to(PharmacyStatus.VERIFIED)

    def flag(self, reason: Optional[str]) -> None:
        self._require_active()
        if not reason or not reason.strip():
            raise ValueError("Give a reason when flagging a prescription so the doctor knows what to fix.")
        self._transition_to(PharmacyStatus.FLAGGED)

    def dispense(self) -> None:
        self._require_active()
        if self._status != PharmacyStatus.VERIFIED:
            raise ValueError("Verify the prescription before dispensing it.")
        self._transition_to(PharmacyStatus.DISPENSED)

    def apply(self, action: PharmacyAction, notes: Optional[str] = None) -> PharmacyStatus:
        """Polymorphic entry point used by the API: one call, behaviour chosen by the action."""
        {
            PharmacyAction.VERIFY: lambda: self.verify(),
            PharmacyAction.FLAG: lambda: self.flag(notes),
            PharmacyAction.DISPENSE: lambda: self.dispense(),
        }[PharmacyAction(action)]()
        return self._status

    # --- internals ---
    def _require_active(self) -> None:
        if self._prescription_status != "active":
            raise ValueError(f"Only active prescriptions can be reviewed (this one is {self._prescription_status}).")

    def _transition_to(self, new_status: PharmacyStatus) -> None:
        if new_status not in self._VALID_TRANSITIONS[self._status]:
            raise ValueError(f"Cannot move pharmacy status from '{self._status.value}' to '{new_status.value}'.")
        self._status = new_status

    def __repr__(self) -> str:
        return f"<PharmacyReview status={self._status.value}>"
