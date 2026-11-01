"""
ArogyaNova — Analytics Service
Calculates medication adherence statistics and prescription trends.
"""
from __future__ import annotations

import uuid
from typing import Dict, Any
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    MedicationLogModel,
    MedicationScheduleModel,
    PrescriptionModel,
    UserModel,
)


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_patient_adherence(self, patient_id: uuid.UUID) -> Dict[str, Any]:
        """
        Calculate adherence percentage for a patient:
        Adherence % = (doses_taken / total_doses_logged) * 100
        """
        stmt_total = (
            select(func.count(MedicationLogModel.id))
            .where(MedicationLogModel.patient_id == patient_id)
        )
        total_logged = (await self._db.execute(stmt_total)).scalar() or 0

        stmt_taken = (
            select(func.count(MedicationLogModel.id))
            .where(
                MedicationLogModel.patient_id == patient_id,
                MedicationLogModel.action == "taken",
            )
        )
        taken_count = (await self._db.execute(stmt_taken)).scalar() or 0
        skipped_count = total_logged - taken_count

        adherence_rate = round((taken_count / total_logged * 100), 1) if total_logged > 0 else 100.0

        return {
            "total_doses": total_logged,
            "doses_taken": taken_count,
            "doses_skipped": skipped_count,
            "adherence_rate": adherence_rate,
            "status": "Good" if adherence_rate >= 80 else "Needs Attention" if adherence_rate >= 50 else "Poor",
        }
