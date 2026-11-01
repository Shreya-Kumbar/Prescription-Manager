"""
ArogyaNova — Prescription API Routes
Full CRUD with role-based access and status transitions.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.domain.base_user import UserRole
from app.domain.prescription import Prescription, PrescriptionItem, PrescriptionStatus, RouteOfAdministration
from app.models.models import (
    AuditLogModel, MedicationModel, MedicationScheduleModel,
    NotificationModel, PrescriptionItemModel, PrescriptionModel, UserModel,
)
from app.schemas.schemas import (
    MessageResponse, PrescriptionCreate, PrescriptionDetail,
    PrescriptionListResponse, PrescriptionSummary, PrescriptionUpdate,
)
from app.security.dependencies import get_current_user, require_role

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])

_DOCTOR_ROLE = require_role(UserRole.DOCTOR)
_ANY_AUTH = require_role(UserRole.DOCTOR, UserRole.PATIENT, UserRole.PHARMACIST, UserRole.ADMINISTRATOR)


def _prescription_to_domain(model: PrescriptionModel) -> Prescription:
    """Map ORM model to domain Prescription."""
    p = Prescription(
        prescription_id=model.id,
        patient_id=model.patient_id,
        doctor_id=model.doctor_id,
        issue_date=model.issue_date,
        diagnosis=model.diagnosis,
        clinical_notes=model.clinical_notes,
        follow_up_date=model.follow_up_date,
        status=PrescriptionStatus(model.status),
        created_at=model.created_at,
        updated_at=model.updated_at,
    )
    for item in model.items:
        try:
            route = RouteOfAdministration(item.route)
        except ValueError:
            route = RouteOfAdministration.OTHER
        p._items.append(
            PrescriptionItem(
                item_id=item.id,
                medication_id=item.medication_id,
                medication_name=item.medication.generic_name if item.medication else "",
                strength=item.strength,
                dosage=item.dosage,
                route=route,
                frequency=item.frequency,
                duration_days=item.duration_days,
                quantity=item.quantity,
                instructions=item.instructions,
                start_date=item.start_date,
                end_date=item.end_date,
            )
        )
    return p


def _build_summary(model: PrescriptionModel) -> PrescriptionSummary:
    from app.schemas.schemas import UserResponse
    return PrescriptionSummary(
        id=model.id,
        status=model.status,
        issue_date=model.issue_date,
        follow_up_date=model.follow_up_date,
        diagnosis=model.diagnosis,
        created_at=model.created_at,
        updated_at=model.updated_at,
        patient=UserResponse.model_validate(model.patient) if model.patient else None,
        doctor=UserResponse.model_validate(model.doctor) if model.doctor else None,
        item_count=len(model.items),
    )


async def _get_prescription_or_404(
    prescription_id: uuid.UUID,
    db: AsyncSession,
) -> PrescriptionModel:
    result = await db.execute(
        select(PrescriptionModel)
        .options(
            selectinload(PrescriptionModel.items).selectinload(PrescriptionItemModel.medication),
            selectinload(PrescriptionModel.patient),
            selectinload(PrescriptionModel.doctor),
        )
        .where(PrescriptionModel.id == prescription_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    return p


def _check_access(model: PrescriptionModel, user: UserModel) -> None:
    """Object-level authorization: enforce who can read which prescription."""
    role = user.role
    if role == UserRole.DOCTOR.value:
        if model.doctor_id != user.id:
            raise HTTPException(status_code=403, detail="You are not the prescribing doctor for this prescription.")
    elif role == UserRole.PATIENT.value:
        if model.patient_id != user.id:
            raise HTTPException(status_code=403, detail="You can only view your own prescriptions.")
    elif role == UserRole.PHARMACIST.value:
        if model.status == PrescriptionStatus.DRAFT.value:
            raise HTTPException(status_code=403, detail="Draft prescriptions are not accessible to pharmacists.")
    # Admin: can read summary only (no clinical notes enforcement in route — filter downstream)


@router.get("", response_model=PrescriptionListResponse)
async def list_prescriptions(
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
) -> PrescriptionListResponse:
    """List prescriptions filtered by role and optional parameters."""
    q = (
        select(PrescriptionModel)
        .options(
            selectinload(PrescriptionModel.items),
            selectinload(PrescriptionModel.patient),
            selectinload(PrescriptionModel.doctor),
        )
        .order_by(PrescriptionModel.created_at.desc())
    )

    role = current_user.role
    if role == UserRole.DOCTOR.value:
        q = q.where(PrescriptionModel.doctor_id == current_user.id)
    elif role == UserRole.PATIENT.value:
        q = q.where(PrescriptionModel.patient_id == current_user.id)
    elif role == UserRole.PHARMACIST.value:
        q = q.where(PrescriptionModel.status.in_(["active", "completed"]))
    # Administrator sees all

    if status_filter:
        q = q.where(PrescriptionModel.status == status_filter)
    if date_from:
        q = q.where(PrescriptionModel.issue_date >= date_from)
    if date_to:
        q = q.where(PrescriptionModel.issue_date <= date_to)

    # Count
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    # Paginate
    q = q.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(q)).scalars().all()

    return PrescriptionListResponse(
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page,
        items=[_build_summary(r) for r in rows],
    )


@router.post("", response_model=PrescriptionDetail, status_code=status.HTTP_201_CREATED)
async def create_prescription(
    request: Request,
    body: PrescriptionCreate,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PrescriptionDetail:
    """Create a new prescription (Doctor only)."""
    if current_user.role != UserRole.DOCTOR.value:
        raise HTTPException(status_code=403, detail="Only doctors can create prescriptions.")

    # Verify patient exists
    patient_result = await db.execute(
        select(UserModel).where(UserModel.id == body.patient_id, UserModel.role == "patient")
    )
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    # Validate medications exist
    for item_data in body.items:
        med_result = await db.execute(
            select(MedicationModel).where(MedicationModel.id == item_data.medication_id, MedicationModel.is_active == True)
        )
        if not med_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Medication {item_data.medication_id} not found or inactive.")

    # Build domain object to validate state
    domain_prescription = Prescription(
        prescription_id=uuid.uuid4(),
        patient_id=body.patient_id,
        doctor_id=current_user.id,
        issue_date=body.issue_date,
        diagnosis=body.diagnosis,
        clinical_notes=body.clinical_notes,
        follow_up_date=body.follow_up_date,
    )

    # Persist — wrapped in a single transaction
    prescription_model = PrescriptionModel(
        id=domain_prescription.prescription_id,
        patient_id=body.patient_id,
        doctor_id=current_user.id,
        status="draft",
        issue_date=body.issue_date,
        follow_up_date=body.follow_up_date,
        diagnosis=body.diagnosis,
        clinical_notes=body.clinical_notes,
    )
    db.add(prescription_model)

    for item_data in body.items:
        item_model = PrescriptionItemModel(
            id=uuid.uuid4(),
            prescription_id=prescription_model.id,
            medication_id=item_data.medication_id,
            strength=item_data.strength,
            dosage=item_data.dosage,
            route=item_data.route,
            frequency=item_data.frequency,
            duration_days=item_data.duration_days,
            quantity=item_data.quantity,
            instructions=item_data.instructions,
            start_date=item_data.start_date,
            end_date=item_data.end_date,
        )
        db.add(item_model)

    # Notification to patient
    db.add(NotificationModel(
        user_id=body.patient_id,
        title="New Prescription Created",
        message=f"Dr. {current_user.first_name} {current_user.last_name} has created a new prescription for you.",
        priority="normal",
        action_url=f"/prescriptions/{prescription_model.id}",
    ))

    db.add(AuditLogModel(
        actor_id=current_user.id,
        action="prescription.create",
        resource_type="prescription",
        resource_id=str(prescription_model.id),
        ip_address=request.client.host if request.client else None,
    ))

    await db.commit()

    # Return full detail
    result = await _get_prescription_or_404(prescription_model.id, db)
    return _build_detail(result, current_user)


@router.get("/{prescription_id}", response_model=PrescriptionDetail)
async def get_prescription(
    prescription_id: uuid.UUID,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PrescriptionDetail:
    """Get a prescription by ID with object-level authorization."""
    model = await _get_prescription_or_404(prescription_id, db)
    _check_access(model, current_user)
    return _build_detail(model, current_user)


@router.patch("/{prescription_id}", response_model=PrescriptionDetail)
async def update_prescription(
    prescription_id: uuid.UUID,
    body: PrescriptionUpdate,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PrescriptionDetail:
    """Update a draft prescription's clinical info (Doctor only)."""
    if current_user.role != UserRole.DOCTOR.value:
        raise HTTPException(status_code=403, detail="Only the prescribing doctor can update a prescription.")

    model = await _get_prescription_or_404(prescription_id, db)
    if model.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the prescribing doctor.")

    # Use domain object for validation
    domain = _prescription_to_domain(model)
    domain.update_clinical_info(
        diagnosis=body.diagnosis,
        clinical_notes=body.clinical_notes,
        follow_up_date=body.follow_up_date,
    )

    if body.diagnosis is not None:
        model.diagnosis = body.diagnosis
    if body.clinical_notes is not None:
        model.clinical_notes = body.clinical_notes
    if body.follow_up_date is not None:
        model.follow_up_date = body.follow_up_date

    db.add(AuditLogModel(
        actor_id=current_user.id,
        action="prescription.update",
        resource_type="prescription",
        resource_id=str(prescription_id),
    ))
    await db.commit()
    result = await _get_prescription_or_404(prescription_id, db)
    return _build_detail(result, current_user)


