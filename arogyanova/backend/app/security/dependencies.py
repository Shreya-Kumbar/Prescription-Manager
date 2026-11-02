"""
ArogyaNova — Auth Dependencies (FastAPI)
JWT extraction from cookies + role-based guards.
"""
from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import Cookie, Depends, Header, HTTPException, status
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.domain.base_user import UserRole
from app.security.passwords import decode_access_token


async def get_current_user_id_and_role(
    access_token: Annotated[Optional[str], Cookie()] = None,
    authorization: Annotated[Optional[str], Header()] = None,
) -> tuple[uuid.UUID, str]:
    """
    Extract and validate the current user from the JWT cookie or Authorization Bearer header.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please log in.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = access_token
    if not token and authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        raise credentials_exception
    try:
        payload = decode_access_token(token)
        user_id_str: str = payload.get("sub")
        role: str = payload.get("role")
        if not user_id_str or not role:
            raise credentials_exception
        return uuid.UUID(user_id_str), role
    except (JWTError, ValueError):
        raise credentials_exception


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    id_and_role: Annotated[tuple, Depends(get_current_user_id_and_role)],
):
    """Fetch the full UserModel for the authenticated user."""
    from sqlalchemy import select
    from app.models.models import UserModel

    user_id, _ = id_and_role
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated.")
    return user


def require_role(*roles: UserRole):
    """FastAPI dependency factory: require one of the specified roles."""
    async def _guard(
        id_and_role: Annotated[tuple, Depends(get_current_user_id_and_role)],
    ) -> tuple[uuid.UUID, str]:
        _, role = id_and_role
        if role not in [r.value for r in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in roles]}",
            )
        return id_and_role
    return _guard


DoctorRequired = Depends(require_role(UserRole.DOCTOR))
PatientRequired = Depends(require_role(UserRole.PATIENT))
PharmacistRequired = Depends(require_role(UserRole.PHARMACIST))
AdminRequired = Depends(require_role(UserRole.ADMINISTRATOR))
DoctorOrAdminRequired = Depends(require_role(UserRole.DOCTOR, UserRole.ADMINISTRATOR))
AnyAuthenticatedUser = Depends(get_current_user_id_and_role)
