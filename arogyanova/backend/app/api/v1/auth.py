"""
ArogyaNova — Authentication API Routes
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/change-password
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import get_db
from app.models.models import (
    AuditLogModel, DoctorProfileModel, PatientProfileModel,
    PharmacistProfileModel, RefreshTokenModel, UserModel,
)
from app.schemas.schemas import (
    ChangePasswordRequest, LoginRequest, MessageResponse,
    RegisterRequest, UserDetailResponse,
)
from app.security.dependencies import AnyAuthenticatedUser, get_current_user
from app.security.passwords import (
    create_access_token, create_refresh_token, hash_password,
    hash_refresh_token, validate_password_strength, verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    is_prod = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/v1/auth",
    )


@router.post("/register", response_model=UserDetailResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserDetailResponse:
    """Register a new user account (doctor, patient, or pharmacist)."""
    # Check existing email
    existing = await db.execute(select(UserModel).where(UserModel.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    # Password strength
    errors = validate_password_strength(body.password)
    if errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))

    # Create user
    user = UserModel(
        id=uuid.uuid4(),
        email=body.email,
        hashed_password=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=body.role,
        is_active=True,
    )
    db.add(user)

    # Create role-specific profile
    if body.role == "doctor":
        if not body.license_number:
            raise HTTPException(status_code=422, detail="License number is required for doctors.")
        profile = DoctorProfileModel(
            user_id=user.id,
            license_number=body.license_number,
            specialization=body.specialization,
        )
        db.add(profile)
    elif body.role == "patient":
        profile = PatientProfileModel(
            user_id=user.id,
            date_of_birth=body.date_of_birth,
            phone=body.phone,
        )
        db.add(profile)
    elif body.role == "pharmacist":
        if not body.license_number:
            raise HTTPException(status_code=422, detail="License number is required for pharmacists.")
        profile = PharmacistProfileModel(
            user_id=user.id,
            license_number=body.license_number,
        )
        db.add(profile)

    # Audit
    audit = AuditLogModel(
        actor_id=user.id,
        action="user.register",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)
    await db.commit()
    await db.refresh(user)

    # Issue tokens
    access_token = create_access_token(user.id, user.role)
    raw_refresh, hashed_refresh = create_refresh_token()
    token_record = RefreshTokenModel(
        user_id=user.id,
        token_hash=hashed_refresh,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(token_record)
    await db.commit()

    _set_auth_cookies(response, access_token, raw_refresh)
    resp = UserDetailResponse.model_validate(user)
    resp.access_token = access_token
    return resp


@router.post("/login", response_model=UserDetailResponse)
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserDetailResponse:
    """Authenticate and receive session cookies."""
    result = await db.execute(
        select(UserModel)
        .where(UserModel.email == body.email)
        .options(
            __import__("sqlalchemy.orm", fromlist=["selectinload"]).selectinload(UserModel.doctor_profile),
            __import__("sqlalchemy.orm", fromlist=["selectinload"]).selectinload(UserModel.patient_profile),
            __import__("sqlalchemy.orm", fromlist=["selectinload"]).selectinload(UserModel.pharmacist_profile),
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        # Audit failed attempt
        db.add(AuditLogModel(
            action="auth.login.failed",
            resource_type="user",
            details=f"Failed login for {body.email}",
            ip_address=request.client.host if request.client else None,
        ))
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account has been deactivated.")

    access_token = create_access_token(user.id, user.role)
    raw_refresh, hashed_refresh = create_refresh_token()
    token_record = RefreshTokenModel(
        user_id=user.id,
        token_hash=hashed_refresh,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(token_record)
    db.add(AuditLogModel(
        actor_id=user.id,
        action="auth.login.success",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request.client else None,
    ))
    await db.commit()

    _set_auth_cookies(response, access_token, raw_refresh)
    resp = UserDetailResponse.model_validate(user)
    resp.access_token = access_token
    return resp


@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    id_and_role: Annotated[tuple, AnyAuthenticatedUser],
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> MessageResponse:
    """Revoke session and clear cookies."""
    user_id, _ = id_and_role
    if refresh_token:
        token_hash = hash_refresh_token(refresh_token)
        result = await db.execute(
            select(RefreshTokenModel).where(
                RefreshTokenModel.user_id == user_id,
                RefreshTokenModel.token_hash == token_hash,
            )
        )
        token_record = result.scalar_one_or_none()
        if token_record:
            token_record.revoked = True
            await db.commit()

    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    return MessageResponse(message="Logged out successfully.")


@router.get("/me", response_model=UserDetailResponse)
async def get_me(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserDetailResponse:
    """Return the currently authenticated user's profile."""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(UserModel)
        .options(
            selectinload(UserModel.doctor_profile),
            selectinload(UserModel.patient_profile),
            selectinload(UserModel.pharmacist_profile),
        )
        .where(UserModel.id == current_user.id)
    )
    user = result.scalar_one()
    return UserDetailResponse.model_validate(user)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Change the current user's password."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    errors = validate_password_strength(body.new_password)
    if errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))

    current_user.hashed_password = hash_password(body.new_password)

    # Revoke all refresh tokens
    await db.execute(
        __import__("sqlalchemy", fromlist=["update"]).update(RefreshTokenModel)
        .where(RefreshTokenModel.user_id == current_user.id)
        .values(revoked=True)
    )

    db.add(AuditLogModel(
        actor_id=current_user.id,
        action="auth.password_changed",
        resource_type="user",
        resource_id=str(current_user.id),
    ))
    await db.commit()
    return MessageResponse(message="Password changed successfully.")
