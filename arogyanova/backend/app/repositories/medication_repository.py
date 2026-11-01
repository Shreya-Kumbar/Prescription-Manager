"""
ArogyaNova — Medication Repository
"""
from __future__ import annotations

import abc
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import MedicationModel
from app.repositories.base import BaseRepository


class MedicationRepository(BaseRepository[MedicationModel]):
    @abc.abstractmethod
    async def search(self, query: str, limit: int = 50) -> List[MedicationModel]:
        raise NotImplementedError


class SQLAlchemyMedicationRepository(MedicationRepository):
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, entity_id: uuid.UUID) -> Optional[MedicationModel]:
        stmt = select(MedicationModel).where(MedicationModel.id == entity_id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, skip: int = 0, limit: int = 100) -> List[MedicationModel]:
        stmt = (
            select(MedicationModel)
            .where(MedicationModel.is_active == True)
            .order_by(MedicationModel.generic_name)
            .offset(skip)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def search(self, query: str, limit: int = 50) -> List[MedicationModel]:
        term = f"%{query}%"
        stmt = (
            select(MedicationModel)
            .where(
                MedicationModel.is_active == True,
                (MedicationModel.generic_name.ilike(term) | MedicationModel.brand_name.ilike(term)),
            )
            .order_by(MedicationModel.generic_name)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, entity: MedicationModel) -> MedicationModel:
        self._db.add(entity)
        await self._db.flush()
        return entity

    async def update(self, entity: MedicationModel) -> MedicationModel:
        await self._db.flush()
        return entity

    async def delete(self, entity_id: uuid.UUID) -> bool:
        med = await self.get_by_id(entity_id)
        if med:
            med.is_active = False  # Soft delete
            await self._db.flush()
            return True
        return False
