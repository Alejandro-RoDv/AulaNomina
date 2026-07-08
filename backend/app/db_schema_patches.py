from sqlalchemy import inspect, text

from app.agreement_header_schema_patch import add_missing_collective_agreement_header_columns
from app.db import engine


PAYROLL_CONTRIBUTION_COLUMNS = {
    "worked_base_salary": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
    "temporary_disability_benefit": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
    "company_disability_complement": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
    "seniority_amount": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
    "contribution_days": "INTEGER DEFAULT 30 NOT NULL",
    "worked_days": "INTEGER DEFAULT 30 NOT NULL",
    "incident_days": "INTEGER DEFAULT 0 NOT NULL",
    "it_days": "INTEGER DEFAULT 0 NOT NULL",
    "non_contribution_days": "INTEGER DEFAULT 0 NOT NULL",
    "daily_common_base": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
    "daily_professional_base": "NUMERIC(10, 2) DEFAULT 0 NOT NULL",
}

PAYROLL_CONCEPT_ENGINE_COLUMNS = {
    "affects_gross": "BOOLEAN DEFAULT TRUE NOT NULL",
    "affects_net": "BOOLEAN DEFAULT TRUE NOT NULL",
    "formula": "TEXT",
}

EMPLOYEE_SPLIT_25_COLUMNS = {
    "document_type": "VARCHAR DEFAULT 'DNI' NOT NULL",
    "nie_prefix": "VARCHAR",
    "document_number": "VARCHAR",
    "document_letter": "VARCHAR",
    "second_last_name": "VARCHAR",
    "sex": "VARCHAR",
    "nationality": "VARCHAR",
    "birth_place": "VARCHAR",
    "domicile": "VARCHAR",
    "landline_phone": "VARCHAR",
    "mobile_phone": "VARCHAR",
    "fax": "VARCHAR",
    "website": "VARCHAR",
    "education_level": "VARCHAR",
    "academic_title": "VARCHAR",
    "academic_title_date": "DATE",
    "main_profession": "VARCHAR",
    "other_courses": "TEXT",
    "accreditations": "TEXT",
    "languages": "TEXT",
    "representative_role": "VARCHAR",
    "representative_nif": "VARCHAR",
    "representative_full_name": "VARCHAR",
    "observations": "TEXT",
}

CONTRACT_LABOR_COLUMNS = {
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
    "partiality_coefficient": "FLOAT",
    "monthly_or_daily_contribution": "VARCHAR",
    "red_occupation_code": "VARCHAR",
    "red_reduction_code": "VARCHAR",
    "gross_annual_salary": "NUMERIC(10, 2)",
    "contract_registry_status": "VARCHAR DEFAULT 'not_registered'",
}

COMPANY_SPLIT_24_COLUMNS = {
    "ccc_regime": "VARCHAR",
    "ccc_code": "VARCHAR",
    "status": "VARCHAR DEFAULT 'alta' NOT NULL",
    "registration_date": "DATE",
    "deregistration_date": "DATE",
    "main_collective_agreement": "VARCHAR",
    "is_cooperative": "BOOLEAN DEFAULT FALSE NOT NULL",
    "special_work_income_withholding": "BOOLEAN DEFAULT FALSE NOT NULL",
    "company_type": "VARCHAR",
    "company_phone": "VARCHAR",
    "company_email": "VARCHAR",
    "company_website": "VARCHAR",
    "company_contact_person": "VARCHAR",
    "legal_representative_name": "VARCHAR",
    "legal_representative_dni": "VARCHAR",
    "legal_representative_position": "VARCHAR",
    "cnae_2009_code": "VARCHAR",
    "cnae_2009_name": "VARCHAR",
    "cnae_2025_code": "VARCHAR",
    "cnae_2025_name": "VARCHAR",
    "professional_contingencies_mutual": "VARCHAR",
    "professional_contingencies_policy": "VARCHAR",
    "professional_contingencies_effective_date": "DATE",
    "common_it_mutual": "VARCHAR",
    "common_it_policy": "VARCHAR",
    "common_it_effective_date": "DATE",
    "collective_insurance_enabled": "BOOLEAN DEFAULT FALSE NOT NULL",
    "collective_insurance_company": "VARCHAR",
    "collective_insurance_policy": "VARCHAR",
    "collective_insurance_capital": "VARCHAR",
    "pension_plan_enabled": "BOOLEAN DEFAULT FALSE NOT NULL",
    "pension_manager_key": "VARCHAR",
    "pension_manager_entity_number": "VARCHAR",
    "pension_plan_name": "VARCHAR",
    "work_calendar_mode": "VARCHAR DEFAULT 'new' NOT NULL",
    "work_calendar_name": "VARCHAR",
    "work_calendar_data": "TEXT",
    "bank_iban": "VARCHAR",
    "model_111": "VARCHAR",
    "fiscal_regime": "VARCHAR",
    "complement_computation": "VARCHAR",
    "siltra_enabled": "BOOLEAN DEFAULT FALSE NOT NULL",
    "siltra_payment_mode": "VARCHAR",
    "siltra_options": "TEXT",
    "sector_bonuses": "TEXT",
    "grouped_withholding_company": "VARCHAR",
}

