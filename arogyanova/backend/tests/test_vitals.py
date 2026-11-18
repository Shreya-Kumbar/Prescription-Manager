"""Receptionist role and vital signs: domain rules (VitalSigns) and the API."""
import pytest
from httpx import ASGITransport, AsyncClient

from app.domain.users import Receptionist
from app.domain.vitals import AlertLevel, VitalSigns
from app.main import app
from tests.test_api_rules import env  # noqa: F401


# ---------- domain ----------
def test_bmi_and_category():
    v = VitalSigns(weight_kg=70, height_cm=175)
    assert v.bmi == 22.9 and v.bmi_category == "Normal"
    assert VitalSigns(weight_kg=95, height_cm=170).bmi_category == "Obese"


def test_alerts_for_abnormal_readings():
    v = VitalSigns(systolic_bp=150, diastolic_bp=95, spo2=88, temperature_c=38.2, pulse=72)
    levels = {a.message.split(" (")[0]: a.level for a in v.alerts}
    assert levels["Very low oxygen"] == AlertLevel.CRITICAL
    assert levels["High blood pressure"] == AlertLevel.WARNING
    assert levels["Fever"] == AlertLevel.WARNING
    assert VitalSigns(systolic_bp=118, diastolic_bp=76, spo2=98, pulse=72).alerts == []


@pytest.mark.parametrize("bad", [{}, {"spo2": 140}, {"systolic_bp": 120}, {"systolic_bp": 80, "diastolic_bp": 90}])
def test_impossible_readings_rejected(bad):
    with pytest.raises(ValueError):
        VitalSigns(**bad)


def test_receptionist_is_a_base_user_without_prescribing_rights():
    import uuid
    r = Receptionist(uuid.uuid4(), "r@x.com", "Meera", "Iyer")
    assert r.has_permission("vitals:record") and not r.can_create_prescription()


# ---------- API ----------
async def _receptionist(env):  # noqa: F811
    body = {"email": "rec@example.com", "password": "Testpass123", "first_name": "Rita", "last_name": "Desk", "role": "receptionist"}
    assert (await env["admin"].post("/api/v1/admin/users", json=body)).status_code == 201
    c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    tok = (await c.post("/api/v1/auth/login", json={"email": body["email"], "password": body["password"]})).json()["access_token"]
    c.headers["Authorization"] = f"Bearer {tok}"
    return c


async def test_receptionist_records_vitals_doctor_sees_them(env):  # noqa: F811
    rec = await _receptionist(env)
    url = f"/api/v1/patients/{env['patient_id']}/vitals"
    r = await rec.post(url, json={"systolic_bp": 150, "diastolic_bp": 95, "spo2": 93, "weight_kg": 80, "height_cm": 170, "notes": "Walk-in"})
    assert r.status_code == 201, r.text
    assert r.json()["bmi"] == 27.7 and r.json()["recorded_by_role"] == "receptionist"
    assert len(r.json()["alerts"]) >= 2

    seen = (await env["doctor"].get(url)).json()
    assert seen[0]["spo2"] == 93
    assert (await env["patient"].get(url)).status_code == 200          # patient sees own vitals
    assert (await env["pharmacist"].get(url)).status_code == 403
    assert (await env["pharmacist"].post(url, json={"pulse": 80})).status_code == 403
    assert (await rec.post(url, json={"spo2": 140})).status_code == 400  # domain validation
    await rec.aclose()


async def test_receptionist_registers_patients_only(env):  # noqa: F811
    rec = await _receptionist(env)
    ok = await rec.post("/api/v1/admin/users", json={"email": "walkin@example.com", "password": "Testpass123", "first_name": "Walk", "last_name": "In", "role": "patient"})
    assert ok.status_code == 201
    no = await rec.post("/api/v1/admin/users", json={"email": "fake.doc@example.com", "password": "Testpass123", "first_name": "F", "last_name": "D", "role": "doctor", "license_number": "X"})
    assert no.status_code == 403
    assert (await rec.get("/api/v1/patients")).status_code == 200
    assert (await rec.get("/api/v1/prescriptions")).status_code == 403   # no clinical records
    dash = (await rec.get("/api/v1/dashboard")).json()
    assert dash["role"] == "receptionist" and "vitals_today" in dash["stats"]
    await rec.aclose()
