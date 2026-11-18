"""Pharmacy workflow: domain rules (PharmacyReview) and the API end to end."""
import pytest

from app.domain.pharmacy import PharmacyAction, PharmacyReview, PharmacyStatus
from tests.test_api_rules import env, _rx  # noqa: F401  (reuse the API fixture)


# ---------- domain (pure OOP rules, no database) ----------
def test_happy_path_verify_then_dispense():
    r = PharmacyReview("active")
    r.verify()
    assert r.status == PharmacyStatus.VERIFIED and r.can_dispense
    r.dispense()
    assert r.status == PharmacyStatus.DISPENSED and r.is_closed


def test_cannot_dispense_before_verifying():
    with pytest.raises(ValueError, match="Verify the prescription"):
        PharmacyReview("active").dispense()


def test_flag_needs_reason_and_can_be_reverified():
    r = PharmacyReview("active")
    with pytest.raises(ValueError, match="reason"):
        r.flag("   ")
    r.flag("Dose too high for age")
    assert r.status == PharmacyStatus.FLAGGED
    with pytest.raises(ValueError):
        r.dispense()          # flagged -> must verify again first
    r.verify()
    assert r.status == PharmacyStatus.VERIFIED


def test_only_active_prescriptions_and_no_actions_after_dispensing():
    with pytest.raises(ValueError, match="Only active"):
        PharmacyReview("cancelled").verify()
    done = PharmacyReview("active", PharmacyStatus.DISPENSED)
    with pytest.raises(ValueError):
        done.apply(PharmacyAction.FLAG, "late")


# ---------- API ----------
async def test_pharmacy_workflow_over_api(env):  # noqa: F811
    doc, pat, ph = env["doctor"], env["patient"], env["pharmacist"]
    rx = (await doc.post("/api/v1/prescriptions", json=_rx(env))).json()
    await doc.post(f"/api/v1/prescriptions/{rx['id']}/finalize")
    url = f"/api/v1/prescriptions/{rx['id']}/pharmacy"

    # only pharmacists
    assert (await doc.post(url, json={"action": "verify"})).status_code == 403
    assert (await pat.post(url, json={"action": "verify"})).status_code == 403
    # rules come back as clear 400s
    assert (await ph.post(url, json={"action": "dispense"})).status_code == 400
    assert (await ph.post(url, json={"action": "flag"})).status_code == 400

    flagged = await ph.post(url, json={"action": "flag", "notes": "Check allergy"})
    assert flagged.json()["pharmacy_status"] == "flagged"
    doc_notes = (await doc.get("/api/v1/notifications")).json()
    doc_notes = doc_notes if isinstance(doc_notes, list) else doc_notes.get("items", [])
    assert any("flagged" in n["title"].lower() for n in doc_notes)

    assert (await ph.post(url, json={"action": "verify"})).json()["pharmacy_status"] == "verified"
    done = (await ph.post(url, json={"action": "dispense"})).json()
    assert done["pharmacy_status"] == "dispensed"
    assert [h["action"] for h in done["pharmacy_history"]] == ["flag", "verify", "dispense"]

    # patient sees it and was notified
    seen = (await pat.get(f"/api/v1/prescriptions/{rx['id']}")).json()
    assert seen["pharmacy_status"] == "dispensed"
    pat_notes = (await pat.get("/api/v1/notifications")).json()
    pat_notes = pat_notes if isinstance(pat_notes, list) else pat_notes.get("items", [])
    assert any("dispensed" in n["title"].lower() for n in pat_notes)

    # pharmacist queue filter
    pending = (await ph.get("/api/v1/prescriptions", params={"pharmacy_status": "pending"})).json()["items"]
    assert all(p["pharmacy_status"] == "pending" for p in pending)


async def test_search_filters_prescriptions(env):  # noqa: F811
    doc = env["doctor"]
    await doc.post("/api/v1/prescriptions", json={**_rx(env), "diagnosis": "Migraine"})
    await doc.post("/api/v1/prescriptions", json={**_rx(env), "diagnosis": "Asthma"})
    found = (await doc.get("/api/v1/prescriptions", params={"search": "migr"})).json()["items"]
    assert [p["diagnosis"] for p in found] == ["Migraine"]
    by_patient = (await doc.get("/api/v1/prescriptions", params={"search": "T patient"})).json()["items"]
    assert len(by_patient) == 2


async def test_cancel_needs_reason_removes_future_doses_and_is_blocked_after_dispensing(env):  # noqa: F811
    from datetime import date
    doc, pat, ph = env["doctor"], env["patient"], env["pharmacist"]
    body = {**_rx(env), "issue_date": date.today().isoformat()}

    # 1. cancel needs a reason, and removes the doses that haven't happened yet
    rx = (await doc.post("/api/v1/prescriptions", json=body)).json()
    await doc.post(f"/api/v1/prescriptions/{rx['id']}/finalize")
    before = len((await pat.get("/api/v1/schedule")).json())
    assert before > 0
    assert (await doc.post(f"/api/v1/prescriptions/{rx['id']}/cancel", json={})).status_code == 422
    r = await doc.post(f"/api/v1/prescriptions/{rx['id']}/cancel", json={"reason": "Wrong dose"})
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert len((await pat.get("/api/v1/schedule")).json()) < before
    notes = (await pat.get("/api/v1/notifications")).json()
    notes = notes if isinstance(notes, list) else notes.get("items", [])
    assert any("cancelled" in n["title"].lower() for n in notes)

    # 2. once dispensed, it can't be cancelled
    rx2 = (await doc.post("/api/v1/prescriptions", json=body)).json()
    await doc.post(f"/api/v1/prescriptions/{rx2['id']}/finalize")
    await ph.post(f"/api/v1/prescriptions/{rx2['id']}/pharmacy", json={"action": "verify"})
    await ph.post(f"/api/v1/prescriptions/{rx2['id']}/pharmacy", json={"action": "dispense"})
    blocked = await doc.post(f"/api/v1/prescriptions/{rx2['id']}/cancel", json={"reason": "Changed mind"})
    assert blocked.status_code == 400 and "dispensed" in blocked.json()["detail"]


