from sqlalchemy import inspect, text

from app.db import engine


CASE_STUDY_COLUMNS = {
    "scenario_code": "VARCHAR",
    "category": "VARCHAR DEFAULT 'general'",
    "company_id": "INTEGER REFERENCES companies(id)",
    "initial_state": "JSON",
    "validation_rules": "JSON",
    "completion_message": "TEXT",
}

CASE_TASK_COLUMNS = {
    "expected_action": "VARCHAR",
    "trigger_type": "VARCHAR DEFAULT 'manual'",
    "trigger_condition": "JSON",
    "validation_rules": "JSON",
    "message_template": "TEXT",
    "blocking": "BOOLEAN DEFAULT TRUE",
}

CASE_ASSIGNMENT_COLUMNS = {
    "started_at": "TIMESTAMP",
    "completed_at": "TIMESTAMP",
    "current_task_order": "INTEGER DEFAULT 1",
    "completion_percentage": "INTEGER DEFAULT 0",
}

EMAIL_THREAD_COLUMNS = {
    "case_assignment_id": "INTEGER REFERENCES case_assignments(id)",
    "case_task_id": "INTEGER REFERENCES case_tasks(id)",
}


def _add_columns(connection, table_name: str, definitions: dict[str, str]) -> None:
    columns = {column["name"] for column in inspect(connection).get_columns(table_name)}
    for column_name, column_definition in definitions.items():
        if column_name not in columns:
            connection.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")
            )


def _create_progress_table(connection) -> None:
    if engine.dialect.name == "postgresql":
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS case_task_progress (
                    id SERIAL PRIMARY KEY,
                    assignment_id INTEGER NOT NULL REFERENCES case_assignments(id) ON DELETE CASCADE,
                    task_id INTEGER NOT NULL REFERENCES case_tasks(id) ON DELETE CASCADE,
                    status VARCHAR DEFAULT 'pending' NOT NULL,
                    attempts INTEGER DEFAULT 0 NOT NULL,
                    validation_result JSON,
                    student_notes TEXT,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    CONSTRAINT uq_case_task_progress_assignment_task UNIQUE (assignment_id, task_id)
                )
                """
            )
        )
    else:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS case_task_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    assignment_id INTEGER NOT NULL REFERENCES case_assignments(id) ON DELETE CASCADE,
                    task_id INTEGER NOT NULL REFERENCES case_tasks(id) ON DELETE CASCADE,
                    status VARCHAR DEFAULT 'pending' NOT NULL,
                    attempts INTEGER DEFAULT 0 NOT NULL,
                    validation_result JSON,
                    student_notes TEXT,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    CONSTRAINT uq_case_task_progress_assignment_task UNIQUE (assignment_id, task_id)
                )
                """
            )
        )


def add_missing_case_scenario_columns() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    with engine.begin() as connection:
        if "case_studies" in table_names:
            _add_columns(connection, "case_studies", CASE_STUDY_COLUMNS)
        if "case_tasks" in table_names:
            _add_columns(connection, "case_tasks", CASE_TASK_COLUMNS)
        if "case_assignments" in table_names:
            _add_columns(connection, "case_assignments", CASE_ASSIGNMENT_COLUMNS)
        if "email_threads" in table_names:
            _add_columns(connection, "email_threads", EMAIL_THREAD_COLUMNS)

        if {"case_assignments", "case_tasks"}.issubset(table_names):
            _create_progress_table(connection)

        if "case_studies" in table_names:
            if engine.dialect.name == "postgresql":
                connection.execute(
                    text(
                        """
                        UPDATE case_studies
                        SET category = COALESCE(category, 'general'),
                            initial_state = COALESCE(initial_state, '{}'::json),
                            validation_rules = COALESCE(validation_rules, '[]'::json)
                        """
                    )
                )
            else:
                connection.execute(
                    text(
                        """
                        UPDATE case_studies
                        SET category = COALESCE(category, 'general'),
                            initial_state = COALESCE(initial_state, '{}'),
                            validation_rules = COALESCE(validation_rules, '[]')
                        """
                    )
                )

        if "case_tasks" in table_names:
            if engine.dialect.name == "postgresql":
                connection.execute(
                    text(
                        """
                        UPDATE case_tasks
                        SET trigger_type = COALESCE(trigger_type, 'manual'),
                            trigger_condition = COALESCE(trigger_condition, '{}'::json),
                            validation_rules = COALESCE(validation_rules, '[]'::json),
                            blocking = COALESCE(blocking, TRUE)
                        """
                    )
                )
            else:
                connection.execute(
                    text(
                        """
                        UPDATE case_tasks
                        SET trigger_type = COALESCE(trigger_type, 'manual'),
                            trigger_condition = COALESCE(trigger_condition, '{}'),
                            validation_rules = COALESCE(validation_rules, '[]'),
                            blocking = COALESCE(blocking, 1)
                        """
                    )
                )

        if "case_assignments" in table_names:
            connection.execute(
                text(
                    """
                    UPDATE case_assignments
                    SET current_task_order = COALESCE(current_task_order, 1),
                        completion_percentage = COALESCE(completion_percentage, 0)
                    """
                )
            )
