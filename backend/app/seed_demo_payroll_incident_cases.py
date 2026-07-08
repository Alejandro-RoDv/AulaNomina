from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Incident, Payroll
from app.models.incident_calculation import PayrollSegment
from app.services.payroll_amounts import money
from app.services.payroll_concept_engine import build_concept_lines_from_payroll
from app.services.payroll_concept_items import sync_engine_concept_items


DEMO_INCIDENT_PAYROLL_CASES = {
    "Javier Romero Sánchez": {
        "case_code": "IT_COMUN_8_DIAS",
        "title": "IT común con prestación y complemento de empresa",
        "incident_type": "IT común",
        "start_date": "2026-05-06",
        "worked_base_salary": Decimal("1063.33"),
        "salary_supplements": Decimal("0.00"),
        "temporary_disability_benefit": Decimal("232.00"),
        "company_disability_complement": Decimal("154.67"),
        "worked_days": 22,
        "incident_days": 8,
        "it_days": 8,
        "non_contribution_days": 0,
        "contribution_days": 30,
        "irpf_percentage": Decimal("10.00"),
        "segment": {
            "segment_type": "IT",
            "start_date": "2026-05-06",
            "end_date": "2026-05-13",
            "calendar_days": 8,
            "payroll_days": Decimal("8.0000"),
            "process_day_from": 1,
            "process_day_to": 8,
            "salary_percentage": Decimal("0.0000"),
            "benefit_percentage": Decimal("60.0000"),
            "complement_percentage": Decimal("40.0000"),
            "contribution_treatment": "CONTRIBUTION",
            "daily_regulatory_base": Decimal("48.3338"),
            "salary_amount": Decimal("0.00"),
            "benefit_amount": Decimal("232.00"),
            "complement_amount": Decimal("154.67"),
            "deduction_amount": Decimal("0.00"),
            "teaching_note": "El salario ordinario de 8 días se sustituye por prestación y complemento empresarial.",
        },
    },
    "Carmen López Torres": {
        "case_code": "RECAIDA_IT_7_DIAS",
        "title": "Recaída de IT con conservación de bruto mediante complemento",
        "incident_type": "Recaída IT",
        "start_date": "2026-05-12",
        "worked_base_salary": Decimal("1399.17"),
        "salary_supplements": Decimal("120.00"),
        "temporary_disability_benefit": Decimal("255.50"),
        "company_disability_complement": Decimal("170.33"),
        "worked_days": 23,
        "incident_days": 7,
        "it_days": 7,
        "non_contribution_days": 0,
        "contribution_days": 30,
        "irpf_percentage": Decimal("14.00"),
        "segment": {
            "segment_type": "RECAIDA_IT",
            "start_date": "2026-05-12",
            "end_date": "2026-05-18",
            "calendar_days": 7,
            "payroll_days": Decimal("7.0000"),
            "process_day_from": 1,
            "process_day_to": 7,
            "salary_percentage": Decimal("0.0000"),
            "benefit_percentage": Decimal("60.0000"),
            "complement_percentage": Decimal("40.0000"),
            "contribution_treatment": "CONTRIBUTION",
            "daily_regulatory_base": Decimal("60.8329"),
            "salary_amount": Decimal("0.00"),
            "benefit_amount": Decimal("255.50"),
            "complement_amount": Decimal("170.33"),
            "deduction_amount": Decimal("0.00"),
            "teaching_note": "La recaída se presenta como continuidad didáctica de una IT previa y conserva la trazabilidad del tramo.",
        },
    },
    "Ana Pérez Navarro": {
        "case_code": "AUSENCIA_NO_RETRIBUIDA_1_DIA",
        "title": "Ausencia no retribuida de un día",
        "incident_type": "Ausencia justificada",
        "start_date": "2026-05-27",
        "worked_base_salary": Decimal("1459.67"),
        "salary_supplements": Decimal("40.00"),
        "temporary_disability_benefit": Decimal("0.00"),
        "company_disability_complement": Decimal("0.00"),
        "worked_days": 29,
        "incident_days": 1,
        "it_days": 0,
        "non_contribution_days": 1,
        "contribution_days": 29,
        "irpf_percentage": Decimal("11.00"),
        "segment": {
            "segment_type": "AUSENCIA_NO_RETRIBUIDA",
            "start_date": "2026-05-27",
            "end_date": "2026-05-27",
            "calendar_days": 1,
            "payroll_days": Decimal("1.0000"),
            "process_day_from": 1,
            "process_day_to": 1,
            "salary_percentage": Decimal("0.0000"),
            "benefit_percentage": Decimal("0.0000"),
            "complement_percentage": Decimal("0.0000"),
            "contribution_treatment": "NO_CONTRIBUTION",
            "daily_regulatory_base": Decimal("50.3333"),
            "salary_amount": Decimal("0.00"),
            "benefit_amount": Decimal("0.00"),
            "complement_amount": Decimal("0.00"),
            "deduction_amount": Decimal("50.33"),
            "teaching_note": "La ausencia no genera prestación ni complemento; reduce salario y días cotizados.",
        },
    },
}