@router.post("/{prescription_id}/finalize", response_model=PrescriptionDetail)
async def finalize_prescription(
    prescription_id: uuid.UUID,
    request: Request,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PrescriptionDetail:
    """Finalize a draft prescription (Doctor only)."""
    if current_user.role != UserRole.DOCTOR.value:
        raise HTTPException(status_code=403, detail="Only doctors can finalize prescriptions.")

    model = await _get_prescription_or_404(prescription_id, db)
    if model.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the prescribing doctor.")

    domain = _prescription_to_domain(model)
    domain.finalize()  # Raises ValueError if invalid

    model.status = PrescriptionStatus.ACTIVE.value

    # Generate medication schedule entries
    for item in model.items:
        if item.start_date:
            start = datetime.combine(item.start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        else:
            start = datetime.now(timezone.utc)

        for day in range(item.duration_days):
            from datetime import timedelta
            scheduled = start + timedelta(days=day)
            db.add(MedicationScheduleModel(
                patient_id=model.patient_id,
                prescription_item_id=item.id,
                scheduled_at=scheduled,
                medication_name=item.medication.generic_name if item.medication else "Unknown",
                dosage=item.dosage,
                instructions=item.instructions,
            ))

    db.add(NotificationModel(
        user_id=model.patient_id,
        title="Prescription Finalized",
        message="Your prescription has been finalized and is now active.",
        priority="high",
        action_url=f"/prescriptions/{prescription_id}",
    ))

    db.add(AuditLogModel(
        actor_id=current_user.id,
        action="prescription.finalize",
        resource_type="prescription",
        resource_id=str(prescription_id),
        ip_address=request.client.host if request.client else None,
    ))
    await db.commit()
    result = await _get_prescription_or_404(prescription_id, db)
    return _build_detail(result, current_user)


@router.post("/{prescription_id}/cancel", response_model=PrescriptionDetail)
async def cancel_prescription(
    prescription_id: uuid.UUID,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PrescriptionDetail:
    """Cancel a prescription (Doctor only)."""
    if current_user.role != UserRole.DOCTOR.value:
        raise HTTPException(status_code=403, detail="Only doctors can cancel prescriptions.")

    model = await _get_prescription_or_404(prescription_id, db)
    if model.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the prescribing doctor.")

    domain = _prescription_to_domain(model)
    domain.cancel()

    model.status = PrescriptionStatus.CANCELLED.value

    db.add(AuditLogModel(
        actor_id=current_user.id,
        action="prescription.cancel",
        resource_type="prescription",
        resource_id=str(prescription_id),
    ))
    await db.commit()
    result = await _get_prescription_or_404(prescription_id, db)
    return _build_detail(result, current_user)


def _build_detail(model: PrescriptionModel, current_user: UserModel) -> PrescriptionDetail:
    from app.schemas.schemas import PrescriptionItemResponse, UserResponse, MedicationResponse
    items = []
    for item in model.items:
        med = MedicationResponse.model_validate(item.medication) if item.medication else None
        items.append(PrescriptionItemResponse(
            id=item.id,
            medication_id=item.medication_id,
            strength=item.strength,
            dosage=item.dosage,
            route=item.route,
            frequency=item.frequency,
            duration_days=item.duration_days,
            quantity=item.quantity,
            instructions=item.instructions,
            start_date=item.start_date,
            end_date=item.end_date,
            medication=med,
        ))

    # Restrict clinical notes from admin
    clinical_notes = model.clinical_notes
    if current_user.role == UserRole.ADMINISTRATOR.value:
        clinical_notes = "[Clinical notes restricted]"

    return PrescriptionDetail(
        id=model.id,
        status=model.status,
        issue_date=model.issue_date,
        follow_up_date=model.follow_up_date,
        diagnosis=model.diagnosis,
        clinical_notes=clinical_notes,
        created_at=model.created_at,
        updated_at=model.updated_at,
        patient=UserResponse.model_validate(model.patient) if model.patient else None,
        doctor=UserResponse.model_validate(model.doctor) if model.doctor else None,
        item_count=len(items),
        items=items,
    )
