from decimal import Decimal

from sqlalchemy.orm import Session, selectinload

from app.models.agreement_parameterization import AgreementConceptCatalog, AgreementRuleHeader, AgreementSalaryConcept
from app.models.contract import Contract


def _amount(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def _date(value):
    return value.isoformat() if value else None


def _detail_to_dict(detail):
    return {
        "id": detail.id,
        "detail_type": detail.detail_type,
        "code": detail.code,
        "name": detail.name,
        "display_order": detail.display_order,
        "professional_category_id": detail.professional_category_id,
        "concept_catalog_id": detail.concept_catalog_id,
        "amount": _amount(detail.amount),
        "percentage": _amount(detail.percentage),
        "company_percentage": _amount(detail.company_percentage),
        "worker_percentage": _amount(detail.worker_percentage),
        "total_percentage": _amount(detail.total_percentage),
        "date_from": _date(detail.date_from),
        "date_to": _date(detail.date_to),
        "options": detail.options or {},
        "notes": detail.notes,
    }


def _rule_to_dict(rule):
    return {
        "id": rule.id,
        "rule_type": rule.rule_type,
        "code": rule.code,
        "name": rule.name,
        "scope": rule.scope,
        "effective_from": _date(rule.effective_from),
        "effective_to": _date(rule.effective_to),
        "is_default": rule.is_default,
        "options": rule.options or {},
        "notes": rule.notes,
        "details": [_detail_to_dict(detail) for detail in sorted(rule.details or [], key=lambda item: item.display_order or 0)],
    }


def _catalog_to_dict(item):
    return {
        "id": item.id,
        "catalog_type": item.catalog_type,
        "code": item.code,
        "name": item.name,
        "default_nature": item.default_nature,
        "default_payment_type": item.default_payment_type,
        "default_calculation_type": item.default_calculation_type,
        "default_contributes": item.default_contributes,
        "default_taxable": item.default_taxable,
        "default_cra_code": item.default_cra_code,
    }


def _salary_concept_to_dict(item):
    return {
        "id": item.id,
        "professional_category_id": item.professional_category_id,
        "concept_catalog_id": item.concept_catalog_id,
        "character": item.character,
        "name": item.name,
        "scope": item.scope,
        "amount": _amount(item.amount),
        "payment_type": item.payment_type,
        "calculation_type": item.calculation_type,
        "contributes": item.contributes,
        "taxable": item.taxable,
        "cra_code": item.cra_code,
        "notes": item.notes,
    }


def build_contract_agreement_parameterization(db: Session, contract_id: int):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        return None

    warnings = []
    if not contract.collective_agreement_id:
        warnings.append("El contrato no tiene convenio colectivo asociado.")
        return {
            "contract": {"id": contract.id, "employee_id": contract.employee_id, "professional_category_id": contract.professional_category_id},
            "agreement": None,
            "warnings": warnings,
            "rule_headers": [],
            "salary_concepts": [],
            "concept_catalog": [],
        }

    rules = (
        db.query(AgreementRuleHeader)
        .options(selectinload(AgreementRuleHeader.details))
        .filter(AgreementRuleHeader.collective_agreement_id == contract.collective_agreement_id, AgreementRuleHeader.is_active == True)
        .order_by(AgreementRuleHeader.rule_type, AgreementRuleHeader.name)
        .all()
    )
    salary_concepts = (
        db.query(AgreementSalaryConcept)
        .filter(AgreementSalaryConcept.collective_agreement_id == contract.collective_agreement_id, AgreementSalaryConcept.is_active == True)
        .filter((AgreementSalaryConcept.professional_category_id == None) | (AgreementSalaryConcept.professional_category_id == contract.professional_category_id))
        .order_by(AgreementSalaryConcept.character, AgreementSalaryConcept.name)
        .all()
    )
    catalog = (
        db.query(AgreementConceptCatalog)
        .filter(AgreementConceptCatalog.collective_agreement_id == contract.collective_agreement_id, AgreementConceptCatalog.is_active == True)
        .order_by(AgreementConceptCatalog.catalog_type, AgreementConceptCatalog.code, AgreementConceptCatalog.name)
        .all()
    )

    if not rules:
        warnings.append("El convenio asociado no tiene reglas parametrizadas.")
    if not catalog:
        warnings.append("El convenio asociado no tiene catálogo de conceptos.")
    if contract.professional_category_id and not salary_concepts:
        warnings.append("No hay conceptos salariales específicos para la categoría del contrato.")

    agreement = contract.collective_agreement
    return {
        "contract": {
            "id": contract.id,
            "employee_id": contract.employee_id,
            "contract_code": contract.contract_code,
            "professional_category_id": contract.professional_category_id,
            "professional_category": contract.professional_category,
            "salary_table_row_id": contract.salary_table_row_id,
            "salary_base": _amount(contract.salary_base),
            "pay_schedule": contract.pay_schedule,
        },
        "agreement": {
            "id": agreement.id if agreement else contract.collective_agreement_id,
            "name": agreement.name if agreement else None,
            "agreement_code": agreement.agreement_code if agreement else contract.collective_agreement_code,
        },
        "warnings": warnings,
        "rule_headers": [_rule_to_dict(rule) for rule in rules],
        "salary_concepts": [_salary_concept_to_dict(item) for item in salary_concepts],
        "concept_catalog": [_catalog_to_dict(item) for item in catalog],
    }
