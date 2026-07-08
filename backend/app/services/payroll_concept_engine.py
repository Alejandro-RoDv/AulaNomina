from __future__ import annotations

from dataclasses import asdict, dataclass, field
from decimal import Decimal
from typing import Any

from app.services.payroll_amounts import money


@dataclass(frozen=True)
class PayrollConceptLine:
    """Canonical payroll line used by the central payroll engine.

    The model deliberately mirrors the professional concept structure used in
    Spanish payroll software: concept code, printed name, concept type,
    salary nature, contribution/tax flags, origin and print order.
    """

    code: str
    name: str
    amount: Decimal
    concept_type: str = "DEVENGO"
    salary_nature: str = "SALARIAL"
    is_contribution_base: bool = True
    is_taxable: bool = True
    affects_gross: bool = True
    affects_net: bool = True
    source_type: str = "SYSTEM"
    display_order: int = 0
    category: str = "OTRO"
    quantity: Decimal = Decimal("1.00")
    unit_price: Decimal | None = None
    formula: str | None = None
    description: str | None = None
    trace: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["amount"] = money(self.amount)
        payload["quantity"] = money(self.quantity)
        payload["unit_price"] = money(self.unit_price if self.unit_price is not None else self.amount)
        return payload


def positive(value: Any) -> bool:
    return money(value) > Decimal("0.00")


def add_line(lines: list[PayrollConceptLine], line: PayrollConceptLine, *, include_zero: bool = False) -> None:
    if include_zero or positive(line.amount):
        lines.append(line)


