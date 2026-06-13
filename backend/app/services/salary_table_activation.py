from collections import defaultdict

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.collective_agreement import SalaryTable, SalaryTableRow
from app.models.contract import Contract
from app.schemas.salary_table_activation import SalaryTableContractMigrationRequest
from app.services.salary_table_concept_migration import (
    apply_contract_concept_actions,
    build_contract_concept_comparison,
)


def _employee_name(contract: Contract):
    if not contract.employee:
        return None
    return " ".join(
        value.strip()
        for value in (
            contract.employee.first_name,
            contract.employee.last_name,
            contract.employee.second_last_name,
        )
        if value and value.strip()
    )


def _load_target_table(db: Session, table_id: int) -> SalaryTable:
    table = (
        db.query(SalaryTable)
        .options(selectinload(SalaryTable.rows))
        .filter(SalaryTable.id == table_id)
        .first()
    )
    if not table:
        raise HTTPException(status_code=404, detail="Tabla salarial no encontrada")
    return table


def _target_rows(table: SalaryTable):
    grouped = defaultdict(list)
    for row in table.rows or []:
        if row.professional_category_id is not None:
            grouped[row.professional_category_id].append(row)

    row_by_category = {}
    duplicate_categories = []
    for category_id, rows in grouped.items():
        ordered = sorted(rows, key=lambda item: item.id)
        row_by_category[category_id] = ordered[0]
        if len(ordered) > 1:
            duplicate_categories.append(category_id)
    return row_by_category, sorted(duplicate_categories)


def _load_agreement_contracts(db: Session, agreement_id: int, active_only: bool):
    query = (
        db.query(Contract)
        .options(
            joinedload(Contract.employee),
            joinedload(Contract.agreement_professional_category),
            joinedload(Contract.salary_table_row).joinedload(SalaryTableRow.salary_table),
        )
        .filter(Contract.collective_agreement_id == agreement_id)
        .order_by(Contract.employee_id, Contract.start_date, Contract.id)
    )
    if active_only:
        query = query.filter(Contract.status == "active")
    return query.all()


def build_salary_table_activation_preview(db: Session, table_id: int, active_only: bool = True) -> dict:
    target = _load_target_table(db, table_id)
    row_by_category, duplicate_categories = _target_rows(target)
    contracts = _load_agreement_contracts(db, target.collective_agreement_id, active_only)
    active_tables = (
        db.query(SalaryTable)
        .filter(
            SalaryTable.collective_agreement_id == target.collective_agreement_id,
            SalaryTable.status == "active",
        )
        .order_by(SalaryTable.year.desc().nullslast(), SalaryTable.id)
        .all()
    )

    items = []
    eligible_count = 0
    already_count = 0
    blocked_count = 0

    for contract in contracts:
        current_row = contract.salary_table_row
        current_table = current_row.salary_table if current_row else None
        target_row = row_by_category.get(contract.professional_category_id)

        if current_table and current_table.id == target.id:
            eligibility = "already_on_target"
            reason = "El contrato ya utiliza esta tabla salarial."
            already_count += 1
        elif not contract.professional_category_id:
            eligibility = "blocked"
            reason = "El contrato no tiene categoría profesional vinculada."
            blocked_count += 1
        elif not target_row:
            eligibility = "blocked"
            reason = "La nueva tabla no contiene una fila para la categoría del contrato."
            blocked_count += 1
        else:
            eligibility = "eligible"
            reason = None
            eligible_count += 1

        concept_comparison = {
            "new_concepts": 0,
            "changed_concepts": 0,
            "reactivated_concepts": 0,
            "unchanged_concepts": 0,
            "obsolete_concepts": 0,
            "preserved_concepts": 0,
            "concept_changes": [],
        }
        if target_row and eligibility in {"eligible", "already_on_target"}:
            resolved = build_contract_concept_comparison(db, contract, target_row)
            concept_comparison = {
                key: resolved[key]
                for key in (
                    "new_concepts",
                    "changed_concepts",
                    "reactivated_concepts",
                    "unchanged_concepts",
                    "obsolete_concepts",
                    "preserved_concepts",
                    "concept_changes",
                )
            }

        category = contract.agreement_professional_category
        items.append(
            {
                "contract_id": contract.id,
                "employee_id": contract.employee_id,
                "employee_code": contract.employee.employee_code if contract.employee else None,
                "employee_name": _employee_name(contract),
                "contract_code": contract.contract_code,
                "contract_status": contract.status,
                "professional_category_id": contract.professional_category_id,
                "professional_category_name": category.name if category else contract.professional_category,
                "current_salary_table_id": current_table.id if current_table else None,
                "current_salary_table_name": current_table.name if current_table else None,
                "target_salary_table_row_id": target_row.id if target_row else None,
                "target_base_salary": target_row.base_salary if target_row else None,
                "eligibility": eligibility,
                "reason": reason,
                **concept_comparison,
            }
        )

    return {
        "target_table_id": target.id,
        "target_table_name": target.name,
        "target_table_status": target.status,
        "current_active_table_ids": [table.id for table in active_tables],
        "current_active_table_names": [table.name for table in active_tables],
        "total_contracts": len(items),
        "eligible_contracts": eligible_count,
        "already_on_target": already_count,
        "blocked_contracts": blocked_count,
        "duplicate_category_rows": duplicate_categories,
        "contracts": items,
    }


