from sqlalchemy import inspect, text

from app.db import Base, engine
from app.db_schema_patches import add_missing_payroll_contribution_columns


def init_database() -> None:
    """Create tables and add missing MVP columns in local development.

    This is a lightweight bridge until Alembic migrations are introduced.
    It is intentionally conservative: it only adds missing nullable/default columns
    that already exist in the SQLAlchemy models.
    """

    Base.metadata.create_all(bind=engine)
    add_missing_payroll_contribution_columns()

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
                "contract_code_description": "VARCHAR",
                "contract_family": "VARCHAR",
                "contribution_group": "VARCHAR",
                "professional_category": "VARCHAR",
                "job_position": "VARCHAR",
                "collective_agreement_code": "VARCHAR",
                "collective_agreement_id": "INTEGER REFERENCES collective_agreements(id)",
                "professional_category_id": "INTEGER REFERENCES professional_categories(id)",
                "salary_table_row_id": "INTEGER REFERENCES salary_table_rows(id)",
                "working_day_type": "VARCHAR",
                "weekly_hours": "FLOAT",
                "full_time_weekly_hours": "FLOAT DEFAULT 40",
                "annual_agreement_hours": "FLOAT",
                "monthly_hours": "FLOAT",
                "annual_hours": "FLOAT",
                "partiality_coefficient": "FLOAT",
                "monthly_or_daily_contribution": "VARCHAR",
                "red_occupation_code": "VARCHAR",
                "red_reduction_code": "VARCHAR",
                "gross_annual_salary": "NUMERIC(10, 2)",
                "pay_schedule": "VARCHAR DEFAULT 'not_prorated_14' NOT NULL",
            }
            for column_name, column_definition in contract_columns.items():
                if column_name not in existing_contract_columns:
                    connection.execute(text(f"ALTER TABLE contracts ADD COLUMN {column_name} {column_definition}"))

            connection.execute(
                text(
                    """
                    UPDATE contracts
                    SET full_time_weekly_hours = COALESCE(full_time_weekly_hours, 40),
                        partiality_coefficient = COALESCE(
                            partiality_coefficient,
                            CASE
                                WHEN weekly_hours IS NOT NULL AND COALESCE(full_time_weekly_hours, 40) > 0
                                THEN ROUND(((weekly_hours / COALESCE(full_time_weekly_hours, 40)) * 100)::numeric, 2)::float
                                ELSE 100
                            END
                        ),
                        monthly_hours = COALESCE(monthly_hours, ROUND((COALESCE(weekly_hours, full_time_weekly_hours, 40) * 52 / 12)::numeric, 2)::float),
                        annual_hours = COALESCE(annual_hours, ROUND((COALESCE(weekly_hours, full_time_weekly_hours, 40) * 52)::numeric, 2)::float)
                    """
                )
            )

        if "incidents" in table_names:
            existing_incident_columns = {column["name"] for column in inspector.get_columns("incidents")}
            for column_name, column_definition in {"center_id": "INTEGER REFERENCES work_centers(id)"}.items():
                if column_name not in existing_incident_columns:
                    connection.execute(text(f"ALTER TABLE incidents ADD COLUMN {column_name} {column_definition}"))

        if "payroll_concepts" in table_names:
            existing_concept_columns = {column["name"] for column in inspector.get_columns("payroll_concepts")}
            concept_columns = {
                "source_type": "VARCHAR DEFAULT 'SYSTEM' NOT NULL",
                "agreement_id": "INTEGER REFERENCES collective_agreements(id)",
                "calculation_type": "VARCHAR DEFAULT 'FIXED_AMOUNT' NOT NULL",
                "default_amount": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "default_unit_price": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "applies_workday_percentage": "BOOLEAN DEFAULT TRUE NOT NULL",
                "is_system": "BOOLEAN DEFAULT FALSE NOT NULL",
            }
            for column_name, column_definition in concept_columns.items():
                if column_name not in existing_concept_columns:
                    connection.execute(text(f"ALTER TABLE payroll_concepts ADD COLUMN {column_name} {column_definition}"))

            connection.execute(
                text(
                    """
                    UPDATE payroll_concepts
                    SET source_type = COALESCE(source_type, 'SYSTEM'),
                        calculation_type = COALESCE(calculation_type, 'FIXED_AMOUNT'),
                        default_amount = COALESCE(default_amount, 0),
                        default_unit_price = COALESCE(default_unit_price, 0),
                        applies_workday_percentage = COALESCE(applies_workday_percentage, TRUE),
                        is_system = COALESCE(is_system, TRUE)
                    """
                )
            )

        if "payrolls" in table_names:
            existing_payroll_columns = {column["name"] for column in inspector.get_columns("payrolls")}
            payroll_columns = {
                "center_id": "INTEGER REFERENCES work_centers(id)",
                "payroll_code": "VARCHAR",
                "variable_incentives": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "common_contingencies_base": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "professional_contingencies_base": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "unemployment_training_fogasa_base": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "irpf_base": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "employee_common_contingencies": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "employee_unemployment": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "employee_training": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "employee_mei": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "company_common_contingencies": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "company_unemployment": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "company_fogasa": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "company_training": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "company_at_ep": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "company_mei": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "company_total_social_security": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "company_total_cost": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
                "irpf_mode": "VARCHAR DEFAULT 'auto' NOT NULL",
                "irpf_percentage": "NUMERIC(5, 2) DEFAULT 0 NOT NULL",
                "suggested_irpf_percentage": "NUMERIC(5, 2) DEFAULT 0 NOT NULL",
            }
            for column_name, column_definition in payroll_columns.items():
                if column_name not in existing_payroll_columns:
                    connection.execute(text(f"ALTER TABLE payrolls ADD COLUMN {column_name} {column_definition}"))

            connection.execute(
                text(
                    """
                    UPDATE payrolls
                    SET common_contingencies_base = COALESCE(NULLIF(common_contingencies_base, 0), gross_salary),
                        professional_contingencies_base = COALESCE(NULLIF(professional_contingencies_base, 0), gross_salary),
                        unemployment_training_fogasa_base = COALESCE(NULLIF(unemployment_training_fogasa_base, 0), gross_salary),
                        irpf_base = COALESCE(NULLIF(irpf_base, 0), gross_salary),
                        employee_common_contingencies = COALESCE(NULLIF(employee_common_contingencies, 0), ROUND((COALESCE(NULLIF(common_contingencies_base, 0), gross_salary) * 4.70 / 100)::numeric, 2)),
                        employee_unemployment = COALESCE(NULLIF(employee_unemployment, 0), ROUND((COALESCE(NULLIF(unemployment_training_fogasa_base, 0), gross_salary) * 1.55 / 100)::numeric, 2)),
                        employee_training = COALESCE(NULLIF(employee_training, 0), ROUND((COALESCE(NULLIF(unemployment_training_fogasa_base, 0), gross_salary) * 0.10 / 100)::numeric, 2)),
                        employee_mei = COALESCE(NULLIF(employee_mei, 0), ROUND((COALESCE(NULLIF(common_contingencies_base, 0), gross_salary) * 0.13 / 100)::numeric, 2)),
                        company_common_contingencies = COALESCE(NULLIF(company_common_contingencies, 0), ROUND((COALESCE(NULLIF(common_contingencies_base, 0), gross_salary) * 23.60 / 100)::numeric, 2)),
                        company_unemployment = COALESCE(NULLIF(company_unemployment, 0), ROUND((COALESCE(NULLIF(unemployment_training_fogasa_base, 0), gross_salary) * 5.50 / 100)::numeric, 2)),
                        company_fogasa = COALESCE(NULLIF(company_fogasa, 0), ROUND((COALESCE(NULLIF(unemployment_training_fogasa_base, 0), gross_salary) * 0.20 / 100)::numeric, 2)),
                        company_training = COALESCE(NULLIF(company_training, 0), ROUND((COALESCE(NULLIF(unemployment_training_fogasa_base, 0), gross_salary) * 0.60 / 100)::numeric, 2)),
                        company_at_ep = COALESCE(NULLIF(company_at_ep, 0), ROUND((COALESCE(NULLIF(professional_contingencies_base, 0), gross_salary) * 1.50 / 100)::numeric, 2)),
                        company_mei = COALESCE(NULLIF(company_mei, 0), ROUND((COALESCE(NULLIF(common_contingencies_base, 0), gross_salary) * 0.67 / 100)::numeric, 2)),
                        company_total_social_security = COALESCE(NULLIF(company_total_social_security, 0),
                            ROUND((COALESCE(NULLIF(common_contingencies_base, 0), gross_salary) * 23.60 / 100)::numeric, 2)
                            + ROUND((COALESCE(NULLIF(unemployment_training_fogasa_base, 0), gross_salary) * 5.50 / 100)::numeric, 2)
                            + ROUND((COALESCE(NULLIF(unemployment_training_fogasa_base, 0), gross_salary) * 0.20 / 100)::numeric, 2)
                            + ROUND((COALESCE(NULLIF(unemployment_training_fogasa_base, 0), gross_salary) * 0.60 / 100)::numeric, 2)
                            + ROUND((COALESCE(NULLIF(professional_contingencies_base, 0), gross_salary) * 1.50 / 100)::numeric, 2)
                            + ROUND((COALESCE(NULLIF(common_contingencies_base, 0), gross_salary) * 0.67 / 100)::numeric, 2)
                        ),
                        company_total_cost = COALESCE(NULLIF(company_total_cost, 0), gross_salary + COALESCE(NULLIF(company_total_social_security, 0),
                            ROUND((COALESCE(NULLIF(common_contingencies_base, 0), gross_salary) * 23.60 / 100)::numeric, 2)
                            + ROUND((COALESCE(NULLIF(unemployment_training_fogasa_base, 0), gross_salary) * 5.50 / 100)::numeric, 2)
                            + ROUND((COALESCE(NULLIF(unemployment_training_fogasa_base, 0), gross_salary) * 0.20 / 100)::numeric, 2)
                            + ROUND((COALESCE(NULLIF(unemployment_training_fogasa_base, 0), gross_salary) * 0.60 / 100)::numeric, 2)
                            + ROUND((COALESCE(NULLIF(professional_contingencies_base, 0), gross_salary) * 1.50 / 100)::numeric, 2)
                            + ROUND((COALESCE(NULLIF(common_contingencies_base, 0), gross_salary) * 0.67 / 100)::numeric, 2)
                        ))
                    """
                )
            )

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

            if "student_groups" in table_names and "group_id" in existing_student_columns:
                if "group_code" in existing_student_columns:
                    connection.execute(
                        text(
                            """
                            UPDATE students
                            SET group_id = (
                                SELECT id FROM student_groups
                                WHERE student_groups.code = students.group_code
                                LIMIT 1
                            )
                            WHERE group_id IS NULL AND group_code IS NOT NULL
                            """
                        )
                    )
                elif "group_name" in existing_student_columns:
                    connection.execute(
                        text(
                            """
                            UPDATE students
                            SET group_id = (
                                SELECT id FROM student_groups
                                WHERE student_groups.name = students.group_name
                                LIMIT 1
                            )
                            WHERE group_id IS NULL AND group_name IS NOT NULL
                            """
                        )
                    )
