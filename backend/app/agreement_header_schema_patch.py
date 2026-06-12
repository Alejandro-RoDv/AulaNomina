from sqlalchemy import inspect, text

from app.db import engine


AGREEMENT_HEADER_COLUMNS = {
    "official_name": "VARCHAR",
    "internal_name": "VARCHAR",
    "is_extendable": "BOOLEAN DEFAULT FALSE NOT NULL",
    "boe_alerts_enabled": "BOOLEAN DEFAULT FALSE NOT NULL",
    "boe_search_terms": "TEXT",
}


def add_missing_collective_agreement_header_columns() -> None:
    inspector = inspect(engine)
    if "collective_agreements" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("collective_agreements")}
    with engine.begin() as connection:
        for column_name, column_definition in AGREEMENT_HEADER_COLUMNS.items():
            if column_name not in existing_columns:
                connection.execute(text("ALTER TABLE collective_agreements ADD COLUMN " + column_name + " " + column_definition))

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
