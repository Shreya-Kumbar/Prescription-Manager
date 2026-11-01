"""
ArogyaNova — SQLAlchemy ORM Models
All tables mapped to PostgreSQL.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean, CheckConstraint, Column, Date, DateTime,
    Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.database import Base
from app.domain.base_user import UserRole
from app.domain.prescription import PrescriptionStatus, RouteOfAdministration


class UserModel(Base):
    """
    Core user table — stores authentication and role information.
    Extended by role-specific profile tables via one-to-one relationships.
    """
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    doctor_profile: Mapped[Optional["DoctorProfileModel"]] = relationship(
        "DoctorProfileModel", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    patient_profile: Mapped[Optional["PatientProfileModel"]] = relationship(
        "PatientProfileModel", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    pharmacist_profile: Mapped[Optional["PharmacistProfileModel"]] = relationship(
        "PharmacistProfileModel", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    notifications: Mapped[List["NotificationModel"]] = relationship(
        "NotificationModel", back_populates="user", cascade="all, delete-orphan"
    )
    prescriptions_written: Mapped[List["PrescriptionModel"]] = relationship(
        "PrescriptionModel", foreign_keys="PrescriptionModel.doctor_id", back_populates="doctor"
    )
    prescriptions_received: Mapped[List["PrescriptionModel"]] = relationship(
        "PrescriptionModel", foreign_keys="PrescriptionModel.patient_id", back_populates="patient"
    )
    audit_logs: Mapped[List["AuditLogModel"]] = relationship(
        "AuditLogModel", back_populates="actor"
    )
    refresh_tokens: Mapped[List["RefreshTokenModel"]] = relationship(
        "RefreshTokenModel", back_populates="user", cascade="all, delete-orphan"
    )
    medication_logs: Mapped[List["MedicationLogModel"]] = relationship(
        "MedicationLogModel", back_populates="patient"
    )

    __table_args__ = (
        CheckConstraint("role IN ('doctor', 'patient', 'pharmacist', 'administrator')", name="valid_role"),
    )

    def __repr__(self) -> str:
        return f"<UserModel {self.email} [{self.role}]>"


class DoctorProfileModel(Base):
    __tablename__ = "doctor_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    license_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    specialization: Mapped[Optional[str]] = mapped_column(String(200))
    hospital_affiliation: Mapped[Optional[str]] = mapped_column(String(200))
    phone: Mapped[Optional[str]] = mapped_column(String(20))

    user: Mapped["UserModel"] = relationship("UserModel", back_populates="doctor_profile")


class PatientProfileModel(Base):
    __tablename__ = "patient_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    address: Mapped[Optional[str]] = mapped_column(Text)
    blood_group: Mapped[Optional[str]] = mapped_column(String(10))
    emergency_contact: Mapped[Optional[str]] = mapped_column(String(200))
    allergies: Mapped[Optional[str]] = mapped_column(Text)
    medical_history: Mapped[Optional[str]] = mapped_column(Text)

    user: Mapped["UserModel"] = relationship("UserModel", back_populates="patient_profile")


class PharmacistProfileModel(Base):
    __tablename__ = "pharmacist_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    license_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    pharmacy_name: Mapped[Optional[str]] = mapped_column(String(200))
    phone: Mapped[Optional[str]] = mapped_column(String(20))

    user: Mapped["UserModel"] = relationship("UserModel", back_populates="pharmacist_profile")


class MedicationModel(Base):
    __tablename__ = "medications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    generic_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    brand_name: Mapped[Optional[str]] = mapped_column(String(200))
    strength: Mapped[str] = mapped_column(String(100), nullable=False)
    dosage_form: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    prescription_items: Mapped[List["PrescriptionItemModel"]] = relationship(
        "PrescriptionItemModel", back_populates="medication"
    )

    __table_args__ = (
        UniqueConstraint("generic_name", "strength", "dosage_form", name="uq_medication_unique"),
        Index("ix_medications_name_search", "generic_name", "brand_name"),
    )


class PrescriptionModel(Base):
    __tablename__ = "prescriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False, index=True)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    follow_up_date: Mapped[Optional[date]] = mapped_column(Date)
    diagnosis: Mapped[Optional[str]] = mapped_column(Text)
    clinical_notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    doctor: Mapped["UserModel"] = relationship("UserModel", foreign_keys=[doctor_id], back_populates="prescriptions_written")
    patient: Mapped["UserModel"] = relationship("UserModel", foreign_keys=[patient_id], back_populates="prescriptions_received")
    items: Mapped[List["PrescriptionItemModel"]] = relationship(
        "PrescriptionItemModel", back_populates="prescription", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'active', 'completed', 'cancelled', 'expired')",
            name="valid_prescription_status"
        ),
        Index("ix_prescriptions_patient_status", "patient_id", "status"),
        Index("ix_prescriptions_doctor_status", "doctor_id", "status"),
    )


class PrescriptionItemModel(Base):
    __tablename__ = "prescription_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    medication_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("medications.id"), nullable=False
    )
    strength: Mapped[str] = mapped_column(String(100), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)
    route: Mapped[str] = mapped_column(String(100), nullable=False)
    frequency: Mapped[str] = mapped_column(String(100), nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[str] = mapped_column(String(100), nullable=False)
    instructions: Mapped[Optional[str]] = mapped_column(Text)
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)

    prescription: Mapped["PrescriptionModel"] = relationship("PrescriptionModel", back_populates="items")
    medication: Mapped["MedicationModel"] = relationship("MedicationModel", back_populates="prescription_items")


class MedicationScheduleModel(Base):
    __tablename__ = "medication_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    prescription_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prescription_items.id", ondelete="CASCADE"), nullable=False
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    medication_name: Mapped[str] = mapped_column(String(200), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)
    instructions: Mapped[Optional[str]] = mapped_column(Text)

    logs: Mapped[List["MedicationLogModel"]] = relationship(
        "MedicationLogModel", back_populates="schedule"
    )

    __table_args__ = (
        Index("ix_schedule_patient_time", "patient_id", "scheduled_at"),
    )


class MedicationLogModel(Base):
    __tablename__ = "medication_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schedule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("medication_schedules.id", ondelete="CASCADE"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # "taken" | "skipped"
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[Optional[str]] = mapped_column(Text)

    schedule: Mapped["MedicationScheduleModel"] = relationship("MedicationScheduleModel", back_populates="logs")
    patient: Mapped["UserModel"] = relationship("UserModel", back_populates="medication_logs")

    __table_args__ = (
        CheckConstraint("action IN ('taken', 'skipped')", name="valid_log_action"),
    )


class NotificationModel(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(50), default="normal")
    action_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["UserModel"] = relationship("UserModel", back_populates="notifications")

    __table_args__ = (
        Index("ix_notifications_user_unread", "user_id", "is_read"),
    )


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[Optional[str]] = mapped_column(String(200))
    details: Mapped[Optional[str]] = mapped_column(Text)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    actor: Mapped[Optional["UserModel"]] = relationship("UserModel", back_populates="audit_logs")


class RefreshTokenModel(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["UserModel"] = relationship("UserModel", back_populates="refresh_tokens")
