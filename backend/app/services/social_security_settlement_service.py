import json
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.crud.communication_file import (
    create_communication_file,
    generate_communication_file,
    validate_communication_file,
)
from app.models.company import Company
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollItem
from app.models.social_security_settlement import (
    SocialSecuritySettlement,
    SocialSecuritySettlementLine,
)
from app.models.work_center import WorkCenter
from app.schemas.communication_file import CommunicationFileCreate, CommunicationFileGenerateRequest
from app.schemas.social_security_settlement import (
    SocialSecuritySettlementPrepareRequest,
    SocialSecuritySettlementStatus,
)
from app.services.communication_file_workflow import (
    CommunicationFileStatus,
    CommunicationFileType,
    normalize_ccc,
)
from app.services.payroll_amounts import money


class SocialSecuritySettlementDomainError(ValueError):
    pass


EDITABLE_SETTLEMENT_STATUSES = {
    SocialSecuritySettlementStatus.DRAFT.value,
    SocialSecuritySettlementStatus.VALIDATION_ERROR.value,
    SocialSecuritySettlementStatus.READY.value,
}

OVERTIME_MARKERS = ("HORA_EXTRA", "HORAS_EXTRA", "OVERTIME")
BONUS_MARKERS = ("BONIFICACION_SS", "BONIF_SS", "SOCIAL_SECURITY_BONUS")
REDUCTION_MARKERS = ("REDUCCION_SS", "REDUCCION_COTIZACION", "SOCIAL_SECURITY_REDUCTION")


