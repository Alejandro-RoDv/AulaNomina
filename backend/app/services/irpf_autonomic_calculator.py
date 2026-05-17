from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from typing import Any

CALCULATION_YEAR = 2026

STATE_SCALE = [
    (Decimal("0.00"), Decimal("12450.00"), Decimal("0.095")),
    (Decimal("12450.00"), Decimal("20200.00"), Decimal("0.120")),
    (Decimal("20200.00"), Decimal("35200.00"), Decimal("0.150")),
    (Decimal("35200.00"), Decimal("60000.00"), Decimal("0.185")),
    (Decimal("60000.00"), Decimal("300000.00"), Decimal("0.225")),
    (Decimal("300000.00"), None, Decimal("0.245")),
]

REGIONAL_SCALES = {
    "andalucia": [
        (Decimal("0.00"), Decimal("13000.00"), Decimal("0.095")),
        (Decimal("13000.00"), Decimal("21000.00"), Decimal("0.120")),
        (Decimal("21000.00"), Decimal("35200.00"), Decimal("0.150")),
        (Decimal("35200.00"), Decimal("50000.00"), Decimal("0.185")),
        (Decimal("50000.00"), None, Decimal("0.225")),
    ],
    "aragon": [
        (Decimal("0.00"), Decimal("13972.50"), Decimal("0.095")),
        (Decimal("13972.50"), Decimal("21210.00"), Decimal("0.120")),
        (Decimal("21210.00"), Decimal("36960.00"), Decimal("0.150")),
        (Decimal("36960.00"), Decimal("52500.00"), Decimal("0.185")),
        (Decimal("52500.00"), Decimal("60000.00"), Decimal("0.205")),
        (Decimal("60000.00"), Decimal("80000.00"), Decimal("0.230")),
        (Decimal("80000.00"), Decimal("90000.00"), Decimal("0.240")),
        (Decimal("90000.00"), Decimal("130000.00"), Decimal("0.250")),
        (Decimal("130000.00"), None, Decimal("0.255")),
    ],
    "asturias": [
        (Decimal("0.00"), Decimal("12450.00"), Decimal("0.100")),
        (Decimal("12450.00"), Decimal("17707.00"), Decimal("0.120")),
        (Decimal("17707.00"), Decimal("33007.00"), Decimal("0.140")),
        (Decimal("33007.00"), Decimal("53407.00"), Decimal("0.185")),
        (Decimal("53407.00"), Decimal("70000.00"), Decimal("0.215")),
        (Decimal("70000.00"), Decimal("90000.00"), Decimal("0.225")),
        (Decimal("90000.00"), Decimal("175000.00"), Decimal("0.250")),
        (Decimal("175000.00"), None, Decimal("0.255")),
    ],
    "baleares": [
        (Decimal("0.00"), Decimal("10000.00"), Decimal("0.090")),
        (Decimal("10000.00"), Decimal("18000.00"), Decimal("0.1125")),
        (Decimal("18000.00"), Decimal("30000.00"), Decimal("0.1425")),
        (Decimal("30000.00"), Decimal("48000.00"), Decimal("0.175")),
        (Decimal("48000.00"), Decimal("70000.00"), Decimal("0.190")),
        (Decimal("70000.00"), Decimal("90000.00"), Decimal("0.2175")),
        (Decimal("90000.00"), Decimal("120000.00"), Decimal("0.2275")),
        (Decimal("120000.00"), Decimal("175000.00"), Decimal("0.2375")),
        (Decimal("175000.00"), None, Decimal("0.2475")),
    ],
    "canarias": [
        (Decimal("0.00"), Decimal("12450.00"), Decimal("0.090")),
        (Decimal("12450.00"), Decimal("17707.00"), Decimal("0.115")),
        (Decimal("17707.00"), Decimal("33007.00"), Decimal("0.140")),
        (Decimal("33007.00"), Decimal("53407.00"), Decimal("0.185")),
        (Decimal("53407.00"), Decimal("90000.00"), Decimal("0.235")),
        (Decimal("90000.00"), Decimal("120000.00"), Decimal("0.250")),
        (Decimal("120000.00"), None, Decimal("0.260")),
    ],
    "cantabria": [
        (Decimal("0.00"), Decimal("13000.00"), Decimal("0.085")),
        (Decimal("13000.00"), Decimal("21000.00"), Decimal("0.110")),
        (Decimal("21000.00"), Decimal("35200.00"), Decimal("0.145")),
        (Decimal("35200.00"), Decimal("60000.00"), Decimal("0.180")),
        (Decimal("60000.00"), Decimal("90000.00"), Decimal("0.225")),
        (Decimal("90000.00"), None, Decimal("0.245")),
    ],
    "castilla_la_mancha": [
        (Decimal("0.00"), Decimal("12450.00"), Decimal("0.095")),
        (Decimal("12450.00"), Decimal("20200.00"), Decimal("0.120")),
        (Decimal("20200.00"), Decimal("35200.00"), Decimal("0.150")),
        (Decimal("35200.00"), Decimal("60000.00"), Decimal("0.185")),
        (Decimal("60000.00"), None, Decimal("0.225")),
    ],
    "castilla_y_leon": [
        (Decimal("0.00"), Decimal("12450.00"), Decimal("0.090")),
        (Decimal("12450.00"), Decimal("20200.00"), Decimal("0.120")),
        (Decimal("20200.00"), Decimal("35200.00"), Decimal("0.140")),
        (Decimal("35200.00"), Decimal("53407.00"), Decimal("0.185")),
        (Decimal("53407.00"), None, Decimal("0.215")),
    ],
    "cataluna": [
        (Decimal("0.00"), Decimal("12450.00"), Decimal("0.105")),
        (Decimal("12450.00"), Decimal("17707.00"), Decimal("0.120")),
        (Decimal("17707.00"), Decimal("21000.00"), Decimal("0.140")),
        (Decimal("21000.00"), Decimal("33007.00"), Decimal("0.150")),
        (Decimal("33007.00"), Decimal("53407.00"), Decimal("0.188")),
        (Decimal("53407.00"), Decimal("90000.00"), Decimal("0.215")),
        (Decimal("90000.00"), Decimal("120000.00"), Decimal("0.235")),
        (Decimal("120000.00"), Decimal("175000.00"), Decimal("0.245")),
        (Decimal("175000.00"), None, Decimal("0.255")),
    ],
    "madrid": [
        (Decimal("0.00"), Decimal("13362.00"), Decimal("0.085")),
        (Decimal("13362.00"), Decimal("18004.00"), Decimal("0.107")),
        (Decimal("18004.00"), Decimal("35425.00"), Decimal("0.128")),
        (Decimal("35425.00"), Decimal("57320.00"), Decimal("0.174")),
        (Decimal("57320.00"), None, Decimal("0.205")),
    ],
}

