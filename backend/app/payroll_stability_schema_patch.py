from sqlalchemy import event, inspect, text

from app.db import Base


PAYROLL_STABILITY_COLUMNS = {
    "common_contingencies_base_override": "NUMERIC(10, 2)",
    "professional_contingencies_base_override": "NUMERIC(10, 2)",
    "unemployment_training_fogasa_base_override": "NUMERIC(10, 2)",
    "calculation_version": "INTEGER DEFAULT 0 NOT NULL",
    "calculation_engine_version": "VARCHAR",
    "calculation_fingerprint": "VARCHAR",
    "last_calculated_at": "TIMESTAMP",
}


@event.listens_for(Base.metadata, "after_create")
def add_payroll_stability_columns(target, connection, **kwargs):
    """Conservative bridge for existing MVP databases until Alembic is adopted."""

    inspector = inspect(connection)
    if "payrolls" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("payrolls")}
    for name, definition in PAYROLL_STABILITY_COLUMNS.items():
        if name not in existing:
            connection.execute(text(f"ALTER TABLE payrolls ADD COLUMN {name} {definition}"))

    connection.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_payrolls_calculation_fingerprint "
            "ON payrolls (calculation_fingerprint)"
        )
    )
