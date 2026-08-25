from sqlalchemy import inspect, text

from app.db import engine
from app.models.training_workspace import TrainingWorkspace
from app.workspace_domain_schema_patch import add_missing_workspace_domain_columns


def add_missing_auth_columns() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    # En instalaciones existentes la tabla de alumnos ya existe antes de que
    # create_all vea el nuevo modelo. Creamos primero la frontera de workspace
    # para poder añadir después su FK a las asignaciones.
    if "students" in table_names:
        TrainingWorkspace.__table__.create(bind=engine, checkfirst=True)
        table_names = set(inspect(engine).get_table_names())

    with engine.begin() as connection:
        if "students" in table_names:
            columns = {column["name"] for column in inspect(connection).get_columns("students")}
            if "user_id" not in columns:
                connection.execute(text("ALTER TABLE students ADD COLUMN user_id INTEGER REFERENCES users(id)"))

            if engine.dialect.name == "postgresql":
                connection.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_students_user_id "
                        "ON students(user_id) WHERE user_id IS NOT NULL"
                    )
                )
            else:
                connection.execute(
                    text("CREATE UNIQUE INDEX IF NOT EXISTS uq_students_user_id ON students(user_id)")
                )

        if "training_workspaces" in table_names and engine.dialect.name == "postgresql":
            # Las generaciones antiguas conservan datos para trazabilidad, pero
            # liberan student_id al archivarse para que exista un nuevo entorno activo.
            connection.execute(
                text("ALTER TABLE training_workspaces ALTER COLUMN student_id DROP NOT NULL")
            )

        if "case_assignments" in table_names and "training_workspaces" in table_names:
            columns = {column["name"] for column in inspect(connection).get_columns("case_assignments")}
            if "workspace_id" not in columns:
                connection.execute(
                    text(
                        "ALTER TABLE case_assignments ADD COLUMN workspace_id "
                        "INTEGER REFERENCES training_workspaces(id)"
                    )
                )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_case_assignments_workspace_id "
                    "ON case_assignments(workspace_id)"
                )
            )

    add_missing_workspace_domain_columns()