WORK_CENTER_SPLIT_24_COLUMNS = {
    "collective_agreement": "VARCHAR",
    "phone": "VARCHAR",
    "fax": "VARCHAR",
    "mobile": "VARCHAR",
    "email": "VARCHAR",
    "website": "VARCHAR",
}

BASE_COLUMNS_REQUIRED_FOR_DAILY_BASE_BACKFILL = {
    "gross_salary",
    "common_contingencies_base",
    "professional_contingencies_base",
}

EMPLOYEE_IDENTITY_UNIQUE_INDEXES = [
    "ix_employees_dni",
    "ix_employees_email",
    "ix_employees_naf",
]

EMPLOYEE_IDENTITY_UNIQUE_CONSTRAINTS = [
    "employees_dni_key",
    "employees_email_key",
    "employees_naf_key",
]


def relax_employee_identity_uniqueness(connection) -> None:
    """Allow the same person to exist in different companies for educational simulations."""

    for constraint_name in EMPLOYEE_IDENTITY_UNIQUE_CONSTRAINTS:
        connection.execute(text(f"ALTER TABLE employees DROP CONSTRAINT IF EXISTS {constraint_name}"))

    for index_name in EMPLOYEE_IDENTITY_UNIQUE_INDEXES:
        connection.execute(text(f"DROP INDEX IF EXISTS {index_name}"))

    connection.execute(text("CREATE INDEX IF NOT EXISTS ix_employees_dni ON employees (dni)"))
    connection.execute(text("CREATE INDEX IF NOT EXISTS ix_employees_email ON employees (email)"))
    connection.execute(text("CREATE INDEX IF NOT EXISTS ix_employees_naf ON employees (naf)"))


def add_missing_employee_split_25_columns() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "employees" not in table_names:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("employees")}

    with engine.begin() as connection:
        for column_name, column_definition in EMPLOYEE_SPLIT_25_COLUMNS.items():
            if column_name not in existing_columns:
                connection.execute(text("ALTER TABLE employees ADD COLUMN " + column_name + " " + column_definition))

        if "document_type" in {column["name"] for column in inspect(connection).get_columns("employees")}:
            connection.execute(text("UPDATE employees SET document_type = COALESCE(document_type, 'DNI')"))

        relax_employee_identity_uniqueness(connection)


def add_missing_company_center_split_24_columns() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    with engine.begin() as connection:
        if "companies" in table_names:
            existing_columns = {column["name"] for column in inspector.get_columns("companies")}
            for column_name, column_definition in COMPANY_SPLIT_24_COLUMNS.items():
                if column_name not in existing_columns:
                    connection.execute(text("ALTER TABLE companies ADD COLUMN " + column_name + " " + column_definition))

        if "work_centers" in table_names:
            existing_columns = {column["name"] for column in inspector.get_columns("work_centers")}
            for column_name, column_definition in WORK_CENTER_SPLIT_24_COLUMNS.items():
                if column_name not in existing_columns:
                    connection.execute(text("ALTER TABLE work_centers ADD COLUMN " + column_name + " " + column_definition))


def add_missing_contract_labor_columns() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    with engine.begin() as connection:
        if "contracts" in table_names:
            existing_columns = {column["name"] for column in inspector.get_columns("contracts")}
            for column_name, column_definition in CONTRACT_LABOR_COLUMNS.items():
                if column_name not in existing_columns:
                    connection.execute(
                        text("ALTER TABLE contracts ADD COLUMN " + column_name + " " + column_definition)
                    )

        if "social_security_registrations" not in table_names:
            connection.execute(
                text(
                    """
                    CREATE TABLE social_security_registrations (
                        id SERIAL PRIMARY KEY,
                        contract_id INTEGER NOT NULL UNIQUE REFERENCES contracts(id),
                        situation_code VARCHAR,
                        situation_description VARCHAR,
                        registration_date DATE,
                        contribution_group VARCHAR,
                        monthly_or_daily_contribution VARCHAR,
                        disability_degree FLOAT,
                        occupation_code VARCHAR,
                        cno VARCHAR,
                        worker_collective_code VARCHAR,
                        unemployed_condition_code VARCHAR,
                        is_replacement BOOLEAN DEFAULT FALSE NOT NULL,
                        replacement_cause_code VARCHAR,
                        replaced_worker_naf VARCHAR,
                        inactivity_type_code VARCHAR,
                        working_time_reduction FLOAT,
                        initial_ctp FLOAT,
                        red_contract_key VARCHAR,
                        red_occupation_code VARCHAR,
                        red_contribution_group VARCHAR,
                        red_reduction_code VARCHAR,
                        red_special_relation VARCHAR,
                        created_at TIMESTAMP,
                        updated_at TIMESTAMP
                    )
                    """
                )
            )


