from datetime import date
from types import SimpleNamespace

import app.services.training_core_contract_review_service as review_service


def assignment(state):
    return SimpleNamespace(case_study=SimpleNamespace(initial_state=state))


def a07_contract(**overrides):
    values = {
        "id": 7,
        "contract_family": "indefinite",
        "contract_type": "indefinido",
        "contract_code": "100",
        "contract_code_description": "Indefinido tiempo completo - ordinario",
        "start_date": date(2026, 9, 1),
        "status": "active",
        "working_day_type": "full_time",
        "weekly_hours": 40,
        "job_position": "Administrativo/a de RRHH",
        "company": SimpleNamespace(name="Fundación AulaNomina"),
        "work_center": SimpleNamespace(name="Colegio San Rafael"),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def a09_contract(**overrides):
    ss = SimpleNamespace(
        is_replacement=True,
        replacement_cause_code="01",
        replaced_worker_naf="141000000005",
    )
    values = {
        "id": 9,
        "contract_family": "replacement",
        "contract_type": "sustitucion",
        "contract_code": "410",
        "contract_code_description": "Temporal tiempo completo - sustitución",
        "start_date": date(2026, 8, 6),
        "status": "active",
        "weekly_hours": 40,
        "ss_registration": ss,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_a07_requires_full_case_contract_data(monkeypatch):
    employee = SimpleNamespace(id=1)
    contract = a07_contract()
    monkeypatch.setattr(review_service, "_find_employee", lambda _db, _name: employee)
    monkeypatch.setattr(review_service, "_latest_contract", lambda _db, _employee: contract)

    review = review_service._review_a07(
        None,
        assignment({
            "employee": "Fulanito Pérez",
            "company_name": "Fundación AulaNomina",
            "center_name": "Colegio San Rafael",
            "start_date": "2026-09-01",
            "contract_data": {
                "working_day_type": "full_time",
                "weekly_hours": 40,
                "job_position": "Administrativo/a de RRHH",
            },
        }),
    )

    assert review["passed"] is True
    assert all(review["evidence"]["checks"].values())


def test_a07_rejects_indefinite_contract_with_wrong_job_or_workday(monkeypatch):
    employee = SimpleNamespace(id=1)
    contract = a07_contract(job_position="Auxiliar", weekly_hours=35)
    monkeypatch.setattr(review_service, "_find_employee", lambda _db, _name: employee)
    monkeypatch.setattr(review_service, "_latest_contract", lambda _db, _employee: contract)

    review = review_service._review_a07(
        None,
        assignment({
            "employee": "Fulanito Pérez",
            "company_name": "Fundación AulaNomina",
            "center_name": "Colegio San Rafael",
            "start_date": "2026-09-01",
            "contract_data": {
                "working_day_type": "full_time",
                "weekly_hours": 40,
                "job_position": "Administrativo/a de RRHH",
            },
        }),
    )

    assert review["passed"] is False
    assert review["evidence"]["checks"]["workday"] is False
    assert review["evidence"]["checks"]["job_position"] is False


def test_a09_requires_replacement_social_security_trace(monkeypatch):
    substitute = SimpleNamespace(id=10)
    replaced = SimpleNamespace(id=11, naf="14/1000000005")
    contract = a09_contract(
        ss_registration=SimpleNamespace(
            is_replacement=True,
            replacement_cause_code="01",
            replaced_worker_naf="14/1000000005",
        )
    )

    def fake_find(_db, name):
        return replaced if name == "Ana Martín" else substitute

    monkeypatch.setattr(review_service, "_find_employee", fake_find)
    monkeypatch.setattr(review_service, "_latest_contract", lambda _db, _employee: contract)

    review = review_service._review_a09(
        None,
        assignment({
            "substitute": "Laura Sánchez",
            "start_date": "2026-08-06",
            "replaced_employee": "Ana Martín",
        }),
    )

    assert review["passed"] is True
    assert review["evidence"]["replaced_naf_matches"] is True


def test_a09_rejects_substitution_without_replaced_worker_naf(monkeypatch):
    substitute = SimpleNamespace(id=10)
    replaced = SimpleNamespace(id=11, naf="14/1000000005")
    contract = a09_contract(
        ss_registration=SimpleNamespace(
            is_replacement=True,
            replacement_cause_code="01",
            replaced_worker_naf="",
        )
    )

    def fake_find(_db, name):
        return replaced if name == "Ana Martín" else substitute

    monkeypatch.setattr(review_service, "_find_employee", fake_find)
    monkeypatch.setattr(review_service, "_latest_contract", lambda _db, _employee: contract)

    review = review_service._review_a09(
        None,
        assignment({
            "substitute": "Laura Sánchez",
            "start_date": "2026-08-06",
            "replaced_employee": "Ana Martín",
        }),
    )

    assert review["passed"] is False
    assert review["evidence"]["replaced_worker_naf"] == ""
