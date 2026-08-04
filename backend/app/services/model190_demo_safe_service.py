from __future__ import annotations

from contextlib import contextmanager
from threading import RLock

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.services import model190_demo_service as demo_service
from app.services.model190_calculator import Model190DomainError


_BASE_EMPLOYEE_CODES = dict(demo_service.DEMO_EMPLOYEE_CODES)
_DEMO_DNI_BY_KEY = {
    "ana": "30000001A",
    "luis": "30000002B",
    "carla": "30000003C",
}
_DEMO_CODE_LOCK = RLock()


def _employee_code_for_company(
    db: Session,
    *,
    company_id: int,
    employee_key: str,
) -> str:
    """Return a stable globally unique employee code for one demo worker.

    ``Employee.employee_code`` is globally unique in AulaNomina, even though the
    demo can be prepared for any company. Existing demo workers are therefore
    resolved by company and DNI first. New workers use the legacy base code when
    it is free, or a deterministic company-scoped suffix when another company
    already owns it.
    """

    dni = _DEMO_DNI_BY_KEY[employee_key]
    existing = (
        db.query(Employee)
        .filter(
            Employee.company_id == company_id,
            Employee.dni == dni,
        )
        .order_by(Employee.id)
        .first()
    )
    if existing is not None:
        return existing.employee_code

    base_code = _BASE_EMPLOYEE_CODES[employee_key]
    candidates = [base_code, f"{base_code}-C{company_id}"]
    attempt = 2

    while True:
        for candidate in candidates:
            holder = (
                db.query(Employee)
                .filter(Employee.employee_code == candidate)
                .first()
            )
            if holder is None or holder.company_id == company_id:
                return candidate

        candidates = [f"{base_code}-C{company_id}-{attempt}"]
        attempt += 1


def _codes_for_company(db: Session, company_id: int) -> dict[str, str]:
    return {
        employee_key: _employee_code_for_company(
            db,
            company_id=company_id,
            employee_key=employee_key,
        )
        for employee_key in _BASE_EMPLOYEE_CODES
    }


@contextmanager
def _company_demo_codes(db: Session, company_id: int):
    """Temporarily expose company-safe codes to the original demo workflow.

    The original Split 39 service centralises all demo detection around
    ``DEMO_EMPLOYEE_CODES``. Mutating that dictionary in place keeps its
    preparation, status and correction functions consistent without changing
    existing records. A lock prevents two demo preparations from observing
    different temporary mappings.
    """

    with _DEMO_CODE_LOCK:
        previous = dict(demo_service.DEMO_EMPLOYEE_CODES)
        selected = _codes_for_company(db, company_id)
        demo_service.DEMO_EMPLOYEE_CODES.clear()
        demo_service.DEMO_EMPLOYEE_CODES.update(selected)
        try:
            yield selected
        finally:
            demo_service.DEMO_EMPLOYEE_CODES.clear()
            demo_service.DEMO_EMPLOYEE_CODES.update(previous)


def _run_demo_operation(callback, db: Session, company_id: int):
    try:
        with _company_demo_codes(db, company_id):
            return callback(db, company_id)
    except IntegrityError as exc:
        db.rollback()
        raise Model190DomainError(
            "MODEL190_DEMO_UNIQUE_CONFLICT",
            "No se ha podido preparar el caso porque uno de sus identificadores ya existe.",
            status_code=409,
            context={"constraint": getattr(exc.orig, "diag", None) and exc.orig.diag.constraint_name},
        ) from exc


def get_model190_demo_status(db: Session, company_id: int) -> dict:
    return _run_demo_operation(
        demo_service.get_model190_demo_status,
        db,
        company_id,
    )


def seed_model190_demo(db: Session, company_id: int | None = None) -> dict:
    # Resolve first so the independent demo company also has an ID before its
    # deterministic employee codes are selected.
    company, company_created = demo_service._resolve_company(db, company_id)
    try:
        with _company_demo_codes(db, company.id):
            result = demo_service.seed_model190_demo(db, company.id)
    except IntegrityError as exc:
        db.rollback()
        raise Model190DomainError(
            "MODEL190_DEMO_UNIQUE_CONFLICT",
            "No se ha podido preparar el caso porque uno de sus identificadores ya existe.",
            status_code=409,
            context={"constraint": getattr(exc.orig, "diag", None) and exc.orig.diag.constraint_name},
        ) from exc

    if company_created:
        result.setdefault("created", {})["company"] = True
    return result


def correct_model190_demo(db: Session, company_id: int) -> dict:
    return _run_demo_operation(
        demo_service.correct_model190_demo,
        db,
        company_id,
    )
