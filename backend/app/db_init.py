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
        if "companies" in table_names:
            existing_company_columns = {
                column["name"] for column in inspector.get_columns("companies")
            }

            company_columns = {
                "ccc": "VARCHAR",
                "company_code": "VARCHAR",
            }

            for column_name, column_definition in company_columns.items():
                if column_name not in existing_company_columns:
                    connection.execute(
                        text(f"ALTER TABLE companies ADD COLUMN {column_name} {column_definition}")
                    )

        if "work_centers" in table_names:
            existing_work_center_columns = {
                column["name"] for column in inspector.get_columns("work_centers")
            }

            work_center_columns = {
                "general_ccc": "VARCHAR",
                "main_ccc": "VARCHAR",
            }

            for column_name, column_definition in work_center_columns.items():
                if column_name not in existing_work_center_columns:
                    connection.execute(
                        text(f"ALTER TABLE work_centers ADD COLUMN {column_name} {column_definition}")
                    )

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
                "center_id": "INTEGER REFERENCES work_centers(id)",
                "is_active": "BOOLEAN DEFAULT TRUE NOT NULL",
                "created_at": "TIMESTAMP",
            }

            for column_name, column_definition in employee_columns.items():
                if column_name not in existing_employee_columns:
                    connection.execute(
                        text(f"ALTER TABLE employees ADD COLUMN {column_name} {column_definition}")
                    )

            connection.execute(
                text(
                    """
                    UPDATE employees
                    SET employee_code = CAST(CAST(SUBSTRING(employee_code FROM 4) AS INTEGER) AS VARCHAR)
                    WHERE employee_code ~ '^EMP[0-9]+$'
                    """
                )
            )

        if "contracts" in table_names:
            existing_contract_columns = {
                column["name"] for column in inspector.get_columns("contracts")
            }

            contract_columns = {
                "company_id": "INTEGER REFERENCES companies(id)",
                "center_id": "INTEGER REFERENCES work_centers(id)",
                "contract_code": "VARCHAR",
                "pay_schedule": "VARCHAR DEFAULT 'not_prorated_14' NOT NULL",
            }

            for column_name, column_definition in contract_columns.items():
                if column_name not in existing_contract_columns:
                    connection.execute(
                        text(f"ALTER TABLE contracts ADD COLUMN {column_name} {column_definition}")
                    )

        if "incidents" in table_names:
            existing_incident_columns = {
                column["name"] for column in inspector.get_columns("incidents")
            }

            incident_columns = {
                "center_id": "INTEGER REFERENCES work_centers(id)",
            }

            for column_name, column_definition in incident_columns.items():
                if column_name not in existing_incident_columns:
                    connection.execute(
                        text(f"ALTER TABLE incidents ADD COLUMN {column_name} {column_definition}")
                    )

        if "payrolls" in table_names:
            existing_payroll_columns = {
                column["name"] for column in inspector.get_columns("payrolls")
            }

            payroll_columns = {
                "center_id": "INTEGER REFERENCES work_centers(id)",
                "payroll_code": "VARCHAR",
            }

            for column_name, column_definition in payroll_columns.items():
                if column_name not in existing_payroll_columns:
                    connection.execute(
                        text(f"ALTER TABLE payrolls ADD COLUMN {column_name} {column_definition}")
                    )

        if "documents" in table_names:
            existing_document_columns = {
                column["name"] for column in inspector.get_columns("documents")
            }

            document_columns = {
                "center_id": "INTEGER REFERENCES work_centers(id)",
                "notes": "TEXT",
            }

            for column_name, column_definition in document_columns.items():
                if column_name not in existing_document_columns:
                    connection.execute(
                        text(f"ALTER TABLE documents ADD COLUMN {column_name} {column_definition}")
                    )
