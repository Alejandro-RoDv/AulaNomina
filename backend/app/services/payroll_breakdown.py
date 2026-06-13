from decimal import Decimal

from sqlalchemy.orm import Session

from app.crud.payroll_salary_structure import ensure_payroll_exists, get_payroll_items
from app.services.monthly_extra_pay_proration import PRORATION_CONCEPT_PREFIX
from app.services.payroll_amounts import money


AUTOMATIC_EXTRA_PREFIXES = (PRORATION_CONCEPT_PREFIX, "EXTRA_")
RETROACTIVE_PREFIX = "RETRO_TABLE_"


def build_payroll_breakdown(db: Session, payroll_id: int):
    payroll = ensure_payroll_exists(db, payroll_id)
    items = get_payroll_items(db, payroll_id)
    irpf_percentage = Decimal(str(payroll.irpf_percentage or 0))

    breakdown = {
        "payroll_id": payroll_id,
        "devengos_salariales": [],
        "devengos_extrasalariales": [],
        "prorratas_automaticas": [],
        "regularizaciones_automaticas": [],
        "deducciones": [],
        "bases_informativas": [],
        "total_devengos": Decimal("0.00"),
        "total_prorrata_automatica": Decimal("0.00"),
        "total_regularizacion_automatica": Decimal("0.00"),
        "total_deducciones": Decimal("0.00"),
        "base_irpf_manual": Decimal("0.00"),
        "irpf_percentage": irpf_percentage,
        "irpf_manual": Decimal("0.00"),
        "neto_manual": Decimal("0.00"),
        "neto_manual_con_irpf": Decimal("0.00"),
    }

    for item in items:
        concept = item.concept
        concept_type = concept.concept_type if concept else "DEVENGO"
        salary_nature = concept.salary_nature if concept else "SALARIAL"
        concept_code = concept.code if concept else ""
        is_taxable = bool(concept.is_taxable) if concept else True
        item_amount = money(item.amount)

        if concept_code.startswith(RETROACTIVE_PREFIX):
            breakdown["regularizaciones_automaticas"].append(item)
            breakdown["prorratas_automaticas"].append(item)
            breakdown["total_regularizacion_automatica"] += item_amount
            breakdown["total_devengos"] += item_amount
            continue

        if concept_code.startswith(AUTOMATIC_EXTRA_PREFIXES):
            breakdown["prorratas_automaticas"].append(item)
            breakdown["total_prorrata_automatica"] += item_amount
            breakdown["total_devengos"] += item_amount
            continue

        if concept_type == "DEDUCCION":
            breakdown["deducciones"].append(item)
            breakdown["total_deducciones"] += item_amount
        elif concept_type == "BASE_INFORMATIVA":
            breakdown["bases_informativas"].append(item)
        elif salary_nature == "EXTRASALARIAL":
            breakdown["devengos_extrasalariales"].append(item)
            breakdown["total_devengos"] += item_amount
            if is_taxable:
                breakdown["base_irpf_manual"] += item_amount
        else:
            breakdown["devengos_salariales"].append(item)
            breakdown["total_devengos"] += item_amount
            if is_taxable:
                breakdown["base_irpf_manual"] += item_amount

    breakdown["total_devengos"] = money(breakdown["total_devengos"])
    breakdown["total_prorrata_automatica"] = money(breakdown["total_prorrata_automatica"])
    breakdown["total_regularizacion_automatica"] = money(breakdown["total_regularizacion_automatica"])
    breakdown["total_deducciones"] = money(breakdown["total_deducciones"])
    breakdown["base_irpf_manual"] = money(breakdown["base_irpf_manual"])
    breakdown["irpf_manual"] = money(
        breakdown["base_irpf_manual"] * irpf_percentage / Decimal("100")
    )
    breakdown["neto_manual"] = money(
        breakdown["total_devengos"] - breakdown["total_deducciones"]
    )
    breakdown["neto_manual_con_irpf"] = money(
        breakdown["total_devengos"]
        - breakdown["total_deducciones"]
        - breakdown["irpf_manual"]
    )
    return breakdown
