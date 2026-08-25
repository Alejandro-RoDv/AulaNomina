from sqlalchemy import inspect, text

from app.db import engine


def add_missing_auth_columns() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

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
