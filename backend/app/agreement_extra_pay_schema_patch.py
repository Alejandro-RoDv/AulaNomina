from sqlalchemy import inspect, text

from app.db import engine


EXTRA_PAY_ACCRUAL_COLUMNS = {
    "payroll_period": "INTEGER DEFAULT 13 NOT NULL",
    "apply_partiality": "BOOLEAN DEFAULT TRUE NOT NULL",
    "deduct_it_days": "BOOLEAN DEFAULT FALSE NOT NULL",
    "deduct_unpaid_absence_days": "BOOLEAN DEFAULT TRUE NOT NULL",
    "deduct_inactivity_days": "BOOLEAN DEFAULT TRUE NOT NULL",
}


def add_missing_agreement_extra_pay_accrual_columns() -> None:
    inspector = inspect(engine)
    if "agreement_extra_pays" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns("agreement_extra_pays")
    }

    with engine.begin() as connection:
        for column_name, column_definition in EXTRA_PAY_ACCRUAL_COLUMNS.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(
                        "ALTER TABLE agreement_extra_pays ADD COLUMN "
                        + column_name
                        + " "
                        + column_definition
                    )
                )

        connection.execute(
            text(
                """
                UPDATE agreement_extra_pays
                SET payroll_period = COALESCE(payroll_period, 13),
                    apply_partiality = COALESCE(apply_partiality, TRUE),
                    deduct_it_days = COALESCE(deduct_it_days, FALSE),
                    deduct_unpaid_absence_days = COALESCE(deduct_unpaid_absence_days, TRUE),
                    deduct_inactivity_days = COALESCE(deduct_inactivity_days, TRUE)
                """
            )
        )
