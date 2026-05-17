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
            existing_company_columns = {column["name"] for column in inspector.get_columns("companies")}
            for column_name, column_definition in {"ccc": "VARCHAR", "company_code": "VARCHAR"}.items():
                if column_name not in existing_company_columns:
                    connection.execute(text(f"ALTER TABLE companies ADD COLUMN {column_name} {column_definition}"))

        if "work_centers" in table_names:
            existing_work_center_columns = {column["name"] for column in inspector.get_columns("work_centers")}
            for column_name, column_definition in {"general_ccc": "VARCHAR", "main_ccc": "VARCHAR"}.items():
                if column_name not in existing_work_center_columns:
                    connection.execute(text(f"ALTER TABLE work_centers ADD COLUMN {column_name} {column_definition}"))

        if "employees" in table_names:
            existing_employee_columns = {column["name"] for column in inspector.get_columns("employees")}
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
                    connection.execute(text(f"ALTER TABLE employees ADD COLUMN {column_name} {column_definition}"))

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
            existing_contract_columns = {column["name"] for column in inspector.get_columns("contracts")}
            contract_columns = {
                "company_id": "INTEGER REFERENCES companies(id)",
                "center_id": "INTEGER REFERENCES work_centers(id)",
                "contract_code": "VARCHAR",
                "pay_schedule": "VARCHAR DEFAULT 'not_prorated_14' NOT NULL",
            }
            for column_name, column_definition in contract_columns.items():
                if column_name not in existing_contract_columns:
                    connection.execute(text(f"ALTER TABLE contracts ADD COLUMN {column_name} {column_definition}"))

        if "incidents" in table_names:
            existing_incident_columns = {column["name"] for column in inspector.get_columns("incidents")}
            for column_name, column_definition in {"center_id": "INTEGER REFERENCES work_centers(id)"}.items():
                if column_name not in existing_incident_columns:
                    connection.execute(text(f"ALTER TABLE incidents ADD COLUMN {column_name} {column_definition}"))

        if "payrolls" in table_names:
            existing_payroll_columns = {column["name"] for column in inspector.get_columns("payrolls")}
            payroll_columns = {
                "center_id": "INTEGER REFERENCES work_centers(id)",
                "payroll_code": "VARCHAR",
                "irpf_mode": "VARCHAR DEFAULT 'auto' NOT NULL",
                "irpf_percentage": "NUMERIC(5, 2) DEFAULT 0 NOT NULL",
                "suggested_irpf_percentage": "NUMERIC(5, 2) DEFAULT 0 NOT NULL",
            }
            for column_name, column_definition in payroll_columns.items():
                if column_name not in existing_payroll_columns:
                    connection.execute(text(f"ALTER TABLE payrolls ADD COLUMN {column_name} {column_definition}"))

        if "documents" in table_names:
            existing_document_columns = {column["name"] for column in inspector.get_columns("documents")}
            document_columns = {"center_id": "INTEGER REFERENCES work_centers(id)", "notes": "TEXT"}
            for column_name, column_definition in document_columns.items():
                if column_name not in existing_document_columns:
                    connection.execute(text(f"ALTER TABLE documents ADD COLUMN {column_name} {column_definition}"))

        if "tax_profiles" in table_names:
            existing_tax_profile_columns = {column["name"] for column in inspector.get_columns("tax_profiles")}
            tax_profile_columns = {
                "birth_year": "INTEGER",
                "autonomous_community": "VARCHAR DEFAULT 'andalucia' NOT NULL",
                "family_situation": "VARCHAR DEFAULT 'situation_3' NOT NULL",
                "spouse_nif": "VARCHAR",
                "employment_situation": "VARCHAR DEFAULT 'active' NOT NULL",
                "contract_category": "VARCHAR DEFAULT 'general' NOT NULL",
                "children_count": "INTEGER DEFAULT 0 NOT NULL",
                "descendants": "JSON DEFAULT '[]'::json NOT NULL",
                "ascendants_in_care": "INTEGER DEFAULT 0 NOT NULL",
                "ascendants": "JSON DEFAULT '[]'::json NOT NULL",
                "employee_disability": "BOOLEAN DEFAULT FALSE NOT NULL",
                "disability_degree": "VARCHAR DEFAULT 'none' NOT NULL",
                "reduced_mobility": "BOOLEAN DEFAULT FALSE NOT NULL",
                "descendants_disability": "BOOLEAN DEFAULT FALSE NOT NULL",
                "geographic_mobility": "BOOLEAN DEFAULT FALSE NOT NULL",
                "ceuta_melilla_residence": "BOOLEAN DEFAULT FALSE NOT NULL",
                "ceuta_melilla_income": "BOOLEAN DEFAULT FALSE NOT NULL",
                "home_loan": "BOOLEAN DEFAULT FALSE NOT NULL",
                "compensatory_pension": "FLOAT DEFAULT 0 NOT NULL",
                "child_support_annuity": "FLOAT DEFAULT 0 NOT NULL",
                "irregular_income_18_2": "FLOAT DEFAULT 0 NOT NULL",
                "irregular_income_18_3": "FLOAT DEFAULT 0 NOT NULL",
                "social_security_contributions": "FLOAT DEFAULT 0 NOT NULL",
                "contract_type": "VARCHAR",
                "contract_start_date": "DATE",
                "expected_annual_salary": "FLOAT DEFAULT 0 NOT NULL",
                "manual_regularization": "BOOLEAN DEFAULT FALSE NOT NULL",
                "voluntary_irpf": "FLOAT",
                "notes": "TEXT",
                "created_at": "TIMESTAMP",
                "updated_at": "TIMESTAMP",
            }
            for column_name, column_definition in tax_profile_columns.items():
                if column_name not in existing_tax_profile_columns:
                    connection.execute(text(f"ALTER TABLE tax_profiles ADD COLUMN {column_name} {column_definition}"))

        if "students" in table_names:
            existing_student_columns = {column["name"] for column in inspector.get_columns("students")}
            student_columns = {"group_id": "INTEGER REFERENCES student_groups(id)"}
            for column_name, column_definition in student_columns.items():
                if column_name not in existing_student_columns:
                    connection.execute(text(f"ALTER TABLE students ADD COLUMN {column_name} {column_definition}"))

            if "student_groups" in table_names:
                connection.execute(
                    text(
                        """
                        UPDATE students
                        SET group_id = student_groups.id
                        FROM student_groups
                        WHERE students.group_id IS NULL
                          AND students.group_name IS NOT NULL
                          AND students.group_name = student_groups.name
                        """
                    )
                )

        if "corrections" in table_names:
            existing_correction_columns = {column["name"] for column in inspector.get_columns("corrections")}
            correction_columns = {"assignment_id": "INTEGER REFERENCES case_assignments(id)"}
            for column_name, column_definition in correction_columns.items():
                if column_name not in existing_correction_columns:
                    connection.execute(text(f"ALTER TABLE corrections ADD COLUMN {column_name} {column_definition}"))

            # PostgreSQL only. This local bridge loosens legacy NOT NULL constraints
            # because corrections now primarily depend on case assignments.
            try:
                connection.execute(text("ALTER TABLE corrections ALTER COLUMN case_study_id DROP NOT NULL"))
                connection.execute(text("ALTER TABLE corrections ALTER COLUMN student_name DROP NOT NULL"))
            except Exception:
                pass