"""
ArogyaNova — AI Provider Abstractions

OOP Principles:
- ABSTRACTION: InteractionChecker defines the AI contract
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
        # --- Pairs drawn from the seeded medication catalogue ---
        {
            "drugs": {"clopidogrel", "omeprazole"},
            "severity": InteractionSeverity.MAJOR,
            "description": "Omeprazole inhibits CYP2C19, reducing activation of clopidogrel and its protection against clots.",
        },
        {
            "drugs": {"clopidogrel", "ibuprofen"},
            "severity": InteractionSeverity.MAJOR,
            "description": "An NSAID plus an antiplatelet agent significantly increases the risk of gastrointestinal bleeding.",
        },
        {
            "drugs": {"lisinopril", "ibuprofen"},
            "severity": InteractionSeverity.MODERATE,
            "description": "NSAIDs can blunt the blood-pressure-lowering effect of ACE inhibitors and strain kidney function.",
        },
        {
            "drugs": {"metoprolol", "salbutamol"},
            "severity": InteractionSeverity.MODERATE,
            "description": "Beta-blockers can oppose the bronchodilating effect of salbutamol.",
        },
        {
            "drugs": {"clopidogrel", "pantoprazole"},
            "severity": InteractionSeverity.MINOR,
            "description": "Pantoprazole may slightly reduce clopidogrel's antiplatelet effect; preferred over omeprazole if a PPI is needed.",
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
