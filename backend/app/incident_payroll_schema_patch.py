from sqlalchemy import event, inspect, text

from app.db import Base


PAYROLL_ITEM_PROVENANCE_COLUMNS = {
    "source_type": "VARCHAR DEFAULT 'manual' NOT NULL",
    "source_id": "INTEGER",
    "source_key": "VARCHAR",
    "segment_id": "INTEGER REFERENCES payroll_segments(id)",
    "is_automatic": "BOOLEAN DEFAULT FALSE NOT NULL",
    "calculation_trace": "TEXT DEFAULT '{}' NOT NULL",
    "updated_at": "TIMESTAMP",
}


@event.listens_for(Base.metadata, "after_create")
def add_incident_payroll_columns(target, connection, **kwargs):
    """Bridge existing MVP databases until the project adopts Alembic."""

    inspector = inspect(connection)
    if "payroll_items" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("payroll_items")}
    for name, definition in PAYROLL_ITEM_PROVENANCE_COLUMNS.items():
        if name not in existing:
            connection.execute(text(f"ALTER TABLE payroll_items ADD COLUMN {name} {definition}"))

    connection.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_payroll_items_source_key "
            "ON payroll_items (source_key)"
        )
    )
    connection.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_payroll_items_source_origin "
            "ON payroll_items (source_type, source_id)"
        )
    )
    connection.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_payroll_items_segment_id "
            "ON payroll_items (segment_id)"
        )
    )