def add_missing_payroll_concept_engine_columns(connection, table_names: list[str]) -> None:
    if "payroll_concepts" not in table_names:
        return

    existing_columns = {column["name"] for column in inspect(connection).get_columns("payroll_concepts")}
    created_columns = set()
    for column_name, column_definition in PAYROLL_CONCEPT_ENGINE_COLUMNS.items():
        if column_name not in existing_columns:
            connection.execute(text("ALTER TABLE payroll_concepts ADD COLUMN " + column_name + " " + column_definition))
            created_columns.add(column_name)

    if {"affects_gross", "affects_net"} & created_columns:
        connection.execute(
            text(
                """
                UPDATE payroll_concepts
                SET affects_gross = CASE WHEN concept_type = 'DEVENGO' THEN TRUE ELSE FALSE END,
                    affects_net = CASE WHEN concept_type IN ('DEVENGO', 'DEDUCCION') THEN TRUE ELSE FALSE END
                """
            )
        )


def add_missing_payroll_contribution_columns() -> None:
    """Add Split 18 payroll contribution columns and later MVP bridge columns."""

    add_missing_collective_agreement_header_columns()
    add_missing_employee_split_25_columns()
    add_missing_company_center_split_24_columns()
    add_missing_contract_labor_columns()

    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    with engine.begin() as connection:
        add_missing_payroll_concept_engine_columns(connection, table_names)

    if "payrolls" not in table_names:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("payrolls")}

    with engine.begin() as connection:
        for column_name, column_definition in PAYROLL_CONTRIBUTION_COLUMNS.items():
            if column_name not in existing_columns:
                connection.execute(
                    text("ALTER TABLE payrolls ADD COLUMN " + column_name + " " + column_definition)
                )

        refreshed_columns = {
            column["name"] for column in inspect(connection).get_columns("payrolls")
        }

        if not BASE_COLUMNS_REQUIRED_FOR_DAILY_BASE_BACKFILL.issubset(refreshed_columns):
            connection.execute(
                text(
                    """
                    UPDATE payrolls
                    SET contribution_days = COALESCE(NULLIF(contribution_days, 0), 30),
                        worked_days = COALESCE(NULLIF(worked_days, 0), 30),
                        incident_days = COALESCE(incident_days, 0),
                        it_days = COALESCE(incident_days, 0),
                        non_contribution_days = COALESCE(non_contribution_days, 0),
                        worked_base_salary = COALESCE(NULLIF(worked_base_salary, 0), base_salary, gross_salary, 0),
                        temporary_disability_benefit = COALESCE(temporary_disability_benefit, 0),
                        company_disability_complement = COALESCE(company_disability_complement, 0),
                        seniority_amount = COALESCE(seniority_amount, 0),
                        daily_common_base = COALESCE(daily_common_base, 0),
                        daily_professional_base = COALESCE(daily_professional_base, 0)
                    """
                )
            )
            return

        connection.execute(
            text(
                """
                UPDATE payrolls
                SET contribution_days = COALESCE(NULLIF(contribution_days, 0), 30),
                    worked_days = COALESCE(NULLIF(worked_days, 0), 30),
                    incident_days = COALESCE(incident_days, 0),
                    it_days = COALESCE(it_days, 0),
                    non_contribution_days = COALESCE(non_contribution_days, 0),
                    worked_base_salary = COALESCE(NULLIF(worked_base_salary, 0), base_salary, gross_salary, 0),
                    temporary_disability_benefit = COALESCE(temporary_disability_benefit, 0),
                    company_disability_complement = COALESCE(company_disability_complement, 0),
                    seniority_amount = COALESCE(seniority_amount, 0),
                    daily_common_base = COALESCE(
                        NULLIF(daily_common_base, 0),
                        ROUND(
                            (
                                COALESCE(NULLIF(common_contingencies_base, 0), gross_salary)
                                / NULLIF(COALESCE(NULLIF(contribution_days, 0), 30), 0)
                            )::numeric,
                            2
                        )
                    ),
                    daily_professional_base = COALESCE(
                        NULLIF(daily_professional_base, 0),
                        ROUND(
                            (
                                COALESCE(NULLIF(professional_contingencies_base, 0), gross_salary)
                                / NULLIF(COALESCE(NULLIF(contribution_days, 0), 30), 0)
                            )::numeric,
                            2
                        )
                    )
                """
            )
        )
