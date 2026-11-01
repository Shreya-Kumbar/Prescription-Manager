"""
ArogyaNova Domain Layer — Abstract Base Classes (Abstraction)

These ABCs define the contracts for all domain actors.
No implementation detail leaks through the interface.

OOP Principle Demonstrated: ABSTRACTION
"""
from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Optional


class UserRole(str, Enum):
    DOCTOR = "doctor"
    PATIENT = "patient"
    PHARMACIST = "pharmacist"
    ADMINISTRATOR = "administrator"


class BaseUser(ABC):
    """
    Abstract base class for all user types in ArogyaNova.

    OOP: Abstraction — defines the contract every user must satisfy.
    OOP: Encapsulation — internal state managed via properties.
    """

    def __init__(
        self,
        user_id: uuid.UUID,
        email: str,
        first_name: str,
        last_name: str,
        role: UserRole,
        is_active: bool = True,
        created_at: Optional[datetime] = None,
    ) -> None:
        self._user_id = user_id
        self._email = email
        self._first_name = first_name
        self._last_name = last_name
        self._role = role
        self._is_active = is_active
        self._created_at = created_at or datetime.utcnow()

    # --- Properties (Encapsulation: controlled read access) ---

    @property
    def user_id(self) -> uuid.UUID:
        return self._user_id

    @property
    def email(self) -> str:
        return self._email

    @property
    def full_name(self) -> str:
        return f"{self._first_name} {self._last_name}"

    @property
    def first_name(self) -> str:
        return self._first_name

    @property
    def last_name(self) -> str:
        return self._last_name

    @property
    def role(self) -> UserRole:
        return self._role

    @property
    def is_active(self) -> bool:
        return self._is_active

    @property
    def created_at(self) -> datetime:
        return self._created_at

    def deactivate(self) -> None:
        """Deactivate this user account."""
        self._is_active = False

    def activate(self) -> None:
        """Re-activate this user account."""
        self._is_active = True

    @abstractmethod
    def get_permissions(self) -> set[str]:
        """Return the set of permission strings this user holds."""
        ...

    @abstractmethod
    def can_create_prescription(self) -> bool:
        """Whether this user role may author a prescription."""
        ...

    def has_permission(self, permission: str) -> bool:
        return permission in self.get_permissions()

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} id={self._user_id} email={self._email}>"
