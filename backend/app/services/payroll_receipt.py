from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.contract import Contract
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollItem
from app.services.payroll_amounts import money
from app.services.payroll_concept_engine import build_concept_lines_from_payroll, summarize_concept_lines
from app.services.payroll_engine import get_effective_period_dates

INFORMATIVE_TYPES = {"BASE_INFORMATIVA", "INFORMATIVO"}
SIMULATED_LEGAL_FOOTER = (
    "Recibo de salarios simulado generado por AulaNomina con finalidad docente. "
    "No sustituye a un recibo oficial emitido por un sistema laboral certificado."
)


def as_decimal(value: Any, default: str = "0.00") -> Decimal:
    return money(value if value is not None else Decimal(default))


def full_employee_name(employee) -> str | None:
    if not employee:
        return None
    parts = [employee.first_name, employee.last_name, getattr(employee, "second_last_name", None)]
    return " ".join(part.strip() for part in parts if part and str(part).strip()) or None


def build_payroll_code(payroll: Payroll) -> str:
    return f"NOM-{payroll.period_year}-{int(payroll.period_month):02d}-{payroll.id:05d}"


def party_company(company) -> dict:
    return {
        "id": getattr(company, "id", None),
        "code": None,
        "name": getattr(company, "name", None),
        "tax_id": getattr(company, "cif", None),
        "social_security_number": None,
        "contribution_account": getattr(company, "main_ccc", None) or getattr(company, "ccc", None) or getattr(company, "ccc_code", None),
        "address": getattr(company, "address", None),
        "city": getattr(company, "city", None),
        "province": getattr(company, "province", None),
    }


def party_work_center(center) -> dict | None:
    if not center:
        return None
    return {
        "id": center.id,
        "code": center.center_code,
        "name": center.name,
        "tax_id": None,
        "social_security_number": None,
        "contribution_account": center.main_ccc or center.general_ccc,
        "address": center.address,
        "city": center.city,
        "province": center.province,
    }


def party_employee(employee) -> dict:
    return {
        "id": getattr(employee, "id", None),
        "code": getattr(employee, "employee_code", None),
        "name": full_employee_name(employee),
        "tax_id": getattr(employee, "dni", None),
        "social_security_number": getattr(employee, "naf", None),
        "contribution_account": None,
        "address": getattr(employee, "address", None) or getattr(employee, "domicile", None),
        "city": getattr(employee, "city", None),
        "province": getattr(employee, "province", None),
    }


def contract_payload(contract) -> dict:
    return {
        "id": contract.id,
        "code": contract.contract_code,
        "type": contract.contract_type,
        "description": contract.contract_code_description,
        "start_date": contract.start_date,
        "end_date": contract.end_date,
        "seniority_date": contract.seniority_date or contract.recognized_seniority_date or contract.start_date,
        "contribution_group": contract.contribution_group,
        "professional_category": contract.professional_category,
        "job_position": contract.job_position,
        "collective_agreement": contract.collective_agreement_name or contract.collective_agreement_code,
        "working_day_type": contract.working_day_type,
        "partiality_coefficient": as_decimal(contract.partiality_coefficient) if contract.partiality_coefficient is not None else None,
        "pay_schedule": contract.pay_schedule,
    }


def period_payload(payroll: Payroll) -> dict:
    period_start, period_end = get_effective_period_dates(payroll.period_month, payroll.period_year)
    calculated_period_days = (period_end - period_start).days + 1 if period_start and period_end else 30
    return {
        "month": payroll.period_month,
        "year": payroll.period_year,
        "label": payroll.period_label,
        "period_start": period_start,
        "period_end": period_end,
        "period_days": calculated_period_days,
        "contribution_days": int(payroll.contribution_days or 0),
        "worked_days": int(payroll.worked_days or 0),
        "incident_days": int(payroll.incident_days or 0),
        "it_days": int(payroll.it_days or 0),
        "non_contribution_days": int(payroll.non_contribution_days or 0),
    }


def line_from_item(item: PayrollItem) -> dict:
    concept = item.concept
    return {
        "id": item.id,
        "code": concept.code if concept else f"ITEM_{item.id}",
        "name": concept.name if concept else item.description or "Concepto",
        "description": item.description,
        "quantity": as_decimal(item.quantity, "1.00"),
        "unit_price": as_decimal(item.unit_price),
        "amount": as_decimal(item.amount),
        "concept_type": concept.concept_type if concept else "DEVENGO",
        "salary_nature": concept.salary_nature if concept else "SALARIAL",
        "category": concept.category if concept else "OTRO",
        "source_type": item.source_type or (concept.source_type.lower() if concept else "manual"),
        "display_order": int(item.display_order or (concept.display_order if concept else 0) or 0),
        "taxable": bool(concept.is_taxable) if concept else True,
        "contribution_base": bool(concept.is_contribution_base) if concept else True,
        "affects_gross": bool(getattr(concept, "affects_gross", True)) if concept else True,
        "affects_net": bool(getattr(concept, "affects_net", True)) if concept else True,
        "formula": getattr(concept, "formula", None) if concept else None,
        "trace": item.calculation_trace or {},
    }


