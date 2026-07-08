from __future__ import annotations

from datetime import date, datetime
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
INCIDENT_CATEGORIES = {"IT", "AUSENCIA", "INCIDENCIA"}
INCIDENT_CODE_PREFIXES = (
    "PRESTACION_IT",
    "COMPLEMENTO_EMPRESA_IT",
    "DESCUENTO_AUSENCIA",
    "AUSENCIA",
    "IT_",
)
SIMULATED_LEGAL_FOOTER = (
    "Recibo de salarios simulado generado por AulaNomina con finalidad docente. "
    "No sustituye a un recibo oficial emitido por un sistema laboral certificado."
)


def as_decimal(value: Any, default: str = "0.00") -> Decimal:
    return money(value if value is not None else Decimal(default))


def decimal_text(value: Any) -> str:
    return f"{as_decimal(value):.2f} €"


def format_date(value: date | None) -> str:
    if not value:
        return "fecha no informada"
    return value.strftime("%d/%m/%Y")


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


def ordinary_reference_amount(payroll: Payroll) -> Decimal:
    return money(
        as_decimal(getattr(payroll, "base_salary", 0))
        + as_decimal(getattr(payroll, "salary_supplements", 0))
        + as_decimal(getattr(payroll, "seniority_amount", 0))
        + as_decimal(getattr(payroll, "variable_incentives", 0))
        + as_decimal(getattr(payroll, "extra_pay_proration", 0))
    )


def base_explanation_context(payroll: Payroll) -> dict:
    ordinary_reference = ordinary_reference_amount(payroll)
    gross_salary = as_decimal(getattr(payroll, "gross_salary", 0))
    base_difference = money(gross_salary - ordinary_reference)
    incident_days = int(getattr(payroll, "incident_days", 0) or 0)
    it_days = int(getattr(payroll, "it_days", 0) or 0)
    non_contribution_days = int(getattr(payroll, "non_contribution_days", 0) or 0)
    contribution_days = int(getattr(payroll, "contribution_days", 0) or 0)
    period_days = 30

    if incident_days:
        summary = (
            f"Referencia ordinaria estimada: {decimal_text(ordinary_reference)}. "
            f"Base/devengo usado en el recibo: {decimal_text(gross_salary)}. "
            f"Diferencia explicativa por incidencias o ajustes: {decimal_text(base_difference)}."
        )
    else:
        summary = "No hay incidencias aplicadas; las bases se explican desde los devengos ordinarios del periodo."

    return {
        "ordinary_reference": ordinary_reference,
        "gross_salary": gross_salary,
        "base_difference": base_difference,
        "incident_days": incident_days,
        "it_days": it_days,
        "non_contribution_days": non_contribution_days,
        "contribution_days": contribution_days,
        "period_days": period_days,
        "summary": summary,
    }


def base_learning_points(payroll: Payroll, *, base_code: str) -> list[str]:
    points = []
    incident_days = int(getattr(payroll, "incident_days", 0) or 0)
    it_days = int(getattr(payroll, "it_days", 0) or 0)
    non_contribution_days = int(getattr(payroll, "non_contribution_days", 0) or 0)
    contribution_days = int(getattr(payroll, "contribution_days", 0) or 0)

    if incident_days:
        points.append("Las incidencias obligan a comprobar si los días afectados siguen cotizando, reducen salario o generan prestación.")
    if it_days:
        points.append("En una IT puede haber prestación y complemento, pero la base puede mantenerse según el tratamiento aplicado al segmento.")
    if non_contribution_days:
        points.append("Los días no cotizados reducen los días de cotización y pueden disminuir las bases frente a una nómina ordinaria.")
    if contribution_days and contribution_days != 30:
        points.append(f"La nómina utiliza {contribution_days} día(s) de cotización en vez de 30.")
    if base_code == "BASE_IRPF":
        points.append("La base de IRPF no siempre coincide con la base de cotización: depende de qué conceptos tributen.")
    elif base_code in {"BASE_CC", "BASE_CP", "BASE_DESEMPLEO_FORMACION_FOGASA"}:
        points.append("Esta base se usa para calcular cuotas de Seguridad Social, no el líquido directamente.")
    return points or ["Base calculada sin incidencias relevantes en el periodo."]


def build_base_explanation_item(payroll: Payroll, code: str, title: str, amount: Decimal, formula: str) -> dict:
    context = base_explanation_context(payroll)
    affected = bool(context["incident_days"] or context["non_contribution_days"] or context["base_difference"])
    if affected:
        explanation = (
            f"{title}: {decimal_text(amount)}. "
            f"Se calcula sobre {context['contribution_days']} día(s) de cotización y {context['incident_days']} día(s) de incidencia. "
            f"{context['summary']}"
        )
    else:
        explanation = f"{title}: {decimal_text(amount)}. Se calcula sobre la nómina ordinaria del periodo sin incidencias aplicadas."

    return {
        "code": code,
        "title": title,
        "amount": money(amount),
        "formula": formula,
        "affected_by_incident": affected,
        "explanation": explanation,
        "learning_points": base_learning_points(payroll, base_code=code),
    }


