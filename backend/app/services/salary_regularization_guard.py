from sqlalchemy.orm import Session

from app.models.payroll import Payroll
from app.schemas.salary_regularization import SalaryRegularizationPreviewRequest
from app.services.salary_regularization import (
    ACTIVE_PAYROLL_STATUSES,
    build_salary_regularization_preview,
)


def build_guarded_salary_regularization_preview(
    db: Session,
    target_table_id: int,
    payload: SalaryRegularizationPreviewRequest,
) -> dict:
    result = build_salary_regularization_preview(db, target_table_id, payload)
    contract_ids = [item["contract_id"] for item in result["contracts"]]
    existing_contract_ids = {
        row.contract_id
        for row in (
            db.query(Payroll.contract_id)
            .filter(
                Payroll.contract_id.in_(contract_ids) if contract_ids else False,
                Payroll.period_month == 15,
                Payroll.period_year == result["exercise"],
                Payroll.status.in_(ACTIVE_PAYROLL_STATUSES),
            )
            .all()
        )
    }

    newly_blocked = 0
    for item in result["contracts"]:
        if item["contract_id"] not in existing_contract_ids:
            continue
        if item["eligibility"] == "eligible":
            newly_blocked += 1
        item["eligibility"] = "blocked"
        item["reason"] = f"Ya existe una nómina complementaria activa para el ejercicio {result['exercise']}."

    if newly_blocked:
        result["eligible_contracts"] = max(0, result["eligible_contracts"] - newly_blocked)
        result["blocked_contracts"] += newly_blocked
        result["warnings"].append(
            f"{newly_blocked} contratos se han bloqueado porque ya tienen una complementaria activa."
        )
    return result
