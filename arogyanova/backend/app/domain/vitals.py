"""
ArogyaNova Domain Layer — Vital Signs (recorded at check-in, before the doctor)

OOP Principles:
- ENCAPSULATION / VALUE OBJECT: VitalSigns is immutable (frozen dataclass) and validates
  itself on creation, so an impossible reading (e.g. SpO2 140%) can never exist.
- ABSTRACTION: derived knowledge — BMI, BMI category, clinical alerts — is exposed as
  properties; callers never re-implement the medical thresholds.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class AlertLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass(frozen=True)
class VitalAlert:
    level: AlertLevel
    message: str


# Plausible physical limits — anything outside is a typing mistake, not a patient.
_LIMITS: dict[str, tuple[float, float]] = {
    "systolic_bp": (50, 260),
    "diastolic_bp": (30, 160),
    "pulse": (25, 230),
    "spo2": (50, 100),
    "temperature_c": (30, 45),
    "respiratory_rate": (4, 70),
    "weight_kg": (1, 400),
    "height_cm": (40, 250),
}


_LABELS = {
    "systolic_bp": "Systolic BP", "diastolic_bp": "Diastolic BP", "pulse": "Pulse", "spo2": "SpO₂",
    "temperature_c": "Temperature (°C)", "respiratory_rate": "Respiratory rate",
    "weight_kg": "Weight (kg)", "height_cm": "Height (cm)",
}


@dataclass(frozen=True)
class VitalSigns:
    systolic_bp: Optional[int] = None      # mmHg
    diastolic_bp: Optional[int] = None     # mmHg
    pulse: Optional[int] = None            # beats per minute
    spo2: Optional[int] = None             # oxygen saturation %
    temperature_c: Optional[float] = None  # °C
    respiratory_rate: Optional[int] = None # breaths per minute
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None

    def __post_init__(self) -> None:
        values = {k: getattr(self, k) for k in _LIMITS}
        if all(v is None for v in values.values()):
            raise ValueError("Enter at least one vital sign.")
        for name, value in values.items():
            if value is None:
                continue
            low, high = _LIMITS[name]
            if not (low <= value <= high):
                raise ValueError(f"{_LABELS[name]} {value} looks wrong — expected {low:g} to {high:g}.")
        if (self.systolic_bp is None) != (self.diastolic_bp is None):
            raise ValueError("Enter both systolic and diastolic blood pressure.")
        if self.systolic_bp is not None and self.systolic_bp <= self.diastolic_bp:
            raise ValueError("Systolic pressure must be higher than diastolic pressure.")

    # --- derived values ---
    @property
    def bmi(self) -> Optional[float]:
        if not self.weight_kg or not self.height_cm:
            return None
        metres = self.height_cm / 100
        return round(self.weight_kg / (metres * metres), 1)

    @property
    def bmi_category(self) -> Optional[str]:
        b = self.bmi
        if b is None:
            return None
        if b < 18.5:
            return "Underweight"
        if b < 25:
            return "Normal"
        if b < 30:
            return "Overweight"
        return "Obese"

    @property
    def blood_pressure(self) -> Optional[str]:
        return f"{self.systolic_bp}/{self.diastolic_bp}" if self.systolic_bp else None

    @property
    def alerts(self) -> list[VitalAlert]:
        """Readings outside normal adult ranges, for the doctor's attention."""
        out: list[VitalAlert] = []
        if self.spo2 is not None:
            if self.spo2 < 90:
                out.append(VitalAlert(AlertLevel.CRITICAL, f"Very low oxygen (SpO₂ {self.spo2}%)"))
            elif self.spo2 < 95:
                out.append(VitalAlert(AlertLevel.WARNING, f"Low oxygen (SpO₂ {self.spo2}%)"))
        if self.systolic_bp is not None:
            if self.systolic_bp >= 180 or self.diastolic_bp >= 120:
                out.append(VitalAlert(AlertLevel.CRITICAL, f"Hypertensive crisis ({self.blood_pressure} mmHg)"))
            elif self.systolic_bp >= 140 or self.diastolic_bp >= 90:
                out.append(VitalAlert(AlertLevel.WARNING, f"High blood pressure ({self.blood_pressure} mmHg)"))
            elif self.systolic_bp < 90 or self.diastolic_bp < 60:
                out.append(VitalAlert(AlertLevel.WARNING, f"Low blood pressure ({self.blood_pressure} mmHg)"))
        if self.temperature_c is not None:
            if self.temperature_c >= 39.5:
                out.append(VitalAlert(AlertLevel.CRITICAL, f"High fever ({self.temperature_c} °C)"))
            elif self.temperature_c >= 38:
                out.append(VitalAlert(AlertLevel.WARNING, f"Fever ({self.temperature_c} °C)"))
            elif self.temperature_c < 35:
                out.append(VitalAlert(AlertLevel.WARNING, f"Low body temperature ({self.temperature_c} °C)"))
        if self.pulse is not None:
            if self.pulse > 100:
                out.append(VitalAlert(AlertLevel.WARNING, f"Fast heart rate ({self.pulse} bpm)"))
            elif self.pulse < 50:
                out.append(VitalAlert(AlertLevel.WARNING, f"Slow heart rate ({self.pulse} bpm)"))
        if self.respiratory_rate is not None and (self.respiratory_rate > 24 or self.respiratory_rate < 10):
            out.append(VitalAlert(AlertLevel.WARNING, f"Abnormal breathing rate ({self.respiratory_rate}/min)"))
        if self.bmi_category in ("Underweight", "Obese"):
            out.append(VitalAlert(AlertLevel.INFO, f"BMI {self.bmi} ({self.bmi_category})"))
        return out