def _json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _json_load(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _issue(
    field: str,
    code: str,
    message: str,
    *,
    severity: str = "ERROR",
    payroll_id: int | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "field": field,
        "code": code,
        "message": message,
        "severity": severity,
    }
    if payroll_id is not None:
        result["payroll_id"] = payroll_id
    return result


def _has_blocking_errors(issues: list[dict[str, Any]]) -> bool:
    return any(str(issue.get("severity") or "ERROR").upper() == "ERROR" for issue in issues)


def _component_total(*values: Any) -> Decimal:
    return money(sum((money(value or 0) for value in values), Decimal("0.00")))


def _item_marker(item: PayrollItem) -> str:
    concept = getattr(item, "concept", None)
    return " ".join(
        str(value or "").upper()
        for value in (
            getattr(concept, "code", None),
            getattr(concept, "category", None),
            getattr(item, "description", None),
        )
    )


def _sum_items_by_markers(payroll: Payroll, markers: tuple[str, ...]) -> Decimal:
    total = Decimal("0.00")
    for item in getattr(payroll, "items", []) or []:
        marker = _item_marker(item)
        if any(token in marker for token in markers):
            total += abs(money(getattr(item, "amount", 0)))
    return money(total)


def resolve_payroll_ccc(payroll: Payroll) -> str | None:
    center = getattr(payroll, "work_center", None)
    if center:
        center_ccc = normalize_ccc(getattr(center, "main_ccc", None)) or normalize_ccc(
            getattr(center, "general_ccc", None)
        )
        if center_ccc:
            return center_ccc
    company = getattr(payroll, "company", None)
    return normalize_ccc(getattr(company, "ccc", None))


def list_company_ccc_options(db: Session, company_id: int) -> list[dict[str, Any]]:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise SocialSecuritySettlementDomainError("Empresa no encontrada")

    options: dict[str, dict[str, Any]] = {}
    company_ccc = normalize_ccc(company.ccc)
    if company_ccc:
        options[company_ccc] = {
            "ccc_id": company_ccc,
            "source": "COMPANY",
            "source_id": company.id,
            "label": f"{company.name} · CCC principal {company_ccc}",
        }

    centers = db.query(WorkCenter).filter(WorkCenter.company_id == company.id).order_by(WorkCenter.name).all()
    for center in centers:
        for attribute, label in (("main_ccc", "CCC principal"), ("general_ccc", "CCC general")):
            ccc = normalize_ccc(getattr(center, attribute, None))
            if not ccc or ccc in options:
                continue
            options[ccc] = {
                "ccc_id": ccc,
                "source": "WORK_CENTER",
                "source_id": center.id,
                "label": f"{center.name} · {label} {ccc}",
            }
    return list(options.values())


def _validate_line(payroll: Payroll, selected_ccc: str, values: dict[str, Decimal]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    employee = getattr(payroll, "employee", None)
    contract = getattr(payroll, "contract", None)

    if not employee:
        issues.append(_issue("employee_id", "EMPLOYEE_MISSING", "La nómina no tiene trabajador vinculado.", payroll_id=payroll.id))
    elif not normalize_ccc(getattr(employee, "naf", None)):
        issues.append(_issue("naf", "NAF_REQUIRED", "Falta el número de afiliación del trabajador.", payroll_id=payroll.id))

    if not contract:
        issues.append(_issue("contract_id", "CONTRACT_MISSING", "La nómina no tiene contrato vinculado.", payroll_id=payroll.id))
    elif not getattr(contract, "contribution_group", None):
        issues.append(
            _issue(
                "contribution_group",
                "CONTRIBUTION_GROUP_REQUIRED",
                "Falta el grupo de cotización del contrato.",
                payroll_id=payroll.id,
            )
        )

    payroll_ccc = resolve_payroll_ccc(payroll)
    if payroll_ccc != selected_ccc:
        issues.append(
            _issue(
                "ccc_id",
                "PAYROLL_CCC_MISMATCH",
                "La nómina no pertenece al CCC seleccionado.",
                payroll_id=payroll.id,
            )
        )

    days = int(getattr(payroll, "contribution_days", 0) or 0)
    if days < 0 or days > 31:
        issues.append(
            _issue(
                "contribution_days",
                "INVALID_CONTRIBUTION_DAYS",
                "Los días cotizados deben estar entre 0 y 31.",
                payroll_id=payroll.id,
            )
        )
    elif days == 0 and any(values[key] > 0 for key in (
        "common_contingencies_base",
        "professional_contingencies_base",
        "unemployment_training_fogasa_base",
    )):
        issues.append(
            _issue(
                "contribution_days",
                "ZERO_DAYS_WITH_BASES",
                "La nómina tiene bases positivas y cero días cotizados.",
                severity="WARNING",
                payroll_id=payroll.id,
            )
        )

    for field in (
        "common_contingencies_base",
        "professional_contingencies_base",
        "unemployment_training_fogasa_base",
    ):
        if values[field] < 0:
            issues.append(
                _issue(field, "NEGATIVE_CONTRIBUTION_BASE", "La base de cotización no puede ser negativa.", payroll_id=payroll.id)
            )

    status = str(getattr(payroll, "status", "") or "").lower()
    if status in {"draft", "pending"}:
        issues.append(
            _issue(
                "payroll_status",
                "PAYROLL_NOT_REVIEWED",
                f"La nómina está en estado {status}.",
                severity="WARNING",
                payroll_id=payroll.id,
            )
        )
    if getattr(payroll, "last_calculated_at", None) is None:
        issues.append(
            _issue(
                "last_calculated_at",
                "CALCULATION_TRACE_MISSING",
                "La nómina no conserva una marca de cálculo estable.",
                severity="WARNING",
                payroll_id=payroll.id,
            )
        )

    component_total = values["company_component_total"]
    stored_total = money(getattr(payroll, "company_total_social_security", 0) or 0)
    if stored_total and abs(stored_total - component_total) > Decimal("0.01"):
        issues.append(
            _issue(
                "company_total_social_security",
                "COMPANY_QUOTA_MISMATCH",
                "El total empresarial no coincide con la suma de sus componentes.",
                severity="WARNING",
                payroll_id=payroll.id,
            )
        )
    return issues


def build_line_values(payroll: Payroll) -> dict[str, Decimal]:
    employee_total = _component_total(
        payroll.employee_common_contingencies,
        payroll.employee_unemployment,
        payroll.employee_training,
        payroll.employee_mei,
    )
    company_component_total = _component_total(
        payroll.company_common_contingencies,
        payroll.company_unemployment,
        payroll.company_fogasa,
        payroll.company_training,
        payroll.company_at_ep,
        payroll.company_mei,
    )
    company_total = money(payroll.company_total_social_security or company_component_total)
    bonuses = _sum_items_by_markers(payroll, BONUS_MARKERS)
    reductions = _sum_items_by_markers(payroll, REDUCTION_MARKERS)
    return {
        "common_contingencies_base": money(payroll.common_contingencies_base or 0),
        "professional_contingencies_base": money(payroll.professional_contingencies_base or 0),
        "unemployment_training_fogasa_base": money(payroll.unemployment_training_fogasa_base or 0),
        "overtime_base": _sum_items_by_markers(payroll, OVERTIME_MARKERS),
        "employee_common_contingencies": money(payroll.employee_common_contingencies or 0),
        "employee_unemployment": money(payroll.employee_unemployment or 0),
        "employee_training": money(payroll.employee_training or 0),
        "employee_mei": money(payroll.employee_mei or 0),
        "employee_total": employee_total,
        "company_common_contingencies": money(payroll.company_common_contingencies or 0),
        "company_unemployment": money(payroll.company_unemployment or 0),
        "company_fogasa": money(payroll.company_fogasa or 0),
        "company_training": money(payroll.company_training or 0),
        "company_at_ep": money(payroll.company_at_ep or 0),
        "company_mei": money(payroll.company_mei or 0),
        "company_component_total": company_component_total,
        "company_total": company_total,
        "bonuses": bonuses,
        "reductions": reductions,
        "total_due": money(employee_total + company_total - bonuses - reductions),
    }


def _create_line(settlement: SocialSecuritySettlement, payroll: Payroll, selected_ccc: str) -> SocialSecuritySettlementLine:
    employee = payroll.employee
    contract = payroll.contract
    values = build_line_values(payroll)
    issues = _validate_line(payroll, selected_ccc, values)
    return SocialSecuritySettlementLine(
        settlement=settlement,
        payroll_id=payroll.id,
        employee_id=payroll.employee_id,
        contract_id=payroll.contract_id,
        center_id=payroll.center_id,
        employee_code=getattr(employee, "employee_code", None),
        employee_name=getattr(payroll, "employee_name", None) or f"Trabajador {payroll.employee_id}",
        document=getattr(employee, "dni", None),
        naf=normalize_ccc(getattr(employee, "naf", None)),
        contribution_group=getattr(contract, "contribution_group", None),
        payroll_status=payroll.status,
        contribution_days=int(payroll.contribution_days or 0),
        common_contingencies_base=values["common_contingencies_base"],
        professional_contingencies_base=values["professional_contingencies_base"],
        unemployment_training_fogasa_base=values["unemployment_training_fogasa_base"],
        overtime_base=values["overtime_base"],
        employee_common_contingencies=values["employee_common_contingencies"],
        employee_unemployment=values["employee_unemployment"],
        employee_training=values["employee_training"],
        employee_mei=values["employee_mei"],
        employee_total=values["employee_total"],
        company_common_contingencies=values["company_common_contingencies"],
        company_unemployment=values["company_unemployment"],
        company_fogasa=values["company_fogasa"],
        company_training=values["company_training"],
        company_at_ep=values["company_at_ep"],
        company_mei=values["company_mei"],
        company_total=values["company_total"],
        bonuses=values["bonuses"],
        reductions=values["reductions"],
        total_due=values["total_due"],
        validation_errors=_json_dump(issues),
    )


def _sum_line_field(lines: list[SocialSecuritySettlementLine], field: str) -> Decimal:
    return money(sum((money(getattr(line, field) or 0) for line in lines), Decimal("0.00")))


def _apply_totals(settlement: SocialSecuritySettlement) -> None:
    lines = list(settlement.lines)
    settlement.worker_count = len(lines)
    settlement.contribution_days = sum(int(line.contribution_days or 0) for line in lines)
    for field in (
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
    ):
        setattr(settlement, field, _sum_line_field(lines, field))


def prepare_social_security_settlement(
    db: Session,
    payload: SocialSecuritySettlementPrepareRequest,
) -> SocialSecuritySettlement:
    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company:
        raise SocialSecuritySettlementDomainError("Empresa no encontrada")

    valid_cccs = {option["ccc_id"] for option in list_company_ccc_options(db, company.id)}
    if payload.ccc_id not in valid_cccs:
        raise SocialSecuritySettlementDomainError("El CCC no pertenece a la empresa ni a sus centros de trabajo")

    settlement = db.query(SocialSecuritySettlement).filter(
        SocialSecuritySettlement.company_id == payload.company_id,
        SocialSecuritySettlement.ccc_id == payload.ccc_id,
        SocialSecuritySettlement.period_year == payload.period_year,
        SocialSecuritySettlement.period_month == payload.period_month,
    ).first()
    if settlement and settlement.status not in EDITABLE_SETTLEMENT_STATUSES:
        raise SocialSecuritySettlementDomainError(
            f"La liquidación no puede recalcularse en estado {settlement.status}."
        )
    if not settlement:
        settlement = SocialSecuritySettlement(
            company_id=payload.company_id,
            ccc_id=payload.ccc_id,
            period_year=payload.period_year,
            period_month=payload.period_month,
            created_by=payload.created_by,
        )
        db.add(settlement)
        db.flush()
    else:
        settlement.lines.clear()
        db.flush()

    payrolls = db.query(Payroll).options(
        joinedload(Payroll.employee),
        joinedload(Payroll.contract),
        joinedload(Payroll.company),
        joinedload(Payroll.work_center),
        joinedload(Payroll.items).joinedload(PayrollItem.concept),
    ).filter(
        Payroll.company_id == payload.company_id,
        Payroll.period_year == payload.period_year,
        Payroll.period_month == payload.period_month,
        Payroll.status != "cancelled",
    ).order_by(Payroll.employee_id, Payroll.id).all()

    selected_payrolls = [payroll for payroll in payrolls if resolve_payroll_ccc(payroll) == payload.ccc_id]
    settlement_issues: list[dict[str, Any]] = []
    missing_ccc_count = sum(1 for payroll in payrolls if resolve_payroll_ccc(payroll) is None)
    if missing_ccc_count:
        settlement_issues.append(
            _issue(
                "ccc_id",
                "PAYROLLS_WITHOUT_CCC",
                f"Hay {missing_ccc_count} nómina(s) del periodo sin CCC resoluble.",
                severity="WARNING",
            )
        )
    if not selected_payrolls:
        settlement_issues.append(
            _issue(
                "payrolls",
                "NO_PAYROLLS_FOR_CCC",
                "No hay nóminas mensuales para la empresa, CCC y periodo seleccionados.",
            )
        )

    for payroll in selected_payrolls:
        settlement.lines.append(_create_line(settlement, payroll, payload.ccc_id))

    _apply_totals(settlement)
    all_line_issues = [
        issue
        for line in settlement.lines
        for issue in _json_load(line.validation_errors, [])
    ]
    settlement.validation_errors = _json_dump(settlement_issues)
    settlement.status = (
        SocialSecuritySettlementStatus.VALIDATION_ERROR.value
        if _has_blocking_errors(settlement_issues + all_line_issues)
        else SocialSecuritySettlementStatus.READY.value
    )
    settlement.prepared_at = datetime.utcnow()
    settlement.confirmed_at = None
    settlement.generated_at = None
    settlement.communication_file_id = None
    if payload.created_by is not None:
        settlement.created_by = payload.created_by

    db.commit()
    db.refresh(settlement)
    return settlement


def get_social_security_settlement(db: Session, settlement_id: int) -> SocialSecuritySettlement | None:
    return db.query(SocialSecuritySettlement).options(
        joinedload(SocialSecuritySettlement.lines)
    ).filter(SocialSecuritySettlement.id == settlement_id).first()


def list_social_security_settlements(
    db: Session,
    *,
    company_id: int | None = None,
    ccc_id: str | None = None,
    period_year: int | None = None,
    period_month: int | None = None,
    status: SocialSecuritySettlementStatus | None = None,
) -> list[SocialSecuritySettlement]:
    query = db.query(SocialSecuritySettlement).options(joinedload(SocialSecuritySettlement.lines))
    if company_id is not None:
        query = query.filter(SocialSecuritySettlement.company_id == company_id)
    if ccc_id is not None:
        query = query.filter(SocialSecuritySettlement.ccc_id == normalize_ccc(ccc_id))
    if period_year is not None:
        query = query.filter(SocialSecuritySettlement.period_year == period_year)
    if period_month is not None:
        query = query.filter(SocialSecuritySettlement.period_month == period_month)
    if status is not None:
        query = query.filter(SocialSecuritySettlement.status == status.value)
    return query.order_by(
        SocialSecuritySettlement.period_year.desc(),
        SocialSecuritySettlement.period_month.desc(),
        SocialSecuritySettlement.ccc_id,
    ).all()


def confirm_social_security_settlement(
    db: Session,
    settlement: SocialSecuritySettlement,
) -> SocialSecuritySettlement:
    if settlement.status != SocialSecuritySettlementStatus.READY.value:
        raise SocialSecuritySettlementDomainError(
            f"Solo puede confirmarse una liquidación READY; estado actual: {settlement.status}."
        )
    all_issues = _json_load(settlement.validation_errors, []) + [
        issue
        for line in settlement.lines
        for issue in _json_load(line.validation_errors, [])
    ]
    if _has_blocking_errors(all_issues):
        raise SocialSecuritySettlementDomainError("La liquidación contiene errores que impiden confirmarla.")
    settlement.status = SocialSecuritySettlementStatus.CONFIRMED.value
    settlement.confirmed_at = datetime.utcnow()
    db.commit()
    db.refresh(settlement)
    return settlement


def build_simulated_settlement_content(settlement: SocialSecuritySettlement) -> str:
    payload = {
        "format": "AULANOMINA_SOCIAL_SECURITY_SETTLEMENT_V1",
        "settlement_id": settlement.id,
        "company_id": settlement.company_id,
        "ccc": settlement.ccc_id,
        "period": f"{settlement.period_year:04d}-{settlement.period_month:02d}",
        "totals": {
            "worker_count": settlement.worker_count,
            "contribution_days": settlement.contribution_days,
            "common_contingencies_base": str(money(settlement.common_contingencies_base)),
            "professional_contingencies_base": str(money(settlement.professional_contingencies_base)),
            "unemployment_training_fogasa_base": str(money(settlement.unemployment_training_fogasa_base)),
            "overtime_base": str(money(settlement.overtime_base)),
            "employee_total": str(money(settlement.employee_total)),
            "company_total": str(money(settlement.company_total)),
            "bonuses": str(money(settlement.bonuses)),
            "reductions": str(money(settlement.reductions)),
            "total_due": str(money(settlement.total_due)),
        },
        "workers": [
            {
                "payroll_id": line.payroll_id,
                "employee_id": line.employee_id,
                "employee_code": line.employee_code,
                "employee_name": line.employee_name,
                "document": line.document,
                "naf": line.naf,
                "contribution_group": line.contribution_group,
                "contribution_days": line.contribution_days,
                "bases": {
                    "common": str(money(line.common_contingencies_base)),
                    "professional": str(money(line.professional_contingencies_base)),
                    "unemployment_training_fogasa": str(money(line.unemployment_training_fogasa_base)),
                    "overtime": str(money(line.overtime_base)),
                },
                "quotas": {
                    "employee": str(money(line.employee_total)),
                    "company": str(money(line.company_total)),
                    "bonuses": str(money(line.bonuses)),
                    "reductions": str(money(line.reductions)),
                    "total_due": str(money(line.total_due)),
                },
            }
            for line in settlement.lines
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)


def generate_social_security_settlement_file(
    db: Session,
    settlement: SocialSecuritySettlement,
    *,
    created_by: int | None = None,
) -> SocialSecuritySettlement:
    if settlement.status != SocialSecuritySettlementStatus.CONFIRMED.value:
        raise SocialSecuritySettlementDomainError(
            f"Solo puede generarse una liquidación CONFIRMED; estado actual: {settlement.status}."
        )
    if settlement.communication_file_id:
        raise SocialSecuritySettlementDomainError("La liquidación ya tiene un fichero generado.")

    period = f"{settlement.period_year:04d}-{settlement.period_month:02d}"
    filename = f"SS_{settlement.company_id}_{settlement.ccc_id}_{settlement.period_year:04d}{settlement.period_month:02d}.json"
    communication = create_communication_file(
        db,
        CommunicationFileCreate(
            company_id=settlement.company_id,
            ccc_id=settlement.ccc_id,
            period=period,
            file_type=CommunicationFileType.SOCIAL_SECURITY_SETTLEMENT,
            metadata={
                "settlement_id": settlement.id,
                "format": "AULANOMINA_SOCIAL_SECURITY_SETTLEMENT_V1",
                "worker_count": settlement.worker_count,
                "total_due": str(money(settlement.total_due)),
            },
            created_by=created_by,
        ),
    )
    communication = validate_communication_file(db, communication, created_by=created_by)
    if communication.status != CommunicationFileStatus.READY.value:
        raise SocialSecuritySettlementDomainError(
            "El fichero común no ha superado su validación antes de generarse."
        )
    communication = generate_communication_file(
        db,
        communication,
        CommunicationFileGenerateRequest(
            content=build_simulated_settlement_content(settlement),
            original_filename=filename,
            metadata={"settlement_status": SocialSecuritySettlementStatus.GENERATED.value},
            created_by=created_by,
        ),
    )

    settlement.communication_file_id = communication.id
    settlement.status = SocialSecuritySettlementStatus.GENERATED.value
    settlement.generated_at = datetime.utcnow()
    db.commit()
    db.refresh(settlement)
    return settlement


def serialize_social_security_settlement_line(line: SocialSecuritySettlementLine) -> dict[str, Any]:
    return {
        "id": line.id,
        "payroll_id": line.payroll_id,
        "employee_id": line.employee_id,
        "contract_id": line.contract_id,
        "center_id": line.center_id,
        "employee_code": line.employee_code,
        "employee_name": line.employee_name,
        "document": line.document,
        "naf": line.naf,
        "contribution_group": line.contribution_group,
        "payroll_status": line.payroll_status,
        "contribution_days": line.contribution_days,
        "common_contingencies_base": line.common_contingencies_base,
        "professional_contingencies_base": line.professional_contingencies_base,
        "unemployment_training_fogasa_base": line.unemployment_training_fogasa_base,
        "overtime_base": line.overtime_base,
        "employee_common_contingencies": line.employee_common_contingencies,
        "employee_unemployment": line.employee_unemployment,
        "employee_training": line.employee_training,
        "employee_mei": line.employee_mei,
        "employee_total": line.employee_total,
        "company_common_contingencies": line.company_common_contingencies,
        "company_unemployment": line.company_unemployment,
        "company_fogasa": line.company_fogasa,
        "company_training": line.company_training,
        "company_at_ep": line.company_at_ep,
        "company_mei": line.company_mei,
        "company_total": line.company_total,
        "bonuses": line.bonuses,
        "reductions": line.reductions,
        "total_due": line.total_due,
        "validation_errors": _json_load(line.validation_errors, []),
    }


def serialize_social_security_settlement(settlement: SocialSecuritySettlement) -> dict[str, Any]:
    return {
        "id": settlement.id,
        "company_id": settlement.company_id,
        "ccc_id": settlement.ccc_id,
        "period_year": settlement.period_year,
        "period_month": settlement.period_month,
        "status": settlement.status,
        "worker_count": settlement.worker_count,
        "contribution_days": settlement.contribution_days,
        "common_contingencies_base": settlement.common_contingencies_base,
        "professional_contingencies_base": settlement.professional_contingencies_base,
        "unemployment_training_fogasa_base": settlement.unemployment_training_fogasa_base,
        "overtime_base": settlement.overtime_base,
        "employee_common_contingencies": settlement.employee_common_contingencies,
        "employee_unemployment": settlement.employee_unemployment,
        "employee_training": settlement.employee_training,
        "employee_mei": settlement.employee_mei,
        "employee_total": settlement.employee_total,
        "company_common_contingencies": settlement.company_common_contingencies,
        "company_unemployment": settlement.company_unemployment,
        "company_fogasa": settlement.company_fogasa,
        "company_training": settlement.company_training,
        "company_at_ep": settlement.company_at_ep,
        "company_mei": settlement.company_mei,
        "company_total": settlement.company_total,
        "bonuses": settlement.bonuses,
        "reductions": settlement.reductions,
        "total_due": settlement.total_due,
        "validation_errors": _json_load(settlement.validation_errors, []),
        "communication_file_id": settlement.communication_file_id,
        "prepared_at": settlement.prepared_at,
        "confirmed_at": settlement.confirmed_at,
        "generated_at": settlement.generated_at,
        "created_by": settlement.created_by,
        "created_at": settlement.created_at,
        "updated_at": settlement.updated_at,
        "lines": [serialize_social_security_settlement_line(line) for line in settlement.lines],
    }
