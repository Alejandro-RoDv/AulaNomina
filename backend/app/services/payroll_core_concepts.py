from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.payroll_salary_structure import PayrollConcept


CORE_PAYROLL_CONCEPTS = [
    # Devengos ordinarios
    dict(code="SALARIO_BASE", name="Salario base", category="BASE", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="CONTRACT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=10),
    dict(code="COMPLEMENTOS_SALARIALES", name="Complementos salariales", category="COMPLEMENTO", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="CONTRACT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=20),
    dict(code="ANTIGUEDAD", name="Antigüedad", category="ANTIGUEDAD", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=25),
    dict(code="INCENTIVOS_VARIABLES", name="Incentivos variables", category="COMPLEMENTO", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="CUSTOM", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=30),
    dict(code="PRORRATA_PAGAS_EXTRA", name="Prorrata de pagas extra", category="PAGA_EXTRA", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=35),
    dict(code="PAGA_EXTRA", name="Paga extraordinaria", category="PAGA_EXTRA", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=36),
    dict(code="PLUS_NOCTURNIDAD", name="Plus de nocturnidad", category="PLUS", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=40),
    dict(code="PLUS_TURNICIDAD", name="Plus de turnicidad", category="PLUS", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=41),
    dict(code="HORAS_EXTRA", name="Horas extraordinarias", category="HORAS_EXTRA", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=42),
    dict(code="DIETAS", name="Dietas", category="DIETA", concept_type="DEVENGO", salary_nature="EXTRASALARIAL", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=50),
    dict(code="KILOMETRAJE", name="Kilometraje", category="KILOMETRAJE", concept_type="DEVENGO", salary_nature="EXTRASALARIAL", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=51),
    dict(code="PRESTACION_IT", name="Prestación IT", category="IT", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=60),
    dict(code="COMPLEMENTO_EMPRESA_IT", name="Complemento empresa IT", category="IT", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=61),
    dict(code="VACACIONES_RETRIBUIDAS", name="Vacaciones retribuidas", category="VACACIONES", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=62),
    dict(code="PERMISO_RETRIBUIDO", name="Permiso retribuido", category="PERMISO", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=63),
    dict(code="REGULARIZACION", name="Regularización", category="REGULARIZACION", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="REGULARIZATION", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=70),
    dict(code="AJUSTE_MANUAL", name="Ajuste manual", category="AJUSTE", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="CUSTOM", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=75),
    # Deducciones y descuentos
    dict(code="DESCUENTO_AUSENCIA", name="Descuento por ausencia", category="AUSENCIA", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="INCIDENT", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=200),
    dict(code="ANTICIPO", name="Anticipo", category="ANTICIPO", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=205),
    dict(code="EMBARGO", name="Embargo", category="EMBARGO", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=206),
    dict(code="SS_CONTINGENCIAS_COMUNES", name="Contingencias comunes trabajador", category="SEGURIDAD_SOCIAL", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=210),
    dict(code="SS_DESEMPLEO", name="Desempleo trabajador", category="SEGURIDAD_SOCIAL", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=220),
    dict(code="SS_FORMACION", name="Formación profesional trabajador", category="SEGURIDAD_SOCIAL", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=230),
    dict(code="SS_MEI", name="MEI trabajador", category="SEGURIDAD_SOCIAL", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=240),
    dict(code="IRPF", name="Retención IRPF", category="DEDUCCION", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=250),
    # Bases e información de cotización
    dict(code="BASE_CC", name="Base contingencias comunes", category="BASE_INFORMATIVA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=310),
    dict(code="BASE_CP", name="Base contingencias profesionales", category="BASE_INFORMATIVA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=320),
    dict(code="BASE_DESEMPLEO_FORMACION_FOGASA", name="Base desempleo, formación y FOGASA", category="BASE_INFORMATIVA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=330),
    dict(code="BASE_IRPF", name="Base IRPF", category="BASE_INFORMATIVA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=340),
    # Coste empresarial informativo
    dict(code="COSTE_EMPRESA_CC", name="Coste empresa contingencias comunes", category="COSTE_EMPRESA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=410),
    dict(code="COSTE_EMPRESA_DESEMPLEO", name="Coste empresa desempleo", category="COSTE_EMPRESA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=420),
    dict(code="COSTE_EMPRESA_FOGASA", name="Coste empresa FOGASA", category="COSTE_EMPRESA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=430),
    dict(code="COSTE_EMPRESA_FORMACION", name="Coste empresa formación", category="COSTE_EMPRESA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=440),
    dict(code="COSTE_EMPRESA_AT_EP", name="Coste empresa AT/EP", category="COSTE_EMPRESA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=450),
    dict(code="COSTE_EMPRESA_MEI", name="Coste empresa MEI", category="COSTE_EMPRESA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=460),
    dict(code="COSTE_EMPRESA_TOTAL", name="Coste total empresa", category="COSTE_EMPRESA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=490),
]


def ensure_core_payroll_concepts(db: Session) -> int:
    """Ensure the preparation editor always exposes the main payroll concept families.

    Existing concepts are never overwritten: agreements and custom catalog entries remain
    authoritative. The function only fills missing codes required by the educational
    payroll workspace.
    """
    existing_codes = {
        str(code).upper()
        for (code,) in db.query(PayrollConcept.code).all()
        if code
    }
    created = 0
    for definition in CORE_PAYROLL_CONCEPTS:
        if definition["code"] in existing_codes:
            continue
        db.add(PayrollConcept(
            code=definition["code"],
            name=definition["name"],
            category=definition["category"],
            concept_type=definition["concept_type"],
            salary_nature=definition["salary_nature"],
            source_type=definition["source_type"],
            calculation_type="FIXED_AMOUNT",
            default_amount=Decimal("0.00"),
            default_unit_price=Decimal("0.00"),
            applies_workday_percentage=False,
            is_system=definition["source_type"] == "SYSTEM",
            is_taxable=definition["is_taxable"],
            is_contribution_base=definition["is_contribution_base"],
            affects_gross=definition["affects_gross"],
            affects_net=definition["affects_net"],
            is_active=True,
            display_order=definition["display_order"],
            notes="Concepto base disponible en el editor mensual de AulaNomina.",
        ))
        existing_codes.add(definition["code"])
        created += 1

    if created:
        db.commit()
    return created
