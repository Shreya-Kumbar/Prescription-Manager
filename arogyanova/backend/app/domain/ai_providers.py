"""
ArogyaNova — AI Provider Abstractions

OOP Principles:
- ABSTRACTION: OCRProvider and InteractionChecker define AI contracts
- POLYMORPHISM: Multiple implementations are interchangeable
- OPEN/CLOSED: New providers can be added without changing consumer code
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# OCR Provider
# ---------------------------------------------------------------------------

@dataclass
class OCRField:
    """Extracted field with confidence score."""
    field_name: str
    value: Optional[str]
    confidence: float  # 0.0 – 1.0
    is_uncertain: bool = False


@dataclass
class OCRResult:
    """
    Structured result from prescription OCR processing.
    All fields may be None if extraction failed.
    """
    raw_text: str
    fields: list[OCRField] = field(default_factory=list)
    medicines: list[dict] = field(default_factory=list)
    provider: str = "unknown"
    processed_at: datetime = field(default_factory=datetime.utcnow)
    is_available: bool = True
    error_message: Optional[str] = None

    def get_field(self, name: str) -> Optional[OCRField]:
        for f in self.fields:
            if f.field_name == name:
                return f
        return None


class OCRProvider(ABC):
    """
    Abstract contract for prescription OCR providers.

    OOP: ABSTRACTION — hides implementation (local vs. cloud).
    OOP: INTERFACE SEGREGATION — only OCR-related methods here.
    """

    @abstractmethod
    async def extract(self, image_bytes: bytes, mime_type: str) -> OCRResult:
        """Extract structured data from a prescription image."""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Whether this provider can currently process images."""
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...


class LocalOCRProvider(OCRProvider):
    """
    Local OCR using pytesseract (Tesseract OCR engine).

    OOP: POLYMORPHISM — implements OCRProvider.
    Falls back gracefully when tesseract is not installed.
    """

    def __init__(self) -> None:
        self._available: Optional[bool] = None

    def is_available(self) -> bool:
        if self._available is None:
            try:
                import pytesseract
                pytesseract.get_tesseract_version()
                self._available = True
            except Exception:
                self._available = False
        return self._available

    @property
    def provider_name(self) -> str:
        return "local-tesseract"

    async def extract(self, image_bytes: bytes, mime_type: str) -> OCRResult:
        if not self.is_available():
            return OCRResult(
                raw_text="",
                provider=self.provider_name,
                is_available=False,
                error_message="Tesseract OCR is not installed on this system. "
                              "Install tesseract-ocr to enable OCR processing.",
            )
        try:
            import io
            import re

            import pytesseract
            from PIL import Image

            image = Image.open(io.BytesIO(image_bytes))
            raw_text = pytesseract.image_to_string(image)

            medicines = self._parse_medicines(raw_text)

            return OCRResult(
                raw_text=raw_text,
                medicines=medicines,
                provider=self.provider_name,
                is_available=True,
            )
        except Exception as e:
            return OCRResult(
                raw_text="",
                provider=self.provider_name,
                is_available=True,
                error_message=f"OCR processing failed: {str(e)}",
            )

    def _parse_medicines(self, text: str) -> list[dict]:
        """
        Heuristic extraction of medicine mentions from free text.
        Results are marked uncertain and require professional review.
        """
        import re

        medicines = []
        # Look for common dose patterns like "Amoxicillin 500mg"
        pattern = re.compile(
            r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(\d+\s*(?:mg|mcg|ml|g|IU|units?))",
            re.IGNORECASE,
        )
        for match in pattern.finditer(text):
            medicines.append({
                "name": match.group(1).strip(),
                "strength": match.group(2).strip(),
                "is_uncertain": True,
                "requires_review": True,
            })
        return medicines


class UnavailableOCRProvider(OCRProvider):
    """
    Placeholder provider that always returns an explicit unavailable result.

    OOP: POLYMORPHISM — safely substitutable wherever OCRProvider is used.
    """

    async def extract(self, image_bytes: bytes, mime_type: str) -> OCRResult:
        return OCRResult(
            raw_text="",
            provider=self.provider_name,
            is_available=False,
            error_message="OCR service is not configured for this environment.",
        )

    def is_available(self) -> bool:
        return False

    @property
    def provider_name(self) -> str:
        return "unavailable"


# ---------------------------------------------------------------------------
# Interaction Checker
# ---------------------------------------------------------------------------

class InteractionSeverity(str, Enum):
    MINOR = "minor"
    MODERATE = "moderate"
    MAJOR = "major"
    CONTRAINDICATED = "contraindicated"


