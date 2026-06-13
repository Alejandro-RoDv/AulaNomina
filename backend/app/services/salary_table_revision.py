from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

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
                if payload.increment_percentage != 0:
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
        "increased_rows": increased_rows,
        "increased_concepts": increased_concepts,
        "increment_percentage": payload.increment_percentage,
        "warnings": warnings,
    }