# TODO pendiente de actualizar: estas comunidades usan provisionalmente la escala de Madrid.
FALLBACK_MADRID_COMMUNITIES = {
    "extremadura",
    "galicia",
    "la_rioja",
    "murcia",
    "navarra",
    "pais_vasco",
    "comunidad_valenciana",
}

EXEMPT_LIMITS = {
    "situation_1": {1: Decimal("17644.00"), 2: Decimal("18694.00")},
    "situation_2": {0: Decimal("17197.00"), 1: Decimal("18130.00"), 2: Decimal("19262.00")},
    "situation_3": {0: Decimal("15876.00"), 1: Decimal("16342.00"), 2: Decimal("16867.00")},
    "general": {0: Decimal("15876.00"), 1: Decimal("16342.00"), 2: Decimal("16867.00")},
}


def money(value: Any) -> Decimal:
    if value in (None, ""):
        return Decimal("0.00")
    return Decimal(str(value))


def round_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def truncate_percent(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_DOWN)


def as_float(value: Decimal) -> float:
    return float(round_money(value))


def normalize_autonomous_community(value: str | None) -> str:
    normalized = str(value or "andalucia").lower().strip().replace(" ", "_").replace("-", "_")
    aliases = {
        "andalucia": "andalucia",
        "andalucía": "andalucia",
        "aragon": "aragon",
        "aragón": "aragon",
        "asturias": "asturias",
        "baleares": "baleares",
        "illes_balears": "baleares",
        "canarias": "canarias",
        "cantabria": "cantabria",
        "castilla_la_mancha": "castilla_la_mancha",
        "castilla_y_leon": "castilla_y_leon",
        "castilla_y_león": "castilla_y_leon",
        "cataluna": "cataluna",
        "cataluña": "cataluna",
        "madrid": "madrid",
        "comunidad_de_madrid": "madrid",
        "extremadura": "extremadura",
        "galicia": "galicia",
        "la_rioja": "la_rioja",
        "murcia": "murcia",
        "navarra": "navarra",
        "pais_vasco": "pais_vasco",
        "país_vasco": "pais_vasco",
        "comunidad_valenciana": "comunidad_valenciana",
        "valencia": "comunidad_valenciana",
    }
    return aliases.get(normalized, "andalucia")


