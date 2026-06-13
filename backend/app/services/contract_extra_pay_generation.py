from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.crud.payroll import resolve_irpf_percentage
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.schemas.contract_extra_pay import ContractExtraPayPayrollCreateRequest
from app.services.agreement_extra_pay import _get_extra_pay
from app.services.contract_extra_pay_preview import (
    as_money,
    load_contract,
    preview_contract_extra_pay,
)


def get_or_create_component_concept(
    db: Session,
    extra_pay,
    line: dict,
    display_order: int,
) -> PayrollConcept:
    code = f"EXTRA_{extra_pay.id}_{line['concept_key']}".upper()[:120]
    concept = db.query(PayrollConcept).filter(PayrollConcept.code == code).first()
    values = {
        "name": f"{extra_pay.name} - {line['concept_name']}",
        "category": "PAGA_EXTRA",
        "concept_type": "BASE_INFORMATIVA",
        "salary_nature": "SALARIAL",
        "source_type": "AGREEMENT",
        "agreement_id": extra_pay.collective_agreement_id,
        "calculation_type": "FIXED_AMOUNT",
        "default_amount": Decimal("0.00"),
        "default_unit_price": Decimal("0.00"),
        "applies_workday_percentage": False,
        "is_system": True,
        "is_taxable": False,
        "is_contribution_base": False,
        "is_active": True,
        "display_order": display_order,
        "notes": f"Componente informativo generado desde la paga extraordinaria {extra_pay.id}.",
    }
    if not concept:
        concept = PayrollConcept(code=code, **values)
        db.add(concept)
        db.flush()
    else:
        for key, value in values.items():
            setattr(concept, key, value)
    return concept


def create_contract_extra_payroll(
    db: Session,
    extra_pay_id: int,
    contract_id: int,
    request: ContractExtraPayPayrollCreateRequest,
) -> dict:
    extra_pay = _get_extra_pay(db, extra_pay_id)
    contract = load_contract(db, contract_id)
    preview = preview_contract_extra_pay(
        db,
        extra_pay_id,
        contract_id,
        request.period_year,
    )
    if not preview["can_generate"]:
        raise HTTPException(status_code=400, detail=preview["generation_block_reason"])
    if not contract.employee:
        raise HTTPException(status_code=400, detail="El contrato no tiene trabajador vinculado")

    irpf_mode = "manual" if request.irpf_percentage is not None else "auto"
    irpf_percentage, suggested_irpf = resolve_irpf_percentage(
        db,
        contract.employee,
        contract,
        irpf_mode,
        request.irpf_percentage,
    )
    gross = as_money(preview["final_amount"])
    irpf = as_money(gross * irpf_percentage / Decimal("100"))
    net = as_money(gross - irpf)

    try:
        payroll = Payroll(
            employee_id=contract.employee_id,
            contract_id=contract.id,
            company_id=contract.company_id,
            center_id=contract.center_id,
            period_month=extra_pay.payroll_period,
            period_year=request.period_year,
            base_salary=gross,
            worked_base_salary=gross,
            temporary_disability_benefit=Decimal("0.00"),
            company_disability_complement=Decimal("0.00"),
            salary_supplements=Decimal("0.00"),
            variable_incentives=Decimal("0.00"),
            extra_pay_proration=Decimal("0.00"),
            gross_salary=gross,
            contribution_days=0,
            worked_days=0,
            incident_days=preview["excluded_total_days"],
            it_days=preview["excluded_it_days"],
            non_contribution_days=preview["excluded_unpaid_absence_days"],
            common_contingencies_base=Decimal("0.00"),
            professional_contingencies_base=Decimal("0.00"),
            unemployment_training_fogasa_base=Decimal("0.00"),
            irpf_base=gross,
            daily_common_base=Decimal("0.00"),
            daily_professional_base=Decimal("0.00"),
            employee_common_contingencies=Decimal("0.00"),
            employee_unemployment=Decimal("0.00"),
            employee_training=Decimal("0.00"),
            employee_mei=Decimal("0.00"),
            employee_social_security=Decimal("0.00"),
            irpf_mode=irpf_mode,
            irpf_percentage=irpf_percentage,
            suggested_irpf_percentage=suggested_irpf,
            irpf=irpf,
            total_deductions=irpf,
            net_salary=net,
            company_common_contingencies=Decimal("0.00"),
            company_unemployment=Decimal("0.00"),
            company_fogasa=Decimal("0.00"),
            company_training=Decimal("0.00"),
            company_at_ep=Decimal("0.00"),
            company_mei=Decimal("0.00"),
            company_total_social_security=Decimal("0.00"),
            company_total_cost=gross,
            status=request.status,
        )
        db.add(payroll)
        db.flush()

        created_items = 0
        for order, line in enumerate(preview["lines"], start=10):
            amount = as_money(line["final_amount"])
            if amount <= 0:
                continue
            concept = get_or_create_component_concept(db, extra_pay, line, order)
            db.add(
                PayrollItem(
                    payroll_id=payroll.id,
                    concept_id=concept.id,
                    description=line["concept_name"],
                    quantity=Decimal("1.00"),
                    unit_price=amount,
                    amount=amount,
                    display_order=order,
                    notes=(
                        f"Paga {extra_pay.id}; base {line['base_source']}; "
                        f"parcialidad {preview['partiality_percentage']}%; "
                        f"devengo {preview['accrued_days']}/{preview['total_period_days']} días."
                    ),
                )
            )
            created_items += 1

        db.commit()
        db.refresh(payroll)
    except Exception:
        db.rollback()
        raise

    return {
        "payroll_id": payroll.id,
        "contract_id": contract.id,
        "employee_id": contract.employee_id,
        "extra_pay_id": extra_pay.id,
        "period_month": extra_pay.payroll_period,
        "period_year": request.period_year,
        "status": payroll.status,
        "gross_salary": as_money(payroll.gross_salary),
        "irpf_percentage": as_money(payroll.irpf_percentage),
        "irpf": as_money(payroll.irpf),
        "total_deductions": as_money(payroll.total_deductions),
        "net_salary": as_money(payroll.net_salary),
        "created_items": created_items,
        "warnings": preview["warnings"],
    }
