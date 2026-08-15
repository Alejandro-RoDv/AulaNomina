from sqlalchemy import event, inspect, text

from app.db import Base


CONTRACT_TRAINING_COLUMNS = {
    "temporary_cause": "TEXT",
    "training_contract_subtype": "VARCHAR",
    "training_program": "VARCHAR",
    "training_center": "VARCHAR",
    "training_company_tutor": "VARCHAR",
    "training_plan_reference": "VARCHAR",
    "training_work_percentage": "FLOAT",
    "qualification_name": "VARCHAR",
    "qualification_date": "DATE",
}


@event.listens_for(Base.metadata, "after_create")
def add_contract_training_columns(target, connection, **kwargs):
    """Puente conservador para bases MVP previas a las migraciones Alembic."""
    inspector = inspect(connection)
    if "contracts" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("contracts")}
    for name, definition in CONTRACT_TRAINING_COLUMNS.items():
        if name not in existing:
            connection.execute(text(f"ALTER TABLE contracts ADD COLUMN {name} {definition}"))
