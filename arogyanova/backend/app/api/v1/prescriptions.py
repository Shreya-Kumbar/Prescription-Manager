"""
ArogyaNova — Prescription API Routes
Full CRUD with role-based access and status transitions.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.domain.base_user import UserRole
from app.domain.pharmacy import PharmacyAction, PharmacyReview, PharmacyStatus
from app.domain.prescription import Prescription, PrescriptionItem, PrescriptionStatus, RouteOfAdministration
from app.models.models import (
    AuditLogModel, MedicationModel, MedicationScheduleModel,
    NotificationModel, PharmacyActionModel, PrescriptionItemModel, PrescriptionModel, UserModel,
)
from app.schemas.schemas import (
    CancelRequest, MessageResponse, PharmacyActionRequest, PrescriptionCreate, PrescriptionDetail,
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


def _build_summary(model: PrescriptionModel, replaced_by: Optional[uuid.UUID] = None) -> PrescriptionSummary:
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
        pharmacy_status=model.pharmacy_status or "pending",
        **_link_fields(model, replaced_by),
    )


def _short(pid) -> str:
    return str(pid).replace("-", "")[:8]


def _link_fields(model: PrescriptionModel, replaced_by: Optional[uuid.UUID] = None) -> dict:
    """Cancellation reason + links between a prescription and its corrected version."""
    return {
        "cancellation_reason": model.cancellation_reason,
        "replaces_id": model.replaces_id,
        "replaced_by_id": replaced_by,
    }


async def _replaced_by_map(ids: list, db: AsyncSession) -> dict:
    """{original id: id of the issued prescription that replaced it} — one column query, no ORM objects."""
    if not ids:
        return {}
    rows = (await db.execute(
        select(PrescriptionModel.replaces_id, PrescriptionModel.id)
        .where(PrescriptionModel.replaces_id.in_(ids), PrescriptionModel.status != PrescriptionStatus.DRAFT.value)
        .order_by(PrescriptionModel.created_at)
    )).all()
    return {old: new for old, new in rows}


async def _detail(model: PrescriptionModel, current_user: UserModel, db: AsyncSession) -> PrescriptionDetail:
    links = await _replaced_by_map([model.id], db)
    return _build_detail(model, current_user, links.get(model.id))


async def _cancel_and_clear(model: PrescriptionModel, reason: str, db: AsyncSession) -> None:
    """Cancel through the domain object, keep the reason, and drop the doses that haven't happened."""
    domain = _prescription_to_domain(model)
    domain.cancel(reason)
    model.status = PrescriptionStatus.CANCELLED.value
    model.cancellation_reason = reason
    today_start = datetime.combine(date.today(), datetime.min.time())
    item_ids = [i.id for i in model.items]
    if item_ids:
        future = (await db.execute(
            select(MedicationScheduleModel)
            .options(selectinload(MedicationScheduleModel.logs))
            .where(MedicationScheduleModel.prescription_item_id.in_(item_ids),
                   MedicationScheduleModel.scheduled_at >= today_start)
        )).scalars().all()
        for sc in future:
            if not sc.logs:
                await db.delete(sc)


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
            selectinload(PrescriptionModel.pharmacy_actions).selectinload(PharmacyActionModel.pharmacist),
        )
        .where(PrescriptionModel.id == prescription_id)
        .execution_options(populate_existing=True)  # always re-read after a change
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    return p