def build_payroll_concept_lines(result: dict[str, Any]) -> list[dict[str, Any]]:
    """Build the canonical concept breakdown from an aggregate payroll result.

    This keeps the existing MVP aggregate fields, but makes the concept list the
    professional explanation layer used by receipt, tests and later incidents.
    """

    lines: list[PayrollConceptLine] = []
    base_salary = money(result.get("base_salary"))
    worked_base_salary = money(result.get("worked_base_salary", base_salary))
    salary_reduction = money(base_salary - worked_base_salary)

    add_line(
        lines,
        PayrollConceptLine(
            code="SALARIO_BASE",
            name="Salario base",
            amount=worked_base_salary,
            category="BASE",
            display_order=10,
            source_type="CONTRACT",
            formula="salario_base_contrato * parcialidad - descuentos_periodo",
            description="Salario base devengado en el periodo.",
            trace={
                "base_salary": base_salary,
                "worked_days": result.get("worked_days"),
                "incident_days": result.get("incident_days"),
                "salary_reduction": salary_reduction,
            },
        ),
        include_zero=True,
    )

    add_line(
        lines,
        PayrollConceptLine(
            code="COMPLEMENTOS_SALARIALES",
            name="Complementos salariales",
            amount=money(result.get("salary_supplements")),
            category="COMPLEMENTO",
            display_order=20,
            source_type="CONTRACT",
            description="Complementos salariales ordinarios del contrato o convenio.",
        ),
    )
    add_line(
        lines,
        PayrollConceptLine(
            code="ANTIGUEDAD",
            name="Antigüedad",
            amount=money(result.get("seniority_amount")),
            category="ANTIGUEDAD",
            display_order=25,
            source_type="AGREEMENT",
            description="Importe automático por regla de antigüedad.",
            trace={"lines": result.get("seniority_lines") or []},
        ),
    )
    add_line(
        lines,
        PayrollConceptLine(
            code="INCENTIVOS_VARIABLES",
            name="Incentivos variables",
            amount=money(result.get("variable_incentives")),
            category="COMPLEMENTO",
            display_order=30,
            source_type="MANUAL",
            description="Variables, incentivos o ajustes positivos manuales.",
        ),
    )
    add_line(
        lines,
        PayrollConceptLine(
            code="PRORRATA_PAGAS_EXTRA",
            name="Prorrata de pagas extra",
            amount=money(result.get("extra_pay_proration")),
            category="PAGA_EXTRA",
            display_order=35,
            source_type="AGREEMENT" if result.get("extra_pay_proration_source") == "configured" else "SYSTEM",
            description="Prorrata mensual de pagas extraordinarias.",
            trace={
                "source": result.get("extra_pay_proration_source"),
                "lines": result.get("extra_pay_proration_lines") or [],
                "warnings": result.get("extra_pay_proration_warnings") or [],
            },
        ),
    )
    add_line(
        lines,
        PayrollConceptLine(
            code="PRESTACION_IT",
            name="Prestación IT",
            amount=money(result.get("temporary_disability_benefit")),
            category="IT",
            display_order=45,
            source_type="INCIDENT",
            description="Prestación económica simulada por incapacidad temporal.",
            trace={"it_days": result.get("it_days")},
        ),
    )
    add_line(
        lines,
        PayrollConceptLine(
            code="COMPLEMENTO_EMPRESA_IT",
            name="Complemento empresa IT",
            amount=money(result.get("company_disability_complement")),
            category="IT",
            display_order=46,
            source_type="INCIDENT",
            description="Complemento empresarial simulado durante IT.",
            trace={"it_days": result.get("it_days")},
        ),
    )

    deduction_lines = [
        ("SS_CONTINGENCIAS_COMUNES", "Contingencias comunes trabajador", "employee_common_contingencies", 210),
        ("SS_DESEMPLEO", "Desempleo trabajador", "employee_unemployment", 220),
        ("SS_FORMACION", "Formación profesional trabajador", "employee_training", 230),
        ("SS_MEI", "MEI trabajador", "employee_mei", 240),
        ("IRPF", "Retención IRPF", "irpf", 250),
    ]
    for code, name, key, order in deduction_lines:
        add_line(
            lines,
            PayrollConceptLine(
                code=code,
                name=name,
                amount=money(result.get(key)),
                concept_type="DEDUCCION",
                salary_nature="INFORMATIVA",
                is_contribution_base=False,
                is_taxable=False,
                affects_gross=False,
                affects_net=True,
                source_type="SYSTEM",
                category="SEGURIDAD_SOCIAL" if code.startswith("SS_") else "DEDUCCION",
                display_order=order,
                description="Deducción automática calculada por el motor de nómina.",
            ),
        )

    base_lines = [
        ("BASE_CC", "Base contingencias comunes", "common_contingencies_base", 310),
        ("BASE_CP", "Base contingencias profesionales", "professional_contingencies_base", 320),
        ("BASE_DESEMPLEO_FORMACION_FOGASA", "Base desempleo, formación y FOGASA", "unemployment_training_fogasa_base", 330),
        ("BASE_IRPF", "Base IRPF", "irpf_base", 340),
    ]
    for code, name, key, order in base_lines:
        add_line(
            lines,
            PayrollConceptLine(
                code=code,
                name=name,
                amount=money(result.get(key)),
                concept_type="BASE_INFORMATIVA",
                salary_nature="INFORMATIVA",
                is_contribution_base=False,
                is_taxable=False,
                affects_gross=False,
                affects_net=False,
                source_type="SYSTEM",
                category="BASE_INFORMATIVA",
                display_order=order,
                description="Base informativa calculada por el motor.",
            ),
            include_zero=True,
        )

    company_cost_lines = [
        ("COSTE_EMPRESA_CC", "Coste empresa contingencias comunes", "company_common_contingencies", 410),
        ("COSTE_EMPRESA_DESEMPLEO", "Coste empresa desempleo", "company_unemployment", 420),
        ("COSTE_EMPRESA_FOGASA", "Coste empresa FOGASA", "company_fogasa", 430),
        ("COSTE_EMPRESA_FORMACION", "Coste empresa formación", "company_training", 440),
        ("COSTE_EMPRESA_AT_EP", "Coste empresa AT/EP", "company_at_ep", 450),
        ("COSTE_EMPRESA_MEI", "Coste empresa MEI", "company_mei", 460),
        ("COSTE_EMPRESA_TOTAL", "Coste total empresa", "company_total_cost", 490),
    ]
    for code, name, key, order in company_cost_lines:
        add_line(
            lines,
            PayrollConceptLine(
                code=code,
                name=name,
                amount=money(result.get(key)),
                concept_type="BASE_INFORMATIVA",
                salary_nature="INFORMATIVA",
                is_contribution_base=False,
                is_taxable=False,
                affects_gross=False,
                affects_net=False,
                source_type="SYSTEM",
                category="COSTE_EMPRESA",
                display_order=order,
                description="Coste empresarial informativo calculado por el motor.",
            ),
        )

    return [line.to_dict() for line in sorted(lines, key=lambda item: item.display_order)]


