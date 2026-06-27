from sqlalchemy import inspect, text

from app.db import Base, engine


GARNISHMENT_COLUMNS = {
    "priority": "INTEGER DEFAULT 1 NOT NULL",
    "reduction_authorized": "BOOLEAN DEFAULT FALSE NOT NULL",
    "reduction_authorization_date": "DATE",
    "reduction_authorization_reference": "VARCHAR(180)",
    "archived": "BOOLEAN DEFAULT FALSE NOT NULL",
    "deleted_at": "TIMESTAMP",
    "deleted_by": "VARCHAR(120)",
    "deleted_reason": "TEXT",
    "created_by": "VARCHAR(120) DEFAULT 'usuario-demo' NOT NULL",
    "updated_by": "VARCHAR(120) DEFAULT 'usuario-demo' NOT NULL",
}

DOCUMENT_COLUMNS = {
    "wage_garnishment_id": "INTEGER REFERENCES wage_garnishments(id)",
}


def apply_wage_garnishment_schema_patch() -> None:
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    with engine.begin() as connection:
        if "wage_garnishments" in table_names:
            existing = {column["name"] for column in inspector.get_columns("wage_garnishments")}
            for column_name, definition in GARNISHMENT_COLUMNS.items():
                if column_name not in existing:
                    connection.execute(text(f"ALTER TABLE wage_garnishments ADD COLUMN {column_name} {definition}"))
            connection.execute(
                text(
                    """
                    UPDATE wage_garnishments
                    SET priority = COALESCE(priority, 1),
                        reduction_authorized = COALESCE(reduction_authorized, FALSE),
                        archived = COALESCE(archived, FALSE),
                        created_by = COALESCE(created_by, 'usuario-demo'),
                        updated_by = COALESCE(updated_by, 'usuario-demo')
                    """
                )
            )

        if "documents" in table_names:
            existing = {column["name"] for column in inspector.get_columns("documents")}
            for column_name, definition in DOCUMENT_COLUMNS.items():
                if column_name not in existing:
                    connection.execute(text(f"ALTER TABLE documents ADD COLUMN {column_name} {definition}"))

        if "smi_parameters" in table_names:
            count = connection.execute(text("SELECT COUNT(*) FROM smi_parameters")).scalar_one()
            if count == 0:
                connection.execute(
                    text(
                        """
                        INSERT INTO smi_parameters (
                            effective_from, effective_to, daily_amount, monthly_amount,
                            annual_amount, source_reference, is_active, created_at, updated_at
                        ) VALUES (
                            '2026-01-01', NULL, 40.70, 1221.00,
                            17094.00, 'Real Decreto 126/2026', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                        )
                        """
                    )
                )
