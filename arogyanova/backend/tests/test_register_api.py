"""
API-level test for POST /api/v1/auth/register.

Regression: the endpoint used to save the account and then crash while building the
response (lazy-loading profiles under async SQLAlchemy), returning a 500 even though
the account existed.
"""
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.database import Base, get_db
from app.main import app


@pytest.fixture
async def client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()


async def test_patient_can_sign_up(client):
    body = {"email": "new.patient@example.com", "password": "Testpass123", "first_name": "New", "last_name": "Patient", "role": "patient"}
    res = await client.post("/api/v1/auth/register", json=body)
    assert res.status_code == 201, res.text
    assert res.json()["role"] == "patient"
    assert res.json()["patient_profile"] is not None

    # Second attempt is a clean 400, not a crash
    again = await client.post("/api/v1/auth/register", json=body)
    assert again.status_code == 400


@pytest.mark.parametrize("role", ["doctor", "pharmacist", "administrator"])
async def test_staff_roles_cannot_self_register(client, role):
    res = await client.post("/api/v1/auth/register", json={
        "email": f"sneaky.{role}@example.com", "password": "Testpass123",
        "first_name": "Sneaky", "last_name": "User", "role": role, "license_number": "FAKE-1",
    })
    assert res.status_code in (403, 422)
