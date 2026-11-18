"""
ArogyaNova — Patients, Medications, Schedule, Notifications, Dashboard, Admin, AI routes
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Annotated, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.domain.base_user import UserRole
from app.domain.ai_providers import LocalInteractionChecker
from app.models.models import (
    AuditLogModel, MedicationLogModel, MedicationModel, MedicationScheduleModel,
    NotificationModel, PrescriptionItemModel, PrescriptionModel, UserModel,
    DoctorProfileModel, PatientProfileModel, PharmacistProfileModel, VitalsModel,
)
from app.schemas.schemas import (
    AdminCreateUser, VitalsCreate, VitalsResponse,
    AdminUserUpdate, AuditLogResponse, DashboardStatsResponse,
    InteractionCheckRequest, InteractionCheckResponse, LogMedicationRequest,
    MedicationCreate, MedicationResponse, MedicationUpdate,
    MessageResponse, NotificationResponse,
    PatientProfileResponse, ScheduleEntryResponse, UserDetailResponse, UserResponse,
)
from app.security.dependencies import get_current_user

# ─────────────────────────────────────────────
# Patients
# ─────────────────────────────────────────────
patients_router = APIRouter(prefix="/patients", tags=["Patients"])


@patients_router.get("", response_model=List[UserDetailResponse])
async def list_patients(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> List[UserDetailResponse]:
    if current_user.role not in [UserRole.DOCTOR.value, UserRole.ADMINISTRATOR.value, UserRole.RECEPTIONIST.value]:
        raise HTTPException(status_code=403, detail="Access denied.")

    q = (
        select(UserModel)
        .options(
            selectinload(UserModel.patient_profile),
            selectinload(UserModel.doctor_profile),
            selectinload(UserModel.pharmacist_profile),
        )
        .where(UserModel.role == "patient", UserModel.is_active == True)
        .order_by(UserModel.last_name)
    )
    if search:
        term = f"%{search}%"
        q = q.where(
            UserModel.first_name.ilike(term) |
            UserModel.last_name.ilike(term) |
            UserModel.email.ilike(term)
        )
    q = q.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(q)).scalars().all()
    return [UserDetailResponse.model_validate(u) for u in rows]


@patients_router.get("/{patient_id}", response_model=UserDetailResponse)
async def get_patient(
    patient_id: uuid.UUID,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserDetailResponse:
    # Patients can only view themselves
    if current_user.role == UserRole.PATIENT.value and current_user.id != patient_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    if current_user.role not in [UserRole.DOCTOR.value, UserRole.ADMINISTRATOR.value, UserRole.PATIENT.value, UserRole.RECEPTIONIST.value]:
        raise HTTPException(status_code=403, detail="Access denied.")

    result = await db.execute(
        select(UserModel)
        .options(
            selectinload(UserModel.patient_profile),
            selectinload(UserModel.doctor_profile),
            selectinload(UserModel.pharmacist_profile),
        )
        .where(UserModel.id == patient_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return UserDetailResponse.model_validate(user)


@patients_router.patch("/{patient_id}/profile", response_model=MessageResponse)
async def update_patient_profile(
    patient_id: uuid.UUID,
    body: PatientProfileResponse,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    # Only the patient themself or an administrator may change a patient's personal details.
    if current_user.id != patient_id and current_user.role != UserRole.ADMINISTRATOR.value:
        raise HTTPException(status_code=403, detail="Access denied.")

    result = await db.execute(
        select(PatientProfileModel).where(PatientProfileModel.user_id == patient_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if hasattr(profile, k):
            setattr(profile, k, v)
    await db.commit()
    return MessageResponse(message="Profile updated.")


# ─────────────────────────────────────────────
# Medications
# ─────────────────────────────────────────────
medications_router = APIRouter(prefix="/medications", tags=["Medications"])


@medications_router.get("", response_model=List[MedicationResponse])
async def list_medications(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    active_only: bool = Query(True),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
) -> List[MedicationResponse]:
    q = select(MedicationModel).order_by(MedicationModel.generic_name)
    if active_only:
        q = q.where(MedicationModel.is_active == True)
    if search:
        term = f"%{search}%"
        q = q.where(MedicationModel.generic_name.ilike(term) | MedicationModel.brand_name.ilike(term))
    if category:
        q = q.where(MedicationModel.category == category)
    q = q.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(q)).scalars().all()
    return [MedicationResponse.model_validate(r) for r in rows]


@medications_router.post("", response_model=MedicationResponse, status_code=201)
async def create_medication(
    body: MedicationCreate,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MedicationResponse:
    if current_user.role not in (UserRole.PHARMACIST.value, UserRole.ADMINISTRATOR.value):
        raise HTTPException(status_code=403, detail="Only pharmacists and administrators can add medications.")

    # Duplicate check
    existing = await db.execute(
        select(MedicationModel).where(
            MedicationModel.generic_name == body.generic_name,
            MedicationModel.strength == body.strength,
            MedicationModel.dosage_form == body.dosage_form,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A medication with this name, strength, and form already exists.")

    med = MedicationModel(id=uuid.uuid4(), **body.model_dump())
    db.add(med)
    await db.commit()
    await db.refresh(med)
    return MedicationResponse.model_validate(med)


@medications_router.patch("/{medication_id}", response_model=MedicationResponse)
async def update_medication(
    medication_id: uuid.UUID,
    body: MedicationUpdate,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MedicationResponse:
    if current_user.role not in (UserRole.PHARMACIST.value, UserRole.ADMINISTRATOR.value):
        raise HTTPException(status_code=403, detail="Only pharmacists and administrators can update medications.")

    result = await db.execute(select(MedicationModel).where(MedicationModel.id == medication_id))
    med = result.scalar_one_or_none()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found.")

    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(med, k, v)
    await db.commit()
    await db.refresh(med)
    return MedicationResponse.model_validate(med)


# ─────────────────────────────────────────────
# Schedule
# ─────────────────────────────────────────────
schedule_router = APIRouter(prefix="/schedule", tags=["Schedule"])


@schedule_router.get("", response_model=List[ScheduleEntryResponse])
async def get_schedule(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
) -> List[ScheduleEntryResponse]:
    if current_user.role != UserRole.PATIENT.value:
        raise HTTPException(status_code=403, detail="Schedule is only available to patients.")

    q = (
        select(MedicationScheduleModel)
        .where(MedicationScheduleModel.patient_id == current_user.id)
        .options(selectinload(MedicationScheduleModel.logs))
        .order_by(MedicationScheduleModel.scheduled_at)
    )
    if date_from:
        q = q.where(MedicationScheduleModel.scheduled_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        q = q.where(MedicationScheduleModel.scheduled_at <= datetime.combine(date_to, datetime.max.time()))

    rows = (await db.execute(q)).scalars().all()
    result = []
    for row in rows:
        logged_action = row.logs[-1].action if row.logs else None
        result.append(ScheduleEntryResponse(
            id=row.id,
            scheduled_at=row.scheduled_at,
            medication_name=row.medication_name,
            dosage=row.dosage,
            instructions=row.instructions,
            logged_action=logged_action,
        ))
    return result


@schedule_router.post("/{schedule_id}/log", response_model=MessageResponse)
async def log_medication(
    schedule_id: uuid.UUID,
    body: LogMedicationRequest,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    if current_user.role != UserRole.PATIENT.value:
        raise HTTPException(status_code=403, detail="Only patients can log medications.")

    result = await db.execute(
        select(MedicationScheduleModel).where(
            MedicationScheduleModel.id == schedule_id,
            MedicationScheduleModel.patient_id == current_user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule entry not found.")

    # A dose can only be logged on the day it is scheduled for:
    # future doses aren't due yet, and past unlogged doses count as missed.
    scheduled = schedule.scheduled_at
    if scheduled.tzinfo is not None:
        scheduled = scheduled.astimezone().replace(tzinfo=None)
    today = datetime.now().date()
    if scheduled.date() > today:
        raise HTTPException(
            status_code=400,
            detail=f"This dose is scheduled for {scheduled.strftime('%d %b')}. You can log it on that day.",
        )
    if scheduled.date() < today:
        raise HTTPException(
            status_code=400,
            detail=f"This dose was due on {scheduled.strftime('%d %b')} and can no longer be logged — it counts as missed.",
        )

    # Each dose is logged once.
    already = await db.execute(select(MedicationLogModel.id).where(MedicationLogModel.schedule_id == schedule_id))
    if already.first():
        raise HTTPException(status_code=400, detail="This dose has already been logged.")

    log = MedicationLogModel(
        schedule_id=schedule_id,
        patient_id=current_user.id,
        action=body.action,
        notes=body.notes,
    )
    db.add(log)
    await db.commit()
    return MessageResponse(message=f"Medication marked as {body.action}.")


# ─────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────
notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])


@notifications_router.get("", response_model=List[NotificationResponse])
async def get_notifications(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    unread_only: bool = Query(False),
) -> List[NotificationResponse]:
    q = (
        select(NotificationModel)
        .where(NotificationModel.user_id == current_user.id)
        .order_by(NotificationModel.created_at.desc())
        .limit(100)
    )
    if unread_only:
        q = q.where(NotificationModel.is_read == False)
    rows = (await db.execute(q)).scalars().all()
    return [NotificationResponse.model_validate(r) for r in rows]


@notifications_router.patch("/{notification_id}/read", response_model=MessageResponse)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    result = await db.execute(
        select(NotificationModel).where(
            NotificationModel.id == notification_id,
            NotificationModel.user_id == current_user.id,
        )
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found.")
    n.is_read = True
    await db.commit()
    return MessageResponse(message="Marked as read.")


@notifications_router.patch("/read-all", response_model=MessageResponse)
async def mark_all_read(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    from sqlalchemy import update as sa_update
    await db.execute(
        sa_update(NotificationModel)
        .where(NotificationModel.user_id == current_user.id, NotificationModel.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return MessageResponse(message="All notifications marked as read.")


# ─────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────
dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@dashboard_router.get("", response_model=DashboardStatsResponse)
async def get_dashboard(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DashboardStatsResponse:
    role = current_user.role
    stats: dict[str, Any] = {}

    if role == UserRole.DOCTOR.value:
        total_pres = (await db.execute(
            select(func.count()).where(PrescriptionModel.doctor_id == current_user.id)
        )).scalar_one()
        draft_pres = (await db.execute(
            select(func.count()).where(
                PrescriptionModel.doctor_id == current_user.id,
                PrescriptionModel.status == "draft"
            )
        )).scalar_one()
        active_pres = (await db.execute(
            select(func.count()).where(
                PrescriptionModel.doctor_id == current_user.id,
                PrescriptionModel.status == "active"
            )
        )).scalar_one()
        patient_count = (await db.execute(
            select(func.count(PrescriptionModel.patient_id.distinct())).where(
                PrescriptionModel.doctor_id == current_user.id
            )
        )).scalar_one()
        recent = (await db.execute(
            select(PrescriptionModel)
            .options(selectinload(PrescriptionModel.patient))
            .where(PrescriptionModel.doctor_id == current_user.id)
            .order_by(PrescriptionModel.created_at.desc())
            .limit(5)
        )).scalars().all()
        stats = {
            "total_prescriptions": total_pres,
            "draft_prescriptions": draft_pres,
            "active_prescriptions": active_pres,
            "total_patients": patient_count,
            "recent_prescriptions": [
                {"id": str(p.id), "status": p.status, "patient_name": f"{p.patient.first_name} {p.patient.last_name}" if p.patient else "Unknown", "date": p.issue_date.isoformat()}
                for p in recent
            ],
        }

    elif role == UserRole.PATIENT.value:
        active_pres = (await db.execute(
            select(func.count()).where(
                PrescriptionModel.patient_id == current_user.id,
                PrescriptionModel.status == "active"
            )
        )).scalar_one()
        total_pres = (await db.execute(
            select(func.count()).where(PrescriptionModel.patient_id == current_user.id)
        )).scalar_one()
        today = datetime.now(timezone.utc).date()
        today_schedule = (await db.execute(
            select(MedicationScheduleModel)
            .where(
                MedicationScheduleModel.patient_id == current_user.id,
                func.date(MedicationScheduleModel.scheduled_at) == today,
            )
            .options(selectinload(MedicationScheduleModel.logs))
            .order_by(MedicationScheduleModel.scheduled_at)
            .limit(10)
        )).scalars().all()

        taken = sum(1 for s in today_schedule if s.logs and s.logs[-1].action == "taken")
        stats = {
            "active_prescriptions": active_pres,
            "total_prescriptions": total_pres,
            "today_doses_total": len(today_schedule),
            "today_doses_taken": taken,
            "upcoming_doses": [
                {"id": str(s.id), "medication": s.medication_name, "time": s.scheduled_at.isoformat(), "logged": bool(s.logs)}
                for s in today_schedule[:5]
            ],
        }

    elif role == UserRole.PHARMACIST.value:
        rows = (await db.execute(
            select(PrescriptionModel.pharmacy_status, func.count())
            .where(PrescriptionModel.status == "active")
            .group_by(PrescriptionModel.pharmacy_status)
        )).all()
        by_status = {k: v for k, v in rows}
        stats = {
            "prescriptions_pending_review": by_status.get("pending", 0),
            "ready_to_dispense": by_status.get("verified", 0),
            "flagged": by_status.get("flagged", 0),
            "dispensed": by_status.get("dispensed", 0),
            "total_reviewed": sum(v for k, v in by_status.items() if k != "pending"),
        }

    elif role == UserRole.ADMINISTRATOR.value:
        user_counts = {}
        for r in ["doctor", "patient", "pharmacist", "administrator", "receptionist"]:
            count = (await db.execute(
                select(func.count()).where(UserModel.role == r)
            )).scalar_one()
            user_counts[r] = count
        total_pres = (await db.execute(select(func.count(PrescriptionModel.id)))).scalar_one()
        active_pres = (await db.execute(
            select(func.count()).where(PrescriptionModel.status == "active")
        )).scalar_one()
        stats = {
            "users_by_role": user_counts,
            "total_prescriptions": total_pres,
            "active_prescriptions": active_pres,
        }

    elif role == UserRole.RECEPTIONIST.value:
        today_start = datetime.combine(date.today(), datetime.min.time())
        total_patients = (await db.execute(select(func.count()).where(UserModel.role == "patient"))).scalar_one()
        new_today = (await db.execute(select(func.count()).where(
            UserModel.role == "patient", UserModel.created_at >= today_start))).scalar_one()
        recent = (await db.execute(
            select(VitalsModel).options(selectinload(VitalsModel.recorded_by))
            .order_by(VitalsModel.recorded_at.desc()).limit(8)
        )).scalars().all()
        names = {u.id: f"{u.first_name} {u.last_name}" for u in (await db.execute(
            select(UserModel).where(UserModel.id.in_([v.patient_id for v in recent])))).scalars().all()}
        vitals_today = (await db.execute(select(func.count()).where(VitalsModel.recorded_at >= today_start))).scalar_one()
        recent_out = []
        flagged_today = 0
        for v in recent:
            resp = _vitals_response(v)
            if v.recorded_at and v.recorded_at.replace(tzinfo=None) >= today_start and resp.alerts:
                flagged_today += 1
            recent_out.append({**resp.model_dump(mode="json"), "patient_name": names.get(v.patient_id, "Patient")})
        stats = {
            "total_patients": total_patients,
            "registered_today": new_today,
            "vitals_today": vitals_today,
            "flagged_today": flagged_today,
            "recent_vitals": recent_out,
        }

    return DashboardStatsResponse(role=role, stats=stats)


# ─────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────
analytics_router = APIRouter(prefix="/analytics", tags=["Analytics"])


@analytics_router.get("/overview")
async def analytics_overview(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=7, le=365),
) -> dict:
    if current_user.role not in [UserRole.DOCTOR.value, UserRole.ADMINISTRATOR.value]:
        raise HTTPException(status_code=403, detail="Access denied.")

    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    q = select(PrescriptionModel).where(PrescriptionModel.created_at >= cutoff)
    if current_user.role == UserRole.DOCTOR.value:
        q = q.where(PrescriptionModel.doctor_id == current_user.id)

    prescriptions = (await db.execute(q)).scalars().all()

    status_dist: dict[str, int] = {}
    for p in prescriptions:
        status_dist[p.status] = status_dist.get(p.status, 0) + 1

    by_date: dict[str, int] = {}
    for p in prescriptions:
        day = p.issue_date.isoformat()
        by_date[day] = by_date.get(day, 0) + 1

    # --- Medication adherence, per scheduled dose ---
    # taken / skipped come from the patient's logs; a past dose with no log counts as MISSED;
    # today's unlogged doses are still pending and future doses are not counted yet.
    sched_q = select(MedicationScheduleModel).options(selectinload(MedicationScheduleModel.logs))
    if current_user.role == UserRole.DOCTOR.value:
        my_patients = select(PrescriptionModel.patient_id).where(PrescriptionModel.doctor_id == current_user.id)
        sched_q = sched_q.where(MedicationScheduleModel.patient_id.in_(my_patients))
    schedules = (await db.execute(sched_q)).scalars().all()

    today = datetime.now().date()

    def dose_state(sc) -> str:
        if sc.logs:
            return sc.logs[0].action               # "taken" | "skipped"
        d = sc.scheduled_at.date()
        return "missed" if d < today else ("pending" if d == today else "upcoming")

    states = [(sc.scheduled_at.date(), dose_state(sc)) for sc in schedules]
    counted = [st for _, st in states if st in ("taken", "skipped", "missed")]
    taken_total = sum(1 for st in counted if st == "taken")
    missed_total = sum(1 for st in counted if st == "missed")
    adherence_rate = round(taken_total / len(counted) * 100, 1) if counted else None

    week = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        day = [st for dd, st in states if dd == d and st in ("taken", "skipped", "missed")]
        taken = sum(1 for st in day if st == "taken")
        week.append({
            "day": d.strftime("%a"),
            "date": d.isoformat(),
            "taken": taken,
            "total": len(day),
            "rate": round(taken / len(day) * 100, 1) if day else None,
        })

    return {
        "period_days": days,
        "total": len(prescriptions),
        "status_distribution": status_dist,
        "prescriptions_by_date": by_date,
        "adherence_rate": adherence_rate,
        "doses_logged": len(counted),
        "doses_taken": taken_total,
        "doses_missed": missed_total,
        "adherence_by_day": week,
    }


# ─────────────────────────────────────────────
# Admin
# ─────────────────────────────────────────────
admin_router = APIRouter(prefix="/admin", tags=["Administration"])


@admin_router.get("/users", response_model=List[UserDetailResponse])
async def admin_list_users(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    role_filter: Optional[str] = Query(None, alias="role"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> List[UserDetailResponse]:
    if current_user.role != UserRole.ADMINISTRATOR.value:
        raise HTTPException(status_code=403, detail="Admin only.")

    q = (
        select(UserModel)
        .options(
            selectinload(UserModel.doctor_profile),
            selectinload(UserModel.patient_profile),
            selectinload(UserModel.pharmacist_profile),
        )
        .order_by(UserModel.created_at.desc())
    )
    if role_filter:
        q = q.where(UserModel.role == role_filter)
    if search:
        term = f"%{search}%"
        q = q.where(UserModel.first_name.ilike(term) | UserModel.last_name.ilike(term) | UserModel.email.ilike(term))
    q = q.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(q)).scalars().all()
    return [UserDetailResponse.model_validate(u) for u in rows]


@admin_router.post("/users/{user_id}/unlock", response_model=MessageResponse)
async def admin_unlock_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Administrator clears a lockout caused by failed logins."""
    if current_user.role != UserRole.ADMINISTRATOR.value:
        raise HTTPException(status_code=403, detail="Administrators only.")
    target = await db.get(UserModel, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    from app.security.lockout import LOCKOUT
    LOCKOUT.reset(target)
    db.add(AuditLogModel(actor_id=current_user.id, action="auth.unlock", resource_type="user", resource_id=str(user_id),
                         ip_address=request.client.host if request.client else None))
    await db.commit()
    return MessageResponse(message=f"{target.first_name} {target.last_name} can sign in again.")


@admin_router.post("/users", response_model=UserDetailResponse, status_code=201)
async def admin_create_user(
    body: AdminCreateUser,
    request: Request,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserDetailResponse:
    """Administrators create any account; receptionists register walk-in patients."""
    if current_user.role == UserRole.RECEPTIONIST.value:
        if body.role != UserRole.PATIENT.value:
            raise HTTPException(status_code=403, detail="Receptionists can register patients only.")
    elif current_user.role != UserRole.ADMINISTRATOR.value:
        raise HTTPException(status_code=403, detail="Only administrators can create staff accounts.")
    from app.api.v1.auth import _load_user_with_profiles, create_user_account
    user = await create_user_account(db, body, request.client.host if request.client else None, actor_id=current_user.id)
    return UserDetailResponse.model_validate(await _load_user_with_profiles(db, user.id))


@admin_router.patch("/users/{user_id}", response_model=UserDetailResponse)
async def admin_update_user(
    user_id: uuid.UUID,
    body: AdminUserUpdate,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserDetailResponse:
    if current_user.role != UserRole.ADMINISTRATOR.value:
        raise HTTPException(status_code=403, detail="Admin only.")

    result = await db.execute(
        select(UserModel)
        .options(
            selectinload(UserModel.doctor_profile),
            selectinload(UserModel.patient_profile),
            selectinload(UserModel.pharmacist_profile),
        )
        .where(UserModel.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if body.is_active is not None:
        user.is_active = body.is_active
    if body.role is not None:
        user.role = body.role

    db.add(AuditLogModel(
        actor_id=current_user.id,
        action="admin.user_update",
        resource_type="user",
        resource_id=str(user_id),
        details=f"Updated: {body.model_dump(exclude_unset=True)}",
    ))
    await db.commit()
    await db.refresh(user)
    return UserDetailResponse.model_validate(user)


@admin_router.get("/audit-logs", response_model=List[AuditLogResponse])
async def admin_audit_logs(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
) -> List[AuditLogResponse]:
    if current_user.role != UserRole.ADMINISTRATOR.value:
        raise HTTPException(status_code=403, detail="Admin only.")

    q = (
        select(AuditLogModel)
        .order_by(AuditLogModel.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = (await db.execute(q)).scalars().all()
    return [AuditLogResponse.model_validate(r) for r in rows]


# ─────────────────────────────────────────────
# AI
# ─────────────────────────────────────────────
ai_router = APIRouter(prefix="/ai", tags=["AI / ML"])
_interaction_checker = LocalInteractionChecker()


@ai_router.post("/interaction-check", response_model=InteractionCheckResponse)
async def check_interactions(
    body: InteractionCheckRequest,
    current_user: Annotated[UserModel, Depends(get_current_user)],
) -> InteractionCheckResponse:
    if current_user.role not in [UserRole.DOCTOR.value, UserRole.PHARMACIST.value]:
        raise HTTPException(status_code=403, detail="Interaction checking is available to doctors and pharmacists.")

    result = await _interaction_checker.check(body.medicine_names)
    return InteractionCheckResponse(
        checked_medicines=result.checked_medicines,
        has_interactions=result.has_interactions,
        interactions=[
            {
                "drug_a": i.drug_a,
                "drug_b": i.drug_b,
                "severity": i.severity.value,
                "description": i.description,
                "source": i.source,
                "is_uncertain": i.is_uncertain,
            }
            for i in result.interactions
        ],
        is_available=result.is_available,
        source=result.source,
        disclaimer=result.disclaimer,
        checked_at=result.checked_at,
        error_message=result.error_message,
    )



# ─────────────────────────────────────────────
# Vitals (recorded at check-in by the receptionist, or by the doctor)
# ─────────────────────────────────────────────
def _vitals_response(model: VitalsModel) -> VitalsResponse:
    from app.domain.vitals import VitalSigns
    v = VitalSigns(
        systolic_bp=model.systolic_bp, diastolic_bp=model.diastolic_bp, pulse=model.pulse, spo2=model.spo2,
        temperature_c=model.temperature_c, respiratory_rate=model.respiratory_rate,
        weight_kg=model.weight_kg, height_cm=model.height_cm,
    )
    who = model.recorded_by
    return VitalsResponse(
        id=model.id, patient_id=model.patient_id,
        systolic_bp=model.systolic_bp, diastolic_bp=model.diastolic_bp, pulse=model.pulse, spo2=model.spo2,
        temperature_c=model.temperature_c, respiratory_rate=model.respiratory_rate,
        weight_kg=model.weight_kg, height_cm=model.height_cm, notes=model.notes,
        recorded_by_name=f"{who.first_name} {who.last_name}" if who else "Staff",
        recorded_by_role=who.role if who else "",
        recorded_at=model.recorded_at,
        bmi=v.bmi, bmi_category=v.bmi_category,
        alerts=[{"level": a.level.value, "message": a.message} for a in v.alerts],
    )


@patients_router.post("/{patient_id}/vitals", response_model=VitalsResponse, status_code=201)
async def record_vitals(
    patient_id: uuid.UUID,
    body: VitalsCreate,
    request: Request,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VitalsResponse:
    """Receptionist (at check-in) or doctor records a patient's vital signs."""
    if current_user.role not in (UserRole.RECEPTIONIST.value, UserRole.DOCTOR.value):
        raise HTTPException(status_code=403, detail="Only receptionists and doctors can record vitals.")
    patient = (await db.execute(select(UserModel).where(UserModel.id == patient_id))).scalar_one_or_none()
    if not patient or patient.role != UserRole.PATIENT.value:
        raise HTTPException(status_code=404, detail="Patient not found.")

    from app.domain.vitals import VitalSigns
    readings = body.model_dump(exclude={"notes"})
    VitalSigns(**readings)  # domain validation — raises ValueError -> HTTP 400

    model = VitalsModel(patient_id=patient_id, recorded_by_id=current_user.id, notes=body.notes, **readings)
    db.add(model)
    db.add(AuditLogModel(
        actor_id=current_user.id, action="vitals.record", resource_type="patient", resource_id=str(patient_id),
        ip_address=request.client.host if request.client else None,
    ))
    await db.commit()
    saved = (await db.execute(
        select(VitalsModel).options(selectinload(VitalsModel.recorded_by)).where(VitalsModel.id == model.id)
    )).scalar_one()
    return _vitals_response(saved)


@patients_router.get("/{patient_id}/vitals", response_model=List[VitalsResponse])
async def list_vitals(
    patient_id: uuid.UUID,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(20, ge=1, le=100),
) -> List[VitalsResponse]:
    """Vital-sign history, newest first."""
    if current_user.role == UserRole.PATIENT.value and current_user.id != patient_id:
        raise HTTPException(status_code=403, detail="You can only view your own vitals.")
    if current_user.role == UserRole.PHARMACIST.value:
        raise HTTPException(status_code=403, detail="Access denied.")
    rows = (await db.execute(
        select(VitalsModel).options(selectinload(VitalsModel.recorded_by))
        .where(VitalsModel.patient_id == patient_id)
        .order_by(VitalsModel.recorded_at.desc()).limit(limit)
    )).scalars().all()
    return [_vitals_response(r) for r in rows]
