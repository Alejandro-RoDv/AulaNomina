from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.payroll_salary_structure import PayrollConcept


CORE_PAYROLL_CONCEPTS = [
    # Devengos salariales ordinarios
    dict(code="SALARIO_BASE", name="Salario base", category="BASE", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="CONTRACT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=10),
    dict(code="COMPLEMENTOS_SALARIALES", name="Complementos salariales", category="COMPLEMENTO", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="CONTRACT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=20),
    dict(code="COMPLEMENTO_CONVENIO", name="Complemento de convenio", category="COMPLEMENTO", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=21),
    dict(code="MEJORA_VOLUNTARIA", name="Mejora voluntaria", category="COMPLEMENTO", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="CONTRACT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=22),
    dict(code="ANTIGUEDAD", name="Antigüedad", category="ANTIGUEDAD", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=25),
    dict(code="COMISIONES", name="Comisiones", category="COMPLEMENTO", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="CUSTOM", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=27),
    dict(code="BONUS_PRODUCTIVIDAD", name="Bonus / productividad", category="COMPLEMENTO", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="CUSTOM", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=28),
    dict(code="INCENTIVOS_VARIABLES", name="Incentivos variables", category="COMPLEMENTO", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="CUSTOM", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=30),
    dict(code="SALARIO_ESPECIE", name="Retribución en especie", category="EXTRA", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="CUSTOM", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=31),
    dict(code="PRORRATA_PAGAS_EXTRA", name="Prorrata de pagas extraordinarias", category="PAGA_EXTRA", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=35),
    dict(code="PAGA_EXTRA", name="Paga extraordinaria", category="PAGA_EXTRA", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=36),
    dict(code="PLUS_NOCTURNIDAD", name="Plus de nocturnidad", category="PLUS", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=40),
    dict(code="PLUS_TURNICIDAD", name="Plus de turnicidad", category="PLUS", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=41),
    dict(code="PLUS_PELIGROSIDAD", name="Plus de peligrosidad", category="PLUS", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=42),
    dict(code="PLUS_TOXICIDAD", name="Plus de toxicidad", category="PLUS", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=43),
    dict(code="PLUS_DISPONIBILIDAD", name="Plus de disponibilidad", category="PLUS", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=44),
    dict(code="PLUS_RESPONSABILIDAD", name="Plus de responsabilidad", category="PLUS", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=45),
    dict(code="PLUS_IDIOMAS", name="Plus de idiomas", category="PLUS", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="AGREEMENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=46),
    dict(code="HORAS_EXTRA", name="Horas extraordinarias ordinarias", category="HORAS_EXTRA", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=50),
    dict(code="HORAS_EXTRA_FUERZA_MAYOR", name="Horas extraordinarias por fuerza mayor", category="HORAS_EXTRA", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=51),
    dict(code="HORAS_COMPLEMENTARIAS", name="Horas complementarias", category="HORAS_EXTRA", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=52),

    # Percepciones extrasalariales y gastos
    dict(code="DIETAS", name="Dietas", category="DIETA", concept_type="DEVENGO", salary_nature="EXTRASALARIAL", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=70),
    dict(code="DIETA_MANUTENCION", name="Dieta de manutención", category="DIETA", concept_type="DEVENGO", salary_nature="EXTRASALARIAL", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=71),
    dict(code="DIETA_ESTANCIA", name="Dieta de estancia", category="DIETA", concept_type="DEVENGO", salary_nature="EXTRASALARIAL", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=72),
    dict(code="KILOMETRAJE", name="Kilometraje / locomoción", category="KILOMETRAJE", concept_type="DEVENGO", salary_nature="EXTRASALARIAL", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=73),
    dict(code="SUPLIDOS", name="Suplidos y gastos reintegrados", category="OTRO", concept_type="DEVENGO", salary_nature="EXTRASALARIAL", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=74),
    dict(code="INDEMNIZACION_FIN_CONTRATO", name="Indemnización fin de contrato", category="OTRO", concept_type="DEVENGO", salary_nature="EXTRASALARIAL", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=75),
    dict(code="INDEMNIZACION_DESPIDO", name="Indemnización por despido", category="OTRO", concept_type="DEVENGO", salary_nature="EXTRASALARIAL", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=76),
    dict(code="VACACIONES_NO_DISFRUTADAS", name="Vacaciones no disfrutadas", category="VACACIONES", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=77),

    # Incidencias, IT y ajustes de devengo
    dict(code="PRESTACION_IT", name="Prestación por incapacidad temporal", category="IT", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=False, affects_gross=True, affects_net=True, display_order=90),
    dict(code="COMPLEMENTO_EMPRESA_IT", name="Complemento empresarial de IT", category="IT", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=91),
    dict(code="VACACIONES_RETRIBUIDAS", name="Vacaciones retribuidas", category="VACACIONES", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=92),
    dict(code="PERMISO_RETRIBUIDO", name="Permiso retribuido", category="PERMISO", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="INCIDENT", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=93),
    dict(code="REGULARIZACION", name="Regularización / retroactivo", category="REGULARIZACION", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="REGULARIZATION", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=100),
    dict(code="ATRASOS", name="Atrasos", category="REGULARIZACION", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="REGULARIZATION", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=101),
    dict(code="AJUSTE_MANUAL", name="Ajuste manual de devengo", category="AJUSTE", concept_type="DEVENGO", salary_nature="SALARIAL", source_type="CUSTOM", is_taxable=True, is_contribution_base=True, affects_gross=True, affects_net=True, display_order=110),

    # Deducciones y descuentos
    dict(code="DESCUENTO_AUSENCIA", name="Descuento por ausencia", category="AUSENCIA", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="INCIDENT", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=200),
    dict(code="AUSENCIA_NO_RETRIBUIDA", name="Ausencia no retribuida", category="AUSENCIA", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="INCIDENT", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=201),
    dict(code="HUELGA", name="Descuento por huelga", category="AUSENCIA", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="INCIDENT", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=202),
    dict(code="ANTICIPO", name="Anticipo", category="ANTICIPO", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=205),
    dict(code="EMBARGO", name="Embargo judicial", category="EMBARGO", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=206),
    dict(code="CUOTA_SINDICAL", name="Cuota sindical", category="DEDUCCION", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=207),
    dict(code="OTRAS_DEDUCCIONES", name="Otras deducciones", category="DEDUCCION", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=208),
    dict(code="AJUSTE_DEDUCCION", name="Ajuste manual de deducción", category="AJUSTE", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="CUSTOM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=209),
    dict(code="SS_CONTINGENCIAS_COMUNES", name="Contingencias comunes trabajador", category="SEGURIDAD_SOCIAL", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=220),
    dict(code="SS_DESEMPLEO", name="Desempleo trabajador", category="SEGURIDAD_SOCIAL", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=221),
    dict(code="SS_FORMACION", name="Formación profesional trabajador", category="SEGURIDAD_SOCIAL", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=222),
    dict(code="SS_MEI", name="MEI trabajador", category="SEGURIDAD_SOCIAL", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=223),
    dict(code="SS_HORAS_EXTRA", name="Cotización trabajador horas extraordinarias", category="SEGURIDAD_SOCIAL", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=224),
    dict(code="SS_HORAS_EXTRA_FUERZA_MAYOR", name="Cotización trabajador horas extra fuerza mayor", category="SEGURIDAD_SOCIAL", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=225),
    dict(code="IRPF", name="Retención IRPF", category="DEDUCCION", concept_type="DEDUCCION", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=True, display_order=250),

    # Bases e información de cotización
    dict(code="BASE_CC", name="Base contingencias comunes", category="BASE_INFORMATIVA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=310),
    dict(code="BASE_CP", name="Base contingencias profesionales", category="BASE_INFORMATIVA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=320),
    dict(code="BASE_DESEMPLEO_FORMACION_FOGASA", name="Base desempleo, formación y FOGASA", category="BASE_INFORMATIVA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=330),
    dict(code="BASE_HORAS_EXTRA", name="Base adicional horas extraordinarias", category="BASE_INFORMATIVA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=335),
    dict(code="BASE_HORAS_EXTRA_FUERZA_MAYOR", name="Base horas extra fuerza mayor", category="BASE_INFORMATIVA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=336),
    dict(code="BASE_IRPF", name="Base sujeta a retención IRPF", category="BASE_INFORMATIVA", concept_type="BASE_INFORMATIVA", salary_nature="INFORMATIVA", source_type="SYSTEM", is_taxable=False, is_contribution_base=False, affects_gross=False, affects_net=False, display_order=340),

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
    """Ensure the preparation editor exposes the main concept families.

    Existing concepts are never overwritten. Agreement and custom catalog entries
    remain authoritative; this only fills missing generic codes used by the
    educational monthly preparation workspace.
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
