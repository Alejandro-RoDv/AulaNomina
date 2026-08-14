"""Bootstrap de B10 · casos integrales."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.case_study import CaseStudy
from app.models.company import Company
from app.services.integrated_demo_case_service import _ensure_assignment, _ensure_case_study
from app.services.integrated_demo_process_seed import ensure_integrated_fie_communication
from app.training.integrated_runtime_cases_2026 import (
    INTEGRATED_SCENARIO_CODES,
    seed_integrated_runtime_assignments_2026,
    seed_integrated_runtime_cases_2026,
)


SUPERSEDED_SCENARIOS = {"IT-2026-008", "NOM-2026-014"}
DEMO_COMPANY_CIF = "G14999999"


def _archive_superseded_integral_cases(db: Session) -> None:
    rows = db.query(CaseStudy).filter(CaseStudy.scenario_code.in_(sorted(SUPERSEDED_SCENARIOS))).all()
    changed = False
    for case_study in rows:
        if case_study.status != "archived":
            case_study.status = "archived"
            changed = True
    if changed:
        db.commit()


def _ensure_c02(db: Session) -> None:
    company = db.query(Company).filter(Company.cif == DEMO_COMPANY_CIF).first()
    case_study = _ensure_case_study(db, company.id if company else None)
    _ensure_assignment(db, case_study)
    ensure_integrated_fie_communication(db, reset=False)
    db.commit()


def bootstrap_integrated_training_2026(db: Session) -> None:
    """Activa C01-C06 y retira los dos itinerarios cortos sustituidos por B10."""
    _archive_superseded_integral_cases(db)
    seed_integrated_runtime_cases_2026(db)
    seed_integrated_runtime_assignments_2026(db)
    _ensure_c02(db)


def integrated_scenario_map_2026() -> dict[str, str]:
    return dict(INTEGRATED_SCENARIO_CODES)
