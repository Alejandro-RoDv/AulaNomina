from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.contract import Contract
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollConcept, PayrollItem
from app.schemas.payroll_salary_structure import (
    ContractPayrollConceptCreate,
    ContractPayrollConceptUpdate,
    PayrollConceptCreate,
    PayrollConceptUpdate,
    PayrollItemCreate,
    PayrollItemUpdate,
)
from app.services.payroll_amounts import money


def get_payroll_concepts(db: Session, include_inactive: bool = False):
    query = db.query(PayrollConcept)
    if not include_inactive:
        query = query.filter(PayrollConcept.is_active == True)
    return query.order_by(PayrollConcept.display_order, PayrollConcept.name).all()


def get_payroll_concept(db: Session, concept_id: int):
    return db.query(PayrollConcept).filter(PayrollConcept.id == concept_id).first()


def get_payroll_concept_by_code(db: Session, code: str):
    return db.query(PayrollConcept).filter(PayrollConcept.code == code.upper()).first()


def create_payroll_concept(db: Session, concept: PayrollConceptCreate):
    if get_payroll_concept_by_code(db, concept.code):
        raise HTTPException(status_code=400, detail="Ya existe un concepto salarial con ese código")

    db_concept = PayrollConcept(**concept.model_dump())
    db.add(db_concept)
    db.commit()
    db.refresh(db_concept)
    return db_concept


def update_payroll_concept(db: Session, concept_id: int, concept: PayrollConceptUpdate):
    db_concept = get_payroll_concept(db, concept_id)
    if not db_concept:
        return None

    update_data = concept.model_dump(exclude_unset=True)
    new_code = update_data.get("code")
    if new_code and new_code != db_concept.code:
        existing = get_payroll_concept_by_code(db, new_code)
        if existing and existing.id != concept_id:
            raise HTTPException(status_code=400, detail="Ya existe otro concepto salarial con ese código")

    for key, value in update_data.items():
        setattr(db_concept, key, value)

    db.commit()
    db.refresh(db_concept)
    return db_concept


def deactivate_payroll_concept(db: Session, concept_id: int):
    db_concept = get_payroll_concept(db, concept_id)
    if not db_concept:
        return None
    db_concept.is_active = False
    db.commit()
    db.refresh(db_concept)
    return db_concept


def ensure_contract_exists(db: Session, contract_id: int):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return contract


def get_contract_payroll_concepts(db: Session, contract_id: int, include_inactive: bool = False):
    ensure_contract_exists(db, contract_id)
    query = db.query(ContractPayrollConcept).options(joinedload(ContractPayrollConcept.concept)).filter(
        ContractPayrollConcept.contract_id == contract_id
    )
    if not include_inactive:
        query = query.filter(ContractPayrollConcept.is_active == True)
    return query.order_by(ContractPayrollConcept.display_order, ContractPayrollConcept.id).all()


def get_contract_payroll_concept(db: Session, concept_line_id: int):
    return db.query(ContractPayrollConcept).options(joinedload(ContractPayrollConcept.concept)).filter(
        ContractPayrollConcept.id == concept_line_id
    ).first()


