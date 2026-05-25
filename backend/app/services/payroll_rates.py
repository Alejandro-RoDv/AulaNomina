from decimal import Decimal


DEFAULT_PAYROLL_RATES = {
    "employee_common_contingencies": Decimal("4.70"),
    "employee_unemployment": Decimal("1.55"),
    "employee_training": Decimal("0.10"),
    "employee_mei": Decimal("0.13"),
    "company_common_contingencies": Decimal("23.60"),
    "company_unemployment": Decimal("5.50"),
    "company_fogasa": Decimal("0.20"),
    "company_training": Decimal("0.60"),
    "company_at_ep": Decimal("1.50"),
    "company_mei": Decimal("0.67"),
}
