"""
ArogyaNova — Prescription Domain Service
Encapsulates business operations, state transition validation, and domain rules.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from app.domain.prescription import PrescriptionStatus
from app.models.models import (
    MedicationModel,
    MedicationScheduleModel,
    PrescriptionItemModel,
    PrescriptionModel,
    UserModel,
)
from app.repositories.prescription_repository import PrescriptionRepository


class PrescriptionService:
    """
    Service coordinating prescription creation, finalization, cancellation,
    and automatic medication schedule generation upon finalization.
    """

    def __init__(self, repo: PrescriptionRepository) -> None:
        self._repo = repo

    async def get_prescription(self, prescription_id: uuid.UUID) -> Optional[PrescriptionModel]:
        return await self._repo.get_with_items(prescription_id)

    async def finalize_prescription(
        self, prescription: PrescriptionModel
    ) -> List[MedicationScheduleModel]:
        """
        Transition draft to active and create daily medication schedule entries.
        """
        if prescription.status != PrescriptionStatus.DRAFT.value:
            raise ValueError(f"Cannot finalize prescription with status '{prescription.status}'. Only drafts can be finalized.")

        prescription.status = PrescriptionStatus.ACTIVE.value
        now = datetime.now(timezone.utc)
        prescription.updated_at = now

        # Generate schedule entries for each item
        schedules: List[MedicationScheduleModel] = []
        for item in prescription.items:
            duration = item.duration_days or 7
            start = item.start_date or date.today()
            # Simple daily schedule generation (e.g. at 09:00 morning)
            for day_offset in range(min(duration, 30)):
                dose_date = start + timedelta(days=day_offset)
                scheduled_time = datetime(
                    dose_date.year, dose_date.month, dose_date.day, 9, 0, tzinfo=timezone.utc
                )
                sched = MedicationScheduleModel(
                    id=uuid.uuid4(),
                    patient_id=prescription.patient_id,
                    prescription_item_id=item.id,
                    scheduled_time=scheduled_time,
                )
                schedules.append(sched)

        await self._repo.update(prescription)
        return schedules

    async def cancel_prescription(
        self, prescription: PrescriptionModel, reason: Optional[str] = None
    ) -> PrescriptionModel:
        if prescription.status not in [PrescriptionStatus.DRAFT.value, PrescriptionStatus.ACTIVE.value]:
            raise ValueError(f"Cannot cancel prescription with status '{prescription.status}'.")

        prescription.status = PrescriptionStatus.CANCELLED.value
        if reason:
            prescription.clinical_notes = (prescription.clinical_notes or "") + f"\n[Cancelled]: {reason}"
        prescription.updated_at = datetime.now(timezone.utc)
        await self._repo.update(prescription)
        return prescription
