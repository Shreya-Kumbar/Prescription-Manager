"""
ArogyaNova — Appointments API

The receptionist books a patient into one of a doctor's free slots; the doctor is notified
and sees the visit on their screen. Rules (slots, states) live in app.domain.appointment.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.domain.appointment import Appointment, AppointmentAction, AppointmentStatus, DoctorSchedule
from app.domain.base_user import UserRole
from app.models.models import AppointmentModel, AuditLogModel, NotificationModel, UserModel
from app.schemas.schemas import (
    AppointmentActionRequest, AppointmentCreate, AppointmentResponse, DaySlotsResponse,
    DoctorOptionResponse, SlotResponse, UserResponse,
)
from app.security.dependencies import get_current_user

router = APIRouter(prefix="/appointments", tags=["Appointments"])

SCHEDULE = DoctorSchedule()           # every doctor uses the clinic's standard hours
_FRONT_DESK = {UserRole.RECEPTIONIST.value, UserRole.ADMINISTRATOR.value}
_ACTIVE = [AppointmentStatus.BOOKED.value, AppointmentStatus.CHECKED_IN.value]


def _when(dt: datetime) -> str:
    return dt.strftime("%a %d %b, %I:%M %p").replace(" 0", " ")


def _response(a: AppointmentModel) -> AppointmentResponse:
    return AppointmentResponse(
        id=a.id, scheduled_at=a.scheduled_at, duration_minutes=a.duration_minutes, reason=a.reason,
        status=a.status, cancellation_reason=a.cancellation_reason,
        patient=UserResponse.model_validate(a.patient) if a.patient else None,
        doctor=UserResponse.model_validate(a.doctor) if a.doctor else None,
        booked_by_name=f"{a.booked_by.first_name} {a.booked_by.last_name}" if a.booked_by else None,
        created_at=a.created_at,
    )


async def _load(appointment_id: uuid.UUID, db: AsyncSession) -> AppointmentModel:
    a = (await db.execute(
        select(AppointmentModel)
        .options(selectinload(AppointmentModel.patient), selectinload(AppointmentModel.doctor), selectinload(AppointmentModel.booked_by))
        .where(AppointmentModel.id == appointment_id)
        .execution_options(populate_existing=True)
    )).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return a


async def _taken(doctor_id: uuid.UUID, day: date, db: AsyncSession) -> list[datetime]:
    start = datetime.combine(day, datetime.min.time())
    return list((await db.execute(
        select(AppointmentModel.scheduled_at).where(
            AppointmentModel.doctor_id == doctor_id, AppointmentModel.status.in_(_ACTIVE),
            AppointmentModel.scheduled_at >= start, AppointmentModel.scheduled_at < start + timedelta(days=1),
        )
    )).scalars().all())


async def _doctor_or_404(doctor_id: uuid.UUID, db: AsyncSession) -> UserModel:
    d = (await db.execute(select(UserModel).where(UserModel.id == doctor_id))).scalar_one_or_none()
    if not d or d.role != UserRole.DOCTOR.value or not d.is_active:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    return d


@router.get("/doctors", response_model=List[DoctorOptionResponse])
async def list_doctors(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> List[DoctorOptionResponse]:
    """Doctors a visit can be booked with."""
    if current_user.role == UserRole.PHARMACIST.value:
        raise HTTPException(status_code=403, detail="Access denied.")
    rows = (await db.execute(
        select(UserModel).options(selectinload(UserModel.doctor_profile))
        .where(UserModel.role == UserRole.DOCTOR.value, UserModel.is_active == True)  # noqa: E712
        .order_by(UserModel.last_name)
    )).scalars().all()
    return [DoctorOptionResponse(id=d.id, first_name=d.first_name, last_name=d.last_name,
                                 specialization=d.doctor_profile.specialization if d.doctor_profile else None) for d in rows]


@router.get("/slots", response_model=DaySlotsResponse)
async def day_slots(
    doctor_id: uuid.UUID,
    day: date,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DaySlotsResponse:
    """All of a doctor's slots on a day, marking the ones already taken or in the past."""
    if current_user.role not in _FRONT_DESK | {UserRole.DOCTOR.value}:
        raise HTTPException(status_code=403, detail="Only the front desk can view booking slots.")
    await _doctor_or_404(doctor_id, db)
    free = set(SCHEDULE.free_slots(day, await _taken(doctor_id, day, db)))
    return DaySlotsResponse(
        doctor_id=doctor_id, day=day, working_day=SCHEDULE.works_on(day),
        slots=[SlotResponse(time=s, available=s in free) for s in SCHEDULE.slots_on(day)],
    )


