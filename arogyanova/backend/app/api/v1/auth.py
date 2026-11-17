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
from typing import Annotated, Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
import hashlib
import secrets

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.domain.notifications import EmailNotificationChannel
from app.db.database import get_db
from app.models.models import (
    AuditLogModel, DoctorProfileModel, PasswordResetTokenModel, PatientProfileModel,
    PharmacistProfileModel, RefreshTokenModel, UserModel,
)
from app.schemas.schemas import (
    ChangePasswordRequest, ForgotPasswordRequest, ForgotPasswordResponse, LoginRequest,
    MessageResponse, RegisterRequest, ResetPasswordRequest, UserDetailResponse,
)
from app.security.dependencies import AnyAuthenticatedUser, get_current_user
from app.security.passwords import (
    create_access_token, create_refresh_token, hash_password,
    hash_refresh_token, validate_password_strength, verify_password,
)

import structlog

logger = structlog.get_logger()

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


async def create_user_account(
    db: AsyncSession,
    body: RegisterRequest,
    ip_address: Optional[str],
    actor_id: Optional[uuid.UUID] = None,
) -> UserModel:
    """
    Create a user and the profile that matches their role (Factory-style helper).
    Used by public patient sign-up and by administrators creating staff accounts.
    """
    existing = await db.execute(select(UserModel).where(func.lower(UserModel.email) == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    errors = validate_password_strength(body.password)
    if errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))

    if body.role in ("doctor", "pharmacist") and not body.license_number:
        raise HTTPException(status_code=422, detail=f"License number is required for {body.role}s.")

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

    if body.role == "doctor":
        db.add(DoctorProfileModel(user_id=user.id, license_number=body.license_number, specialization=body.specialization))
    elif body.role == "patient":
        db.add(PatientProfileModel(user_id=user.id, date_of_birth=body.date_of_birth, phone=body.phone))
    elif body.role == "pharmacist":
        db.add(PharmacistProfileModel(user_id=user.id, license_number=body.license_number))

    db.add(AuditLogModel(
        actor_id=actor_id or user.id,
        action="user.register" if actor_id is None else "admin.user_created",
        resource_type="user",
        resource_id=str(user.id),
        details=None if actor_id is None else f"Created {body.role} account {body.email}",
        ip_address=ip_address,
    ))
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/register", response_model=UserDetailResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserDetailResponse:
    """
    Public self-registration — PATIENTS ONLY.
    Doctor and pharmacist accounts must be created by an administrator
    (POST /admin/users), so nobody can grant themselves prescribing rights.
    """
    if body.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Only patients can sign up. Doctor and pharmacist accounts are created by an administrator.",
        )
    user = await create_user_account(db, body, request.client.host if request.client else None)

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
    # Reload with profiles eagerly loaded: building the response must not trigger
    # lazy loads, which fail under async SQLAlchemy (this used to return a 500 even
    # though the account had already been saved).
    user = await _load_user_with_profiles(db, user.id)
    resp = UserDetailResponse.model_validate(user)
    resp.access_token = access_token
    return resp


async def _load_user_with_profiles(db: AsyncSession, user_id: uuid.UUID) -> UserModel:
    result = await db.execute(
        select(UserModel)
        .options(
            selectinload(UserModel.doctor_profile),
            selectinload(UserModel.patient_profile),
            selectinload(UserModel.pharmacist_profile),
        )
        .where(UserModel.id == user_id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


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



# ---------------------------------------------------------------------------
# Forgot / reset password
# ---------------------------------------------------------------------------

RESET_TOKEN_TTL_MINUTES = 30
_FORGOT_MESSAGE = "If an account exists for that email, a password reset link has been sent."


def _hash_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ForgotPasswordResponse:
    """
    Start a password reset. Always returns the same message so attackers cannot
    discover which emails are registered (prevents user enumeration).
    """
    result = await db.execute(select(UserModel).where(func.lower(UserModel.email) == body.email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return ForgotPasswordResponse(message=_FORGOT_MESSAGE)

    # Invalidate any earlier unused tokens for this user
    await db.execute(
        update(PasswordResetTokenModel)
        .where(PasswordResetTokenModel.user_id == user.id, PasswordResetTokenModel.used == False)  # noqa: E712
        .values(used=True)
    )

    raw_token = secrets.token_urlsafe(32)
    db.add(PasswordResetTokenModel(
        user_id=user.id,
        token_hash=_hash_reset_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
    ))
    db.add(AuditLogModel(
        actor_id=user.id,
        action="auth.password_reset_requested",
        resource_type="user",
        resource_id=str(user.id),
    ))
    await db.commit()

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
    mailer = EmailNotificationChannel(
        smtp_host=settings.SMTP_HOST, smtp_port=settings.SMTP_PORT,
        smtp_user=settings.SMTP_USER, smtp_password=settings.SMTP_PASSWORD,
        mail_from=settings.MAIL_FROM,
    )
    emailed = await mailer.send_to_address(
        user.email,
        "Reset your ArogyaNova password",
        f"Hi {user.first_name},\n\n"
        f"We received a request to reset your ArogyaNova password. Open this link to choose a new one:\n\n"
        f"{reset_url}\n\n"
        f"The link works once and expires in {RESET_TOKEN_TTL_MINUTES} minutes. "
        f"If you didn't ask for this, you can ignore this email.\n\n— ArogyaNova",
    )
    if not emailed:
        logger.warning("Password reset email not sent (SMTP not configured or failed)", user_id=str(user.id))

    # If the email could not be sent and we are in development, hand the token back so
    # the GUI can show the link. In production it is never returned.
    dev_token = raw_token if (not emailed and settings.ENVIRONMENT == "development") else None
    return ForgotPasswordResponse(message=_FORGOT_MESSAGE, dev_reset_token=dev_token)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    body: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Complete a password reset using a one-time token."""
    invalid = HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")

    result = await db.execute(
        select(PasswordResetTokenModel).where(PasswordResetTokenModel.token_hash == _hash_reset_token(body.token))
    )
    token = result.scalar_one_or_none()
    if token is None or token.used:
        raise invalid
    expires_at = token.expires_at
    if expires_at.tzinfo is None:  # SQLite returns naive datetimes
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise invalid

    errors = validate_password_strength(body.new_password)
    if errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))

    user = await db.get(UserModel, token.user_id)
    if user is None or not user.is_active:
        raise invalid

    user.hashed_password = hash_password(body.new_password)
    token.used = True
    # Log out every existing session
    await db.execute(
        update(RefreshTokenModel).where(RefreshTokenModel.user_id == user.id).values(revoked=True)
    )
    db.add(AuditLogModel(
        actor_id=user.id,
        action="auth.password_reset_completed",
        resource_type="user",
        resource_id=str(user.id),
    ))
    await db.commit()
    return MessageResponse(message="Your password has been reset. You can now sign in.")