def activate_salary_table(db: Session, table_id: int) -> dict:
    target = _load_target_table(db, table_id)
    previous_active = (
        db.query(SalaryTable)
        .filter(
            SalaryTable.collective_agreement_id == target.collective_agreement_id,
            SalaryTable.status == "active",
            SalaryTable.id != target.id,
        )
        .order_by(SalaryTable.year.desc().nullslast(), SalaryTable.id)
        .all()
    )

    try:
        for table in previous_active:
            table.status = "historical"
        target.status = "active"
        db.commit()
        db.refresh(target)
    except Exception:
        db.rollback()
        raise

    return {
        "target_table_id": target.id,
        "target_table_name": target.name,
        "target_status": target.status,
        "previous_active_table_ids": [table.id for table in previous_active],
        "previous_active_table_names": [table.name for table in previous_active],
        "message": "Tabla salarial activada. Los contratos no se han modificado.",
    }


def migrate_contracts_to_salary_table(
    db: Session,
    table_id: int,
    payload: SalaryTableContractMigrationRequest,
) -> dict:
    target = _load_target_table(db, table_id)
    if target.status != "active":
        raise HTTPException(status_code=409, detail="La tabla debe estar activa antes de migrar contratos")

    preview = build_salary_table_activation_preview(db, table_id, active_only=payload.active_contracts_only)
    item_by_contract = {item["contract_id"]: item for item in preview["contracts"]}
    eligible_ids = {
        item["contract_id"]
        for item in preview["contracts"]
        if item["eligibility"] == "eligible"
    }
    selected_ids = eligible_ids if payload.migrate_all_eligible else set(payload.contract_ids)
    row_by_category, _ = _target_rows(target)

    contracts = (
        db.query(Contract)
        .options(joinedload(Contract.collective_agreement))
        .filter(Contract.id.in_(selected_ids))
        .all()
        if selected_ids
        else []
    )
    contract_by_id = {contract.id: contract for contract in contracts}
    actions_by_contract = defaultdict(list)
    for action in payload.concept_actions:
        actions_by_contract[action.contract_id].append(action)

    migrated_ids = []
    skipped = []
    concept_actions_skipped = []
    salary_base_updated = 0
    concepts_created = 0
    concepts_updated = 0
    concepts_reactivated = 0
    concepts_deactivated = 0

    try:
        for contract_id in sorted(selected_ids):
            item = item_by_contract.get(contract_id)
            contract = contract_by_id.get(contract_id)
            if not item or not contract:
                skipped.append({"contract_id": contract_id, "reason": "Contrato fuera del ámbito de la vista previa."})
                for action in actions_by_contract.get(contract_id, []):
                    concept_actions_skipped.append({
                        "contract_id": contract_id,
                        "concept_key": action.concept_key,
                        "reason": "El contrato no pertenece al ámbito de la migración.",
                    })
                continue
            if item["eligibility"] != "eligible":
                skipped.append({"contract_id": contract_id, "reason": item["reason"] or "Contrato no migrable."})
                for action in actions_by_contract.get(contract_id, []):
                    concept_actions_skipped.append({
                        "contract_id": contract_id,
                        "concept_key": action.concept_key,
                        "reason": "El contrato no es migrable.",
                    })
                continue

            target_row = row_by_category.get(contract.professional_category_id)
            if not target_row:
                skipped.append({"contract_id": contract_id, "reason": "No existe fila equivalente en la tabla destino."})
                for action in actions_by_contract.get(contract_id, []):
                    concept_actions_skipped.append({
                        "contract_id": contract_id,
                        "concept_key": action.concept_key,
                        "reason": "No existe una fila salarial de destino.",
                    })
                continue

            contract.salary_table_row_id = target_row.id
            if payload.update_salary_base and target_row.base_salary is not None:
                contract.salary_base = target_row.base_salary
                salary_base_updated += 1

            action_result = apply_contract_concept_actions(
                db,
                contract,
                target_row,
                actions_by_contract.get(contract_id, []),
            )
            concepts_created += action_result["created"]
            concepts_updated += action_result["updated"]
            concepts_reactivated += action_result["reactivated"]
            concepts_deactivated += action_result["deactivated"]
            concept_actions_skipped.extend(action_result["skipped"])
            migrated_ids.append(contract.id)

        db.commit()
    except Exception:
        db.rollback()
        raise

    warnings = ["La migración cambia la fila salarial vinculada al contrato."]
    if payload.concept_actions:
        warnings.append("Solo se han aplicado las modificaciones de conceptos expresamente seleccionadas.")
    else:
        warnings.append("Los conceptos permanentes no se han modificado.")
    if not payload.update_salary_base:
        warnings.append("El salario base existente se ha conservado.")

    return {
        "target_table_id": target.id,
        "target_table_name": target.name,
        "selected_contracts": len(selected_ids),
        "migrated_contracts": len(migrated_ids),
        "salary_base_updated": salary_base_updated,
        "concepts_created": concepts_created,
        "concepts_updated": concepts_updated,
        "concepts_reactivated": concepts_reactivated,
        "concepts_deactivated": concepts_deactivated,
        "concept_actions_skipped": concept_actions_skipped,
        "skipped_contracts": skipped,
        "migrated_contract_ids": migrated_ids,
        "warnings": warnings,
    }
