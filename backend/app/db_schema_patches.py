from sqlalchemy import inspect, text

from app.db import engine


PAYROLL_CONTRIBUTION_COLUMNS = {
    "contribution_days": "INTEGER DEFAULT 30 NOT NULL",
    "worked_days": "INTEGER DEFAULT 30 NOT NULL",
    "incident_days": "INTEGER DEFAULT 0 NOT NULL",
    "non_contribution_days": "INTEGER DEFAULT 0 NOT NULL",
    "daily_common_base": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
    "daily_professional_base": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
}

BASE_COLUMNS_REQUIRED_FOR_DAILY_BASE_BACKFILL = {
    "gross_salary",
    "common_contingencies_base",
    "professional_contingencies_base",
}


def add_missing_payroll_contribution_columns() -> None:
    """Add Split 18 payroll contribution-day columns to existing databases.

    This is an idempotent development/demo bridge until Alembic migrations are
    introduced. It is intentionally narrow and defensive:
    - It always adds the new columns if payrolls exists.
    - It only backfills daily bases when the older base columns already exist.
    """

    inspector = inspect(engine)
    if "payrolls" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("payrolls")}

    with engine.begin() as connection:
        for column_name, column_definition in PAYROLL_CONTRIBUTION_COLUMNS.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(f"ALTER TABLE payrolls ADD COLUMN {column_name} {column_definition}")
                )

        refreshed_columns = {
            column["name"] for column in inspect(connection).get_columns("payrolls")
        }

        if not BASE_COLUMNS_REQUIRED_FOR_DAILY_BASE_BACKFILL.issubset(refreshed_columns):
            connection.execute(
                text(
                    """
                    UPDATE payrolls
                    SET contribution_days = COALESCE(NULLIF(contribution_days, 0), 30),
                        worked_days = COALESCE(NULLIF(worked_days, 0), 30),
                        incident_days = COALESCE(incident_days, 0),
                        non_contribution_days = COALESCE(non_contribution_days, 0),
                        daily_common_base = COALESCE(daily_common_base, 0),
                        daily_professional_base = COALESCE(daily_professional_base, 0)
                    """
                )
            )
            return

        connection.execute(
            text(
                """
                UPDATE payrolls
                SET contribution_days = COALESCE(NULLIF(contribution_days, 0), 30),
                    worked_days = COALESCE(NULLIF(worked_days, 0), 30),
                    incident_days = COALESCE(incident_days, 0),
                    non_contribution_days = COALESCE(non_contribution_days, 0),
                    daily_common_base = COALESCE(
                        NULLIF(daily_common_base, 0),
                        ROUND(
                            (
                                COALESCE(NULLIF(common_contingencies_base, 0), gross_salary)
                                / NULLIF(COALESCE(NULLIF(contribution_days, 0), 30), 0)
                            )::numeric,
                            2
                        )
                    ),
                    daily_professional_base = COALESCE(
                        NULLIF(daily_professional_base, 0),
                        ROUND(
                            (
                                COALESCE(NULLIF(professional_contingencies_base, 0), gross_salary)
                                / NULLIF(COALESCE(NULLIF(contribution_days, 0), 30), 0)
                            )::numeric,
                            2
                        )
                    )
                """
            )
        )