def line_from_dict(line: dict) -> dict:
    return {
        "id": None,
        "code": line.get("code") or "CONCEPTO",
        "name": line.get("name") or "Concepto",
        "description": line.get("description"),
        "quantity": as_decimal(line.get("quantity"), "1.00"),
        "unit_price": as_decimal(line.get("unit_price") if line.get("unit_price") is not None else line.get("amount")),
        "amount": as_decimal(line.get("amount")),
        "concept_type": line.get("concept_type") or "DEVENGO",
        "salary_nature": line.get("salary_nature") or "SALARIAL",
        "category": line.get("category") or "OTRO",
        "source_type": str(line.get("source_type") or "system").lower(),
        "display_order": int(line.get("display_order") or 0),
        "taxable": bool(line.get("is_taxable")),
        "contribution_base": bool(line.get("is_contribution_base")),
        "affects_gross": bool(line.get("affects_gross")),
        "affects_net": bool(line.get("affects_net")),
        "formula": line.get("formula"),
        "trace": line.get("trace") or {},
    }


def receipt_lines(payroll: Payroll) -> list[dict]:
    items = sorted(
        list(payroll.items or []),
        key=lambda item: (int(item.display_order or 0), int(item.id or 0)),
    )
    engine_items = [item for item in items if str(item.source_key or "").startswith(f"ENGINE:{payroll.id}:")]
    selected_items = engine_items or items
    if selected_items:
        return [line_from_item(item) for item in selected_items]
    return [line_from_dict(line) for line in build_concept_lines_from_payroll(payroll)]


def split_lines(lines: list[dict]) -> tuple[list[dict], list[dict], list[dict], list[dict], list[dict]]:
    earnings: list[dict] = []
    deductions: list[dict] = []
    base_lines: list[dict] = []
    company_cost_lines: list[dict] = []
    informative_lines: list[dict] = []

    for line in lines:
        concept_type = line["concept_type"]
        category = line.get("category") or "OTRO"
        code = line.get("code") or ""
        if concept_type == "DEVENGO" and line.get("affects_gross"):
            earnings.append(line)
        elif concept_type == "DEDUCCION" and line.get("affects_net"):
            deductions.append(line)
        elif category == "COSTE_EMPRESA" or code.startswith("COSTE_EMPRESA"):
            company_cost_lines.append(line)
        elif concept_type in INFORMATIVE_TYPES and (category == "BASE_INFORMATIVA" or code.startswith("BASE_")):
            base_lines.append(line)
        else:
            informative_lines.append(line)

    sort_key = lambda item: (int(item.get("display_order") or 0), item.get("code") or "")
    return (
        sorted(earnings, key=sort_key),
        sorted(deductions, key=sort_key),
        sorted(base_lines, key=sort_key),
        sorted(company_cost_lines, key=sort_key),
        sorted(informative_lines, key=sort_key),
    )


def bases_payload(payroll: Payroll) -> dict:
    return {
        "common_contingencies": as_decimal(payroll.common_contingencies_base),
        "professional_contingencies": as_decimal(payroll.professional_contingencies_base),
        "unemployment_training_fogasa": as_decimal(payroll.unemployment_training_fogasa_base),
        "irpf": as_decimal(payroll.irpf_base),
        "daily_common_base": as_decimal(payroll.daily_common_base),
        "daily_professional_base": as_decimal(payroll.daily_professional_base),
    }


def deduction_payload(payroll: Payroll) -> dict:
    return {
        "employee_common_contingencies": as_decimal(payroll.employee_common_contingencies),
        "employee_unemployment": as_decimal(payroll.employee_unemployment),
        "employee_training": as_decimal(payroll.employee_training),
        "employee_mei": as_decimal(payroll.employee_mei),
        "employee_social_security": as_decimal(payroll.employee_social_security),
        "irpf_percentage": as_decimal(payroll.irpf_percentage),
        "irpf": as_decimal(payroll.irpf),
        "total_deductions": as_decimal(payroll.total_deductions),
    }


def company_cost_payload(payroll: Payroll) -> dict:
    return {
        "company_common_contingencies": as_decimal(payroll.company_common_contingencies),
        "company_unemployment": as_decimal(payroll.company_unemployment),
        "company_fogasa": as_decimal(payroll.company_fogasa),
        "company_training": as_decimal(payroll.company_training),
        "company_at_ep": as_decimal(payroll.company_at_ep),
        "company_mei": as_decimal(payroll.company_mei),
        "company_total_social_security": as_decimal(payroll.company_total_social_security),
        "company_total_cost": as_decimal(payroll.company_total_cost),
    }