def normalize_family_situation(value: str | None) -> str:
    if value in {"situation_1", "SITUACION1", "1"}:
        return "situation_1"
    if value in {"situation_2", "SITUACION2", "2"}:
        return "situation_2"
    return "situation_3"


def normalize_disability(value: str | None, fallback: bool = False) -> str:
    if value in {"from_33_to_65", "DE33A65", "33_65"}:
        return "from_33_to_65"
    if value in {"from_65", "DESDE65", "65"}:
        return "from_65"
    if fallback:
        return "from_33_to_65"
    return "none"


def normalize_contract_category(value: str | None) -> str:
    if value in {"inferior_year", "INFERIORAÑO", "inferior_ano", "temporary_under_year"}:
        return "inferior_year"
    if value in {"special", "ESPECIAL"}:
        return "special"
    if value in {"manual", "MANUALES"}:
        return "manual"
    return "general"


def normalize_employment_situation(value: str | None) -> str:
    if value in {"pensioner", "PENSIONISTA"}:
        return "pensioner"
    if value in {"unemployed", "DESEMPLEADO"}:
        return "unemployed"
    if value in {"other", "OTRA"}:
        return "other"
    return "active"


def get_regional_scale(community: str) -> tuple[list[tuple[Decimal, Decimal | None, Decimal]], bool]:
    if community in REGIONAL_SCALES:
        return REGIONAL_SCALES[community], False
    if community in FALLBACK_MADRID_COMMUNITIES:
        return REGIONAL_SCALES["madrid"], True
    return REGIONAL_SCALES["madrid"], True


def scale_tax_part(base: Decimal, scale: list[tuple[Decimal, Decimal | None, Decimal]]) -> Decimal:
    if base <= 0:
        return Decimal("0.00")
    quota = Decimal("0.00")
    for start, end, rate in scale:
        if base <= start:
            break
        upper = base if end is None or base < end else end
        if upper > start:
            quota += (upper - start) * rate
        if end is None or base <= end:
            break
    return quota


def scale_tax(base: Decimal, community: str) -> Decimal:
    regional_scale, _ = get_regional_scale(community)
    return scale_tax_part(base, STATE_SCALE) + scale_tax_part(base, regional_scale)


def computed_share(item: dict[str, Any], share_key: str = "whole") -> Decimal:
    if item.get(share_key) is True or item.get("full_computation") is True:
        return Decimal("1.00")
    share = item.get("share")
    if share not in (None, ""):
        return Decimal(str(share))
    return Decimal("0.50")


def get_descendants(profile: dict[str, Any]) -> list[dict[str, Any]]:
    descendants = profile.get("descendants") or []
    if descendants:
        return descendants[:16]
    count = int(profile.get("children_count") or 0)
    disability = normalize_disability(None, bool(profile.get("descendants_disability")))
    return [
        {"birth_year": CALCULATION_YEAR - 10, "whole": False, "disability_degree": disability, "reduced_mobility": False}
        for _ in range(min(count, 16))
    ]


