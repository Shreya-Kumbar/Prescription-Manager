"""
ArogyaNova — Backend Tests
Tests for domain classes, OOP behavior, and security.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta

import pytest

from app.domain.base_user import UserRole
from app.domain.prescription import (
    Prescription, PrescriptionItem, PrescriptionStatus, RouteOfAdministration,
)
from app.domain.users import Administrator, Doctor, Patient, Pharmacist
from app.domain.notifications import (
    InAppNotificationChannel, EmailNotificationChannel, SMSNotificationChannel,
    Notification, NotificationPriority, NotificationService,
)
from app.domain.ai_providers import (
    LocalInteractionChecker, UnavailableInteractionChecker,
    LocalOCRProvider, UnavailableOCRProvider,
)
from app.security.passwords import (
    hash_password, verify_password, create_access_token, decode_access_token,
    validate_password_strength,
)


# ─────────────────────────────────────────────────────────────
# OOP: Encapsulation Tests — Prescription domain class
# ─────────────────────────────────────────────────────────────

class TestPrescriptionEncapsulation:
    """
    Tests that Prescription controls its own state transitions
    and does not allow arbitrary mutation.
    """

    def _make_prescription(self, status=PrescriptionStatus.DRAFT) -> Prescription:
        p = Prescription(
            prescription_id=uuid.uuid4(),
            patient_id=uuid.uuid4(),
            doctor_id=uuid.uuid4(),
            issue_date=date.today(),
            status=status,
        )
        return p

    def _make_item(self) -> PrescriptionItem:
        return PrescriptionItem(
            item_id=uuid.uuid4(),
            medication_id=uuid.uuid4(),
            medication_name="Amoxicillin",
            strength="500mg",
            dosage="1 capsule",
            route=RouteOfAdministration.ORAL,
            frequency="Three times daily",
            duration_days=7,
            quantity="21 capsules",
        )

    def test_new_prescription_is_draft(self):
        p = self._make_prescription()
        assert p.status == PrescriptionStatus.DRAFT
        assert p.is_draft

    def test_can_add_item_to_draft(self):
        p = self._make_prescription()
        item = self._make_item()
        p.add_item(item)
        assert p.item_count == 1

    def test_items_returns_defensive_copy(self):
        p = self._make_prescription()
        p.add_item(self._make_item())
        items = p.items
        items.clear()  # Modifying the returned list should not affect prescription
        assert p.item_count == 1

    def test_cannot_add_item_to_active_prescription(self):
        p = self._make_prescription(PrescriptionStatus.ACTIVE)
        with pytest.raises(ValueError, match="Cannot add items"):
            p.add_item(self._make_item())

    def test_cannot_finalize_empty_prescription(self):
        p = self._make_prescription()
        with pytest.raises(ValueError, match="at least one medication"):
            p.finalize()

    def test_finalize_transitions_to_active(self):
        p = self._make_prescription()
        p.add_item(self._make_item())
        p.finalize()
        assert p.status == PrescriptionStatus.ACTIVE
        assert p.is_active

    def test_cannot_edit_finalized_prescription(self):
        p = self._make_prescription()
        p.add_item(self._make_item())
        p.finalize()
        assert not p.is_editable
        with pytest.raises(ValueError):
            p.update_clinical_info(diagnosis="Updated")

    def test_cannot_finalize_cancelled_prescription(self):
        p = self._make_prescription()
        p.add_item(self._make_item())
        p.cancel()
        with pytest.raises(ValueError, match="Invalid status transition"):
            p.finalize()

    def test_valid_status_transitions(self):
        p = self._make_prescription()
        p.add_item(self._make_item())
        # DRAFT -> ACTIVE -> COMPLETED
        p.finalize()
        p.complete()
        assert p.status == PrescriptionStatus.COMPLETED

    def test_invalid_transition_raises(self):
        p = self._make_prescription()
        p.add_item(self._make_item())
        p.finalize()
        p.complete()
        # COMPLETED -> ACTIVE is not allowed
        with pytest.raises(ValueError, match="Invalid status transition"):
            p.finalize()

    def test_remove_item_from_draft(self):
        p = self._make_prescription()
        item = self._make_item()
        p.add_item(item)
        p.remove_item(item.item_id)
        assert p.item_count == 0

    def test_remove_item_from_active_raises(self):
        p = self._make_prescription(PrescriptionStatus.ACTIVE)
        item = self._make_item()
        with pytest.raises(ValueError, match="Cannot remove"):
            p.remove_item(item.item_id)


# ─────────────────────────────────────────────────────────────
# OOP: Inheritance Tests — User hierarchy
# ─────────────────────────────────────────────────────────────

class TestUserInheritance:
    """Tests that the user class hierarchy works correctly."""

    def _make_doctor(self) -> Doctor:
        return Doctor(
            user_id=uuid.uuid4(),
            email="dr.test@arogyanova.dev",
            first_name="Test",
            last_name="Doctor",
            license_number="LIC-001",
        )

    def _make_patient(self) -> Patient:
        return Patient(
            user_id=uuid.uuid4(),
            email="patient.test@arogyanova.dev",
            first_name="Test",
            last_name="Patient",
        )

    def _make_pharmacist(self) -> Pharmacist:
        return Pharmacist(
            user_id=uuid.uuid4(),
            email="pharma.test@arogyanova.dev",
            first_name="Test",
            last_name="Pharmacist",
            license_number="PH-001",
        )

    def _make_admin(self) -> Administrator:
        return Administrator(
            user_id=uuid.uuid4(),
            email="admin.test@arogyanova.dev",
            first_name="Test",
            last_name="Admin",
        )

    def test_doctor_role(self):
        d = self._make_doctor()
        assert d.role == UserRole.DOCTOR

    def test_patient_role(self):
        p = self._make_patient()
        assert p.role == UserRole.PATIENT

    def test_doctor_can_create_prescription(self):
        d = self._make_doctor()
        assert d.can_create_prescription() is True

    def test_patient_cannot_create_prescription(self):
        p = self._make_patient()
        assert p.can_create_prescription() is False

    def test_pharmacist_cannot_create_prescription(self):
        ph = self._make_pharmacist()
        assert ph.can_create_prescription() is False

    def test_admin_cannot_create_prescription(self):
        a = self._make_admin()
        assert a.can_create_prescription() is False

    def test_doctor_has_prescription_create_permission(self):
        d = self._make_doctor()
        assert d.has_permission("prescription:create")

    def test_patient_does_not_have_prescription_create_permission(self):
        p = self._make_patient()
        assert not p.has_permission("prescription:create")

    def test_admin_does_not_get_clinical_permissions(self):
        a = self._make_admin()
        assert not a.has_permission("prescription:create")

    def test_deactivate_user(self):
        d = self._make_doctor()
        assert d.is_active
        d.deactivate()
        assert not d.is_active
        assert not d.can_create_prescription()

    def test_doctor_full_name(self):
        d = self._make_doctor()
        assert d.full_name == "Test Doctor"

    def test_doctor_display_title(self):
        d = self._make_doctor()
        assert d.display_title == "Dr. Test Doctor"

    def test_permissions_are_defensive_copy(self):
        d = self._make_doctor()
        perms = d.get_permissions()
        perms.clear()
        assert d.has_permission("prescription:create")


# ─────────────────────────────────────────────────────────────
# OOP: Polymorphism Tests — Notification channels
# ─────────────────────────────────────────────────────────────

class TestNotificationPolymorphism:
    """
    Tests that notification channels are interchangeable
    through the common interface.
    """

    def test_email_channel_unavailable_without_config(self):
        ch = EmailNotificationChannel()
        assert not ch.is_available()

    def test_sms_channel_unavailable_without_config(self):
        ch = SMSNotificationChannel()
        assert not ch.is_available()

    def test_email_channel_name(self):
        ch = EmailNotificationChannel()
        assert ch.channel_name == "email"

    def test_sms_channel_name(self):
        ch = SMSNotificationChannel()
        assert ch.channel_name == "sms"

    def test_notification_service_reports_available_channels(self):
        email = EmailNotificationChannel()  # unavailable
        sms = SMSNotificationChannel()  # unavailable
        service = NotificationService([email, sms])
        # Neither is configured so no available channels
        assert service.available_channels() == []

    def test_notification_service_with_mixed_channels(self):
        email = EmailNotificationChannel(smtp_host="smtp.test", smtp_user="test@test.com")
        sms = SMSNotificationChannel()
        service = NotificationService([email, sms])
        channels = service.available_channels()
        assert "email" in channels
        assert "sms" not in channels


# ─────────────────────────────────────────────────────────────
# OOP: Polymorphism Tests — AI Providers
# ─────────────────────────────────────────────────────────────

class TestAIProviderPolymorphism:
    """Tests that AI providers are interchangeable."""

    @pytest.mark.asyncio
    async def test_unavailable_ocr_returns_unavailable(self):
        provider = UnavailableOCRProvider()
        result = await provider.extract(b"fake_image", "image/jpeg")
        assert not result.is_available
        assert result.error_message is not None

    @pytest.mark.asyncio
    async def test_unavailable_interaction_checker(self):
        checker = UnavailableInteractionChecker()
        result = await checker.check(["aspirin", "warfarin"])
        assert not result.is_available
        assert result.error_message is not None
        # MUST NOT return a fabricated clean result
        assert not result.has_interactions

    @pytest.mark.asyncio
    async def test_local_interaction_checker_finds_known_interaction(self):
        checker = LocalInteractionChecker()
        result = await checker.check(["warfarin", "aspirin"])
        assert result.is_available
        assert result.has_interactions

    @pytest.mark.asyncio
    async def test_local_interaction_checker_no_interaction(self):
        checker = LocalInteractionChecker()
        result = await checker.check(["paracetamol", "cetirizine"])
        assert result.is_available
        # No known interaction in local dataset

    @pytest.mark.asyncio
    async def test_interaction_results_have_disclaimer(self):
        checker = LocalInteractionChecker()
        result = await checker.check(["warfarin", "aspirin"])
        assert result.disclaimer
        assert "qualified healthcare professional" in result.disclaimer

    def test_unavailable_provider_not_available(self):
        provider = UnavailableOCRProvider()
        assert not provider.is_available()

    def test_unavailable_checker_not_available(self):
        checker = UnavailableInteractionChecker()
        assert not checker.is_available()


# ─────────────────────────────────────────────────────────────
# Security Tests
# ─────────────────────────────────────────────────────────────

class TestSecurity:
    def test_password_hash_differs_from_plaintext(self):
        hashed = hash_password("TestPass123!")
        assert hashed != "TestPass123!"

    def test_correct_password_verifies(self):
        hashed = hash_password("TestPass123!")
        assert verify_password("TestPass123!", hashed)

    def test_wrong_password_fails(self):
        hashed = hash_password("TestPass123!")
        assert not verify_password("WrongPass999!", hashed)

    def test_jwt_roundtrip(self):
        user_id = uuid.uuid4()
        token = create_access_token(user_id, "doctor")
        payload = decode_access_token(token)
        assert payload["sub"] == str(user_id)
        assert payload["role"] == "doctor"

    def test_jwt_expired_raises(self):
        from jose import JWTError
        user_id = uuid.uuid4()
        token = create_access_token(user_id, "doctor", expires_delta=timedelta(seconds=-1))
        with pytest.raises(JWTError):
            decode_access_token(token)

    def test_password_strength_weak(self):
        errors = validate_password_strength("weak")
        assert len(errors) > 0

    def test_password_strength_strong(self):
        errors = validate_password_strength("StrongPass1!")
        assert len(errors) == 0

    def test_password_strength_no_uppercase(self):
        errors = validate_password_strength("lowercase123")
        assert any("uppercase" in e.lower() for e in errors)

    def test_password_strength_no_digit(self):
        errors = validate_password_strength("NoDigitsHere!")
        assert any("digit" in e.lower() for e in errors)

    def test_different_hashes_for_same_password(self):
        """Argon2id uses random salts — same password should produce different hashes."""
        h1 = hash_password("SamePassword1!")
        h2 = hash_password("SamePassword1!")
        assert h1 != h2
        assert verify_password("SamePassword1!", h1)
        assert verify_password("SamePassword1!", h2)