def base_explanations_payload(payroll: Payroll) -> list[dict]:
    return [
        build_base_explanation_item(
            payroll,
            "BASE_CC",
            "Base de contingencias comunes",
            as_decimal(payroll.common_contingencies_base),
            "Devengos cotizables comunes del periodo, ajustados por días y tratamiento de incidencia.",
        ),
        build_base_explanation_item(
            payroll,
            "BASE_CP",
            "Base de contingencias profesionales",
            as_decimal(payroll.professional_contingencies_base),
            "Devengos cotizables para AT/EP y contingencias profesionales.",
        ),
        build_base_explanation_item(
            payroll,
            "BASE_DESEMPLEO_FORMACION_FOGASA",
            "Base de desempleo, formación y FOGASA",
            as_decimal(payroll.unemployment_training_fogasa_base),
            "Base usada para desempleo, formación profesional y FOGASA.",
        ),
        build_base_explanation_item(
            payroll,
            "BASE_IRPF",
            "Base sujeta a IRPF",
            as_decimal(payroll.irpf_base),
            "Importes tributables del periodo antes de aplicar el porcentaje de retención.",
        ),
    ]


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


def source_type_label(value: str | None) -> str:
    normalized = str(value or "").upper()
    labels = {
        "SYSTEM": "sistema",
        "CONTRACT": "contrato",
        "AGREEMENT": "convenio",
        "INCIDENT": "incidencia",
        "MANUAL": "manual",
        "CUSTOM": "personalizado",
    }
    return labels.get(normalized, str(value or "origen no informado").lower())


def section_for_line(line: dict) -> str:
    code = str(line.get("code") or "").upper()
    category = str(line.get("category") or "").upper()
    concept_type = str(line.get("concept_type") or "").upper()
    if concept_type == "DEVENGO" and line.get("affects_gross"):
        return "Devengo"
    if concept_type == "DEDUCCION" and line.get("affects_net"):
        return "Deducción"
    if category == "COSTE_EMPRESA" or code.startswith("COSTE_EMPRESA"):
        return "Coste empresa"
    if concept_type in INFORMATIVE_TYPES and (category == "BASE_INFORMATIVA" or code.startswith("BASE_")):
        return "Base informativa"
    return "Informativo"


def effect_summary_for_line(line: dict) -> str:
    section = section_for_line(line)
    amount = decimal_text(line.get("amount"))
    if section == "Devengo":
        return f"Suma {amount} al total devengado."
    if section == "Deducción":
        return f"Resta {amount} del líquido a percibir."
    if section == "Base informativa":
        return f"Informa una base de {amount}; no se paga ni se descuenta directamente."
    if section == "Coste empresa":
        return f"Informa un coste empresarial de {amount}; no modifica el líquido del trabajador."
    return f"Línea informativa de {amount}."


def flags_for_line(line: dict) -> list[str]:
    flags = []
    flags.append("afecta al bruto" if line.get("affects_gross") else "no afecta al bruto")
    flags.append("afecta al neto" if line.get("affects_net") else "no afecta al neto")
    flags.append("cotiza" if line.get("contribution_base") else "no cotiza")
    flags.append("tributa" if line.get("taxable") else "no tributa")
    return flags


def learning_points_for_line(line: dict) -> list[str]:
    points = []
    section = section_for_line(line)
    category = str(line.get("category") or "").upper()
    source_type = str(line.get("source_type") or "").upper()

    if section == "Devengo":
        points.append("Los devengos explican qué importes se reconocen antes de aplicar deducciones.")
    elif section == "Deducción":
        points.append("Las deducciones explican por qué el líquido es inferior al total devengado.")
    elif section == "Base informativa":
        points.append("Las bases informativas sirven para calcular cuotas o retenciones, aunque no sean importes a cobrar.")
    elif section == "Coste empresa":
        points.append("El coste de empresa ayuda a separar salario del trabajador y coste total de contratación.")

    if line.get("contribution_base"):
        points.append("Este concepto entra en la base de cotización según la parametrización actual.")
    elif section == "Devengo":
        points.append("Este devengo no entra en base de cotización según la parametrización actual.")

    if line.get("taxable"):
        points.append("Este concepto forma parte de la base sujeta a IRPF.")
    elif section == "Devengo":
        points.append("Este devengo no tributa en la simulación actual.")

    if category in INCIDENT_CATEGORIES or source_type == "INCIDENT":
        points.append("Aparece por una incidencia procesada en la nómina.")
    if line.get("formula"):
        points.append("La fórmula permite auditar de dónde sale el importe.")
    return points


