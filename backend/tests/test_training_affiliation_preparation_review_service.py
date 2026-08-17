import json
from types import SimpleNamespace

import app.services.training_affiliation_preparation_review_service as review_service


class FakeQuery:
    def __init__(self, items):
        self.items = items

    def filter(self, *_args, **_kwargs):
        return self

    def order_by(self, *_args, **_kwargs):
        return self

    def all(self):
        return self.items


class FakeDb:
    def __init__(self, files):
        self.files = files

    def query(self, *_args, **_kwargs):
        return FakeQuery(self.files)


def assignment():
    return SimpleNamespace(
        case_study=SimpleNamespace(
            initial_state={
                "employee": "Fulanito Pérez",
                "start_date": "2026-09-01",
            }
        )
    )


def employee():
    return SimpleNamespace(
        id=4,
        first_name="Fulanito",
        last_name="Pérez",
        second_last_name=None,
        dni="12345678Z",
        naf="14/1234567890",
    )


def contract():
    return SimpleNamespace(
        id=14,
        company_id=1,
        company=SimpleNamespace(ccc="14000000001"),
        work_center=SimpleNamespace(main_ccc="14000000001", general_ccc="14000000001"),
    )


def affiliation_file(*, naf="14/1234567890", movement_type="ALTA"):
    movement = {
        "movement_type": movement_type,
        "effective_date": "2026-09-01",
        "employee_id": 4,
        "employee_name": "Fulanito Pérez",
        "contract_id": 14,
        "dni": "12345678Z",
        "naf": naf,
        "ccc": "14000000001",
    }
    return SimpleNamespace(
        id=91,
        status="DRAFT",
        content=json.dumps({"movements": [movement]}),
    )


def test_digits_normalizes_formatted_naf():
    assert review_service._digits("14/1234567890") == "141234567890"
    assert review_service._digits("14 1234567890") == "141234567890"


def test_a29_requires_alta_loaded_into_affiliation_file(monkeypatch):
    worker = employee()
    worker_contract = contract()
    monkeypatch.setattr(review_service, "_find_employee", lambda _db, _name: worker)
    monkeypatch.setattr(review_service, "_active_contract", lambda _db, _employee: worker_contract)

    review = review_service._review_a29(FakeDb([affiliation_file()]), assignment())

    assert review["passed"] is True
    assert review["evidence"]["prepared"] is True
    assert review["evidence"]["ccc_ok"] is True
    assert review["evidence"]["naf_ok"] is True


def test_a29_does_not_pass_from_contract_parametrization_without_remittance(monkeypatch):
    worker = employee()
    worker_contract = contract()
    monkeypatch.setattr(review_service, "_find_employee", lambda _db, _name: worker)
    monkeypatch.setattr(review_service, "_active_contract", lambda _db, _employee: worker_contract)

    review = review_service._review_a29(FakeDb([]), assignment())

    assert review["passed"] is False
    assert review["evidence"]["prepared"] is False
    assert review["evidence"]["communication_file_id"] is None


def test_a29_rejects_wrong_naf_even_when_movement_exists(monkeypatch):
    worker = employee()
    worker_contract = contract()
    monkeypatch.setattr(review_service, "_find_employee", lambda _db, _name: worker)
    monkeypatch.setattr(review_service, "_active_contract", lambda _db, _employee: worker_contract)

    review = review_service._review_a29(
        FakeDb([affiliation_file(naf="14/0000000000")]),
        assignment(),
    )

    assert review["passed"] is False
    assert review["evidence"]["naf_ok"] is False


def test_a29_rejects_baja_when_alta_is_expected(monkeypatch):
    worker = employee()
    worker_contract = contract()
    monkeypatch.setattr(review_service, "_find_employee", lambda _db, _name: worker)
    monkeypatch.setattr(review_service, "_active_contract", lambda _db, _employee: worker_contract)

    review = review_service._review_a29(
        FakeDb([affiliation_file(movement_type="BAJA")]),
        assignment(),
    )

    assert review["passed"] is False
    assert review["evidence"]["prepared"] is False
