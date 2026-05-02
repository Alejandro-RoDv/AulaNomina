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

    with engine.begin() as connection:
        if "employees" in table_names:
            existing_employee_columns = {
                column["name"] for column in inspector.get_columns("employees")
            }

            employee_columns = {
                "phone": "VARCHAR",
                "birth_date": "DATE",
                "address": "VARCHAR",
                "city": "VARCHAR",
                "province": "VARCHAR",
                "postal_code": "VARCHAR",
                "naf": "VARCHAR",
                "company_id": "INTEGER REFERENCES companies(id)",
                "is_active": "BOOLEAN DEFAULT TRUE NOT NULL",
                "created_at": "TIMESTAMP",
            }

            for column_name, column_definition in employee_columns.items():
                if column_name not in existing_employee_columns:
                    connection.execute(
                        text(f"ALTER TABLE employees ADD COLUMN {column_name} {column_definition}")
                    )

        if "contracts" in table_names:
            existing_contract_columns = {
                column["name"] for column in inspector.get_columns("contracts")
            }

            contract_columns = {
                "company_id": "INTEGER REFERENCES companies(id)",
            }

            for column_name, column_definition in contract_columns.items():
                if column_name not in existing_contract_columns:
                    connection.execute(
                        text(f"ALTER TABLE contracts ADD COLUMN {column_name} {column_definition}")
                    )