def summarize_concept_lines(lines: list[dict[str, Any]]) -> dict[str, Decimal]:
    total_devengos = Decimal("0.00")
    total_deducciones = Decimal("0.00")
    total_informativo = Decimal("0.00")
    contribution_base = Decimal("0.00")
    taxable_base = Decimal("0.00")

    for line in lines:
        amount = money(line.get("amount"))
        concept_type = line.get("concept_type")
        if concept_type == "DEVENGO" and line.get("affects_gross", True):
            total_devengos += amount
        elif concept_type == "DEDUCCION" and line.get("affects_net", True):
            total_deducciones += amount
        else:
            total_informativo += amount
        if line.get("is_contribution_base"):
            contribution_base += amount
        if line.get("is_taxable"):
            taxable_base += amount

    total_devengos = money(total_devengos)
    total_deducciones = money(total_deducciones)
    return {
        "total_devengos": total_devengos,
        "total_deducciones": total_deducciones,
        "total_informativo": money(total_informativo),
        "contribution_concepts_total": money(contribution_base),
        "taxable_concepts_total": money(taxable_base),
        "neto_por_conceptos": money(total_devengos - total_deducciones),
    }


def build_concept_lines_from_payroll(payroll: Any) -> list[dict[str, Any]]:
    payload = {
        "base_salary": getattr(payroll, "base_salary", Decimal("0.00")),
        "worked_base_salary": getattr(payroll, "worked_base_salary", Decimal("0.00")),
        "salary_supplements": getattr(payroll, "salary_supplements", Decimal("0.00")),
        "seniority_amount": getattr(payroll, "seniority_amount", Decimal("0.00")),
        "variable_incentives": getattr(payroll, "variable_incentives", Decimal("0.00")),
        "extra_pay_proration": getattr(payroll, "extra_pay_proration", Decimal("0.00")),
        "temporary_disability_benefit": getattr(payroll, "temporary_disability_benefit", Decimal("0.00")),
        "company_disability_complement": getattr(payroll, "company_disability_complement", Decimal("0.00")),
        "worked_days": getattr(payroll, "worked_days", None),
        "incident_days": getattr(payroll, "incident_days", None),
        "it_days": getattr(payroll, "it_days", None),
        "common_contingencies_base": getattr(payroll, "common_contingencies_base", Decimal("0.00")),
        "professional_contingencies_base": getattr(payroll, "professional_contingencies_base", Decimal("0.00")),
        "unemployment_training_fogasa_base": getattr(payroll, "unemployment_training_fogasa_base", Decimal("0.00")),
        "irpf_base": getattr(payroll, "irpf_base", Decimal("0.00")),
        "employee_common_contingencies": getattr(payroll, "employee_common_contingencies", Decimal("0.00")),
        "employee_unemployment": getattr(payroll, "employee_unemployment", Decimal("0.00")),
        "employee_training": getattr(payroll, "employee_training", Decimal("0.00")),
        "employee_mei": getattr(payroll, "employee_mei", Decimal("0.00")),
        "irpf": getattr(payroll, "irpf", Decimal("0.00")),
        "company_common_contingencies": getattr(payroll, "company_common_contingencies", Decimal("0.00")),
        "company_unemployment": getattr(payroll, "company_unemployment", Decimal("0.00")),
        "company_fogasa": getattr(payroll, "company_fogasa", Decimal("0.00")),
        "company_training": getattr(payroll, "company_training", Decimal("0.00")),
        "company_at_ep": getattr(payroll, "company_at_ep", Decimal("0.00")),
        "company_mei": getattr(payroll, "company_mei", Decimal("0.00")),
        "company_total_cost": getattr(payroll, "company_total_cost", Decimal("0.00")),
    }
    return build_payroll_concept_lines(payload)
