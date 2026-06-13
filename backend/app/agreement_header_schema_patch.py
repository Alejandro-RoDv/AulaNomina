from sqlalchemy import inspect, text

from app.db import engine


AGREEMENT_HEADER_COLUMNS = {
    "official_name": "VARCHAR",
    "internal_name": "VARCHAR",
    "is_extendable": "BOOLEAN DEFAULT FALSE NOT NULL",
    "boe_alerts_enabled": "BOOLEAN DEFAULT FALSE NOT NULL",
    "boe_search_terms": "TEXT",
}

AGREEMENT_RULE_DETAIL_COLUMNS = {
    "minimum_value": "NUMERIC(10, 2)",
    "maximum_value": "NUMERIC(10, 2)",
}

AGREEMENT_SALARY_CONCEPT_COLUMNS = {
    "salary_table_id": "INTEGER",
}


def add_missing_collective_agreement_header_columns() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "collective_agreements" not in table_names:
        return

    agreement_columns = {column["name"] for column in inspector.get_columns("collective_agreements")}
    detail_columns = (
        {column["name"] for column in inspector.get_columns("agreement_rule_details")}
        if "agreement_rule_details" in table_names
        else set()
    )
    salary_concept_columns = (
        {column["name"] for column in inspector.get_columns("agreement_salary_concepts")}
        if "agreement_salary_concepts" in table_names
        else set()
    )

    with engine.begin() as connection:
        for column_name, column_definition in AGREEMENT_HEADER_COLUMNS.items():
            if column_name not in agreement_columns:
                connection.execute(text("ALTER TABLE collective_agreements ADD COLUMN " + column_name + " " + column_definition))

        if detail_columns:
            for column_name, column_definition in AGREEMENT_RULE_DETAIL_COLUMNS.items():
                if column_name not in detail_columns:
                    connection.execute(text("ALTER TABLE agreement_rule_details ADD COLUMN " + column_name + " " + column_definition))

        if salary_concept_columns:
            for column_name, column_definition in AGREEMENT_SALARY_CONCEPT_COLUMNS.items():
                if column_name not in salary_concept_columns:
                    connection.execute(text("ALTER TABLE agreement_salary_concepts ADD COLUMN " + column_name + " " + column_definition))

        connection.execute(
            text(
                """
                UPDATE collective_agreements
                SET is_extendable = COALESCE(is_extendable, FALSE),
                    boe_alerts_enabled = COALESCE(boe_alerts_enabled, FALSE)
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE collective_agreements
                SET official_name = COALESCE(official_name, 'Convenio colectivo simulado de servicios administrativos'),
                    internal_name = COALESCE(internal_name, 'Convenio demo administración 2026'),
                    is_extendable = TRUE,
                    boe_alerts_enabled = TRUE,
                    boe_search_terms = COALESCE(boe_search_terms, 'servicios administrativos gestión empresarial convenio colectivo')
                WHERE agreement_code = 'SIM-ADM-2026'
                """
            )
        )
