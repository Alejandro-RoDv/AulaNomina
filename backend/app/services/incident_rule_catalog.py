from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.incident_calculation import IncidentCalculationRule


LEGAL_RULE_VALID_FROM = date(2015, 10, 31)


DEFAULT_RULES: list[dict[str, Any]] = [
    {
        "code": "LEGAL_IT_COMMON_GENERAL",
        "name": "IT por contingencia común",
        "incident_type": "IT",
        "process_type": "common_disease",
        "priority": 100,
        "legal_reference": "LGSS: prestación general de IT por enfermedad común o accidente no laboral",
        "configuration": {
            "kind": "medical",
            "salary_replacement": True,
            "contribution_treatment": "maintain",
            "bands": [
                {"from": 1, "to": 3, "segment_type": "it_waiting", "benefit_percentage": 0, "payer": "none"},
                {"from": 4, "to": 15, "segment_type": "it_common_60_company", "benefit_percentage": 60, "payer": "company"},
                {"from": 16, "to": 20, "segment_type": "it_common_60_delegated", "benefit_percentage": 60, "payer": "social_security"},
                {"from": 21, "to": None, "segment_type": "it_common_75", "benefit_percentage": 75, "payer": "social_security"},
            ],
        },
    },
    {
        "code": "LEGAL_IT_NON_WORK_ACCIDENT",
        "name": "IT por accidente no laboral",
        "incident_type": "IT",
        "process_type": "non_work_accident",
        "priority": 100,
        "legal_reference": "LGSS: prestación general de IT por enfermedad común o accidente no laboral",
        "configuration": {
            "kind": "medical",
            "salary_replacement": True,
            "contribution_treatment": "maintain",
            "bands": [
                {"from": 1, "to": 3, "segment_type": "it_waiting", "benefit_percentage": 0, "payer": "none"},
                {"from": 4, "to": 15, "segment_type": "it_common_60_company", "benefit_percentage": 60, "payer": "company"},
                {"from": 16, "to": 20, "segment_type": "it_common_60_delegated", "benefit_percentage": 60, "payer": "social_security"},
                {"from": 21, "to": None, "segment_type": "it_common_75", "benefit_percentage": 75, "payer": "social_security"},
            ],
        },
    },
    {
        "code": "LEGAL_IT_WORK_ACCIDENT",
        "name": "IT por accidente de trabajo",
        "incident_type": "IT",
        "process_type": "work_accident",
        "priority": 100,
        "legal_reference": "LGSS: salario del día de baja y prestación desde el día siguiente",
        "configuration": {
            "kind": "medical",
            "salary_replacement": True,
            "contribution_treatment": "maintain",
            "regulatory_base": "professional",
            "bands": [
                {"from": 1, "to": 1, "segment_type": "work_accident_salary_day", "salary_percentage": 100, "benefit_percentage": 0, "payer": "company"},
                {"from": 2, "to": None, "segment_type": "work_accident_75", "benefit_percentage": 75, "payer": "social_security"},
            ],
        },
    },
    {
        "code": "LEGAL_IT_OCCUPATIONAL_DISEASE",
        "name": "IT por enfermedad profesional",
        "incident_type": "IT",
        "process_type": "occupational_disease",
        "priority": 100,
        "legal_reference": "LGSS: contingencia profesional",
        "configuration": {
            "kind": "medical",
            "salary_replacement": True,
            "contribution_treatment": "maintain",
            "regulatory_base": "professional",
            "bands": [
                {"from": 1, "to": 1, "segment_type": "occupational_disease_salary_day", "salary_percentage": 100, "benefit_percentage": 0, "payer": "company"},
                {"from": 2, "to": None, "segment_type": "occupational_disease_75", "benefit_percentage": 75, "payer": "social_security"},
            ],
        },
    },
    {
        "code": "LEGAL_RELAPSE_COMMON",
        "name": "Recaída de IT común",
        "incident_type": "RECAIDA",
        "process_type": "common_disease",
        "priority": 100,
        "legal_reference": "LGSS: continuidad del proceso de IT",
        "configuration": {
            "kind": "medical",
            "salary_replacement": True,
            "contribution_treatment": "maintain",
            "bands": [
                {"from": 1, "to": 3, "segment_type": "it_waiting", "benefit_percentage": 0, "payer": "none"},
                {"from": 4, "to": 15, "segment_type": "it_common_60_company", "benefit_percentage": 60, "payer": "company"},
                {"from": 16, "to": 20, "segment_type": "it_common_60_delegated", "benefit_percentage": 60, "payer": "social_security"},
                {"from": 21, "to": None, "segment_type": "it_common_75", "benefit_percentage": 75, "payer": "social_security"},
            ],
        },
    },
    {
        "code": "LEGAL_PROTECTED_BENEFIT_100",
        "name": "Prestación protegida al 100 por cien",
        "incident_type": "NACIMIENTO_CUIDADO",
        "process_type": None,
        "priority": 100,
        "legal_reference": "Perfil general configurable para prestaciones protegidas",
        "configuration": {
            "kind": "medical",
            "salary_replacement": True,
            "contribution_treatment": "maintain",
            "bands": [{"from": 1, "to": None, "segment_type": "protected_benefit_100", "benefit_percentage": 100, "payer": "social_security"}],
        },
    },
    {
        "code": "LEGAL_VACATION_PAID",
        "name": "Vacaciones retribuidas",
        "incident_type": "VACACIONES",
        "process_type": None,
        "priority": 100,
        "legal_reference": "Estatuto de los Trabajadores: vacaciones anuales retribuidas",
        "configuration": {"kind": "paid_time", "segment_type": "vacation", "salary_percentage": 100, "contribution_treatment": "maintain", "informative_concept": "INC_VACATION_INFO"},
    },
    {
        "code": "LEGAL_PAID_LEAVE",
        "name": "Permiso retribuido",
        "incident_type": "PERMISO_RETRIBUIDO",
        "process_type": None,
        "priority": 100,
        "legal_reference": "Permiso retribuido según ley o convenio",
        "configuration": {"kind": "paid_time", "segment_type": "paid_leave", "salary_percentage": 100, "contribution_treatment": "maintain", "informative_concept": "INC_PAID_LEAVE_INFO"},
    },
    {
        "code": "LEGAL_UNPAID_ABSENCE",
        "name": "Ausencia no retribuida",
        "incident_type": "AUSENCIA",
        "process_type": None,
        "priority": 100,
        "legal_reference": "Ausencia no retribuida; tratamiento configurable por causa y convenio",
        "configuration": {"kind": "unpaid_time", "segment_type": "unpaid_absence", "salary_percentage": 0, "contribution_treatment": "reduce", "deduction_concept": "INC_UNPAID_ABSENCE"},
    },
    {
        "code": "LEGAL_UNPAID_LEAVE",
        "name": "Permiso no retribuido",
        "incident_type": "PERMISO_NO_RETRIBUIDO",
        "process_type": None,
        "priority": 100,
        "legal_reference": "Permiso no retribuido según pacto o convenio",
        "configuration": {"kind": "unpaid_time", "segment_type": "unpaid_leave", "salary_percentage": 0, "contribution_treatment": "reduce", "deduction_concept": "INC_UNPAID_ABSENCE"},
    },
    {
        "code": "LEGAL_SUSPENSION",
        "name": "Suspensión de contrato",
        "incident_type": "SUSPENSION",
        "process_type": None,
        "priority": 100,
        "legal_reference": "Suspensión contractual; causa concreta parametrizable",
        "configuration": {"kind": "unpaid_time", "segment_type": "suspension", "salary_percentage": 0, "contribution_treatment": "reduce", "deduction_concept": "INC_SUSPENSION_DEDUCTION"},
    },
    {
        "code": "LEGAL_DISCIPLINARY_SANCTION",
        "name": "Sanción con suspensión de empleo y sueldo",
        "incident_type": "SANCION",
        "process_type": None,
        "priority": 100,
        "legal_reference": "Sanción laboral; configuración educativa",
        "configuration": {"kind": "unpaid_time", "segment_type": "sanction", "salary_percentage": 0, "contribution_treatment": "reduce", "deduction_concept": "INC_SANCTION_DEDUCTION"},
    },
    {
        "code": "LEGAL_OVERTIME_PAID",
        "name": "Horas extraordinarias abonadas",
        "incident_type": "HORAS_EXTRA",
        "process_type": None,
        "priority": 100,
        "legal_reference": "Estatuto de los Trabajadores: valor no inferior a la hora ordinaria",
        "configuration": {"kind": "overtime", "segment_type": "overtime", "earning_concept": "INC_OVERTIME", "minimum_ordinary_hour_value": True},
    },
]


