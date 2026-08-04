from sqlalchemy import event, inspect, text

from app.db import Base


MODEL190_ADJUSTMENT_COLUMNS = {
    "model190_key": "VARCHAR(1)",
    "model190_subkey": "VARCHAR(2)",
    "accrual_year": "INTEGER",
    "deductible_expense_amount": "NUMERIC(14, 2) DEFAULT 0 NOT NULL",
}

MODEL190_INITIAL_KEYS = (
    {
        "code": "A",
        "name": "Rendimientos del trabajo: empleados por cuenta ajena",
        "description": (
            "Catálogo educativo inicial basado en el diseño AEAT del ejercicio 2025. "
            "La clave A no utiliza subclave y cubre los rendimientos ordinarios del trabajo."
        ),
        "recipient_type": "employee",
        "valid_from": 2025,
    },
    {
        "code": "G",
        "name": "Rendimientos de actividades profesionales",
        "description": (
            "Catálogo educativo inicial basado en el diseño AEAT del ejercicio 2025. "
            "Incluye únicamente las subclaves profesionales soportadas por el MVP."
        ),
        "recipient_type": "professional",
        "valid_from": 2025,
    },
)

MODEL190_INITIAL_SUBKEYS = (
    {
        "key_code": "G",
        "code": "01",
        "name": "Actividad profesional: tipo general",
        "description": (
            "Percepciones profesionales sujetas al tipo general de retención. "
            "Referencia educativa: diseño AEAT del ejercicio 2025."
        ),
        "valid_from": 2025,
    },
    {
        "key_code": "G",
        "code": "03",
        "name": "Actividad profesional: inicio de actividad",
        "description": (
            "Percepciones profesionales sujetas al tipo reducido por inicio de actividad. "
            "Referencia educativa: diseño AEAT del ejercicio 2025."
        ),
        "valid_from": 2025,
    },
)


@event.listens_for(Base.metadata, "after_create")
def apply_model190_schema_patch(target, connection, **kwargs):
    """Create the Split 39.1 domain bridge and seed the supported fiscal catalogue.

    AulaNomina still uses lightweight schema patches until Alembic is introduced.
    Fresh databases receive the complete tables through SQLAlchemy metadata; existing
    databases additionally receive the Model 190 classification fields on withholding
    adjustments. The catalogue is deliberately limited and versioned from exercise 2025.
    """

    inspector = inspect(connection)
    table_names = set(inspector.get_table_names())

    if "tax_withholding_adjustments" in table_names:
        existing = {
            column["name"]
            for column in inspector.get_columns("tax_withholding_adjustments")
        }
        for column_name, definition in MODEL190_ADJUSTMENT_COLUMNS.items():
            if column_name not in existing:
                connection.execute(
                    text(
                        "ALTER TABLE tax_withholding_adjustments "
                        f"ADD COLUMN {column_name} {definition}"
                    )
                )

        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS "
                "ix_tax_withholding_adjustments_model190_key "
                "ON tax_withholding_adjustments (model190_key)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS "
                "ix_tax_withholding_adjustments_accrual_year "
                "ON tax_withholding_adjustments (accrual_year)"
            )
        )

    if "tax_190_keys" in table_names:
        for item in MODEL190_INITIAL_KEYS:
            exists = connection.execute(
                text(
                    "SELECT 1 FROM tax_190_keys "
                    "WHERE code = :code AND valid_from = :valid_from"
                ),
                item,
            ).first()
            if exists is None:
                connection.execute(
                    text(
                        "INSERT INTO tax_190_keys "
                        "(code, name, description, recipient_type, valid_from, valid_to, active, created_at, updated_at) "
                        "VALUES (:code, :name, :description, :recipient_type, :valid_from, NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                    ),
                    item,
                )

    if "tax_190_subkeys" in table_names:
        for item in MODEL190_INITIAL_SUBKEYS:
            exists = connection.execute(
                text(
                    "SELECT 1 FROM tax_190_subkeys "
                    "WHERE key_code = :key_code AND code = :code AND valid_from = :valid_from"
                ),
                item,
            ).first()
            if exists is None:
                connection.execute(
                    text(
                        "INSERT INTO tax_190_subkeys "
                        "(key_code, code, name, description, valid_from, valid_to, active, created_at, updated_at) "
                        "VALUES (:key_code, :code, :name, :description, :valid_from, NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                    ),
                    item,
                )
