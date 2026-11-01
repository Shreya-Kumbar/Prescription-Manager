"""
ArogyaNova — Prescription Repository (Concrete Implementation)
OOP: Polymorphism & Liskov Substitution Principle.
"""
from __future__ import annotations

import abc
import uuid
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import PrescriptionItemModel, PrescriptionModel
from app.repositories.base import BaseRepository


class PrescriptionRepository(BaseRepository[PrescriptionModel]):
    """Abstract interface specifically for Prescription operations."""

    @abc.abstractmethod
    async def get_with_items(self, prescription_id: uuid.UUID) -> Optional[PrescriptionModel]:
        """Fetch prescription with all prescription items and medication details loaded."""
        raise NotImplementedError

    @abc.abstractmethod
    async def list_for_patient(
        self, patient_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> List[PrescriptionModel]:
        """Fetch all prescriptions for a specific patient."""
        raise NotImplementedError

    @abc.abstractmethod
    async def list_for_doctor(
        self, doctor_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> List[PrescriptionModel]:
        """Fetch all prescriptions issued by a specific doctor."""
        raise NotImplementedError


class SQLAlchemyPrescriptionRepository(PrescriptionRepository):
    """
    Concrete SQLAlchemy implementation of PrescriptionRepository.
    OOP: Polymorphism — satisfies PrescriptionRepository contract using async SQLAlchemy.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, entity_id: uuid.UUID) -> Optional[PrescriptionModel]:
        stmt = select(PrescriptionModel).where(PrescriptionModel.id == entity_id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_items(self, prescription_id: uuid.UUID) -> Optional[PrescriptionModel]:
        stmt = (
            select(PrescriptionModel)
            .options(
                selectinload(PrescriptionModel.items).selectinload(PrescriptionItemModel.medication),
                selectinload(PrescriptionModel.patient),
                selectinload(PrescriptionModel.doctor),
            )
            .where(PrescriptionModel.id == prescription_id)
        )
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, skip: int = 0, limit: int = 100) -> List[PrescriptionModel]:
        stmt = (
            select(PrescriptionModel)
            .options(
                selectinload(PrescriptionModel.patient),
                selectinload(PrescriptionModel.doctor),
                selectinload(PrescriptionModel.items),
            )
            .order_by(PrescriptionModel.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def list_for_patient(
        self, patient_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> List[PrescriptionModel]:
        stmt = (
            select(PrescriptionModel)
            .options(
                selectinload(PrescriptionModel.patient),
                selectinload(PrescriptionModel.doctor),
                selectinload(PrescriptionModel.items),
            )
            .where(PrescriptionModel.patient_id == patient_id)
            .order_by(PrescriptionModel.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def list_for_doctor(
        self, doctor_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> List[PrescriptionModel]:
        stmt = (
            select(PrescriptionModel)
            .options(
                selectinload(PrescriptionModel.patient),
                selectinload(PrescriptionModel.doctor),
                selectinload(PrescriptionModel.items),
            )
            .where(PrescriptionModel.doctor_id == doctor_id)
            .order_by(PrescriptionModel.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, entity: PrescriptionModel) -> PrescriptionModel:
        self._db.add(entity)
        await self._db.flush()
        return entity

    async def update(self, entity: PrescriptionModel) -> PrescriptionModel:
        await self._db.flush()
        return entity

    async def delete(self, entity_id: uuid.UUID) -> bool:
        prescription = await self.get_by_id(entity_id)
        if prescription:
            await self._db.delete(prescription)
            await self._db.flush()
            return True
        return False
