from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy.orm import joinedload

from app.models.incident import Incident
from app.models.incident_advanced import IncidentRegularization
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.services.incident_payroll_processor import period_incidents
from app.services.incident_segmenter import build_incident_segments
from app.services.incident_service import incident_snapshot, register_incident_audit
from app.services.payroll_amounts import calculate_social_security_amounts_from_bases


MONEY = Decimal("0.01")


def money(value):
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def next_period(month: int, year: int):
    if month >= 12:
        return 1, year + 1
    return month + 1, year


def incident_result_amount(result: dict, incident_id: int):
    value = Decimal("0")
    for segment in result.get("segments", []):
        if segment.get("incident_id") != incident_id:
            continue
        value += Decimal(str(segment.get("benefit_amount") or 0))
        value += Decimal(str(segment.get("complement_amount") or 0))
        value -= Decimal(str(segment.get("deduction_amount") or 0))
        if str(segment.get("segment_type") or "").startswith("overtime"):
            value += Decimal(str(segment.get("salary_amount") or 0))
    return money(value)


def ensure_regularization_concept(db, positive: bool):
    code = "INC_REGULARIZATION_EARNING" if positive else "INC_REGULARIZATION_DEDUCTION"
    concept = db.query(PayrollConcept).filter(PayrollConcept.code == code).first()
    if concept:
        return concept
    concept = PayrollConcept(
        code=code,
        name="Regularización automática de incidencia" if positive else "Deducción por regularización de incidencia",
        category="REGULARIZACION_INCIDENCIA",
        concept_type="DEVENGO" if positive else "DEDUCCION",
        salary_nature="SALARIAL",
        source_type="SYSTEM",
        calculation_type="INCIDENT_REGULARIZATION",
        applies_workday_percentage=False,
        is_system=True,
        is_taxable=True,
        is_contribution_base=True,
        is_active=True,
        display_order=760,
        notes="Concepto generado al corregir una incidencia procesada en una nómina cerrada.",
    )
    db.add(concept)
    db.flush()
    return concept


def find_or_create_target_payroll(db, source: Payroll, target_month: int, target_year: int):
    payroll = db.query(Payroll).filter(
        Payroll.contract_id == source.contract_id,
        Payroll.period_month == target_month,
        Payroll.period_year == target_year,
        Payroll.status.in_(["draft", "pending", "calculated", "reviewed"]),
    ).first()
    if payroll:
        return payroll

    payroll = db.query(Payroll).filter(
        Payroll.contract_id == source.contract_id,
        Payroll.period_month == 15,
        Payroll.period_year == target_year,
        Payroll.status.in_(["draft", "pending", "calculated", "reviewed"]),
    ).first()
    if payroll:
        return payroll

    payroll = Payroll(
        employee_id=source.employee_id,
        contract_id=source.contract_id,
        company_id=source.company_id,
        center_id=source.center_id,
        period_month=15,
        period_year=target_year,
        base_salary=0,
        worked_base_salary=0,
        temporary_disability_benefit=0,
        company_disability_complement=0,
        salary_supplements=0,
        seniority_amount=0,
        variable_incentives=0,
        extra_pay_proration=0,
        gross_salary=0,
        contribution_days=0,
        worked_days=0,
        incident_days=0,
        it_days=0,
        non_contribution_days=0,
        irpf_mode=source.irpf_mode,
        irpf_percentage=source.irpf_percentage,
        suggested_irpf_percentage=source.suggested_irpf_percentage,
        status="pending",
    )
    db.add(payroll)
    db.flush()
    return payroll


