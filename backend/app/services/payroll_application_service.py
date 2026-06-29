from __future__ import annotations

from sqlalchemy.orm import Session

import app.crud.payroll as payroll_crud
from app.models.payroll import Payroll
from app.schemas.payroll import PayrollCreate, PayrollPrepareRequest, PayrollUpdate
from app.services.incident_payroll_service import process_payroll_incidents


def _supports_incident_processing(payroll: Payroll | None) -> bool:
    return bool(
        payroll
        and payroll.period_month in range(1, 13)
        and payroll.status != "closed"
    )


def _process_and_reload(
    db: Session,
    payroll: Payroll | None,
    *,
    actor: str,
) -> Payroll | None:
    if not _supports_incident_processing(payroll):
        return payroll

    process_payroll_incidents(db, payroll.id, actor=actor)
    return payroll_crud.get_payroll(db, payroll.id)


def create_payroll(
    db: Session,
    payroll: PayrollCreate,
    *,
    actor: str = "payroll_create",
) -> Payroll:
    created = payroll_crud.create_payroll(db, payroll)
    return _process_and_reload(db, created, actor=actor)


def update_payroll(
    db: Session,
    payroll_id: int,
    payroll_data: PayrollUpdate,
    *,
    actor: str = "payroll_update",
) -> Payroll | None:
    updated = payroll_crud.update_payroll(db, payroll_id, payroll_data)
    return _process_and_reload(db, updated, actor=actor)


def prepare_monthly_payrolls(
    db: Session,
    request: PayrollPrepareRequest,
) -> dict:
    """Prepare payrolls and explicitly process incidents for new records.

    The CRUD preparation operation remains responsible for persistence. This
    application service coordinates the incident engine without replacing CRUD
    functions at import time.
    """

    result = payroll_crud.prepare_monthly_payrolls(db, request)
    for item in result.get("payrolls", []):
        if item.get("already_existing") or not item.get("payroll_id"):
            continue

        payroll = payroll_crud.get_payroll(db, item["payroll_id"])
        processed = _process_and_reload(db, payroll, actor="payroll_prepare")
        if not processed or not processed.contract:
            continue

        incident_summary = payroll_crud.get_incident_summary(
            db,
            processed.contract,
            processed.period_month,
            processed.period_year,
        )
        item.clear()
        item.update(
            payroll_crud.build_prepare_item_from_payroll(
                processed.contract,
                processed,
                incident_summary,
                False,
            )
        )

    return result


__all__ = ["create_payroll", "prepare_monthly_payrolls", "update_payroll"]