def line_explanation_text(line: dict) -> str:
    source = source_type_label(line.get("source_type"))
    section = section_for_line(line)
    effect = effect_summary_for_line(line)
    flags = ", ".join(flags_for_line(line))
    description = line.get("description") or "sin descripción adicional"
    return (
        f"{line.get('name') or line.get('code')} es una línea de tipo {section.lower()} con origen {source}. "
        f"{effect} En esta simulación {flags}. Descripción: {description}."
    )


def line_explanations_payload(lines: list[dict]) -> list[dict]:
    explanations = []
    sorted_lines = sorted(lines, key=lambda item: (int(item.get("display_order") or 0), item.get("code") or ""))
    for index, line in enumerate(sorted_lines, start=1):
        explanations.append({
            "line_id": line.get("id"),
            "code": line.get("code") or f"LINEA_{index}",
            "name": line.get("name") or "Concepto",
            "section": section_for_line(line),
            "amount": as_decimal(line.get("amount")),
            "concept_type": line.get("concept_type") or "INFORMATIVO",
            "category": line.get("category") or "OTRO",
            "source_type": line.get("source_type") or "system",
            "affects_gross": bool(line.get("affects_gross")),
            "affects_net": bool(line.get("affects_net")),
            "taxable": bool(line.get("taxable")),
            "contribution_base": bool(line.get("contribution_base")),
            "formula": line.get("formula"),
            "explanation": line_explanation_text(line),
            "learning_points": learning_points_for_line(line),
        })
    return explanations


def segment_type_label(segment_type: str | None) -> str:
    value = str(segment_type or "").upper()
    labels = {
        "IT": "Incapacidad temporal",
        "RECAIDA_IT": "Recaída de IT",
        "SICK_LEAVE": "Incapacidad temporal",
        "COMMON_SICKNESS": "IT por enfermedad común",
        "WORK_ACCIDENT": "IT por accidente de trabajo",
        "ABSENCE": "Ausencia",
        "AUSENCIA_NO_RETRIBUIDA": "Ausencia no retribuida",
        "UNPAID_ABSENCE": "Ausencia no retribuida",
        "VACATION": "Vacaciones",
        "MATERNITY": "Nacimiento y cuidado de menor",
        "PATERNITY": "Nacimiento y cuidado de menor",
    }
    return labels.get(value, segment_type or "Incidencia")


def contribution_treatment_label(value: str | None) -> str:
    normalized = str(value or "").upper()
    if normalized in {"CONTRIBUTION", "CONTRIBUTES", "COTIZA", "FULL"}:
        return "Mantiene cotización durante el segmento."
    if normalized in {"NO_CONTRIBUTION", "NO_COTIZA", "EXCLUDED"}:
        return "No cotiza por los días indicados en este segmento."
    if normalized in {"PARTIAL", "PARTIAL_CONTRIBUTION"}:
        return "Cotización parcial según el tratamiento de la incidencia."
    return "Tratamiento de cotización pendiente de parametrización específica."


def incident_related_lines(lines: list[dict]) -> list[dict]:
    related = []
    for line in lines:
        category = str(line.get("category") or "").upper()
        code = str(line.get("code") or "").upper()
        if category in INCIDENT_CATEGORIES or code.startswith(INCIDENT_CODE_PREFIXES):
            related.append(line)
    return related


def affected_concepts_payload(lines: list[dict]) -> list[dict]:
    concepts = []
    seen_codes = set()
    for line in incident_related_lines(lines):
        code = line.get("code") or "CONCEPTO"
        if code in seen_codes:
            continue
        seen_codes.add(code)
        concepts.append({
            "code": code,
            "name": line.get("name") or code,
            "amount": as_decimal(line.get("amount")),
            "concept_type": line.get("concept_type") or "INFORMATIVO",
        })
    return concepts


def learning_points_for_segment(segment, payroll: Payroll) -> list[str]:
    points = []
    if as_decimal(getattr(segment, "benefit_amount", 0)):
        points.append("La prestación aparece como devengo específico y permite diferenciar salario ordinario de prestación de Seguridad Social o pago delegado.")
    if as_decimal(getattr(segment, "complement_amount", 0)):
        points.append("El complemento de empresa se muestra separado para explicar qué parte mejora la prestación legal o convencional.")
    if as_decimal(getattr(segment, "deduction_amount", 0)):
        points.append("El descuento reduce el líquido y permite identificar ausencias o tramos no retribuidos.")
    if int(getattr(payroll, "incident_days", 0) or 0):
        points.append("Los días de incidencia modifican el reparto entre días trabajados, días cotizados y días afectados por la situación comunicada.")
    points.append(contribution_treatment_label(getattr(segment, "contribution_treatment", None)))
    return points


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


