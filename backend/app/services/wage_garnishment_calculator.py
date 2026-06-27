from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any


TRANCHES = (
    ("1º tramo", Decimal("0"), "protected"),
    ("2º tramo", Decimal("30"), "smi"),
    ("3º tramo", Decimal("50"), "smi"),
    ("4º tramo", Decimal("60"), "smi"),
    ("5º tramo", Decimal("75"), "smi"),
    ("Exceso", Decimal("90"), "excess"),
)


def money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_wage_garnishment(
    *,
    monthly_net: Decimal,
    smi_annual: Decimal,
    reduction_percentage: Decimal = Decimal("0"),
    extra_pay_prorated: bool = False,
    includes_full_extra_pay: bool = False,
    extra_pay_amount: Decimal = Decimal("0"),
) -> dict[str, Any]:
    monthly_net = money(monthly_net)
    smi_annual = money(smi_annual)
    reduction_percentage = money(reduction_percentage)
    extra_pay_amount = money(extra_pay_amount)

    if monthly_net < 0:
        raise ValueError("La cantidad líquida no puede ser negativa")
    if smi_annual <= 0:
        raise ValueError("El SMI anual debe ser superior a cero")
    if reduction_percentage < 0 or reduction_percentage > 100:
        raise ValueError("La reducción debe estar entre 0 y 100")
    if extra_pay_prorated and includes_full_extra_pay:
        raise ValueError("No se pueden combinar pagas prorrateadas y paga extra completa")
    if includes_full_extra_pay and extra_pay_amount <= 0:
        raise ValueError("El importe líquido de la paga extra debe ser superior a cero")

    smi_monthly = money(smi_annual / Decimal("14"))
    smi_prorated = money(smi_annual / Decimal("12"))
    protected_minimum = (
        money(smi_monthly * Decimal("2"))
        if includes_full_extra_pay
        else smi_prorated if extra_pay_prorated else smi_monthly
    )
    final_net = money(monthly_net + (extra_pay_amount if includes_full_extra_pay else Decimal("0")))
    pending = final_net
    tranche_rows: list[dict[str, Any]] = []

    for name, legal_percentage, tranche_type in TRANCHES:
        limit = protected_minimum if tranche_type == "protected" else smi_monthly
        if tranche_type == "excess":
            limit = pending
        base = money(max(Decimal("0"), min(pending, limit)))
        pending = money(max(Decimal("0"), pending - base))
        applied_percentage = (
            max(Decimal("0"), legal_percentage - reduction_percentage)
            if Decimal("0") < legal_percentage < Decimal("90")
            else legal_percentage
        )
        garnishable = money(base * applied_percentage / Decimal("100"))
        tranche_rows.append(
            {
                "nombre": name,
                "baseTramo": float(base),
                "smiReferencia": float(protected_minimum if tranche_type == "protected" else smi_monthly),
                "porcentaje": float(legal_percentage),
                "porcentajeAplicado": float(applied_percentage),
                "importeEmbargable": float(garnishable),
            }
        )

    total = money(sum((Decimal(str(row["importeEmbargable"])) for row in tranche_rows), Decimal("0")))
    return {
        "totalEmbargable": float(total),
        "liquidoFinalCalculado": float(final_net),
        "smiAnual": float(smi_annual),
        "smiMensual": float(smi_monthly),
        "smiProrrateado": float(smi_prorated),
        "minimoInembargable": float(protected_minimum),
        "unidadTramo": float(smi_monthly),
        "tramos": tranche_rows,
    }