def recalculate_target(payroll: Payroll):
    items = [item for item in payroll.items if item.concept]
    earnings = sum((Decimal(str(item.amount or 0)) for item in items if item.concept.concept_type == "DEVENGO"), Decimal("0"))
    deductions = sum((Decimal(str(item.amount or 0)) for item in items if item.concept.concept_type == "DEDUCCION"), Decimal("0"))
    gross = money(earnings)
    contribution_base = money(sum((Decimal(str(item.amount or 0)) for item in items if item.concept.is_contribution_base and item.concept.concept_type == "DEVENGO"), Decimal("0")))
    taxable = money(sum((Decimal(str(item.amount or 0)) for item in items if item.concept.is_taxable and item.concept.concept_type == "DEVENGO"), Decimal("0")))
    amounts = calculate_social_security_amounts_from_bases(
        gross_salary=gross,
        common_contingencies_base=contribution_base,
        professional_contingencies_base=contribution_base,
        unemployment_training_fogasa_base=contribution_base,
        irpf_base=taxable,
        irpf_percentage=Decimal(str(payroll.irpf_percentage or 0)),
    )
    for key, value in amounts.items():
        if hasattr(payroll, key):
            setattr(payroll, key, value)
    payroll.total_deductions = money(Decimal(str(payroll.total_deductions or 0)) + deductions)
    payroll.net_salary = money(gross - payroll.total_deductions)
    payroll.status = "calculated"


def generate_incident_regularization(db, incident_id: int, actor: str | None = None):
    incident = (
        db.query(Incident)
        .options(joinedload(Incident.contract), joinedload(Incident.detail))
        .filter(Incident.id == incident_id)
        .first()
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    source = incident.processed_payroll
    if not source or source.status != "closed":
        raise HTTPException(status_code=400, detail="La incidencia no procede de una nómina cerrada")

    incidents = period_incidents(db, source)
    result = build_incident_segments(db, source.id, incident.contract, source.period_month, source.period_year, incidents)
    recalculated = incident_result_amount(result, incident.id)
    previous = money(incident.generated_amount)
    difference = money(recalculated - previous)
    target_month, target_year = next_period(source.period_month, source.period_year)
    source_key = f"incident-regularization:{incident.id}:source:{source.id}:version:{incident.version}"

    existing = db.query(IncidentRegularization).filter(IncidentRegularization.source_key == source_key).first()
    if existing:
        return existing

    target = find_or_create_target_payroll(db, source, target_month, target_year)
    concept = ensure_regularization_concept(db, difference >= 0)
    item_key = f"{source_key}:item"
    item = db.query(PayrollItem).filter(PayrollItem.source_key == item_key).first()
    if item is None:
        item = PayrollItem(
            payroll_id=target.id,
            concept_id=concept.id,
            description=f"Regularización incidencia {incident.id} · nómina origen {source.period_month:02d}/{source.period_year}",
            quantity=1,
            unit_price=abs(difference),
            amount=abs(difference),
            display_order=760,
            notes="Generada automáticamente; la nómina cerrada de origen permanece inalterada.",
            source_type="incident_regularization",
            source_id=incident.id,
            source_key=item_key,
            is_automatic=True,
            calculation_trace={
                "source_payroll_id": source.id,
                "previous_amount": str(previous),
                "recalculated_amount": str(recalculated),
                "difference": str(difference),
            },
        )
        db.add(item)
        db.flush()

    regularization = IncidentRegularization(
        incident_id=incident.id,
        source_payroll_id=source.id,
        target_payroll_id=target.id,
        target_period_month=target_month,
        target_period_year=target_year,
        status="generated",
        gross_difference=difference,
        contribution_difference=difference,
        taxable_difference=difference,
        source_key=source_key,
        calculation_trace={
            "source_period": f"{source.period_month:02d}/{source.period_year}",
            "target_period": f"{target_month:02d}/{target_year}",
            "previous_amount": str(previous),
            "recalculated_amount": str(recalculated),
        },
        created_by=actor,
        processed_at=datetime.utcnow(),
    )
    db.add(regularization)
    db.flush()
    db.refresh(target)
    recalculate_target(target)

    previous_snapshot = incident_snapshot(incident)
    incident.detail.requires_recalculation = False
    incident.detail.requires_regularization = False
    incident.detail.updated_by = actor
    incident.detail.updated_at = datetime.utcnow()
    register_incident_audit(
        db,
        incident,
        action="regularization_generated",
        actor=actor,
        reason=f"Regularización generada en nómina {target.id}",
        previous_values=previous_snapshot,
        new_values={**incident_snapshot(incident), "regularization_id": regularization.id, "difference": str(difference)},
    )
    db.commit()
    db.refresh(regularization)
    return regularization