def get_ascendants(profile: dict[str, Any]) -> list[dict[str, Any]]:
    ascendants = profile.get("ascendants") or []
    if ascendants:
        return ascendants[:6]
    count = int(profile.get("ascendants_in_care") or 0)
    return [
        {"birth_year": CALCULATION_YEAR - 75, "cohabitation_people": 1, "disability_degree": "none", "reduced_mobility": False}
        for _ in range(min(count, 6))
    ]


def calculate_descendant_values(profile: dict[str, Any]) -> dict[str, Any]:
    descendants = sorted(get_descendants(profile), key=lambda item: int(item.get("birth_year") or 9999))
    eligible = []
    for item in descendants:
        birth_year = int(item.get("birth_year") or 0)
        disability = normalize_disability(item.get("disability_degree"))
        age = CALCULATION_YEAR - birth_year if birth_year else 999
        if birth_year and (age < 25 or disability != "none"):
            eligible.append({**item, "age": age, "share": computed_share(item), "disability": disability})

    minimum_general = Decimal("0.00")
    minimum_under_3 = Decimal("0.00")
    disability_minimum = Decimal("0.00")
    assistance = Decimal("0.00")

    for index, item in enumerate(eligible, start=1):
        share = item["share"]
        if index == 1:
            minimum_general += Decimal("2400.00") * share
        elif index == 2:
            minimum_general += Decimal("2700.00") * share
        elif index == 3:
            minimum_general += Decimal("4000.00") * share
        else:
            minimum_general += Decimal("4500.00") * share

        adoption_year = int(item.get("adoption_year") or 0)
        if item["age"] < 3 or adoption_year > 2023:
            minimum_under_3 += Decimal("2800.00") * share

        if item["disability"] == "from_65":
            disability_minimum += Decimal("9000.00") * share
            assistance += Decimal("3000.00") * share
        elif item["disability"] == "from_33_to_65":
            disability_minimum += Decimal("3000.00") * share
            if item.get("reduced_mobility"):
                assistance += Decimal("3000.00") * share

    return {
        "count": len(eligible),
        "minimum": round_money(minimum_general + minimum_under_3),
        "disability_minimum": round_money(disability_minimum + assistance),
        "details": eligible,
    }


def calculate_ascendant_values(profile: dict[str, Any]) -> dict[str, Any]:
    ascendants = get_ascendants(profile)
    minimum = Decimal("0.00")
    disability_minimum = Decimal("0.00")
    eligible_count = 0
    details = []

    for item in ascendants:
        birth_year = int(item.get("birth_year") or 0)
        disability = normalize_disability(item.get("disability_degree"))
        age = CALCULATION_YEAR - birth_year if birth_year else 0
        cohabitation_people = Decimal(str(item.get("cohabitation_people") or 1))
        if cohabitation_people <= 0:
            cohabitation_people = Decimal("1")
        share_divisor = cohabitation_people

        is_eligible = birth_year and (age >= 65 or disability != "none")
        if not is_eligible:
            continue

        eligible_count += 1
        minimum += Decimal("1150.00") / share_divisor
        if age >= 75:
            minimum += Decimal("1400.00") / share_divisor

        if disability == "from_65":
            disability_minimum += Decimal("9000.00") / share_divisor
            disability_minimum += Decimal("3000.00") / share_divisor
        elif disability == "from_33_to_65":
            disability_minimum += Decimal("3000.00") / share_divisor
            if item.get("reduced_mobility"):
                disability_minimum += Decimal("3000.00") / share_divisor

        details.append({**item, "age": age, "disability": disability})

    return {
        "count": eligible_count,
        "minimum": round_money(minimum),
        "disability_minimum": round_money(disability_minimum),
        "details": details,
    }


