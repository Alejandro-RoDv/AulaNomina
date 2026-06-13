from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

STANDARD_MONTH_DAYS = Decimal("30")


@dataclass(frozen=True)
class SalaryConcept:
    """Simple payroll concept used by the contribution base calculator."""

    name: str
    amount: Decimal
    contributes_common: bool = True
    contributes_professional: bool = True
    taxable_irpf: bool = True


@dataclass(frozen=True)
class ContributionBaseInput:
    """Input payload for simulated Spanish payroll contribution bases."""

    base_salary: Decimal = Decimal("0.00")
    salary_supplements: Decimal = Decimal("0.00")
    seniority_amount: Decimal = Decimal("0.00")
    variable_incentives: Decimal = Decimal("0.00")
    extra_pay_proration: Decimal = Decimal("0.00")
    non_salary_compensation: Decimal = Decimal("0.00")
    overtime_amount: Decimal = Decimal("0.00")
    contribution_days: int = 30
    non_contribution_days: int = 0


def money(value) -> Decimal:
    return Decimal(value or "0.00").quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def ratio(value: Decimal) -> Decimal:
    return Decimal(value or "0.00").quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def safe_days(value: int | None) -> int:
    if value is None:
        return 0
    return max(0, min(30, int(value)))


def calculate_day_ratio(contribution_days: int) -> Decimal:
    days = Decimal(safe_days(contribution_days))
    if STANDARD_MONTH_DAYS == 0:
        return Decimal("0")
    return ratio(days / STANDARD_MONTH_DAYS)


def calculate_daily_base(monthly_base: Decimal, contribution_days: int) -> Decimal:
    days = Decimal(safe_days(contribution_days))
    if days <= 0:
        return Decimal("0.00")
    return money(monthly_base / days)


def build_default_salary_concepts(payload: ContributionBaseInput) -> list[SalaryConcept]:
    """Build the MVP concept classification used for base calculation."""

    return [
        SalaryConcept(
            name="Salario base",
            amount=money(payload.base_salary),
            contributes_common=True,
            contributes_professional=True,
            taxable_irpf=True,
        ),
        SalaryConcept(
            name="Complementos salariales",
            amount=money(payload.salary_supplements),
            contributes_common=True,
            contributes_professional=True,
            taxable_irpf=True,
        ),
        SalaryConcept(
            name="Antigüedad",
            amount=money(payload.seniority_amount),
            contributes_common=True,
            contributes_professional=True,
            taxable_irpf=True,
        ),
        SalaryConcept(
            name="Variables e incentivos",
            amount=money(payload.variable_incentives),
            contributes_common=True,
            contributes_professional=True,
            taxable_irpf=True,
        ),
        SalaryConcept(
            name="Prorrata pagas extra",
            amount=money(payload.extra_pay_proration),
            contributes_common=True,
            contributes_professional=True,
            taxable_irpf=True,
        ),
        SalaryConcept(
            name="Percepciones extrasalariales excluidas",
            amount=money(payload.non_salary_compensation),
            contributes_common=False,
            contributes_professional=False,
            taxable_irpf=False,
        ),
        SalaryConcept(
            name="Horas extraordinarias",
            amount=money(payload.overtime_amount),
            contributes_common=False,
            contributes_professional=True,
            taxable_irpf=True,
        ),
    ]


def sum_concepts(concepts: list[SalaryConcept], attribute: str) -> Decimal:
    total = Decimal("0.00")
    for concept in concepts:
        if getattr(concept, attribute):
            total += money(concept.amount)
    return money(total)


def sum_excluded_concepts(concepts: list[SalaryConcept]) -> Decimal:
    total = Decimal("0.00")
    for concept in concepts:
        if not concept.contributes_common and not concept.contributes_professional and not concept.taxable_irpf:
            total += money(concept.amount)
    return money(total)


def serialize_concepts(concepts: list[SalaryConcept]) -> list[dict]:
    return [
        {
            "name": concept.name,
            "amount": money(concept.amount),
            "contributes_common": concept.contributes_common,
            "contributes_professional": concept.contributes_professional,
            "taxable_irpf": concept.taxable_irpf,
        }
        for concept in concepts
    ]


def calculate_contribution_bases(
    base_salary: Decimal = Decimal("0.00"),
    salary_supplements: Decimal = Decimal("0.00"),
    seniority_amount: Decimal = Decimal("0.00"),
    variable_incentives: Decimal = Decimal("0.00"),
    extra_pay_proration: Decimal = Decimal("0.00"),
    non_salary_compensation: Decimal = Decimal("0.00"),
    overtime_amount: Decimal = Decimal("0.00"),
    contribution_days: int = 30,
    non_contribution_days: int = 0,
    salary_concepts: list[SalaryConcept] | None = None,
) -> dict:
    """Calculate simulated contribution bases for the AulaNomina MVP."""

    normalized_contribution_days = safe_days(contribution_days)
    normalized_non_contribution_days = safe_days(non_contribution_days)
    contribution_day_ratio = calculate_day_ratio(normalized_contribution_days)

    payload = ContributionBaseInput(
        base_salary=money(base_salary),
        salary_supplements=money(salary_supplements),
        seniority_amount=money(seniority_amount),
        variable_incentives=money(variable_incentives),
        extra_pay_proration=money(extra_pay_proration),
        non_salary_compensation=money(non_salary_compensation),
        overtime_amount=money(overtime_amount),
        contribution_days=normalized_contribution_days,
        non_contribution_days=normalized_non_contribution_days,
    )

    concepts = salary_concepts or build_default_salary_concepts(payload)

    gross_salary = money(sum(money(concept.amount) for concept in concepts))
    common_concepts_total = sum_concepts(concepts, "contributes_common")
    professional_concepts_total = sum_concepts(concepts, "contributes_professional")
    taxable_irpf_total = sum_concepts(concepts, "taxable_irpf")
    excluded_concepts_total = sum_excluded_concepts(concepts)

    common_contingencies_base = money(common_concepts_total * contribution_day_ratio)
    professional_contingencies_base = money(professional_concepts_total * contribution_day_ratio)
    unemployment_training_fogasa_base = professional_contingencies_base
    irpf_base = money(taxable_irpf_total * contribution_day_ratio)

    daily_common_base = calculate_daily_base(common_contingencies_base, normalized_contribution_days)
    daily_professional_base = calculate_daily_base(professional_contingencies_base, normalized_contribution_days)

    return {
        "gross_salary": gross_salary,
        "common_contingencies_base": common_contingencies_base,
        "professional_contingencies_base": professional_contingencies_base,
        "unemployment_training_fogasa_base": unemployment_training_fogasa_base,
        "irpf_base": irpf_base,
        "daily_common_base": daily_common_base,
        "daily_professional_base": daily_professional_base,
        "contribution_days": normalized_contribution_days,
        "non_contribution_days": normalized_non_contribution_days,
        "contribution_day_ratio": contribution_day_ratio,
        "included_common_concepts_total": common_concepts_total,
        "included_professional_concepts_total": professional_concepts_total,
        "taxable_irpf_concepts_total": taxable_irpf_total,
        "excluded_concepts_total": excluded_concepts_total,
        "salary_concepts": serialize_concepts(concepts),
    }
