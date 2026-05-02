from sqlalchemy import inspect, text

from app.db import Base, engine


def init_database() -> None:
    """Create tables and add missing MVP columns in local development.

    This is a lightweight bridge until Alembic migrations are introduced.
    It is intentionally conservative: it only adds missing nullable/default columns
    that already exist in the SQLAlchemy models.
    """

    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "employees" not in table_names:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("employees")}

    employee_columns = {
        "phone": "VARCHAR",
        "birth_date": "DATE",
        "address": "VARCHAR",
        "city": "VARCHAR",
        "province": "VARCHAR",
        "postal_code": "VARCHAR",
        "is_active": "BOOLEAN DEFAULT TRUE NOT NULL",
        "created_at": "TIMESTAMP",
    }

    with engine.begin() as connection:
        for column_name, column_definition in employee_columns.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(f"ALTER TABLE employees ADD COLUMN {column_name} {column_definition}")
                )
