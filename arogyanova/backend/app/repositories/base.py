"""
ArogyaNova — Repository Abstraction Layer (OOP: Abstraction & Dependency Inversion)
Defines abstract contracts for data persistence operations.
"""
from __future__ import annotations

import abc
import uuid
from typing import Generic, List, Optional, TypeVar

T = TypeVar("T")


class BaseRepository(abc.ABC, Generic[T]):
    """
    Abstract base repository defining standard CRUD contracts.
    OOP: Abstraction — hides SQLAlchemy and SQL query mechanics behind high-level operations.
    SOLID: Interface Segregation & Dependency Inversion Principle.
    """

    @abc.abstractmethod
    async def get_by_id(self, entity_id: uuid.UUID) -> Optional[T]:
        """Retrieve an entity by primary key."""
        raise NotImplementedError

    @abc.abstractmethod
    async def list_all(self, skip: int = 0, limit: int = 100) -> List[T]:
        """List entities with pagination."""
        raise NotImplementedError

    @abc.abstractmethod
    async def create(self, entity: T) -> T:
        """Persist a new entity."""
        raise NotImplementedError

    @abc.abstractmethod
    async def update(self, entity: T) -> T:
        """Update an existing entity."""
        raise NotImplementedError

    @abc.abstractmethod
    async def delete(self, entity_id: uuid.UUID) -> bool:
        """Delete an entity by id."""
        raise NotImplementedError
