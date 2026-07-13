from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.social_security_settlement import SocialSecuritySettlement
from app.schemas.social_security_settlement import SocialSecuritySettlementPrepareRequest
from app.services.payroll_amounts import money
from app.services.social_security_settlement_service import (
    prepare_social_security_settlement as prepare_settlement_domain,
)


TOTAL_FIELDS = (
    "common_contingencies_base",
    "professional_contingencies_base",
    "unemployment_training_fogasa_base",
    "overtime_base",
    "employee_common_contingencies",
    "employee_unemployment",
    "employee_training",
    "employee_mei",
    "employee_total",
    "company_common_contingencies",
    "company_unemployment",
    "company_fogasa",
    "company_training",
    "company_at_ep",
    "company_mei",
    "company_total",
    "bonuses",
    "reductions",
    "total_due",
)


def recalculate_settlement_totals(settlement: SocialSecuritySettlement) -> None:
    lines = list(settlement.lines)
    settlement.worker_count = len(lines)
    settlement.contribution_days = sum(int(line.contribution_days or 0) for line in lines)
    for field in TOTAL_FIELDS:
        total = sum(
            (money(getattr(line, field, 0) or 0) for line in lines),
            Decimal("0.00"),
        )
        setattr(settlement, field, money(total))


def prepare_social_security_settlement(
    db: Session,
    payload: SocialSecuritySettlementPrepareRequest,
) -> SocialSecuritySettlement:
    settlement = prepare_settlement_domain(db, payload)

    # The domain builder attaches each new line through the relationship before
    # the explicit append. Reloading the persisted collection guarantees one
    # row per payroll and prevents duplicated in-memory totals.
    db.expire(settlement, ["lines"])
    settlement.lines
    recalculate_settlement_totals(settlement)
    db.commit()
    db.refresh(settlement)
    return settlement
