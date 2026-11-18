"""Appointments: DoctorSchedule slots, Appointment state machine, and the booking API."""
from datetime import date, datetime, time, timedelta

import pytest

from app.domain.appointment import Appointment, AppointmentStatus, DoctorSchedule
from tests.test_api_rules import env  # noqa: F401  (reuse the API fixture)


def _next_working_day(start: date = None) -> date:
    d = (start or date.today()) + timedelta(days=1)
    while d.weekday() == 6:  # Sunday off
        d += timedelta(days=1)
    return d


# ---------- domain ----------
def test_schedule_slots_and_days_off():
    s = DoctorSchedule()
    monday = date(2026, 11, 16)
    slots = s.slots_on(monday)
    assert slots[0] == datetime(2026, 11, 16, 9, 0) and slots[-1] == datetime(2026, 11, 16, 16, 45)
    assert datetime(2026, 11, 16, 13, 0) not in slots          # lunch break
    assert len(slots) == 16 + 12                                 # 4 h + 3 h of 15-min slots
    assert s.slots_on(date(2026, 11, 22)) == []                  # Sunday
    assert s.is_slot(datetime(2026, 11, 16, 10, 15)) and not s.is_slot(datetime(2026, 11, 16, 10, 20))


def test_free_slots_skip_taken_and_past():
    s = DoctorSchedule()
    day = date(2026, 11, 16)
    now = datetime(2026, 11, 16, 9, 20)
    free = s.free_slots(day, taken=[datetime(2026, 11, 16, 9, 30)], now=now)
    assert datetime(2026, 11, 16, 9, 15) not in free   # past
    assert datetime(2026, 11, 16, 9, 30) not in free   # taken
    assert free[0] == datetime(2026, 11, 16, 9, 45)


def test_appointment_lifecycle_rules():
    at = datetime(2026, 11, 16, 10, 0)
    a = Appointment(at)
    with pytest.raises(ValueError, match="Check the patient in"):
        a.complete()
    with pytest.raises(ValueError, match="day of the appointment"):
        a.check_in(now=datetime(2026, 11, 15, 10, 0))
    a.check_in(now=datetime(2026, 11, 16, 9, 50))
    a.complete()
    assert a.status == AppointmentStatus.COMPLETED and not a.is_active
    with pytest.raises(ValueError):
        a.cancel("too late")                       # finished visits can't be cancelled

    b = Appointment(at)
    with pytest.raises(ValueError, match="reason"):
        b.cancel(" ")
    with pytest.raises(ValueError, match="no-show"):
        b.mark_no_show(now=datetime(2026, 11, 16, 9, 0))
    b.mark_no_show(now=datetime(2026, 11, 16, 11, 0))
    assert b.status == AppointmentStatus.NO_SHOW


# ---------- API ----------
async def test_booking_flow_over_api(env):  # noqa: F811
    desk, doc, pat, ph, pid = env["admin"], env["doctor"], env["patient"], env["pharmacist"], env["patient_id"]
    doctors = (await desk.get("/api/v1/appointments/doctors")).json()
    me = (await doc.get("/api/v1/auth/me")).json()
    doctor_id = next(d["id"] for d in doctors if d["id"] == me["id"])
    day = _next_working_day()

    slots = (await desk.get("/api/v1/appointments/slots", params={"doctor_id": doctor_id, "day": day.isoformat()})).json()
    assert slots["working_day"] and all(s["available"] for s in slots["slots"])
    at = datetime.combine(day, time(10, 30)).isoformat()
    body = {"patient_id": pid, "doctor_id": doctor_id, "scheduled_at": at, "reason": "Follow-up for fever"}

    # only the front desk books
    assert (await pat.post("/api/v1/appointments", json=body)).status_code == 403
    assert (await doc.post("/api/v1/appointments", json=body)).status_code == 403
    r = await desk.post("/api/v1/appointments", json=body)
    assert r.status_code == 201 and r.json()["status"] == "booked"
    appt = r.json()

    # slot is now taken; outside hours / past are refused
    assert (await desk.post("/api/v1/appointments", json=body)).status_code == 409
    assert (await desk.post("/api/v1/appointments", json={**body, "scheduled_at": datetime.combine(day, time(13, 15)).isoformat()})).status_code == 400
    assert (await desk.post("/api/v1/appointments", json={**body, "scheduled_at": datetime(2020, 1, 6, 10, 0).isoformat()})).status_code == 400
    taken = (await desk.get("/api/v1/appointments/slots", params={"doctor_id": doctor_id, "day": day.isoformat()})).json()
    assert not next(s for s in taken["slots"] if s["time"].startswith(at[:16]))["available"]

    # doctor notified and sees it; patient sees it; pharmacist can't
    dn = (await doc.get("/api/v1/notifications")).json()
    dn = dn if isinstance(dn, list) else dn.get("items", [])
    assert any(n["title"] == "New appointment" for n in dn)
    assert [a["id"] for a in (await doc.get("/api/v1/appointments", params={"when": "upcoming"})).json()] == [appt["id"]]
    assert [a["id"] for a in (await pat.get("/api/v1/appointments")).json()] == [appt["id"]]
    assert (await ph.get("/api/v1/appointments")).status_code == 403

    # check-in only on the day; doctor can't complete before check-in; patient cancels with reason
    url = f"/api/v1/appointments/{appt['id']}/status"
    assert (await desk.post(url, json={"action": "check_in"})).status_code == 400
    assert (await doc.post(url, json={"action": "complete"})).status_code == 400
    assert (await pat.post(url, json={"action": "cancel"})).status_code == 400
    c = await pat.post(url, json={"action": "cancel", "reason": "Feeling better"})
    assert c.status_code == 200 and c.json()["status"] == "cancelled" and c.json()["cancellation_reason"] == "Feeling better"
    # the slot is free again
    assert (await desk.post("/api/v1/appointments", json=body)).status_code == 201
