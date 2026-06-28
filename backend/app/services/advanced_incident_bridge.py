from __future__ import annotations

from decimal import Decimal


def install_advanced_incident_calculation() -> None:
    import app.services.incident_segmenter as segmenter

    if getattr(segmenter, "_advanced_incident_calculation_installed", False):
        return

    from app.services.advanced_incident_calculation import (
        advanced_regulatory_daily_base,
        resolve_agreement_it_target,
    )
    from app.services.incident_rule_catalog import normalized_process_type

    original_day_record = segmenter._day_record

    def regulatory_base_adapter(db, contract, incident, configuration, fallback_daily_salary):
        daily, source, warnings, trace = advanced_regulatory_daily_base(
            db,
            contract,
            incident,
            configuration,
            fallback_daily_salary,
        )
        incident_details = incident.details or {}
        incident_details.setdefault("advanced_regulatory_base_trace", trace)
        return daily, source, warnings

    def day_record_with_agreement_complement(
        db,
        contract,
        current,
        period_start,
        period_end,
        incident,
        day_weight,
        daily_salary,
    ):
        record, warnings = original_day_record(
            db,
            contract,
            current,
            period_start,
            period_end,
            incident,
            day_weight,
            daily_salary,
        )
        if incident is None or record.get("process_day") is None:
            return record, warnings

        target, agreement_trace = resolve_agreement_it_target(
            db,
            contract,
            incident,
            current,
            int(record["process_day"]),
            normalized_process_type(incident),
        )
        manual_target = Decimal(
            str((incident.details or {}).get("company_complement_target_percentage", 0))
        ) / Decimal("100")
        effective_target = target if target is not None else manual_target
        if effective_target <= 0:
            advanced_trace = (incident.details or {}).get("advanced_regulatory_base_trace")
            if advanced_trace:
                record["trace"]["advanced_regulatory_base"] = advanced_trace
            return record, warnings

        benefit_percentage = Decimal(str(record.get("benefit_percentage") or 0))
        salary_percentage = Decimal(str(record.get("salary_percentage") or 0))
        complement_percentage = max(
            Decimal("0"),
            effective_target - benefit_percentage - salary_percentage,
        )
        record["complement_percentage"] = complement_percentage
        record["complement_amount"] = daily_salary * complement_percentage
        record["trace"].update(agreement_trace)
        record["trace"]["effective_target_percentage"] = str(
            (effective_target * Decimal("100")).quantize(Decimal("0.01"))
        )
        advanced_trace = (incident.details or {}).get("advanced_regulatory_base_trace")
        if advanced_trace:
            record["trace"]["advanced_regulatory_base"] = advanced_trace
        return record, warnings

    segmenter.resolve_regulatory_daily_base = regulatory_base_adapter
    segmenter._day_record = day_record_with_agreement_complement
    segmenter._advanced_incident_calculation_installed = True