PROTECTED_TYPES = {"RIESGO_EMBARAZO", "RIESGO_LACTANCIA", "CUIDADO_MENOR"}


@dataclass(frozen=True)
class ResolvedIncidentCalculationRule:
    id: int | None
    code: str
    name: str
    incident_type: str
    process_type: str | None
    agreement_id: int | None
    valid_from: date
    valid_to: date | None
    priority: int
    configuration: dict[str, Any]
    legal_reference: str | None
    is_active: bool = True


def normalized_process_type(incident) -> str | None:
    details = incident.details or {}
    value = details.get("process_type") or details.get("benefit_type")
    if incident.incident_type in {"IT", "RECAIDA"}:
        return value or "common_disease"
    return value


def ensure_default_incident_rules(db: Session) -> None:
    existing_codes = {row.code for row in db.query(IncidentCalculationRule.code).all()}
    for definition in DEFAULT_RULES:
        if definition["code"] in existing_codes:
            continue
        db.add(IncidentCalculationRule(
            code=definition["code"],
            name=definition["name"],
            incident_type=definition["incident_type"],
            process_type=definition["process_type"],
            valid_from=LEGAL_RULE_VALID_FROM,
            priority=definition["priority"],
            configuration=deepcopy(definition["configuration"]),
            legal_reference=definition["legal_reference"],
            is_active=True,
        ))
    db.flush()


