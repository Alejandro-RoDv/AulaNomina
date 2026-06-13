from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app.models.agreement_extra_pay import AgreementExtraPay, AgreementExtraPayConcept
from app.models.agreement_parameterization import AgreementSalaryConcept
from app.models.collective_agreement import SalaryTable, SalaryTableRow
from app.schemas.salary_table_revision import SalaryTableRevisionRequest


MONEY_QUANT = Decimal("0.01")


def _money(value, factor: Decimal | None = None):
    if value is None:
        return None
    amount = Decimal(str(value))
    if factor is not None:
        amount *= factor
    return amount.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def _row_has_amounts(row: SalaryTableRow) -> bool:
    return any(
        value is not None
        for value in (
            row.base_salary,
            row.seniority_amount,
            row.specific_complement,
            row.agreement_plus,
            row.total_amount,
        )
    )


def duplicate_salary_table_revision(
    db: Session,
    source_table_id: int,
    payload: SalaryTableRevisionRequest,
) -> dict:
    source = (
        db.query(SalaryTable)
        .options(selectinload(SalaryTable.rows))
        .filter(SalaryTable.id == source_table_id)
        .first()
    )
    if not source:
        raise HTTPException(status_code=404, detail="Tabla salarial de origen no encontrada")

    duplicate = (
        db.query(SalaryTable)
        .filter(
            SalaryTable.collective_agreement_id == source.collective_agreement_id,
            SalaryTable.year == payload.year,
            SalaryTable.name == payload.name,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Ya existe una tabla salarial con ese nombre y ejercicio")

    factor = Decimal("1.00") + (payload.increment_percentage / Decimal("100.00"))
    copied_rows = 0
    copied_concepts = 0
    copied_extra_pays = 0
    copied_extra_pay_lines = 0
    increased_rows = 0
    increased_concepts = 0
    warnings: list[str] = []

    try:
        target = SalaryTable(
            collective_agreement_id=source.collective_agreement_id,
            name=payload.name,
            year=payload.year,
            effective_from=payload.effective_from,
            effective_to=payload.effective_to,
            number_of_payments=source.number_of_payments,
            amount_type=source.amount_type,
            status=payload.status,
            notes=payload.notes or f"Revisión creada desde la tabla {source.name} ({source.year or 'sin ejercicio'}).",
        )
        db.add(target)
        db.flush()

        if payload.copy_rows:
            if not source.rows:
                warnings.append("La tabla de origen no contiene filas salariales.")
            for row in source.rows or []:
                db.add(
                    SalaryTableRow(
                        salary_table_id=target.id,
                        professional_category_id=row.professional_category_id,
                        professional_group_id=row.professional_group_id,
                        category_name=row.category_name,
                        group_name=row.group_name,
                        level=row.level,
                        base_salary=_money(row.base_salary, factor),
                        seniority_amount=_money(row.seniority_amount, factor),
                        specific_complement=_money(row.specific_complement, factor),
                        agreement_plus=_money(row.agreement_plus, factor),
                        total_amount=_money(row.total_amount, factor),
                        amount_unit=row.amount_unit,
                        notes=row.notes,
                    )
                )
                copied_rows += 1
                if payload.increment_percentage != 0 and _row_has_amounts(row):
                    increased_rows += 1
        else:
            warnings.append("La tabla se ha creado sin copiar filas salariales.")

        source_concepts = (
            db.query(AgreementSalaryConcept)
            .filter(AgreementSalaryConcept.salary_table_id == source.id)
            .order_by(AgreementSalaryConcept.id)
            .all()
        )
        if payload.copy_concepts:
            if not source_concepts:
                warnings.append("La tabla de origen no contiene conceptos salariales versionados.")
            for concept in source_concepts:
                should_increase = concept.character == "salarial" or (
                    concept.character == "no_salarial" and payload.increase_non_salary
                )
                amount = _money(concept.amount, factor if should_increase else None)
                db.add(
                    AgreementSalaryConcept(
                        collective_agreement_id=source.collective_agreement_id,
                        salary_table_id=target.id,
                        professional_category_id=concept.professional_category_id,
                        concept_catalog_id=concept.concept_catalog_id,
                        character=concept.character,
                        name=concept.name,
                        scope=concept.scope,
                        amount=amount,
                        payment_type=concept.payment_type,
                        calculation_type=concept.calculation_type,
                        contributes=concept.contributes,
                        taxable=concept.taxable,
                        cra_code=concept.cra_code,
                        is_active=concept.is_active,
                        notes=concept.notes,
                    )
                )
                copied_concepts += 1
                if should_increase and concept.amount is not None and payload.increment_percentage != 0:
                    increased_concepts += 1
        elif source_concepts:
            warnings.append("La tabla se ha creado sin copiar conceptos salariales versionados.")

        source_extra_pays = (
            db.query(AgreementExtraPay)
            .options(selectinload(AgreementExtraPay.concept_lines))
            .filter(AgreementExtraPay.salary_table_id == source.id)
            .order_by(AgreementExtraPay.id)
            .all()
        )
        if payload.copy_extra_pays:
            if not source_extra_pays:
                warnings.append("La tabla de origen no contiene pagas extraordinarias versionadas.")
            for extra_pay in source_extra_pays:
                target_extra_pay = AgreementExtraPay(
                    collective_agreement_id=source.collective_agreement_id,
                    salary_table_id=target.id,
                    code=extra_pay.code,
                    name=extra_pay.name,
                    payment_month=extra_pay.payment_month,
                    accrual_start_month=extra_pay.accrual_start_month,
                    accrual_end_month=extra_pay.accrual_end_month,
                    accrual_months=extra_pay.accrual_months,
                    proration_allowed=extra_pay.proration_allowed,
                    proration_default=extra_pay.proration_default,
                    is_active=extra_pay.is_active,
                    notes=extra_pay.notes,
                )
                db.add(target_extra_pay)
                db.flush()
                copied_extra_pays += 1

                for line in extra_pay.concept_lines or []:
                    db.add(
                        AgreementExtraPayConcept(
                            extra_pay_id=target_extra_pay.id,
                            professional_category_id=line.professional_category_id,
                            concept_key=line.concept_key,
                            concept_name=line.concept_name,
                            calculation_mode=line.calculation_mode,
                            percentage=line.percentage,
                            fixed_amount=line.fixed_amount,
                            is_active=line.is_active,
                            display_order=line.display_order,
                            notes=line.notes,
                        )
                    )
                    copied_extra_pay_lines += 1
        elif source_extra_pays:
            warnings.append("La tabla se ha creado sin copiar la configuración de pagas extraordinarias.")

        if payload.mark_source_historical:
            source.status = "historical"

        db.commit()
    except Exception:
        db.rollback()
        raise

    target = (
        db.query(SalaryTable)
        .options(selectinload(SalaryTable.rows))
        .filter(SalaryTable.id == target.id)
        .first()
    )

    return {
        "source_table_id": source.id,
        "source_status": source.status,
        "salary_table": target,
        "copied_rows": copied_rows,
        "copied_concepts": copied_concepts,
        "copied_extra_pays": copied_extra_pays,
        "copied_extra_pay_lines": copied_extra_pay_lines,
        "increased_rows": increased_rows,
        "increased_concepts": increased_concepts,
        "increment_percentage": payload.increment_percentage,
        "warnings": warnings,
    }
