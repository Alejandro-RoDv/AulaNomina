from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.services.advanced_incident_calculation import (
    advanced_regulatory_daily_base,
    resolve_agreement_it_target,
)


RegulatoryDailyBaseResolver = Callable[
    [Session, Any, Incident, dict[str, Any], Decimal],
    tuple[Decimal, str, list[str], dict[str, Any]],
]
AgreementItTargetResolver = Callable[
    [Session, Any, Incident, date, int, str | None],
    tuple[Decimal | None, dict[str, Any]],
]


@dataclass(frozen=True)
class IncidentCalculationPolicy:
    """Explicit dependencies used by the incident segmenter.

    Keeping the calculation collaborators in an immutable policy object makes
    the engine testable without replacing module functions at import time.
    """

    regulatory_daily_base: RegulatoryDailyBaseResolver
    agreement_it_target: AgreementItTargetResolver


DEFAULT_INCIDENT_CALCULATION_POLICY = IncidentCalculationPolicy(
    regulatory_daily_base=advanced_regulatory_daily_base,
    agreement_it_target=resolve_agreement_it_target,
)
