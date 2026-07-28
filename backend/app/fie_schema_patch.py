from sqlalchemy import inspect, text

from app.db import Base, engine


FIE_COLUMNS = {
    "external_worker_name": "VARCHAR",
    "external_nif": "VARCHAR",
    "priority": "VARCHAR DEFAULT 'NORMAL' NOT NULL",
    "read_at": "TIMESTAMP",
}


def apply_fie_schema_patch() -> None:
    """Create FIE tables and add the Split 37 reconciliation columns.

    AulaNomina still uses lightweight schema patches until Alembic is introduced.
    PostgreSQL installations created with the first FIE draft also need employee_id
    changed to nullable so educational messages can arrive without an identified worker.
    """

    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    if "fie_communications" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("fie_communications")}
    with engine.begin() as connection:
        for column_name, definition in FIE_COLUMNS.items():
            if column_name not in existing:
                connection.execute(text(f"ALTER TABLE fie_communications ADD COLUMN {column_name} {definition}"))

        if engine.dialect.name == "postgresql":
            connection.execute(text("ALTER TABLE fie_communications ALTER COLUMN employee_id DROP NOT NULL"))

        connection.execute(
            text(
                """
                UPDATE fie_communications
                SET priority = COALESCE(priority, 'NORMAL')
                """
            )
        )
