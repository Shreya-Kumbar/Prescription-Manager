"""
ArogyaNova Repositories Module
"""
from app.repositories.base import BaseRepository
from app.repositories.prescription_repository import (
    PrescriptionRepository,
    SQLAlchemyPrescriptionRepository,
)
from app.repositories.user_repository import (
    UserRepository,
    SQLAlchemyUserRepository,
)
from app.repositories.medication_repository import (
    MedicationRepository,
    SQLAlchemyMedicationRepository,
)

__all__ = [
    "BaseRepository",
    "PrescriptionRepository",
    "SQLAlchemyPrescriptionRepository",
    "UserRepository",
    "SQLAlchemyUserRepository",
    "MedicationRepository",
    "SQLAlchemyMedicationRepository",
]
