"""
Tests for the forgot-password / reset-password flow.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1.auth import _FORGOT_MESSAGE, _hash_reset_token, forgot_password, reset_password
from app.db.database import Base
from app.models.models import PasswordResetTokenModel, UserModel
from app.schemas.schemas import ForgotPasswordRequest, ResetPasswordRequest
from app.security.passwords import hash_password, verify_password

OLD_PW = "OldPass123"
NEW_PW = "NewPass456"


@pytest.fixture(autouse=True)
def no_real_email(monkeypatch):
    """Tests must never send real email, whatever is in the developer's .env."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture
async def user(db):
    u = UserModel(
        id=uuid.uuid4(), email="Reset.Me@example.com", hashed_password=hash_password(OLD_PW),
        first_name="Reset", last_name="Me", role="patient", is_active=True,
    )
    db.add(u)
    await db.commit()
    return u


async def test_unknown_email_gives_same_message_and_no_token(db, user):
    res = await forgot_password(ForgotPasswordRequest(email="nobody@example.com"), db)
    assert res.message == _FORGOT_MESSAGE
    assert res.dev_reset_token is None


async def test_known_email_issues_token_case_insensitively(db, user):
    res = await forgot_password(ForgotPasswordRequest(email="reset.me@EXAMPLE.com"), db)
    assert res.message == _FORGOT_MESSAGE
    assert res.dev_reset_token
    stored = (await db.execute(select(PasswordResetTokenModel))).scalars().all()
    assert len(stored) == 1
    assert stored[0].token_hash == _hash_reset_token(res.dev_reset_token)  # only the hash is stored
    assert stored[0].token_hash != res.dev_reset_token


async def test_reset_changes_password_and_token_is_single_use(db, user):
    token = (await forgot_password(ForgotPasswordRequest(email=user.email), db)).dev_reset_token
    await reset_password(ResetPasswordRequest(token=token, new_password=NEW_PW), db)
    await db.refresh(user)
    assert verify_password(NEW_PW, user.hashed_password)
    assert not verify_password(OLD_PW, user.hashed_password)

    with pytest.raises(HTTPException) as exc:
        await reset_password(ResetPasswordRequest(token=token, new_password="Another789"), db)
    assert exc.value.status_code == 400


async def test_new_request_invalidates_old_token(db, user):
    first = (await forgot_password(ForgotPasswordRequest(email=user.email), db)).dev_reset_token
    second = (await forgot_password(ForgotPasswordRequest(email=user.email), db)).dev_reset_token
    with pytest.raises(HTTPException):
        await reset_password(ResetPasswordRequest(token=first, new_password=NEW_PW), db)
    await reset_password(ResetPasswordRequest(token=second, new_password=NEW_PW), db)


async def test_expired_token_rejected(db, user):
    token = (await forgot_password(ForgotPasswordRequest(email=user.email), db)).dev_reset_token
    row = (await db.execute(select(PasswordResetTokenModel))).scalar_one()
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    await db.commit()
    with pytest.raises(HTTPException) as exc:
        await reset_password(ResetPasswordRequest(token=token, new_password=NEW_PW), db)
    assert exc.value.status_code == 400


async def test_weak_password_rejected_and_token_still_usable(db, user):
    token = (await forgot_password(ForgotPasswordRequest(email=user.email), db)).dev_reset_token
    with pytest.raises(HTTPException) as exc:
        await reset_password(ResetPasswordRequest(token=token, new_password="alllowercase"), db)
    assert exc.value.status_code == 422
    await reset_password(ResetPasswordRequest(token=token, new_password=NEW_PW), db)


async def test_bogus_token_rejected(db, user):
    with pytest.raises(HTTPException) as exc:
        await reset_password(ResetPasswordRequest(token="not-a-real-token-123", new_password=NEW_PW), db)
    assert exc.value.status_code == 400


async def test_email_sent_when_smtp_configured_and_token_not_returned(db, user, monkeypatch):
    from app.core.config import settings
    from app.domain.notifications import EmailNotificationChannel

    sent = []
    monkeypatch.setattr(settings, "SMTP_USER", "sender@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "app-password")
    monkeypatch.setattr(EmailNotificationChannel, "_deliver", lambda self, msg: sent.append(msg))

    res = await forgot_password(ForgotPasswordRequest(email=user.email), db)
    assert res.dev_reset_token is None          # link goes by email, not to the browser
    assert len(sent) == 1
    assert sent[0]["To"] == user.email
    assert "/reset-password?token=" in sent[0].get_content()
