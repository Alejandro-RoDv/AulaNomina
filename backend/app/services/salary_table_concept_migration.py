from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy.orm import Session, joinedload

from app.models.collective_agreement import SalaryTableRow
from app.models.contract import Contract
from app.models.payroll_salary_structure import ContractPayrollConcept
from app.services.agreement_contract_concept_sync import (
    _build_candidates,
    _concept_code,
    _decimal,
    _get_or_create_payroll_concept,
    _load_agreement_concepts,
)


def _target_candidates(db: Session, contract: Contract, target_row: SalaryTableRow) -> dict[str, dict]:
    context = SimpleNamespace(
        collective_agreement_id=contract.collective_agreement_id,
        professional_category_id=contract.professional_category_id,
        salary_table_row=target_row,
    )
    agreement_concepts = _load_agreement_concepts(db, context)
    candidates = _build_candidates(context, agreement_concepts)
    candidates.pop("salary_base", None)

    result = {}
    for display_order, candidate in enumerate(candidates.values(), start=10):
        concept_key = _concept_code(
            contract.collective_agreement_id,
            candidate["semantic_key"],
            candidate.get("agreement_concept"),
        )
        result[concept_key] = {
            **candidate,
            "concept_key": concept_key,
            "display_order": display_order,
        }
    return result


def _current_lines(db: Session, contract_id: int) -> list[ContractPayrollConcept]:
    return (
        db.query(ContractPayrollConcept)
        .options(joinedload(ContractPayrollConcept.concept))
        .filter(ContractPayrollConcept.contract_id == contract_id)
        .order_by(ContractPayrollConcept.is_active.desc(), ContractPayrollConcept.id)
        .all()
    )


def _current_agreement_map(lines: list[ContractPayrollConcept], agreement_id: int) -> dict[str, ContractPayrollConcept]:
    result = {}
    for line in lines:
        concept = line.concept
        if not concept or concept.source_type != "AGREEMENT" or concept.agreement_id != agreement_id:
            continue
        current = result.get(concept.code)
        if current is None or (line.is_active and not current.is_active):
            result[concept.code] = line
    return result


def build_contract_concept_comparison(
    db: Session,
    contract: Contract,
    target_row: SalaryTableRow,
) -> dict:
    target_map = _target_candidates(db, contract, target_row)
    lines = _current_lines(db, contract.id)
    current_map = _current_agreement_map(lines, contract.collective_agreement_id)
    items = []

    counts = {
        "new_concepts": 0,
        "changed_concepts": 0,
        "reactivated_concepts": 0,
        "unchanged_concepts": 0,
        "obsolete_concepts": 0,
        "preserved_concepts": 0,
    }

    for concept_key, candidate in sorted(target_map.items(), key=lambda pair: pair[1]["name"]):
        current_line = current_map.get(concept_key)
        target_amount = _decimal(candidate.get("amount"))
        current_amount = _decimal(current_line.amount) if current_line else None

        if current_line is None:
            status = "new"
            selectable = True
            selected_by_default = True
            action = "upsert"
            reason = "El concepto no existe todavía en el contrato."
            counts["new_concepts"] += 1
        elif not current_line.is_active:
            status = "reactivate"
            selectable = True
            selected_by_default = True
            action = "upsert"
            reason = "El concepto existe, pero está desactivado."
            counts["reactivated_concepts"] += 1
        elif current_amount != target_amount:
            status = "changed"
            selectable = True
            selected_by_default = True
            action = "upsert"
            reason = "El importe de la tabla nueva es diferente."
            counts["changed_concepts"] += 1
        else:
            status = "unchanged"
            selectable = False
            selected_by_default = False
            action = "none"
            reason = "El concepto ya tiene el importe previsto."
            counts["unchanged_concepts"] += 1

        difference = target_amount - current_amount if current_amount is not None else target_amount
        items.append(
            {
                "concept_key": concept_key,
                "name": candidate["name"],
                "source_type": "AGREEMENT",
                "current_contract_concept_id": current_line.id if current_line else None,
                "current_payroll_concept_id": current_line.concept_id if current_line else None,
                "current_amount": current_amount,
                "target_amount": target_amount,
                "difference": difference,
                "current_active": current_line.is_active if current_line else None,
                "status": status,
                "selectable": selectable,
                "selected_by_default": selected_by_default,
                "proposed_action": action,
                "reason": reason,
            }
        )

    for concept_key, current_line in sorted(current_map.items(), key=lambda pair: pair[1].concept.name):
        if concept_key in target_map or not current_line.is_active:
            continue
        current_amount = _decimal(current_line.amount)
        counts["obsolete_concepts"] += 1
        items.append(
            {
                "concept_key": concept_key,
                "name": current_line.description or current_line.concept.name,
                "source_type": "AGREEMENT",
                "current_contract_concept_id": current_line.id,
                "current_payroll_concept_id": current_line.concept_id,
                "current_amount": current_amount,
                "target_amount": None,
                "difference": -current_amount,
                "current_active": True,
                "status": "obsolete",
                "selectable": True,
                "selected_by_default": False,
                "proposed_action": "deactivate",
                "reason": "El concepto no forma parte de la estructura aplicable en la tabla nueva.",
            }
        )

    for line in lines:
        concept = line.concept
        if not concept:
            continue
        if concept.source_type == "AGREEMENT" and concept.agreement_id == contract.collective_agreement_id:
            continue
        counts["preserved_concepts"] += 1
        source_type = concept.source_type or "CUSTOM"
        items.append(
            {
                "concept_key": f"PRESERVED_{line.id}",
                "name": line.description or concept.name,
                "source_type": source_type,
                "current_contract_concept_id": line.id,
                "current_payroll_concept_id": line.concept_id,
                "current_amount": _decimal(line.amount),
                "target_amount": None,
                "difference": None,
                "current_active": line.is_active,
                "status": "preserved",
                "selectable": False,
                "selected_by_default": False,
                "proposed_action": "none",
                "reason": "Concepto personalizado o de sistema: se conserva sin cambios.",
            }
        )

    return {
        **counts,
        "concept_changes": items,
        "target_candidates": target_map,
        "current_agreement_lines": current_map,
    }