@router.post("", response_model=AppointmentResponse, status_code=201)
async def book_appointment(
    body: AppointmentCreate,
    request: Request,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AppointmentResponse:
    """Front desk books a patient into a free slot; doctor and patient are notified."""
    if current_user.role not in _FRONT_DESK:
        raise HTTPException(status_code=403, detail="Appointments are booked at the front desk (receptionist).")
    patient = (await db.execute(select(UserModel).where(UserModel.id == body.patient_id))).scalar_one_or_none()
    if not patient or patient.role != UserRole.PATIENT.value or not patient.is_active:
        raise HTTPException(status_code=404, detail="Patient not found.")
    doctor = await _doctor_or_404(body.doctor_id, db)

    start = body.scheduled_at.replace(tzinfo=None, second=0, microsecond=0)
    if not SCHEDULE.is_slot(start):
        raise HTTPException(status_code=400, detail="That time is outside the doctor's working hours (Mon–Sat, 9–1 and 2–5, 15-minute slots).")
    if start <= datetime.now():
        raise HTTPException(status_code=400, detail="That slot is already in the past.")
    if start in await _taken(doctor.id, start.date(), db):
        raise HTTPException(status_code=409, detail="That slot was just taken — pick another time.")
    clash = (await db.execute(select(AppointmentModel.id).where(
        AppointmentModel.patient_id == patient.id, AppointmentModel.scheduled_at == start,
        AppointmentModel.status.in_(_ACTIVE)))).first()
    if clash:
        raise HTTPException(status_code=409, detail="This patient already has an appointment at that time.")

    a = AppointmentModel(patient_id=patient.id, doctor_id=doctor.id, booked_by_id=current_user.id,
                         scheduled_at=start, duration_minutes=SCHEDULE.slot_minutes, reason=body.reason.strip())
    db.add(a)
    await db.flush()
    db.add(NotificationModel(
        user_id=doctor.id, title="New appointment",
        message=f"{patient.first_name} {patient.last_name} is booked with you on {_when(start)} — {a.reason}",
        priority="normal", action_url="/appointments",
    ))
    db.add(NotificationModel(
        user_id=patient.id, title="Appointment booked",
        message=f"You're booked with Dr. {doctor.first_name} {doctor.last_name} on {_when(start)}. Please arrive 10 minutes early.",
        priority="normal", action_url="/appointments",
    ))
    db.add(AuditLogModel(actor_id=current_user.id, action="appointment.book", resource_type="appointment",
                         resource_id=str(a.id), ip_address=request.client.host if request.client else None))
    await db.commit()
    return _response(await _load(a.id, db))


@router.get("", response_model=List[AppointmentResponse])
async def list_appointments(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    day: Optional[date] = Query(None, description="Only this day"),
    when: Optional[str] = Query(None, pattern="^(upcoming|past)$"),
    doctor_id: Optional[uuid.UUID] = Query(None),
    patient_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
) -> List[AppointmentResponse]:
    """Doctors see their own, patients their own, front desk sees everyone's."""
    role = current_user.role
    if role == UserRole.PHARMACIST.value:
        raise HTTPException(status_code=403, detail="Access denied.")
    q = select(AppointmentModel).options(
        selectinload(AppointmentModel.patient), selectinload(AppointmentModel.doctor), selectinload(AppointmentModel.booked_by))
    if role == UserRole.DOCTOR.value:
        q = q.where(AppointmentModel.doctor_id == current_user.id)
    elif role == UserRole.PATIENT.value:
        q = q.where(AppointmentModel.patient_id == current_user.id)
    if doctor_id:
        q = q.where(AppointmentModel.doctor_id == doctor_id)
    if patient_id:
        q = q.where(AppointmentModel.patient_id == patient_id)
    if status:
        q = q.where(AppointmentModel.status == status)
    today = datetime.combine(date.today(), datetime.min.time())
    if day:
        start = datetime.combine(day, datetime.min.time())
        q = q.where(AppointmentModel.scheduled_at >= start, AppointmentModel.scheduled_at < start + timedelta(days=1))
    if when == "upcoming":
        q = q.where(AppointmentModel.scheduled_at >= today + timedelta(days=1)).order_by(AppointmentModel.scheduled_at)
    elif when == "past":
        q = q.where(AppointmentModel.scheduled_at < today).order_by(AppointmentModel.scheduled_at.desc())
    else:
        q = q.order_by(AppointmentModel.scheduled_at)
    rows = (await db.execute(q.limit(200))).scalars().all()
    return [_response(a) for a in rows]


@router.post("/{appointment_id}/status", response_model=AppointmentResponse)
async def change_status(
    appointment_id: uuid.UUID,
    body: AppointmentActionRequest,
    request: Request,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AppointmentResponse:
    """
    check_in / no_show: front desk.  complete: the appointment's doctor.
    cancel (reason required): front desk, the doctor, or the patient themself.
    """
    a = await _load(appointment_id, db)
    role, action = current_user.role, body.action
    is_doctor = role == UserRole.DOCTOR.value and a.doctor_id == current_user.id
    is_patient = role == UserRole.PATIENT.value and a.patient_id == current_user.id
    allowed = {
        "check_in": role in _FRONT_DESK,
        "no_show": role in _FRONT_DESK,
        "complete": is_doctor,
        "cancel": role in _FRONT_DESK or is_doctor or is_patient,
    }[action]
    if not allowed:
        raise HTTPException(status_code=403, detail="You can't do that for this appointment.")

    domain = Appointment(a.scheduled_at, AppointmentStatus(a.status))
    a.status = domain.apply(AppointmentAction(action), body.reason).value   # ValueError -> HTTP 400
    if action == "cancel":
        a.cancellation_reason = body.reason.strip()

    who = f"{current_user.first_name} {current_user.last_name}"
    pname = f"{a.patient.first_name} {a.patient.last_name}"
    if action == "check_in":
        db.add(NotificationModel(user_id=a.doctor_id, title="Patient checked in",
                                 message=f"{pname} has arrived for the {a.scheduled_at:%I:%M %p} appointment.",
                                 priority="normal", action_url="/appointments"))
    elif action == "cancel":
        if not is_doctor:
            db.add(NotificationModel(user_id=a.doctor_id, title="Appointment cancelled",
                                     message=f"{pname}'s appointment on {_when(a.scheduled_at)} was cancelled by {who}: {a.cancellation_reason}",
                                     priority="normal", action_url="/appointments"))
        if not is_patient:
            db.add(NotificationModel(user_id=a.patient_id, title="Appointment cancelled",
                                     message=f"Your appointment with Dr. {a.doctor.last_name} on {_when(a.scheduled_at)} was cancelled: {a.cancellation_reason}. Please contact reception to rebook.",
                                     priority="high", action_url="/appointments"))
    db.add(AuditLogModel(actor_id=current_user.id, action=f"appointment.{action}", resource_type="appointment",
                         resource_id=str(a.id), details=body.reason,
                         ip_address=request.client.host if request.client else None))
    await db.commit()
    return _response(await _load(a.id, db))