def _check_access(model: PrescriptionModel, user: UserModel) -> None:
    """Object-level authorization: enforce who can read which prescription."""
    role = user.role
    if role == UserRole.RECEPTIONIST.value:
        raise HTTPException(status_code=403, detail="Receptionists do not have access to prescriptions.")
    if role == UserRole.DOCTOR.value:
        # Any doctor may READ a patient's issued prescriptions (medication history matters for safe
        # prescribing). Drafts stay private to their author; every change still requires the author.
        if model.doctor_id != user.id and model.status == PrescriptionStatus.DRAFT.value:
            raise HTTPException(status_code=403, detail="This draft belongs to another doctor.")
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
    pharmacy_status: Optional[str] = Query(None),
    patient_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    scope: Optional[str] = Query(None, pattern="^(mine|all)$"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
) -> PrescriptionListResponse:
    """List prescriptions filtered by role and optional parameters."""
    if current_user.role == UserRole.RECEPTIONIST.value:
        raise HTTPException(status_code=403, detail="Receptionists do not have access to prescriptions.")
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
        # Default: the doctor's own prescriptions. For one patient's history, or with scope=all,
        # also include other doctors' issued (non-draft) prescriptions — read-only.
        if patient_id or scope == "all":
            q = q.where(or_(
                PrescriptionModel.doctor_id == current_user.id,
                PrescriptionModel.status != PrescriptionStatus.DRAFT.value,
            ))
        else:
            q = q.where(PrescriptionModel.doctor_id == current_user.id)
    elif role == UserRole.PATIENT.value:
        q = q.where(PrescriptionModel.patient_id == current_user.id)
    elif role == UserRole.PHARMACIST.value:
        q = q.where(PrescriptionModel.status.in_(["active", "completed"]))
    # Administrator sees all

    if status_filter:
        q = q.where(PrescriptionModel.status == status_filter)
    if pharmacy_status:
        q = q.where(PrescriptionModel.pharmacy_status == pharmacy_status)
    if patient_id:
        q = q.where(PrescriptionModel.patient_id == patient_id)
    if search:
        # Search diagnosis, notes, patient name/email and doctor name
        term = f"%{search.strip()}%"
        id_term = f"%{search.strip().lstrip('#').replace('-', '').lower()}%"
        patient_ids = select(UserModel.id).where(or_(
            UserModel.first_name.ilike(term), UserModel.last_name.ilike(term),
            (UserModel.first_name + " " + UserModel.last_name).ilike(term), UserModel.email.ilike(term),
        ))
        q = q.where(or_(
            PrescriptionModel.diagnosis.ilike(term),
            PrescriptionModel.clinical_notes.ilike(term),
            func.replace(func.lower(cast(PrescriptionModel.id, String)), "-", "").like(id_term),
            PrescriptionModel.patient_id.in_(patient_ids),
            PrescriptionModel.doctor_id.in_(patient_ids),
        ))
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
    links = await _replaced_by_map([r.id for r in rows], db)

    return PrescriptionListResponse(
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page,
        items=[_build_summary(r, links.get(r.id)) for r in rows],
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

    # A corrected version must replace an active, undispensed prescription of the same doctor & patient
    if body.replaces_id:
        original = await _get_prescription_or_404(body.replaces_id, db)
        if original.doctor_id != current_user.id or original.patient_id != body.patient_id:
            raise HTTPException(status_code=400, detail="A corrected prescription must be for the same patient, by the doctor who wrote the original.")
        if original.status != PrescriptionStatus.ACTIVE.value or original.pharmacy_status == "dispensed":
            raise HTTPException(status_code=400, detail="Only an active prescription that hasn't been dispensed can be replaced.")

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
        replaces_id=body.replaces_id,
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
    return await _detail(result, current_user, db)


@router.get("/{prescription_id}", response_model=PrescriptionDetail)
async def get_prescription(
    prescription_id: uuid.UUID,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PrescriptionDetail:
    """Get a prescription by ID with object-level authorization."""
    model = await _get_prescription_or_404(prescription_id, db)
    _check_access(model, current_user)
    return await _detail(model, current_user, db)


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
    return await _detail(result, current_user, db)


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

    # Issuing a corrected version cancels the one it replaces — in the same transaction,
    # so the patient is never left with two active versions or with none.
    original = None
    if model.replaces_id:
        original = await _get_prescription_or_404(model.replaces_id, db)
        if original.pharmacy_status == "dispensed":
            raise HTTPException(status_code=400, detail="The original prescription was dispensed in the meantime, so it can't be replaced. Write a new prescription instead.")
        if original.status == PrescriptionStatus.ACTIVE.value:
            flag = next((a.notes for a in reversed(original.pharmacy_actions or []) if a.action == "flag"), None)
            reason = f"Replaced by corrected prescription #{_short(model.id)}" + (f" (pharmacy flag: {flag})" if flag else "")
            await _cancel_and_clear(original, reason, db)

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

    if original is not None:
        db.add(NotificationModel(
            user_id=model.patient_id,
            title="Prescription updated",
            message=f"Dr. {current_user.last_name} corrected your prescription #{_short(original.id)}. Follow the new one (#{_short(model.id)}); the old one is cancelled.",
            priority="high",
            action_url=f"/prescriptions/{prescription_id}",
        ))
        # Tell the pharmacist(s) who raised the flag where the corrected version is
        for pid in {a.pharmacist_id for a in original.pharmacy_actions or [] if a.action == "flag"}:
            db.add(NotificationModel(
                user_id=pid,
                title="Corrected prescription issued",
                message=f"Dr. {current_user.last_name} replaced flagged #{_short(original.id)} for {model.patient.first_name} {model.patient.last_name} with #{_short(model.id)}. It's in your review queue.",
                priority="high",
                action_url=f"/prescriptions/{prescription_id}",
            ))
    else:
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
    return await _detail(result, current_user, db)


@router.post("/{prescription_id}/cancel", response_model=PrescriptionDetail)
async def cancel_prescription(
    prescription_id: uuid.UUID,
    body: CancelRequest,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PrescriptionDetail:
    """
    Cancel a prescription (prescribing doctor only), e.g. wrong drug or dose, a missed
    allergy, or a pharmacist flag. Not allowed once the medicines have been dispensed.
    """
    if current_user.role != UserRole.DOCTOR.value:
        raise HTTPException(status_code=403, detail="Only doctors can cancel prescriptions.")

    model = await _get_prescription_or_404(prescription_id, db)
    if model.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the prescribing doctor.")
    if model.pharmacy_status == "dispensed":
        raise HTTPException(
            status_code=400,
            detail="These medicines have already been dispensed to the patient, so the prescription can't be cancelled. Write a new prescription to change the treatment.",
        )

    # Cancel, keep the reason, and remove doses that haven't happened yet from the schedule
    await _cancel_and_clear(model, body.reason, db)

    db.add(NotificationModel(
        user_id=model.patient_id,
        title="Prescription cancelled",
        message=f"Dr. {current_user.last_name} cancelled your prescription. Reason: {body.reason}. Do not take the remaining doses.",
        priority="high",
        action_url=f"/prescriptions/{prescription_id}",
    ))
    db.add(AuditLogModel(
        actor_id=current_user.id,
        action="prescription.cancel",
        resource_type="prescription",
        resource_id=str(prescription_id),
        details=body.reason,
    ))
    await db.commit()
    result = await _get_prescription_or_404(prescription_id, db)
    return await _detail(result, current_user, db)


def _build_detail(model: PrescriptionModel, current_user: UserModel, replaced_by: Optional[uuid.UUID] = None) -> PrescriptionDetail:
    from app.schemas.schemas import MedicationResponse, PharmacyActionResponse, PrescriptionItemResponse, UserResponse
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
        pharmacy_status=model.pharmacy_status or "pending",
        pharmacy_history=[
            PharmacyActionResponse(
                action=a.action,
                notes=a.notes,
                pharmacist_name=f"{a.pharmacist.first_name} {a.pharmacist.last_name}" if a.pharmacist else "Pharmacist",
                created_at=a.created_at,
            )
            for a in (model.pharmacy_actions or [])
        ],
        **_link_fields(model, replaced_by),
    )



@router.post("/{prescription_id}/pharmacy", response_model=PrescriptionDetail)
async def pharmacy_action(
    prescription_id: uuid.UUID,
    body: PharmacyActionRequest,
    request: Request,
    current_user: Annotated[UserModel, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PrescriptionDetail:
    """
    Pharmacist verifies, flags (with a reason) or dispenses an active prescription.
    The prescribing doctor answers a flag with 'respond' (keep as written + reason),
    which sends the prescription back to the pharmacist for a fresh check.
    """
    model = await _get_prescription_or_404(prescription_id, db)
    if body.action == PharmacyAction.RESPOND.value:
        if current_user.role != UserRole.DOCTOR.value or model.doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the prescribing doctor can respond to a pharmacy flag.")
    elif current_user.role != UserRole.PHARMACIST.value:
        raise HTTPException(status_code=403, detail="Only pharmacists can verify, flag or dispense prescriptions.")

    # Domain object enforces the workflow rules (raises ValueError -> 400)
    review = PharmacyReview(prescription_status=model.status, status=PharmacyStatus(model.pharmacy_status or "pending"))
    new_status = review.apply(PharmacyAction(body.action), body.notes)
    model.pharmacy_status = new_status.value

    db.add(PharmacyActionModel(
        prescription_id=model.id, pharmacist_id=current_user.id, action=body.action, notes=body.notes,
    ))

    pharmacist = f"{current_user.first_name} {current_user.last_name}"
    if body.action == PharmacyAction.FLAG.value:
        db.add(NotificationModel(
            user_id=model.doctor_id,
            title="Prescription flagged by pharmacy",
            message=f"{pharmacist} flagged a prescription for {model.patient.first_name} {model.patient.last_name}: {body.notes}",
            priority="high",
            action_url=f"/prescriptions/{model.id}",
        ))
    elif body.action == PharmacyAction.DISPENSE.value:
        db.add(NotificationModel(
            user_id=model.patient_id,
            title="Medicines dispensed",
            message=f"Your medicines have been dispensed by {pharmacist}. Follow your dose schedule.",
            priority="normal",
            action_url=f"/prescriptions/{model.id}",
        ))
    elif body.action == PharmacyAction.RESPOND.value:
        flaggers = {a.pharmacist_id for a in model.pharmacy_actions if a.action == PharmacyAction.FLAG.value}
        doctor = f"Dr. {current_user.first_name} {current_user.last_name}"
        for pid in flaggers:
            db.add(NotificationModel(
                user_id=pid,
                title="Doctor responded to your flag",
                message=f"{doctor} kept the prescription for {model.patient.first_name} {model.patient.last_name} as written: {body.notes}. Please check it again.",
                priority="high",
                action_url=f"/prescriptions/{model.id}",
            ))
    elif body.action == PharmacyAction.VERIFY.value:
        db.add(NotificationModel(
            user_id=model.doctor_id,
            title="Prescription verified",
            message=f"{pharmacist} verified the prescription for {model.patient.first_name} {model.patient.last_name}.",
            priority="low",
            action_url=f"/prescriptions/{model.id}",
        ))

    db.add(AuditLogModel(
        actor_id=current_user.id,
        action=f"pharmacy.{body.action}",
        resource_type="prescription",
        resource_id=str(model.id),
        details=body.notes,
        ip_address=request.client.host if request.client else None,
    ))
    await db.commit()
    return await _detail(await _get_prescription_or_404(prescription_id, db), current_user, db)