def apply_contract_concept_actions(
    db: Session,
    contract: Contract,
    target_row: SalaryTableRow,
    actions: list,
) -> dict:
    comparison = build_contract_concept_comparison(db, contract, target_row)
    comparison_map = {item["concept_key"]: item for item in comparison["concept_changes"]}
    target_map = comparison["target_candidates"]
    current_map = comparison["current_agreement_lines"]

    created = 0
    updated = 0
    reactivated = 0
    deactivated = 0
    skipped = []

    unique_actions = {}
    for action in actions:
        unique_actions[action.concept_key] = action.action

    for concept_key, action_name in unique_actions.items():
        item = comparison_map.get(concept_key)
        if not item:
            skipped.append({
                "contract_id": contract.id,
                "concept_key": concept_key,
                "reason": "El concepto no pertenece a la comparación actual del contrato.",
            })
            continue

        if action_name == "upsert":
            candidate = target_map.get(concept_key)
            if not candidate:
                skipped.append({
                    "contract_id": contract.id,
                    "concept_key": concept_key,
                    "reason": "No existe un concepto de destino para actualizar.",
                })
                continue

            payroll_concept, _, _ = _get_or_create_payroll_concept(db, contract, candidate)
            line = current_map.get(concept_key)
            target_amount = _decimal(candidate.get("amount"))
            source_note = (
                f"Actualizado desde convenio {contract.collective_agreement_id}; "
                f"tabla salarial {target_row.salary_table_id}; "
                f"origen {candidate['source']}; clave {candidate['semantic_key']}."
            )

            if line is None:
                db.add(
                    ContractPayrollConcept(
                        contract_id=contract.id,
                        concept_id=payroll_concept.id,
                        description=candidate["name"],
                        quantity=Decimal("1.00"),
                        unit_price=Decimal("0.00"),
                        amount=target_amount,
                        start_date=contract.start_date,
                        end_date=contract.end_date,
                        is_active=True,
                        display_order=candidate["display_order"],
                        notes=source_note,
                    )
                )
                created += 1
                continue

            was_active = line.is_active
            line.concept_id = payroll_concept.id
            line.description = candidate["name"]
            line.quantity = Decimal("1.00")
            line.unit_price = Decimal("0.00")
            line.amount = target_amount
            line.start_date = contract.start_date
            line.end_date = contract.end_date
            line.is_active = True
            line.display_order = candidate["display_order"]
            line.notes = source_note
            if was_active:
                updated += 1
            else:
                reactivated += 1
            continue

        if action_name == "deactivate":
            line = current_map.get(concept_key)
            if item["status"] != "obsolete" or not line or not line.is_active:
                skipped.append({
                    "contract_id": contract.id,
                    "concept_key": concept_key,
                    "reason": "Solo pueden desactivarse conceptos obsoletos y activos del convenio.",
                })
                continue
            line.is_active = False
            line.notes = (
                f"Desactivado al migrar a la tabla salarial {target_row.salary_table_id}. "
                f"El concepto dejó de formar parte de la estructura aplicable."
            )
            deactivated += 1
            continue

        skipped.append({
            "contract_id": contract.id,
            "concept_key": concept_key,
            "reason": "Acción de concepto no válida.",
        })

    return {
        "created": created,
        "updated": updated,
        "reactivated": reactivated,
        "deactivated": deactivated,
        "skipped": skipped,
    }
