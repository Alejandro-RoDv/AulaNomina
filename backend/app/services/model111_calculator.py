from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP


CENT = Decimal("0.01")
QUARTER_MONTHS = {
    "1T": (1, 2, 3),
    "2T": (4, 5, 6),
    "3T": (7, 8, 9),
    "4T": (10, 11, 12),
}
MONTHLY_PERIODS = {f"{month:02d}": month for month in range(1, 13)}


def money(value) -> Decimal:
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def period_bounds(year: int, period: str) -> tuple[date, date, str]:
    normalized = str(period).upper().strip()
    if normalized in QUARTER_MONTHS:
        months = QUARTER_MONTHS[normalized]
        start = date(year, months[0], 1)
        end_month = months[-1]
        end = date(year, end_month, monthrange(year, end_month)[1])
        return start, end, "quarterly"
    if normalized in MONTHLY_PERIODS:
        month = MONTHLY_PERIODS[normalized]
        return date(year, month, 1), date(year, month, monthrange(year, month)[1]), "monthly"
    raise ValueError("Periodo no válido. Usa 1T, 2T, 3T, 4T o un mes entre 01 y 12")


def period_contains_month(period: str, month: int) -> bool:
    normalized = str(period).upper().strip()
    if normalized in QUARTER_MONTHS:
        return month in QUARTER_MONTHS[normalized]
    return MONTHLY_PERIODS.get(normalized) == month


def classify_result(has_operations: bool, total_withholding) -> str:
    total = money(total_withholding)
    if not has_operations:
        return "no_activity"
    if total == Decimal("0.00"):
        return "negative"
    return "payable"


def summarize_lines(lines: list[dict], previous_result=Decimal("0.00")) -> dict:
    work_lines = [line for line in lines if line["category"] == "work"]
    professional_lines = [line for line in lines if line["category"] == "economic_activity"]

    def block_summary(block_lines: list[dict]) -> dict:
        recipient_keys = {
            line["recipient_key"]
            for line in block_lines
            if money(line.get("base_amount")) != 0 or money(line.get("withholding_amount")) != 0
        }
        return {
            "perceptors": len(recipient_keys),
            "base": money(sum((money(line.get("base_amount")) for line in block_lines), Decimal("0.00"))),
            "withholding": money(
                sum((money(line.get("withholding_amount")) for line in block_lines), Decimal("0.00"))
            ),
        }

    work = block_summary(work_lines)
    professionals = block_summary(professional_lines)
    total = money(work["withholding"] + professionals["withholding"])
    previous = money(previous_result)
    result = money(total - previous)
    has_operations = any(
        money(line.get("base_amount")) != 0 or money(line.get("withholding_amount")) != 0
        for line in lines
    )

    return {
        "work": work,
        "professionals": professionals,
        "total_withholding": total,
        "previous_result": previous,
        "result_amount": result,
        "has_operations": has_operations,
        "result_type": classify_result(has_operations, result),
    }


def build_reconciliation(lines: list[dict]) -> list[dict]:
    groups: dict[str, dict] = {}
    for line in lines:
        key = line.get("reconciliation_key") or line.get("source_type") or "other"
        group = groups.setdefault(
            key,
            {
                "key": key,
                "label": line.get("reconciliation_label") or key,
                "sort_order": int(line.get("reconciliation_order") or 999),
                "recipient_keys": set(),
                "base": Decimal("0.00"),
                "withholding": Decimal("0.00"),
                "source_count": 0,
            },
        )
        group["recipient_keys"].add(line["recipient_key"])
        group["base"] += money(line.get("base_amount"))
        group["withholding"] += money(line.get("withholding_amount"))
        group["source_count"] += 1

    result = []
    for group in sorted(groups.values(), key=lambda item: (item["sort_order"], item["label"])):
        result.append(
            {
                "key": group["key"],
                "label": group["label"],
                "perceptors": len(group["recipient_keys"]),
                "base": money(group["base"]),
                "withholding": money(group["withholding"]),
                "source_count": group["source_count"],
            }
        )
    return result