def test_doctor_response_sends_flag_back_for_recheck():
    r = PharmacyReview("active")
    with pytest.raises(ValueError, match="Only a flagged"):
        r.respond("Intended dose")          # nothing to respond to yet
    r.flag("Dose looks high")
    with pytest.raises(ValueError, match="Explain"):
        r.respond(" ")
    r.respond("Loading dose is intended for this patient")
    assert r.status == PharmacyStatus.PENDING   # pharmacist must check again
    r.verify()
    assert r.status == PharmacyStatus.VERIFIED


async def test_doctor_responds_to_flag_over_api(env):  # noqa: F811
    doc, pat, ph = env["doctor"], env["patient"], env["pharmacist"]
    rx = (await doc.post("/api/v1/prescriptions", json=_rx(env))).json()
    await doc.post(f"/api/v1/prescriptions/{rx['id']}/finalize")
    url = f"/api/v1/prescriptions/{rx['id']}/pharmacy"
    # can't respond before a flag exists
    assert (await doc.post(url, json={"action": "respond", "notes": "fine"})).status_code == 400
    await ph.post(url, json={"action": "flag", "notes": "Possible interaction"})
    # only the prescribing doctor responds
    assert (await ph.post(url, json={"action": "respond", "notes": "x" * 5})).status_code == 403
    assert (await pat.post(url, json={"action": "respond", "notes": "x" * 5})).status_code == 403
    assert (await doc.post(url, json={"action": "respond"})).status_code == 400
    res = (await doc.post(url, json={"action": "respond", "notes": "Benefit outweighs risk; monitoring"})).json()
    assert res["pharmacy_status"] == "pending"
    assert [h["action"] for h in res["pharmacy_history"]] == ["flag", "respond"]
    ph_notes = (await ph.get("/api/v1/notifications")).json()
    ph_notes = ph_notes if isinstance(ph_notes, list) else ph_notes.get("items", [])
    assert any("responded" in n["title"].lower() for n in ph_notes)
    # pharmacist can now verify again
    assert (await ph.post(url, json={"action": "verify"})).json()["pharmacy_status"] == "verified"


async def test_corrected_prescription_replaces_flagged_one_on_issue(env):  # noqa: F811
    doc, ph = env["doctor"], env["pharmacist"]
    old = (await doc.post("/api/v1/prescriptions", json=_rx(env))).json()
    await doc.post(f"/api/v1/prescriptions/{old['id']}/finalize")
    await ph.post(f"/api/v1/prescriptions/{old['id']}/pharmacy", json={"action": "flag", "notes": "Dose too high"})

    new = (await doc.post("/api/v1/prescriptions", json={**_rx(env), "replaces_id": old["id"]})).json()
    assert new["replaces_id"] == old["id"]
    # still a draft: the original stays active (patient isn't left without a prescription)
    assert (await doc.get(f"/api/v1/prescriptions/{old['id']}")).json()["status"] == "active"

    await doc.post(f"/api/v1/prescriptions/{new['id']}/finalize")
    o = (await doc.get(f"/api/v1/prescriptions/{old['id']}")).json()
    assert o["status"] == "cancelled" and o["replaced_by_id"] == new["id"]
    assert "Dose too high" in o["cancellation_reason"] and new["id"].replace("-", "")[:8] in o["cancellation_reason"]

    notes = (await ph.get("/api/v1/notifications")).json()
    notes = notes if isinstance(notes, list) else notes.get("items", [])
    assert any("corrected prescription" in n["title"].lower() for n in notes)

    # a cancelled prescription can't be replaced again
    assert (await doc.post("/api/v1/prescriptions", json={**_rx(env), "replaces_id": old["id"]})).status_code == 400


async def test_search_by_prescription_number_and_cancel_reason_saved(env):  # noqa: F811
    doc = env["doctor"]
    rx = (await doc.post("/api/v1/prescriptions", json=_rx(env))).json()
    short = "#" + rx["id"].replace("-", "")[:8]
    found = (await doc.get("/api/v1/prescriptions", params={"search": short})).json()["items"]
    assert [p["id"] for p in found] == [rx["id"]]
    await doc.post(f"/api/v1/prescriptions/{rx['id']}/finalize")
    await doc.post(f"/api/v1/prescriptions/{rx['id']}/cancel", json={"reason": "Wrong patient"})
    assert (await doc.get(f"/api/v1/prescriptions/{rx['id']}")).json()["cancellation_reason"] == "Wrong patient"
