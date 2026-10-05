from types import SimpleNamespace

from app.training.activity_mail_2026 import MAIL_CODES, _body, _tasks_for_code


def _task(code, description):
    return SimpleNamespace(
        trigger_condition={"training_code": code},
        description=description,
        title=description,
        task_order=int(code[1:]),
        id=int(code[1:]),
    )


def test_a04_mail_contains_only_data_needed_to_create_worker():
    case = SimpleNamespace(
        title="Alta completa de trabajador",
        description="Caso técnico con expediente, contrato y afiliación.",
        initial_state={
            "training_sequence": ["A04", "A07", "A29"],
            "employee_data": {
                "first_name": "Fulanito",
                "last_name": "Pérez",
                "dni": "12345678Z",
                "naf": "14/1234567890",
                "birth_date": "1995-04-12",
                "nationality": "Española",
                "email": "fulanito.perez@demo.aulanomina.local",
            },
            "start_date": "2026-09-01",
            "contract_data": {"working_day": "Jornada completa", "weekly_hours": 40},
        },
        tasks=[
            _task("A04", "Crear el expediente"),
            _task("A07", "Crear un contrato indefinido"),
            _task("A29", "Preparar el alta de Seguridad Social"),
        ],
    )

    assert "A04" in MAIL_CODES
    assert [task.trigger_condition["training_code"] for task in _tasks_for_code(case, "A04")] == ["A04"]

    body = _body(case, "A04")
    assert "Fulanito" in body
    assert "Pérez" in body
    assert "12345678Z" in body
    assert "14/1234567890" in body
    assert "1995-04-12" in body
    assert "Española" in body
    assert "fulanito.perez@demo.aulanomina.local" in body
    assert "crear su expediente" in body.lower()

    # Datos de prácticas posteriores no deben adelantarse en el primer correo.
    assert "contrato indefinido" not in body.lower()
    assert "seguridad social" not in body.lower()
    assert "jornada completa" not in body.lower()
    assert "2026-09-01" not in body