@dataclass
class DrugInteraction:
    drug_a: str
    drug_b: str
    severity: InteractionSeverity
    description: str
    source: str
    is_uncertain: bool = False


@dataclass
class InteractionCheckResult:
    checked_medicines: list[str]
    interactions: list[DrugInteraction]
    is_available: bool
    source: str
    checked_at: datetime = field(default_factory=datetime.utcnow)
    disclaimer: str = (
        "Drug interaction results are for reference only and must be reviewed "
        "by a qualified healthcare professional before any clinical decision."
    )
    error_message: Optional[str] = None

    @property
    def has_interactions(self) -> bool:
        return len(self.interactions) > 0

    @property
    def highest_severity(self) -> Optional[InteractionSeverity]:
        if not self.interactions:
            return None
        order = [
            InteractionSeverity.CONTRAINDICATED,
            InteractionSeverity.MAJOR,
            InteractionSeverity.MODERATE,
            InteractionSeverity.MINOR,
        ]
        for sev in order:
            if any(i.severity == sev for i in self.interactions):
                return sev
        return None


class InteractionChecker(ABC):
    """
    Abstract contract for drug interaction checking.

    OOP: ABSTRACTION, INTERFACE SEGREGATION
    """

    @abstractmethod
    async def check(self, medicine_names: list[str]) -> InteractionCheckResult:
        """Check for interactions among a list of medicine names."""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        ...

    @property
    @abstractmethod
    def source_name(self) -> str:
        ...


class LocalInteractionChecker(InteractionChecker):
    """
    Development interaction checker using a small curated local dataset.

    NOT a clinical reference. Results are for demonstration only.

    OOP: POLYMORPHISM — concrete implementation of InteractionChecker.
    """

    # Simplified local dataset — NOT for clinical use
    _KNOWN_INTERACTIONS: list[dict] = [
        {
            "drugs": {"warfarin", "aspirin"},
            "severity": InteractionSeverity.MAJOR,
            "description": "Concurrent use increases bleeding risk significantly.",
        },
        {
            "drugs": {"metformin", "alcohol"},
            "severity": InteractionSeverity.MODERATE,
            "description": "Alcohol may increase the risk of lactic acidosis with metformin.",
        },
        {
            "drugs": {"simvastatin", "erythromycin"},
            "severity": InteractionSeverity.MAJOR,
            "description": "Erythromycin inhibits CYP3A4, increasing simvastatin levels and myopathy risk.",
        },
        {
            "drugs": {"lisinopril", "potassium"},
            "severity": InteractionSeverity.MODERATE,
            "description": "ACE inhibitors can cause hyperkalemia when combined with potassium supplements.",
        },
        {
            "drugs": {"fluoxetine", "tramadol"},
            "severity": InteractionSeverity.MAJOR,
            "description": "Increased risk of serotonin syndrome.",
        },
    ]

    async def check(self, medicine_names: list[str]) -> InteractionCheckResult:
        normalized = [m.lower().strip() for m in medicine_names]
        found: list[DrugInteraction] = []

        for entry in self._KNOWN_INTERACTIONS:
            drugs = entry["drugs"]
            matched = [d for d in drugs if any(d in n or n in d for n in normalized)]
            if len(matched) >= 2:
                drug_list = list(drugs)
                found.append(
                    DrugInteraction(
                        drug_a=drug_list[0],
                        drug_b=drug_list[1],
                        severity=entry["severity"],
                        description=entry["description"],
                        source=self.source_name,
                        is_uncertain=True,
                    )
                )

        return InteractionCheckResult(
            checked_medicines=medicine_names,
            interactions=found,
            is_available=True,
            source=self.source_name,
        )

    def is_available(self) -> bool:
        return True

    @property
    def source_name(self) -> str:
        return "local-development-dataset"


class UnavailableInteractionChecker(InteractionChecker):
    """
    Explicitly unavailable checker — never fabricates a clean safety result.

    OOP: POLYMORPHISM — safely substitutable for InteractionChecker.
    """

    async def check(self, medicine_names: list[str]) -> InteractionCheckResult:
        return InteractionCheckResult(
            checked_medicines=medicine_names,
            interactions=[],
            is_available=False,
            source=self.source_name,
            error_message=(
                "Drug interaction checking service is not configured. "
                "Please consult a qualified pharmacist or clinical reference."
            ),
        )

    def is_available(self) -> bool:
        return False

    @property
    def source_name(self) -> str:
        return "unavailable"