def create_contract_payroll_concept(db: Session, contract_id: int, item: ContractPayrollConceptCreate):
    ensure_contract_exists(db, contract_id)
    concept = ensure_active_concept(db, item.concept_id)
    quantity = money(item.quantity)
    unit_price = money(item.unit_price)
    amount = resolve_item_amount(quantity, unit_price, item.amount)

    db_item = ContractPayrollConcept(
        contract_id=contract_id,
        concept_id=item.concept_id,
        description=item.description,
        quantity=quantity,
        unit_price=unit_price,
        amount=amount,
        start_date=item.start_date,
        end_date=item.end_date,
        is_active=item.is_active,
        display_order=item.display_order or concept.display_order,
        notes=item.notes,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return get_contract_payroll_concept(db, db_item.id)


def update_contract_payroll_concept(db: Session, concept_line_id: int, item: ContractPayrollConceptUpdate):
    db_item = get_contract_payroll_concept(db, concept_line_id)
    if not db_item:
        return None

    update_data = item.model_dump(exclude_unset=True)
    if "concept_id" in update_data:
        ensure_active_concept(db, update_data["concept_id"])

    for key, value in update_data.items():
        if key in {"quantity", "unit_price", "amount"} and value is not None:
            value = money(value)
        setattr(db_item, key, value)

    if "amount" not in update_data:
        db_item.amount = resolve_item_amount(db_item.quantity, db_item.unit_price, None)

    db.commit()
    db.refresh(db_item)
    return get_contract_payroll_concept(db, db_item.id)


def deactivate_contract_payroll_concept(db: Session, concept_line_id: int):
    db_item = get_contract_payroll_concept(db, concept_line_id)
    if not db_item:
        return None
    db_item.is_active = False
    db.commit()
    db.refresh(db_item)
    return db_item


def get_payroll_items(db: Session, payroll_id: int):
    return db.query(PayrollItem).options(joinedload(PayrollItem.concept)).filter(
        PayrollItem.payroll_id == payroll_id
    ).order_by(PayrollItem.display_order, PayrollItem.id).all()


def get_payroll_item(db: Session, item_id: int):
    return db.query(PayrollItem).options(joinedload(PayrollItem.concept)).filter(PayrollItem.id == item_id).first()


def ensure_payroll_exists(db: Session, payroll_id: int):
    payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    return payroll


def ensure_active_concept(db: Session, concept_id: int):
    concept = db.query(PayrollConcept).filter(
        PayrollConcept.id == concept_id,
        PayrollConcept.is_active == True,
    ).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concepto salarial no encontrado")
    return concept


def resolve_item_amount(quantity: Decimal, unit_price: Decimal, amount: Decimal | None):
    if amount is not None:
        return money(amount)
    return money((quantity or Decimal("0.00")) * (unit_price or Decimal("0.00")))


def create_payroll_item(db: Session, payroll_id: int, item: PayrollItemCreate):
    ensure_payroll_exists(db, payroll_id)
    ensure_active_concept(db, item.concept_id)

    quantity = money(item.quantity)
    unit_price = money(item.unit_price)
    amount = resolve_item_amount(quantity, unit_price, item.amount)

    db_item = PayrollItem(
        payroll_id=payroll_id,
        concept_id=item.concept_id,
        description=item.description,
        quantity=quantity,
        unit_price=unit_price,
        amount=amount,
        display_order=item.display_order,
        notes=item.notes,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return get_payroll_item(db, db_item.id)


def load_contract_concepts_into_payroll(db: Session, payroll_id: int):
    payroll = ensure_payroll_exists(db, payroll_id)
    contract_items = get_contract_payroll_concepts(db, payroll.contract_id)
    created_items = 0
    skipped_items = 0

    for contract_item in contract_items:
        existing = db.query(PayrollItem).filter(
            PayrollItem.payroll_id == payroll_id,
            PayrollItem.concept_id == contract_item.concept_id,
            PayrollItem.description == contract_item.description,
        ).first()
        if existing:
            skipped_items += 1
            continue

        db_item = PayrollItem(
            payroll_id=payroll_id,
            concept_id=contract_item.concept_id,
            description=contract_item.description or "Concepto permanente del contrato",
            quantity=contract_item.quantity,
            unit_price=contract_item.unit_price,
            amount=contract_item.amount,
            display_order=contract_item.display_order,
            notes=contract_item.notes,
        )
        db.add(db_item)
        created_items += 1

    db.commit()
    return {
        "payroll_id": payroll_id,
        "contract_id": payroll.contract_id,
        "created_items": created_items,
        "skipped_items": skipped_items,
    }


def update_payroll_item(db: Session, item_id: int, item: PayrollItemUpdate):
    db_item = get_payroll_item(db, item_id)
    if not db_item:
        return None

    update_data = item.model_dump(exclude_unset=True)
    if "concept_id" in update_data:
        ensure_active_concept(db, update_data["concept_id"])

    for key, value in update_data.items():
        if key in {"quantity", "unit_price", "amount"} and value is not None:
            value = money(value)
        setattr(db_item, key, value)

    if "amount" not in update_data:
        db_item.amount = resolve_item_amount(db_item.quantity, db_item.unit_price, None)

    db.commit()
    db.refresh(db_item)
    return get_payroll_item(db, db_item.id)


def delete_payroll_item(db: Session, item_id: int):
    db_item = get_payroll_item(db, item_id)
    if not db_item:
        return None
    db.delete(db_item)
    db.commit()
    return db_item


def build_payroll_breakdown(db: Session, payroll_id: int):
    ensure_payroll_exists(db, payroll_id)
    items = get_payroll_items(db, payroll_id)

    breakdown = {
        "payroll_id": payroll_id,
        "devengos_salariales": [],
        "devengos_extrasalariales": [],
        "deducciones": [],
        "bases_informativas": [],
        "total_devengos": Decimal("0.00"),
        "total_deducciones": Decimal("0.00"),
        "neto_manual": Decimal("0.00"),
    }

    for item in items:
        concept_type = item.concept.concept_type if item.concept else "DEVENGO"
        salary_nature = item.concept.salary_nature if item.concept else "SALARIAL"

        if concept_type == "DEDUCCION":
            breakdown["deducciones"].append(item)
            breakdown["total_deductions"] += money(item.amount)
        elif concept_type == "BASE_INFORMATIVA":
            breakdown["bases_informativas"].append(item)
        elif salary_nature == "EXTRASALARIAL":
            breakdown["devengos_extrasalariales"].append(item)
            breakdown["total_devengos"] += money(item.amount)
        else:
            breakdown["devengos_salariales"].append(item)
            breakdown["total_devengos"] += money(item.amount)

    breakdown["total_devengos"] = money(breakdown["total_devengos"])
    breakdown["total_deducciones"] = money(breakdown["total_deducciones"])
    breakdown["neto_manual"] = money(breakdown["total_devengos"] - breakdown["total_deducciones"])
    return breakdown
