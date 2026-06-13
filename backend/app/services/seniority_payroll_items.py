from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.services.payroll_amounts import money


SENIORITY_CONCEPT_PREFIX = "SENIORITY_AUTO_"


def sync_seniority_items(db: Session, payroll_id: int, lines: list[dict]) -> int:
    existing = (
        db.query(PayrollItem)
        .join(PayrollConcept, PayrollConcept.id == PayrollItem.concept_id)
        .filter(
            PayrollItem.payroll_id == payroll_id,
            PayrollConcept.code.like(f"{SENIORITY_CONCEPT_PREFIX}%"),
        )
        .all()
    )
    for item in existing:
        db.delete(item)
    db.flush()

    created = 0
    for index, line in enumerate(lines, start=1):
        amount = money(line.get("amount"))
        if amount == 0:
            continue
        rule_id = line.get("rule_id") or "RULE"
        code = f"{SENIORITY_CONCEPT_PREFIX}{rule_id}_{index}"[:120]
        concept = db.query(PayrollConcept).filter(PayrollConcept.code == code).first()
        values = {
            "name": line.get("concept_name") or "Antigüedad",
            "category": "ANTIGUEDAD",
            "concept_type": "BASE_INFORMATIVA",
            "salary_nature": "SALARIAL",
            "source_type": "AGREEMENT",
            "calculation_type": "FIXED_AMOUNT",
            "default_amount": Decimal("0.00"),
            "default_unit_price": Decimal("0.00"),
            "applies_workday_percentage": False,
            "is_system": True,
            "is_taxable": False,
            "is_contribution_base": False,
            "is_active": True,
            "display_order": 25 + index,
            "notes": "Traza informativa del cálculo automático de antigüedad.",
        }
        if concept is None:
            concept = PayrollConcept(code=code, **values)
            db.add(concept)
            db.flush()
        else:
            for key, value in values.items():
                setattr(concept, key, value)

        maturity = line.get("maturity_date")
        description = line.get("detail") or "Antigüedad calculada"
        if maturity:
            description = f"{description} · {maturity.isoformat()}"
        db.add(
            PayrollItem(
                payroll_id=payroll_id,
                concept_id=concept.id,
                description=description,
                quantity=Decimal("1.00"),
                unit_price=amount,
                amount=amount,
                display_order=25 + index,
                notes=f"Módulo de antigüedad: {line.get('module_number') or 0}.",
            )
        )
        created += 1

    db.flush()
    return created