EMPLOYEE_RATE = {
    "common_contingencies": Decimal("4.70"),
    "unemployment": Decimal("1.55"),
    "training": Decimal("0.10"),
    "mei": Decimal("0.13"),
}

COMPANY_RATE = {
    "common_contingencies": Decimal("23.60"),
    "unemployment": Decimal("5.50"),
    "fogasa": Decimal("0.20"),
    "training": Decimal("0.60"),
    "at_ep": Decimal("1.50"),
    "mei": Decimal("0.67"),
}


def parse_demo_date(value: str):
    year, month, day = [int(part) for part in value.split("-")]
    return datetime(year, month, day).date()


def percentage(base: Decimal, rate: Decimal) -> Decimal:
    return money(base * rate / Decimal("100.00"))


def get_demo_case_for_payroll(payroll: Payroll) -> dict | None:
    return DEMO_INCIDENT_PAYROLL_CASES.get(payroll.employee_name)


def update_demo_payroll_amounts(payroll: Payroll, case: dict) -> None:
    base_salary = money(payroll.contract.salary_base if payroll.contract else payroll.base_salary)
    worked_base_salary = money(case["worked_base_salary"])
    salary_supplements = money(case["salary_supplements"])
    temporary_disability_benefit = money(case["temporary_disability_benefit"])
    company_disability_complement = money(case["company_disability_complement"])
    gross_salary = money(
        worked_base_salary
        + salary_supplements
        + temporary_disability_benefit
        + company_disability_complement
    )
    contribution_base = gross_salary
    irpf_percentage = money(case["irpf_percentage"])
    irpf = percentage(gross_salary, irpf_percentage)

    employee_common = percentage(contribution_base, EMPLOYEE_RATE["common_contingencies"])
    employee_unemployment = percentage(contribution_base, EMPLOYEE_RATE["unemployment"])
    employee_training = percentage(contribution_base, EMPLOYEE_RATE["training"])
    employee_mei = percentage(contribution_base, EMPLOYEE_RATE["mei"])
    employee_social_security = money(employee_common + employee_unemployment + employee_training + employee_mei)
    total_deductions = money(employee_social_security + irpf)

    company_common = percentage(contribution_base, COMPANY_RATE["common_contingencies"])
    company_unemployment = percentage(contribution_base, COMPANY_RATE["unemployment"])
    company_fogasa = percentage(contribution_base, COMPANY_RATE["fogasa"])
    company_training = percentage(contribution_base, COMPANY_RATE["training"])
    company_at_ep = percentage(contribution_base, COMPANY_RATE["at_ep"])
    company_mei = percentage(contribution_base, COMPANY_RATE["mei"])
    company_total_social_security = money(
        company_common
        + company_unemployment
        + company_fogasa
        + company_training
        + company_at_ep
        + company_mei
    )

    payroll.base_salary = base_salary
    payroll.worked_base_salary = worked_base_salary
    payroll.temporary_disability_benefit = temporary_disability_benefit
    payroll.company_disability_complement = company_disability_complement
    payroll.salary_supplements = salary_supplements
    payroll.gross_salary = gross_salary
    payroll.contribution_days = case["contribution_days"]
    payroll.worked_days = case["worked_days"]
    payroll.incident_days = case["incident_days"]
    payroll.it_days = case["it_days"]
    payroll.non_contribution_days = case["non_contribution_days"]
    payroll.common_contingencies_base = contribution_base
    payroll.professional_contingencies_base = contribution_base
    payroll.unemployment_training_fogasa_base = contribution_base
    payroll.irpf_base = gross_salary
    payroll.daily_common_base = money(contribution_base / Decimal("30.00"))
    payroll.daily_professional_base = money(contribution_base / Decimal("30.00"))
    payroll.employee_common_contingencies = employee_common
    payroll.employee_unemployment = employee_unemployment
    payroll.employee_training = employee_training
    payroll.employee_mei = employee_mei
    payroll.employee_social_security = employee_social_security
    payroll.irpf_mode = "manual"
    payroll.irpf_percentage = irpf_percentage
    payroll.suggested_irpf_percentage = irpf_percentage
    payroll.irpf = irpf
    payroll.total_deductions = total_deductions
    payroll.net_salary = money(gross_salary - total_deductions)
    payroll.company_common_contingencies = company_common
    payroll.company_unemployment = company_unemployment
    payroll.company_fogasa = company_fogasa
    payroll.company_training = company_training
    payroll.company_at_ep = company_at_ep
    payroll.company_mei = company_mei
    payroll.company_total_social_security = company_total_social_security
    payroll.company_total_cost = money(gross_salary + company_total_social_security)
    payroll.calculation_engine_version = "split-33-demo-incidents"
    payroll.calculation_version = int(payroll.calculation_version or 0) + 1
    payroll.last_calculated_at = datetime.utcnow()
    payroll.status = "calculated"


