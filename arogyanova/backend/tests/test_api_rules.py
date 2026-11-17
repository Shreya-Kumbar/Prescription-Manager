"""
API tests for business rules and role permissions found during the end-to-end audit.
"""
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.database import Base, get_db
from app.main import app
from app.models.models import MedicationModel, UserModel
from app.security.passwords import hash_password


@pytest.fixture
async def env():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_db():
        async with factory() as session:
            yield session

    async with factory() as s:
        med = MedicationModel(id=uuid.uuid4(), generic_name="Paracetamol", strength="500mg", dosage_form="Tablet", is_active=True)
        s.add(med)
        s.add(UserModel(id=uuid.uuid4(), email="admin@example.com", hashed_password=hash_password("Adminpass123"),
                        first_name="Ada", last_name="Admin", role="administrator", is_active=True))
        await s.commit()

    app.dependency_overrides[get_db] = override_db

    admin = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    tok = (await admin.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "Adminpass123"})).json()["access_token"]
    admin.headers["Authorization"] = f"Bearer {tok}"

    async def client_for(role, email, **extra):
        body = {"email": email, "password": "Testpass123", "first_name": "T", "last_name": role, "role": role, **extra}
        if role == "patient":
            r = await AsyncClient(transport=ASGITransport(app=app), base_url="http://test").post("/api/v1/auth/register", json=body)
        else:
            r = await admin.post("/api/v1/admin/users", json=body)   # staff are created by an admin
        assert r.status_code == 201, r.text
        c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        tok = (await c.post("/api/v1/auth/login", json={"email": email, "password": "Testpass123"})).json()["access_token"]
        c.headers["Authorization"] = f"Bearer {tok}"
        return c, r.json()["id"]

    doctor, _ = await client_for("doctor", "doc@example.com", license_number="L1")
    patient, patient_id = await client_for("patient", "pat@example.com")
    pharmacist, _ = await client_for("pharmacist", "ph@example.com", license_number="P1")
    yield {"admin": admin, "doctor": doctor, "patient": patient, "pharmacist": pharmacist, "patient_id": patient_id, "med": med}
    for c in (admin, doctor, patient, pharmacist):
        await c.aclose()
    app.dependency_overrides.clear()
    await engine.dispose()


def _rx(env, items=True):
    m = env["med"]
    return {
        "patient_id": env["patient_id"], "issue_date": "2026-11-17", "diagnosis": "Fever",
        "items": [{"medication_id": str(m.id), "strength": "500mg", "dosage": "1 tablet", "route": "oral",
                   "frequency": "Twice daily", "duration_days": 3, "quantity": "6 tablets"}] if items else [],
    }


async def test_illegal_state_changes_return_400_not_500(env):
    doc = env["doctor"]
    rx = (await doc.post("/api/v1/prescriptions", json=_rx(env))).json()
    assert (await doc.post(f"/api/v1/prescriptions/{rx['id']}/finalize")).status_code == 200

    again = await doc.post(f"/api/v1/prescriptions/{rx['id']}/finalize")
    assert again.status_code == 400 and "transition" in again.json()["detail"].lower()

    edit = await doc.patch(f"/api/v1/prescriptions/{rx['id']}", json={"diagnosis": "changed"})
    assert edit.status_code == 400

    empty = (await doc.post("/api/v1/prescriptions", json=_rx(env, items=False))).json()
    fin = await doc.post(f"/api/v1/prescriptions/{empty['id']}/finalize")
    assert fin.status_code == 400 and "at least one medication" in fin.json()["detail"]


async def test_patient_profile_edit_permissions(env):
    body = {"allergies": "Penicillin", "blood_group": "A+"}
    url = f"/api/v1/patients/{env['patient_id']}/profile"
    assert (await env["doctor"].patch(url, json=body)).status_code == 403      # doctors cannot edit
    assert (await env["pharmacist"].patch(url, json=body)).status_code == 403
    assert (await env["patient"].patch(url, json=body)).status_code == 200     # the patient can
    assert (await env["admin"].patch(url, json=body)).status_code == 200       # and an admin can


async def test_medication_catalogue_permissions(env):
    body = {"generic_name": "Cetirizine", "strength": "10mg", "dosage_form": "Tablet"}
    assert (await env["pharmacist"].post("/api/v1/medications", json=body)).status_code == 201
    assert (await env["doctor"].post("/api/v1/medications", json=body)).status_code == 403
    assert (await env["patient"].post("/api/v1/medications", json=body)).status_code == 403


async def test_only_admin_can_create_staff(env):
    body = {"email": "new.doc@example.com", "password": "Testpass123", "first_name": "N", "last_name": "Doc",
            "role": "doctor", "license_number": "MCI-9"}
    assert (await env["doctor"].post("/api/v1/admin/users", json=body)).status_code == 403
    assert (await env["patient"].post("/api/v1/admin/users", json=body)).status_code == 403
    r = await env["admin"].post("/api/v1/admin/users", json=body)
    assert r.status_code == 201 and r.json()["doctor_profile"]["license_number"] == "MCI-9"
    missing = await env["admin"].post("/api/v1/admin/users", json={**body, "email": "x@example.com", "license_number": None})
    assert missing.status_code == 422


async def test_doses_can_only_be_logged_once_and_not_in_the_future(env):
    from datetime import date, datetime
    doc, pat = env["doctor"], env["patient"]
    rx = (await doc.post("/api/v1/prescriptions", json={**_rx(env), "issue_date": date.today().isoformat()})).json()
    assert (await doc.post(f"/api/v1/prescriptions/{rx['id']}/finalize")).status_code == 200

    schedule = (await pat.get("/api/v1/schedule")).json()
    today = [s for s in schedule if datetime.fromisoformat(s["scheduled_at"]).date() <= date.today()]
    future = [s for s in schedule if datetime.fromisoformat(s["scheduled_at"]).date() > date.today()]
    assert today and future, "a 3-day course should have doses today and later"

    r = await pat.post(f"/api/v1/schedule/{future[0]['id']}/log", json={"action": "taken"})
    assert r.status_code == 400 and "scheduled for" in r.json()["detail"]

    assert (await pat.post(f"/api/v1/schedule/{today[0]['id']}/log", json={"action": "taken"})).status_code == 200
    again = await pat.post(f"/api/v1/schedule/{today[0]['id']}/log", json={"action": "skipped"})
    assert again.status_code == 400 and "already been logged" in again.json()["detail"]
