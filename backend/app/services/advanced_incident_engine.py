from decimal import Decimal

from sqlalchemy.orm import joinedload

from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.services.incident_agreement_adjustments import apply_agreement_adjustments
from app.services.incident_regulatory_base import resolve_advanced_regulatory_daily_base
from app.services.incident_salary_concepts import sync_segmented_contract_concepts
from app.services.payroll_amounts import calculate_social_security_amounts_from_bases


def recalculate_after_concept_segmentation(db, payroll, concept_total):
    payroll.salary_supplements = concept_total
    overtime = (
        db.query(PayrollItem)
        .join(PayrollConcept, PayrollConcept.id == PayrollItem.concept_id)
        .filter(
            PayrollItem.payroll_id == payroll.id,
            PayrollConcept.category == "HORAS_EXTRA",
            PayrollItem.source_type == "incident_engine",
        )
        .all()
    )
    overtime_total = sum((Decimal(str(item.amount or 0)) for item in overtime), Decimal("0"))
    gross = sum(
        (
            Decimal(str(payroll.worked_base_salary or 0)),
            Decimal(str(payroll.temporary_disability_benefit or 0)),
            Decimal(str(payroll.company_disability_complement or 0)),
            Decimal(str(payroll.salary_supplements or 0)),
            Decimal(str(payroll.seniority_amount or 0)),
            Decimal(str(payroll.variable_incentives or 0)),
            Decimal(str(payroll.extra_pay_proration or 0)),
            overtime_total,
        ),
        Decimal("0"),
    )
    common_base = Decimal(str(payroll.common_contingencies_base or gross))
    professional_base = Decimal(str(payroll.professional_contingencies_base or gross))
    unemployment_base = Decimal(str(payroll.unemployment_training_fogasa_base or professional_base))
    amounts = calculate_social_security_amounts_from_bases(
        gross_salary=gross,
        common_contingencies_base=common_base,
        professional_contingencies_base=professional_base,
        unemployment_training_fogasa_base=unemployment_base,
        irpf_base=gross,
        irpf_percentage=Decimal(str(payroll.irpf_percentage or 0)),
    )
    for key, value in amounts.items():
        if hasattr(payroll, key):
            setattr(payroll, key, value)


def install_advanced_incident_engine():
    import app.services.incident_actions as actions
    import app.services.incident_payroll_orchestrator as orchestrator
    import app.services.incident_segmenter as segmenter

    if getattr(segmenter, "_advanced_incident_engine_installed", False):
        return

    original_build = segmenter.build_incident_segments
    original_process = orchestrator.process_payroll_incidents
    original_recalculation = actions.request_incident_recalculation

    def advanced_build(db, payroll_id, contract, period_month, period_year, incidents):
        result = original_build(db, payroll_id, contract, period_month, period_year, incidents)
        return apply_agreement_adjustments(db, contract, incidents, result)

    def advanced_process(db, payroll_id, actor=None):
        result = original_process(db, payroll_id, actor=actor)
        payroll = (
            db.query(Payroll)
            .options(joinedload(Payroll.segments), joinedload(Payroll.contract))
            .filter(Payroll.id == payroll_id)
            .first()
        )
        if payroll and payroll.status != "closed":
            concept_result = sync_segmented_contract_concepts(db, payroll)
            recalculate_after_concept_segmentation(db, payroll, concept_result["total"])
            db.commit()
            result["segmented_salary_concepts"] = concept_result
        return result

    def advanced_recalculation(db, incident_id, request):
        incident = original_recalculation(db, incident_id, request)
        if incident.requires_regularization:
            from app.crud.incident import get_incident
            from app.services.incident_regularization import generate_incident_regularization

            generate_incident_regularization(db, incident.id, actor=request.actor)
            return get_incident(db, incident.id)
        return incident

    segmenter.resolve_regulatory_daily_base = resolve_advanced_regulatory_daily_base
    segmenter.build_incident_segments = advanced_build
    orchestrator.build_incident_segments = advanced_build
    orchestrator.process_payroll_incidents = advanced_process
    actions.request_incident_recalculation = advanced_recalculation
    segmenter._advanced_incident_engine_installed = True