def calculate_irpf_2026(profile: dict[str, Any]) -> dict[str, Any]:
    community = normalize_autonomous_community(profile.get("autonomous_community"))
    _, regional_fallback = get_regional_scale(community)
    family_situation = normalize_family_situation(profile.get("family_situation"))
    employment_situation = normalize_employment_situation(profile.get("employment_situation"))
    contract_category = normalize_contract_category(profile.get("contract_category") or profile.get("contract_type"))

    retrib = money(profile.get("expected_annual_salary"))
    cotizaciones = money(profile.get("social_security_contributions"))
    if cotizaciones == 0 and retrib > 0:
        cotizaciones = round_money(retrib * Decimal("0.0635"))

    irregular_1 = min(money(profile.get("irregular_income_18_2")), Decimal("90000.00"), retrib * Decimal("0.30"))
    irregular_2 = money(profile.get("irregular_income_18_3"))
    compensatory_pension = money(profile.get("compensatory_pension"))
    child_support_annuity = money(profile.get("child_support_annuity"))

    employee_disability = normalize_disability(profile.get("disability_degree"), bool(profile.get("employee_disability")))
    reduced_mobility = bool(profile.get("reduced_mobility"))
    geographic_mobility = bool(profile.get("geographic_mobility"))

    deductible_general = Decimal("2000.00")
    deductible_mobility = Decimal("2000.00") if geographic_mobility else Decimal("0.00")
    if employment_situation == "active" and (employee_disability == "from_65" or (employee_disability == "from_33_to_65" and reduced_mobility)):
        disability_worker_expense = Decimal("7750.00")
    elif employment_situation == "active" and employee_disability == "from_33_to_65":
        disability_worker_expense = Decimal("3500.00")
    else:
        disability_worker_expense = Decimal("0.00")

    other_expenses = deductible_general + deductible_mobility + disability_worker_expense
    salary_less_contributions = retrib - cotizaciones
    if salary_less_contributions < 0:
        other_expenses = Decimal("0.00")
    elif other_expenses > salary_less_contributions:
        other_expenses = salary_less_contributions

    deductible_expenses = cotizaciones + other_expenses
    rnt = retrib - irregular_1 - irregular_2 - cotizaciones
    if rnt < 0:
        rnt = Decimal("0.00")

    if rnt <= Decimal("14852.00"):
        red20 = Decimal("7302.00")
    elif rnt <= Decimal("17673.52"):
        red20 = Decimal("7302.00") - (Decimal("1.75") * (rnt - Decimal("14852.00")))
    elif rnt < Decimal("19747.50"):
        red20 = Decimal("2364.34") - (Decimal("1.14") * (rnt - Decimal("17673.52")))
    else:
        red20 = Decimal("0.00")
    red20 = round_money(max(red20, Decimal("0.00")))

    rnt_reduced = rnt - other_expenses - red20
    if rnt_reduced < 0:
        rnt_reduced = Decimal("0.00")

    pension_reduction = Decimal("600.00") if employment_situation == "pensioner" else Decimal("0.00")
    unemployment_reduction = Decimal("1200.00") if employment_situation == "unemployed" else Decimal("0.00")

    descendants = calculate_descendant_values(profile)
    ascendants = calculate_ascendant_values(profile)
    children_reduction = Decimal("600.00") if descendants["count"] > 2 else Decimal("0.00")

    birth_year = profile.get("birth_year")
    age = CALCULATION_YEAR - int(birth_year) if birth_year else 0
    taxpayer_minimum = Decimal("5550.00")
    if age >= 65:
        taxpayer_minimum += Decimal("1150.00")
    if age >= 75:
        taxpayer_minimum += Decimal("1400.00")

    if employee_disability == "from_65":
        taxpayer_disability_minimum = Decimal("12000.00")
    elif employee_disability == "from_33_to_65":
        taxpayer_disability_minimum = Decimal("3000.00") + (Decimal("3000.00") if reduced_mobility else Decimal("0.00"))
    else:
        taxpayer_disability_minimum = Decimal("0.00")

    minimum_personal_family = round_money(
        taxpayer_minimum
        + descendants["minimum"]
        + ascendants["minimum"]
        + taxpayer_disability_minimum
        + descendants["disability_minimum"]
        + ascendants["disability_minimum"]
    )

    reductions = pension_reduction + children_reduction + unemployment_reduction + compensatory_pension
    base = rnt_reduced - reductions
    if base < 0:
        base = Decimal("0.00")

    num_descendants_for_limit = 2 if descendants["count"] > 1 else descendants["count"]
    limit_table = EXEMPT_LIMITS.get(family_situation, EXEMPT_LIMITS["situation_3"])
    exempt_limit = limit_table.get(num_descendants_for_limit)
    exempt = False
    if exempt_limit is not None and retrib <= exempt_limit + pension_reduction + unemployment_reduction:
        exempt = True

    if exempt or retrib <= 0:
        cuota = Decimal("0.00")
        tipo = Decimal("0.00")
        annual_withholding = Decimal("0.00")
        applied_limit = False
    else:
        if child_support_annuity > 0 and base - child_support_annuity > 0:
            quota_1 = scale_tax(base - child_support_annuity, community) + scale_tax(child_support_annuity, community)
            quota_2 = scale_tax(minimum_personal_family + Decimal("1980.00"), community)
        else:
            quota_1 = scale_tax(base, community)
            quota_2 = scale_tax(minimum_personal_family, community)

        cuota = quota_1 - quota_2
        if cuota < 0:
            cuota = Decimal("0.00")

        applied_limit = False
        if retrib <= Decimal("35200.00") and exempt_limit is not None:
            legal_limit = (retrib - (exempt_limit + pension_reduction + unemployment_reduction)) * Decimal("0.43")
            if legal_limit < 0:
                legal_limit = Decimal("0.00")
            if cuota > legal_limit:
                cuota = legal_limit
                applied_limit = True

        ceuta_melilla = bool(profile.get("ceuta_melilla_residence")) and bool(profile.get("ceuta_melilla_income"))
        if bool(profile.get("home_loan")) and retrib < Decimal("33007.20"):
            home_loan_reduction = (retrib * Decimal("0.02")).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
        else:
            home_loan_reduction = Decimal("0.00")

        positive_difference = (cuota * Decimal("0.40") if ceuta_melilla else cuota) - home_loan_reduction
        if positive_difference < 0:
            positive_difference = Decimal("0.00")

        tipo = truncate_percent((positive_difference / retrib) * Decimal("100")) if retrib else Decimal("0.00")

        if ceuta_melilla:
            if contract_category == "special" and tipo < Decimal("6.00"):
                tipo = Decimal("6.00")
            elif contract_category == "inferior_year" and tipo < Decimal("0.80"):
                tipo = Decimal("0.80")
        else:
            if contract_category == "special" and tipo < Decimal("15.00"):
                tipo = Decimal("15.00")
            elif contract_category == "inferior_year" and tipo < Decimal("2.00"):
                tipo = Decimal("2.00")

        annual_withholding = round_money((retrib * tipo) / Decimal("100"))

    return {
        "suggested_irpf": float(tipo),
        "annual_withholding": as_float(annual_withholding),
        "cuota": as_float(cuota),
        "base": as_float(base),
        "minimum_personal_family": as_float(minimum_personal_family),
        "net_work_income": as_float(rnt),
        "reduced_net_work_income": as_float(rnt_reduced),
        "deductible_expenses": as_float(deductible_expenses),
        "reduction_work_income": as_float(red20),
        "exempt": exempt,
        "applied_minimum_limit": applied_limit,
        "details": {
            "calculation_year": CALCULATION_YEAR,
            "autonomous_community": community,
            "regional_scale_fallback_madrid": regional_fallback,
            "family_situation": family_situation,
            "employment_situation": employment_situation,
            "contract_category": contract_category,
            "social_security_contributions_used": as_float(cotizaciones),
            "other_expenses": as_float(other_expenses),
            "descendants_count": descendants["count"],
            "ascendants_count": ascendants["count"],
            "descendants_minimum": as_float(descendants["minimum"]),
            "ascendants_minimum": as_float(ascendants["minimum"]),
            "taxpayer_minimum": as_float(taxpayer_minimum),
            "taxpayer_disability_minimum": as_float(taxpayer_disability_minimum),
            "home_loan": bool(profile.get("home_loan")),
            "ceuta_melilla": bool(profile.get("ceuta_melilla_residence")) and bool(profile.get("ceuta_melilla_income")),
        },
    }