def resolve_default_calculation_rule(incident_type: str, process_type: str | None, calculation_date: date) -> ResolvedIncidentCalculationRule | None:
    if calculation_date < LEGAL_RULE_VALID_FROM:
        return None
    candidates = [
        definition for definition in DEFAULT_RULES
        if definition["incident_type"] == incident_type
        and definition["process_type"] in {None, process_type}
    ]
    if not candidates:
        return None
    candidates.sort(
        key=lambda definition: (
            1 if definition["process_type"] == process_type and process_type is not None else 0,
            definition["priority"],
        ),
        reverse=True,
    )
    definition = candidates[0]
    return ResolvedIncidentCalculationRule(
        id=None,
        code=definition["code"],
        name=definition["name"],
        incident_type=definition["incident_type"],
        process_type=definition["process_type"],
        agreement_id=None,
        valid_from=LEGAL_RULE_VALID_FROM,
        valid_to=None,
        priority=definition["priority"],
        configuration=deepcopy(definition["configuration"]),
        legal_reference=definition["legal_reference"],
    )


def resolve_calculation_rule(db: Session, incident, calculation_date: date):
    incident_type = incident.incident_type
    if incident_type in PROTECTED_TYPES:
        incident_type = "NACIMIENTO_CUIDADO"
    process_type = normalized_process_type(incident)
    agreement_id = getattr(incident.contract, "collective_agreement_id", None) if incident.contract else None

    candidates = db.query(IncidentCalculationRule).filter(
        IncidentCalculationRule.is_active.is_(True),
        IncidentCalculationRule.incident_type == incident_type,
        IncidentCalculationRule.valid_from <= calculation_date,
        or_(IncidentCalculationRule.valid_to.is_(None), IncidentCalculationRule.valid_to >= calculation_date),
        or_(IncidentCalculationRule.process_type.is_(None), IncidentCalculationRule.process_type == process_type),
        or_(IncidentCalculationRule.agreement_id.is_(None), IncidentCalculationRule.agreement_id == agreement_id),
    ).all()
    if candidates:
        candidates.sort(
            key=lambda row: (
                1 if row.agreement_id == agreement_id and agreement_id is not None else 0,
                1 if row.process_type == process_type and process_type is not None else 0,
                row.priority,
                row.valid_from,
            ),
            reverse=True,
        )
        return candidates[0]
    return resolve_default_calculation_rule(incident_type, process_type, calculation_date)


def resolve_band(configuration: dict[str, Any], process_day: int) -> dict[str, Any]:
    for band in configuration.get("bands", []):
        lower = int(band.get("from") or 1)
        upper = band.get("to")
        if process_day >= lower and (upper is None or process_day <= int(upper)):
            return band
    return {}