def segment_payload(payroll: Payroll) -> list[dict]:
    segments = []
    for segment in sorted(payroll.segments or [], key=lambda item: (item.start_date, item.end_date, item.id)):
        segments.append({
            "id": segment.id,
            "incident_id": segment.incident_id,
            "segment_type": segment.segment_type,
            "start_date": segment.start_date,
            "end_date": segment.end_date,
            "calendar_days": segment.calendar_days,
            "payroll_days": as_decimal(segment.payroll_days),
            "salary_percentage": as_decimal(segment.salary_percentage),
            "benefit_percentage": as_decimal(segment.benefit_percentage),
            "complement_percentage": as_decimal(segment.complement_percentage),
            "contribution_treatment": segment.contribution_treatment,
            "salary_amount": as_decimal(segment.salary_amount),
            "benefit_amount": as_decimal(segment.benefit_amount),
            "complement_amount": as_decimal(segment.complement_amount),
            "deduction_amount": as_decimal(segment.deduction_amount),
        })
    return segments


def totals_payload(payroll: Payroll, lines: list[dict]) -> dict:
    concept_totals = summarize_concept_lines([
        {
            "amount": line["amount"],
            "concept_type": line["concept_type"],
            "affects_gross": line["affects_gross"],
            "affects_net": line["affects_net"],
            "is_contribution_base": line["contribution_base"],
            "is_taxable": line["taxable"],
        }
        for line in lines
    ])
    return {
        "total_earnings": as_decimal(payroll.gross_salary),
        "total_deductions": as_decimal(payroll.total_deductions),
        "net_salary": as_decimal(payroll.net_salary),
        "company_total_cost": as_decimal(payroll.company_total_cost),
        "concept_earnings": concept_totals["total_devengos"],
        "concept_deductions": concept_totals["total_deductions"],
        "concept_net_salary": concept_totals["neto_por_conceptos"],
    }


def build_warnings(payroll: Payroll, lines: list[dict]) -> list[str]:
    warnings = []
    totals = totals_payload(payroll, lines)
    if totals["concept_earnings"] != totals["total_earnings"]:
        warnings.append("El total de devengos por conceptos no coincide exactamente con el bruto agregado de la nómina.")
    if totals["concept_deductions"] != totals["total_deductions"]:
        warnings.append("El total de deducciones por conceptos no coincide exactamente con las deducciones agregadas de la nómina.")
    if not lines:
        warnings.append("La nómina no contiene líneas de conceptos; el recibo se ha generado solo con importes agregados.")
    return warnings


def get_payroll_receipt(db: Session, payroll_id: int) -> dict:
    payroll = (
        db.query(Payroll)
        .options(
            joinedload(Payroll.company),
            joinedload(Payroll.work_center),
            joinedload(Payroll.employee),
            joinedload(Payroll.contract).joinedload(Contract.collective_agreement),
            selectinload(Payroll.items).joinedload(PayrollItem.concept),
            selectinload(Payroll.segments),
        )
        .filter(Payroll.id == payroll_id)
        .first()
    )
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    if not payroll.employee:
        raise HTTPException(status_code=400, detail="La nómina no tiene trabajador vinculado")
    if not payroll.contract:
        raise HTTPException(status_code=400, detail="La nómina no tiene contrato vinculado")
    if not payroll.company:
        raise HTTPException(status_code=400, detail="La nómina no tiene empresa vinculada")

    lines = receipt_lines(payroll)
    earnings, deductions, base_lines, company_cost_lines, informative_lines = split_lines(lines)

    return {
        "payroll_id": payroll.id,
        "payroll_code": build_payroll_code(payroll),
        "status": payroll.status,
        "generated_at": datetime.utcnow(),
        "is_simulated": True,
        "company": party_company(payroll.company),
        "work_center": party_work_center(payroll.work_center),
        "employee": party_employee(payroll.employee),
        "contract": contract_payload(payroll.contract),
        "period": period_payload(payroll),
        "earnings": earnings,
        "deductions": deductions,
        "bases": bases_payload(payroll),
        "base_lines": base_lines,
        "company_cost": company_cost_payload(payroll),
        "company_cost_lines": company_cost_lines,
        "informative_lines": informative_lines,
        "incident_segments": segment_payload(payroll),
        "deduction_summary": deduction_payload(payroll),
        "totals": totals_payload(payroll, lines),
        "legal_footer": SIMULATED_LEGAL_FOOTER,
        "warnings": build_warnings(payroll, lines),
    }