def find_matching_incident(db: Session, payroll: Payroll, case: dict) -> Incident | None:
    return (
        db.query(Incident)
        .filter(
            Incident.employee_id == payroll.employee_id,
            Incident.contract_id == payroll.contract_id,
            Incident.incident_type == case["incident_type"],
            Incident.start_date == parse_demo_date(case["start_date"]),
        )
        .first()
    )


def upsert_demo_segment(db: Session, payroll: Payroll, incident: Incident | None, case: dict) -> PayrollSegment:
    segment_data = case["segment"]
    segment_key = f"DEMO_SPLIT33:{payroll.id}:{case['case_code']}"
    segment = db.query(PayrollSegment).filter(PayrollSegment.segment_key == segment_key).first()
    if not segment:
        segment = PayrollSegment(payroll_id=payroll.id, segment_key=segment_key)
        db.add(segment)

    segment.incident_id = incident.id if incident else None
    segment.segment_type = segment_data["segment_type"]
    segment.start_date = parse_demo_date(segment_data["start_date"])
    segment.end_date = parse_demo_date(segment_data["end_date"])
    segment.calendar_days = segment_data["calendar_days"]
    segment.payroll_days = money(segment_data["payroll_days"])
    segment.process_day_from = segment_data["process_day_from"]
    segment.process_day_to = segment_data["process_day_to"]
    segment.salary_percentage = money(segment_data["salary_percentage"])
    segment.benefit_percentage = money(segment_data["benefit_percentage"])
    segment.complement_percentage = money(segment_data["complement_percentage"])
    segment.contribution_treatment = segment_data["contribution_treatment"]
    segment.daily_salary_base = money(payroll.base_salary / Decimal("30.00"))
    segment.daily_regulatory_base = money(segment_data["daily_regulatory_base"])
    segment.salary_amount = money(segment_data["salary_amount"])
    segment.benefit_amount = money(segment_data["benefit_amount"])
    segment.complement_amount = money(segment_data["complement_amount"])
    segment.deduction_amount = money(segment_data["deduction_amount"])
    segment.calculation_trace = {
        "demo_case": case["case_code"],
        "title": case["title"],
        "teaching_note": segment_data["teaching_note"],
        "source": "seed_demo_payroll_incident_cases",
    }
    return segment


def sync_demo_engine_items(db: Session, payroll: Payroll) -> dict[str, int]:
    lines = build_concept_lines_from_payroll(payroll)
    return sync_engine_concept_items(db, payroll.id, lines)


def seed_demo_payroll_incident_cases(db: Session) -> dict[str, int]:
    payrolls = db.query(Payroll).all()
    applied_cases = 0
    synced_items = 0
    created_segments = 0

    for payroll in payrolls:
        case = get_demo_case_for_payroll(payroll)
        if not case:
            continue
        update_demo_payroll_amounts(payroll, case)
        incident = find_matching_incident(db, payroll, case)
        segment = upsert_demo_segment(db, payroll, incident, case)
        db.flush()
        sync_result = sync_demo_engine_items(db, payroll)
        applied_cases += 1
        created_segments += 1 if segment else 0
        synced_items += sync_result.get("created_items", 0)

    return {
        "cases": applied_cases,
        "segments": created_segments,
        "engine_items": synced_items,
    }
