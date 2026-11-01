"""
ArogyaNova — User Repository
"""
from __future__ import annotations

import abc
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import UserModel
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[UserModel]):
    @abc.abstractmethod
    async def get_by_email(self, email: str) -> Optional[UserModel]:
        raise NotImplementedError

    @abc.abstractmethod
    async def get_with_profile(self, user_id: uuid.UUID) -> Optional[UserModel]:
        raise NotImplementedError


class SQLAlchemyUserRepository(UserRepository):
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, entity_id: uuid.UUID) -> Optional[UserModel]:
        stmt = select(UserModel).where(UserModel.id == entity_id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[UserModel]:
        stmt = (
            select(UserModel)
            .options(
                selectinload(UserModel.doctor_profile),
                selectinload(UserModel.patient_profile),
                selectinload(UserModel.pharmacist_profile),
            )
            .where(UserModel.email == email.lower().strip())
        )
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_profile(self, user_id: uuid.UUID) -> Optional[UserModel]:
        stmt = (
            select(UserModel)
            .options(
                selectinload(UserModel.doctor_profile),
                selectinload(UserModel.patient_profile),
                selectinload(UserModel.pharmacist_profile),
            )
            .where(UserModel.id == user_id)
        )
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, skip: int = 0, limit: int = 100) -> List[UserModel]:
        stmt = (
            select(UserModel)
            .options(
                selectinload(UserModel.doctor_profile),
                selectinload(UserModel.patient_profile),
                selectinload(UserModel.pharmacist_profile),
            )
            .order_by(UserModel.last_name)
            .offset(skip)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, entity: UserModel) -> UserModel:
        self._db.add(entity)
        await self._db.flush()
        return entity

    async def update(self, entity: UserModel) -> UserModel:
        await self._db.flush()
        return entity

    async def delete(self, entity_id: uuid.UUID) -> bool:
        user = await self.get_by_id(entity_id)
        if user:
            await self._db.delete(user)
            await self._db.flush()
            return True
        return False
