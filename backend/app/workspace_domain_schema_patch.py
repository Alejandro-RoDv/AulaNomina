from __future__ import annotations

from sqlalchemy import inspect, text

from app.db import engine


WORKSPACE_TABLES = (
    "companies",
    "work_centers",
    "employees",
    "contracts",
    "incidents",
    "payrolls",
    "documents",
    "tax_profiles",
)

POSTGRES_LEGACY_UNIQUES = (
    ("companies", "companies_cif_key"),
    ("companies", "companies_ccc_key"),
    ("work_centers", "work_centers_center_code_key"),
    ("work_centers", "work_centers_main_ccc_key"),
    ("employees", "employees_employee_code_key"),
)

COMPOSITE_INDEXES = (
    ("uq_companies_workspace_cif", "companies", "workspace_id, cif"),
    ("uq_companies_workspace_ccc", "companies", "workspace_id, ccc"),
    ("uq_work_centers_workspace_code", "work_centers", "workspace_id, center_code"),
    ("uq_work_centers_workspace_ccc", "work_centers", "workspace_id, main_ccc"),
    ("uq_employees_workspace_code", "employees", "workspace_id, employee_code"),
)


def add_missing_workspace_domain_columns() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "training_workspaces" not in table_names:
        return

    with engine.begin() as connection:
        for table_name in WORKSPACE_TABLES:
            if table_name not in table_names:
                continue
            columns = {column["name"] for column in inspect(connection).get_columns(table_name)}
            if "workspace_id" not in columns:
                connection.execute(
                    text(
                        f"ALTER TABLE {table_name} ADD COLUMN workspace_id "
                        "INTEGER REFERENCES training_workspaces(id)"
                    )
                )
            connection.execute(
                text(
                    f"CREATE INDEX IF NOT EXISTS ix_{table_name}_workspace_id "
                    f"ON {table_name}(workspace_id)"
                )
            )

        if engine.dialect.name == "postgresql":
            for table_name, constraint_name in POSTGRES_LEGACY_UNIQUES:
                if table_name in table_names:
                    connection.execute(
                        text(f"ALTER TABLE {table_name} DROP CONSTRAINT IF EXISTS {constraint_name}")
                    )

        for index_name, table_name, columns in COMPOSITE_INDEXES:
            if table_name in table_names:
                connection.execute(
                    text(
                        f"CREATE UNIQUE INDEX IF NOT EXISTS {index_name} "
                        f"ON {table_name}({columns})"
                    )
                )