def incident_summary_payload(payroll: Payroll, explanations: list[dict]) -> dict:
    total_benefits = sum((item["benefit_amount"] for item in explanations), Decimal("0.00"))
    total_complements = sum((item["complement_amount"] for item in explanations), Decimal("0.00"))
    total_deductions = sum((item["deduction_amount"] for item in explanations), Decimal("0.00"))
    total_net_effect = sum((item["net_effect"] for item in explanations), Decimal("0.00"))
    incident_days = int(getattr(payroll, "incident_days", 0) or 0)
    it_days = int(getattr(payroll, "it_days", 0) or 0)
    non_contribution_days = int(getattr(payroll, "non_contribution_days", 0) or 0)
    has_incidents = bool(explanations or incident_days or it_days or non_contribution_days)

    if has_incidents:
        explanation = (
            f"La nómina contiene {incident_days} día(s) de incidencia, "
            f"{it_days} día(s) de IT y {non_contribution_days} día(s) no cotizados. "
            "El recibo separa salario, prestaciones, complementos, descuentos y bases para que el alumno pueda seguir el efecto completo."
        )
    else:
        explanation = "Nómina ordinaria sin segmentos de incidencia aplicados."

    return {
        "has_incidents": has_incidents,
        "incident_days": incident_days,
        "it_days": it_days,
        "non_contribution_days": non_contribution_days,
        "total_benefits": money(total_benefits),
        "total_company_complements": money(total_complements),
        "total_absence_deductions": money(total_deductions),
        "total_net_incident_effect": money(total_net_effect),
        "explanation": explanation,
    }


def build_incident_explanations(payroll: Payroll, lines: list[dict]) -> list[dict]:
    explanations = []
    affected_concepts = affected_concepts_payload(lines)
    for segment in sorted(payroll.segments or [], key=lambda item: (item.start_date, item.end_date, item.id)):
        salary_amount = as_decimal(getattr(segment, "salary_amount", 0))
        benefit_amount = as_decimal(getattr(segment, "benefit_amount", 0))
        complement_amount = as_decimal(getattr(segment, "complement_amount", 0))
        deduction_amount = as_decimal(getattr(segment, "deduction_amount", 0))
        net_effect = money(salary_amount + benefit_amount + complement_amount - deduction_amount)
        title = segment_type_label(getattr(segment, "segment_type", None))
        period = f"{format_date(getattr(segment, 'start_date', None))} - {format_date(getattr(segment, 'end_date', None))}"
        explanation_parts = [
            f"{title} del {period}.",
            f"Afecta a {getattr(segment, 'calendar_days', 0) or 0} día(s) naturales y {as_decimal(getattr(segment, 'payroll_days', 0))} día(s) de nómina.",
        ]
        if salary_amount:
            explanation_parts.append(f"El salario ordinario reconocido en el tramo asciende a {decimal_text(salary_amount)}.")
        if benefit_amount:
            explanation_parts.append(f"Se incorpora prestación por {decimal_text(benefit_amount)}.")
        if complement_amount:
            explanation_parts.append(f"La empresa complementa la situación con {decimal_text(complement_amount)}.")
        if deduction_amount:
            explanation_parts.append(f"Existe descuento asociado por {decimal_text(deduction_amount)}.")
        explanation_parts.append(contribution_treatment_label(getattr(segment, "contribution_treatment", None)))

        explanations.append({
            "id": segment.id,
            "incident_id": getattr(segment, "incident_id", None),
            "segment_type": getattr(segment, "segment_type", None) or "INCIDENCIA",
            "title": title,
            "period": period,
            "calendar_days": int(getattr(segment, "calendar_days", 0) or 0),
            "payroll_days": as_decimal(getattr(segment, "payroll_days", 0)),
            "salary_amount": salary_amount,
            "benefit_amount": benefit_amount,
            "complement_amount": complement_amount,
            "deduction_amount": deduction_amount,
            "net_effect": net_effect,
            "contribution_treatment": getattr(segment, "contribution_treatment", None),
            "explanation": " ".join(explanation_parts),
            "learning_points": learning_points_for_segment(segment, payroll),
            "affected_concepts": affected_concepts,
        })
    return explanations


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
    incident_explanations = build_incident_explanations(payroll, lines)

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
        "base_explanations": base_explanations_payload(payroll),
        "line_explanations": line_explanations_payload(lines),
        "company_cost": company_cost_payload(payroll),
        "company_cost_lines": company_cost_lines,
        "informative_lines": informative_lines,
        "incident_segments": segment_payload(payroll),
        "incident_summary": incident_summary_payload(payroll, incident_explanations),
        "incident_explanations": incident_explanations,
        "deduction_summary": deduction_payload(payroll),
        "totals": totals_payload(payroll, lines),
        "legal_footer": SIMULATED_LEGAL_FOOTER,
        "warnings": build_warnings(payroll, lines),
    }
