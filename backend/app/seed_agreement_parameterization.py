from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.agreement_parameterization import AgreementConceptCatalog, AgreementRuleDetail, AgreementRuleHeader
from app.models.agreement_seniority import AgreementSeniorityRule
from app.services.payroll_rates import DEFAULT_PAYROLL_RATES


def _exists_rule(db: Session, agreement_id: int, code: str) -> bool:
    return db.query(AgreementRuleHeader).filter(AgreementRuleHeader.collective_agreement_id == agreement_id, AgreementRuleHeader.code == code).first() is not None


def _create_rule(db: Session, agreement_id: int, rule_type: str, code: str, name: str, options: dict | None = None, details: list[dict] | None = None) -> int:
    if _exists_rule(db, agreement_id, code):
        return 0
    rule = AgreementRuleHeader(collective_agreement_id=agreement_id, rule_type=rule_type, code=code, name=name, scope="global", is_default=True, options=options or {})
    db.add(rule)
    db.flush()
    for index, detail in enumerate(details or [], start=1):
        db.add(AgreementRuleDetail(rule_header_id=rule.id, display_order=index, **detail))
    return 1


def _rate(code: str, name: str, company_key: str | None = None, worker_key: str | None = None) -> dict:
    company = DEFAULT_PAYROLL_RATES.get(company_key, Decimal("0")) if company_key else Decimal("0")
    worker = DEFAULT_PAYROLL_RATES.get(worker_key, Decimal("0")) if worker_key else Decimal("0")
    return {"detail_type": "rate", "code": code, "name": name, "company_percentage": company, "worker_percentage": worker, "total_percentage": company + worker}


def seed_agreement_parameterization(db: Session, agreement_id: int) -> dict:
    created_catalog_items = 0
    if not db.query(AgreementConceptCatalog).filter(AgreementConceptCatalog.collective_agreement_id == agreement_id).first():
        for item in [
            ("salary", "0001", "Salario base", "salarial", "mensual", "manual", True, True, "0001"),
            ("salary", "0004", "Complemento convenio", "salarial", "mensual", "manual", True, True, "0004"),
            ("salary", "0042", "Paga extraordinaria", "paga_extra", "julio_diciembre", "automatico", True, True, "0042"),
            ("salary", "ANT", "Antigüedad", "antiguedad", "trienio", "automatico", True, True, "0001"),
            ("salary", "VAC", "Vacaciones", "vacaciones", "diario", "automatico", True, True, "0001"),
            ("non_salary", "DIET", "Dietas", "no_salarial", "diario", "manual", False, False, None),
            ("deduction", "IRPF", "IRPF", "deduccion", "mensual", "automatico", False, False, None),
            ("deduction", "CC", "Contingencias comunes", "deduccion", "mensual", "automatico", False, False, None),
        ]:
            db.add(AgreementConceptCatalog(collective_agreement_id=agreement_id, catalog_type=item[0], code=item[1], name=item[2], default_nature=item[3], default_payment_type=item[4], default_calculation_type=item[5], default_contributes=item[6], default_taxable=item[7], default_cra_code=item[8], is_system=True))
            created_catalog_items += 1

    created_rules = 0
    created_rules += _create_rule(db, agreement_id, "global_option", "GLOBAL", "Opciones globales", {"prorratear_pagas_extra": False, "boe_alerts_prepared": True})
    created_rules += _create_rule(db, agreement_id, "criteria", "CRITERIOS", "Criterios del convenio", {"bloques": ["Antigüedad", "Atrasos", "Contratación", "IT", "Pagas extra", "Período de prueba", "Vacaciones"]})
    created_rules += _create_rule(db, agreement_id, "smi_iprem", "SMI_IPREM", "SMI e IPREM", {"smi_diario": None, "smi_mensual": None, "iprem_diario": None, "iprem_mensual": None})
    created_rules += _create_rule(db, agreement_id, "contribution_type", "TIPOS_RG", "Tipos de cotización", details=[
        _rate("CC", "Contingencias comunes", "company_common_contingencies", "employee_common_contingencies"),
        _rate("DES", "Desempleo", "company_unemployment", "employee_unemployment"),
        _rate("FOGASA", "FOGASA", "company_fogasa", None),
        _rate("FP", "Formación profesional", "company_training", "employee_training"),
        _rate("MEI", "MEI", "company_mei", "employee_mei"),
    ])
    created_rules += _create_rule(db, agreement_id, "vacation_automation", "VAC_AUTO", "Vacaciones", {"numero_dias": 30, "tipo_dias": "naturales", "devenga_it": True, "cotizacion": True, "computo_diario": True})
    created_rules += _create_rule(db, agreement_id, "extra_pay_automation", "PEXTRA", "Pagas extraordinarias", {"prorrateo": False, "codigo_cra": "0042", "pagas": ["julio", "diciembre"], "cotizacion": True})
    created_rules += _create_rule(db, agreement_id, "seniority", "ANT", "Antigüedad", {"forma_pago": "mensual", "criterio_devengo": "fecha_antiguedad", "computo_diario": True})
    created_rules += _create_rule(db, agreement_id, "it_complement", "IT", "Complementos IT", {"tramos": 4, "conceptos": [], "diagnosticos": [], "limites": {}})

    created_seniority_rules = 0
    if not db.query(AgreementSeniorityRule).filter(AgreementSeniorityRule.collective_agreement_id == agreement_id).first():
        db.add(
            AgreementSeniorityRule(
                collective_agreement_id=agreement_id,
                code="TRI",
                name="Trienios",
                module_years=3,
                calculation_mode="table_amount",
                applies_partiality=True,
                daily_proration_on_maturity=True,
                contributes=True,
                taxable=True,
                affects_extra_payments=True,
                is_active=True,
                display_order=10,
                notes="Regla didáctica base. Utiliza el importe de antigüedad de cada fila salarial.",
            )
        )
        created_seniority_rules = 1

    db.commit()
    return {
        "created_rules": created_rules,
        "created_catalog_items": created_catalog_items,
        "created_seniority_rules": created_seniority_rules,
        "message": "Parametrización base cargada",
    }
