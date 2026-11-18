"""
ArogyaNova — Pydantic Schemas
Request/response validation and serialization.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import AliasChoices, BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Common
# ---------------------------------------------------------------------------

class MessageResponse(BaseModel):
    message: str


class PaginatedResponse(BaseModel):
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(..., pattern="^(doctor|patient|pharmacist)$")
    # Role-specific fields
    license_number: Optional[str] = None
    specialization: Optional[str] = None
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None
    blood_group: Optional[str] = Field(None, pattern="^(A|B|AB|O)[+-]$")
    allergies: Optional[str] = Field(None, max_length=500)

    @field_validator("role")
    @classmethod
    def role_cannot_be_admin(cls, v: str) -> str:
        if v == "administrator":
            raise ValueError("Cannot register as administrator via public registration.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    # Only returned in development, where no email server is configured.
    dev_reset_token: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10)
    new_password: str = Field(..., min_length=8)


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserDetailResponse(UserResponse):
    access_token: Optional[str] = None
    locked_until: Optional[datetime] = None   # set while the account is locked after failed logins
    doctor_profile: Optional[DoctorProfileResponse] = None
    patient_profile: Optional[PatientProfileResponse] = None
    pharmacist_profile: Optional[PharmacistProfileResponse] = None


class DoctorProfileResponse(BaseModel):
    license_number: str
    specialization: Optional[str] = None
    hospital_affiliation: Optional[str] = None
    phone: Optional[str] = None

    model_config = {"from_attributes": True}


class PatientProfileResponse(BaseModel):
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    blood_group: Optional[str] = None
    emergency_contact: Optional[str] = None
    allergies: Optional[str] = None
    medical_history: Optional[str] = None

    model_config = {"from_attributes": True}


class PharmacistProfileResponse(BaseModel):
    license_number: str
    pharmacy_name: Optional[str] = None
    phone: Optional[str] = None

    model_config = {"from_attributes": True}


# Fix forward references
UserDetailResponse.model_rebuild()


# ---------------------------------------------------------------------------
# Medications
# ---------------------------------------------------------------------------

class MedicationCreate(BaseModel):
    generic_name: str = Field(..., min_length=1, max_length=200)
    brand_name: Optional[str] = Field(None, max_length=200)
    strength: str = Field(..., min_length=1, max_length=100)
    dosage_form: str = Field(..., min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    manufacturer: Optional[str] = Field(None, max_length=200)


class MedicationUpdate(BaseModel):
    generic_name: Optional[str] = Field(None, min_length=1, max_length=200)
    brand_name: Optional[str] = Field(None, max_length=200)
    strength: Optional[str] = Field(None, min_length=1, max_length=100)
    dosage_form: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    manufacturer: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = None


class MedicationResponse(BaseModel):
    id: uuid.UUID
    generic_name: str
    brand_name: Optional[str] = None
    strength: str
    dosage_form: str
    category: Optional[str] = None
    description: Optional[str] = None
    manufacturer: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Prescriptions
# ---------------------------------------------------------------------------

class PrescriptionItemCreate(BaseModel):
    medication_id: uuid.UUID
    strength: str = Field(..., min_length=1, max_length=100)
    dosage: str = Field(..., min_length=1, max_length=100)
    route: str = Field(..., max_length=100)
    frequency: str = Field(..., min_length=1, max_length=100)
    duration_days: int = Field(..., gt=0, le=365)
    quantity: str = Field(..., min_length=1, max_length=100)
    instructions: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class PrescriptionItemResponse(BaseModel):
    id: uuid.UUID
    medication_id: uuid.UUID
    strength: str
    dosage: str
    route: str
    frequency: str
    duration_days: int
    quantity: str
    instructions: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    medication: Optional[MedicationResponse] = None

    model_config = {"from_attributes": True}


class PrescriptionCreate(BaseModel):
    patient_id: uuid.UUID
    issue_date: date
    follow_up_date: Optional[date] = None
    diagnosis: Optional[str] = None
    clinical_notes: Optional[str] = None
    items: List[PrescriptionItemCreate] = Field(default_factory=list)
    # Set when this is a corrected version of a (flagged) prescription
    replaces_id: Optional[uuid.UUID] = None


class PrescriptionUpdate(BaseModel):
    follow_up_date: Optional[date] = None
    diagnosis: Optional[str] = None
    clinical_notes: Optional[str] = None


class PrescriptionSummary(BaseModel):
    id: uuid.UUID
    status: str
    issue_date: date
    follow_up_date: Optional[date] = None
    diagnosis: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    patient: Optional[UserResponse] = None
    doctor: Optional[UserResponse] = None
    item_count: int = 0
    pharmacy_status: str = "pending"
    cancellation_reason: Optional[str] = None
    replaces_id: Optional[uuid.UUID] = None
    replaced_by_id: Optional[uuid.UUID] = None

    model_config = {"from_attributes": True}


class PharmacyActionResponse(BaseModel):
    action: str
    notes: Optional[str] = None
    pharmacist_name: str
    created_at: datetime


class CancelRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class PharmacyActionRequest(BaseModel):
    action: str = Field(..., pattern="^(verify|flag|dispense|respond)$")
    notes: Optional[str] = Field(None, max_length=1000)


class PrescriptionDetail(PrescriptionSummary):
    items: List[PrescriptionItemResponse] = Field(default_factory=list)
    clinical_notes: Optional[str] = None
    pharmacy_history: List[PharmacyActionResponse] = Field(default_factory=list)


class PrescriptionListResponse(PaginatedResponse):
    items: List[PrescriptionSummary]


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class NotificationResponse(BaseModel):
    id: uuid.UUID
    title: str
    message: str
    priority: str
    action_url: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Schedule
# ---------------------------------------------------------------------------

class ScheduleEntryResponse(BaseModel):
    id: uuid.UUID
    scheduled_at: datetime
    medication_name: str
    dosage: str
    instructions: Optional[str] = None
    logged_action: Optional[str] = None

    model_config = {"from_attributes": True}


class LogMedicationRequest(BaseModel):
    action: str = Field(..., pattern="^(taken|skipped)$")
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

class DashboardStatsResponse(BaseModel):
    role: str
    stats: dict[str, Any]


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------

class AuditLogResponse(BaseModel):
    id: uuid.UUID
    actor_id: Optional[uuid.UUID] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Admin User Management
# ---------------------------------------------------------------------------

class AdminUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = Field(None, pattern="^(doctor|patient|pharmacist|administrator|receptionist)$")


class AdminCreateUser(RegisterRequest):
    role: str = Field(..., pattern="^(doctor|patient|pharmacist|administrator|receptionist)$")

    @field_validator("role")
    @classmethod
    def role_cannot_be_admin(cls, v: str) -> str:
        # Admin can create any role
        return v


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------

class InteractionCheckRequest(BaseModel):
    # Accept both "medicine_names" and "medicines" (the key the frontend sends)
    medicine_names: List[str] = Field(
        ..., min_length=2, validation_alias=AliasChoices("medicine_names", "medicines")
    )


class InteractionCheckResponse(BaseModel):
    checked_medicines: List[str]
    has_interactions: bool
    interactions: List[dict]
    is_available: bool
    source: str
    disclaimer: str
    checked_at: datetime
    error_message: Optional[str] = None





# ---------------------------------------------------------------------------
# Vitals
# ---------------------------------------------------------------------------

class VitalsCreate(BaseModel):
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    pulse: Optional[int] = None
    spo2: Optional[int] = None
    temperature_c: Optional[float] = None
    respiratory_rate: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    notes: Optional[str] = Field(None, max_length=1000)


class VitalAlertResponse(BaseModel):
    level: str
    message: str


class VitalsResponse(VitalsCreate):
    id: uuid.UUID
    patient_id: uuid.UUID
    recorded_by_name: str
    recorded_by_role: str
    recorded_at: datetime
    bmi: Optional[float] = None
    bmi_category: Optional[str] = None
    alerts: List[VitalAlertResponse] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------

class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    scheduled_at: datetime   # clinic local time, must be one of the doctor's free slots
    reason: str = Field(..., min_length=3, max_length=300)


class AppointmentActionRequest(BaseModel):
    action: str = Field(..., pattern="^(check_in|complete|cancel|no_show)$")
    reason: Optional[str] = Field(None, max_length=300)


class AppointmentResponse(BaseModel):
    id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int
    reason: str
    status: str
    cancellation_reason: Optional[str] = None
    patient: Optional[UserResponse] = None
    doctor: Optional[UserResponse] = None
    booked_by_name: Optional[str] = None
    created_at: datetime


class SlotResponse(BaseModel):
    time: datetime
    available: bool


class DaySlotsResponse(BaseModel):
    doctor_id: uuid.UUID
    day: date
    working_day: bool
    slots: List[SlotResponse]


class DoctorOptionResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    specialization: Optional[str] = None
