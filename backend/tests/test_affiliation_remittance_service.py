import json
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - registra todas las tablas en Base
from app.db import Base
from app.models.affiliation_worker_state import AffiliationWorkerState
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.services.affiliation_remittance_service import (
    add_movements,
    create_draft,
    generate_draft,
    list_candidates,
    process_affiliation_submission,
    send_draft,
    serialize_draft,
)
from app.services.siltra_response_codes import CommunicationSubmissionStatus


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def create_contract(
    db,
    *,
    company_name="Empresa Demo",
    cif="B12345678",
    ccc="14123456789",
    employee_code="1",
    dni="12345678Z",
    naf="141234567890",
    start_date=date(2026, 7, 10),
    end_date=None,
):
    company = Company(name=company_name, cif=cif, ccc=ccc)
    db.add(company)
    db.flush()
    employee = Employee(
        employee_code=employee_code,
        company_id=company.id,
        dni=dni,
        naf=naf,
        first_name="Ana",
        last_name="Prueba",
    )
    db.add(employee)
    db.flush()
    contract = Contract(
        employee_id=employee.id,
        company_id=company.id,
        contract_type="Indefinido",
        contract_code="100",
        start_date=start_date,
        end_date=end_date,
        contribution_group="05",
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return company, employee, contract


def prepare_submission(db, movement_key):
    draft = create_draft(db, [movement_key])
    generate_draft(db, draft)
    return draft, send_draft(db, draft)


def test_candidates_are_derived_from_contract_dates(db):
    _, _, contract = create_contract(db, end_date=date(2026, 7, 31))

    candidates = list_candidates(
        db,
        date_from=date(2026, 7, 1),
        date_to=date(2026, 7, 31),
    )

    assert {item["movement_type"] for item in candidates} == {"ALTA", "BAJA"}
    assert {item["contract_id"] for item in candidates} == {contract.id}
    assert {item["ccc"] for item in candidates} == {"14123456789"}


def test_accepted_registration_creates_independent_external_state(db):
    _, employee, contract = create_contract(db)
    movement_key = f"A:{contract.id}:2026-07-10"
    draft, submission = prepare_submission(db, movement_key)

    result = process_affiliation_submission(db, submission)
    state = db.query(AffiliationWorkerState).one()

    assert result.status == CommunicationSubmissionStatus.ACCEPTED.value
    assert result.response_code == "A0001"
    assert state.employee_id == employee.id
    assert state.ccc == "14123456789"
    assert state.status == "ACTIVE"
    assert draft.response_file_id == result.response_file_id


def test_duplicate_registration_is_rejected_without_overwriting_state(db):
    _, employee, contract = create_contract(db)
    movement_key = f"A:{contract.id}:2026-07-10"
    draft, first_submission = prepare_submission(db, movement_key)
    process_affiliation_submission(db, first_submission)

    second_submission = send_draft(db, draft)
    second_result = process_affiliation_submission(db, second_submission)
    state = db.query(AffiliationWorkerState).filter_by(employee_id=employee.id).one()

    assert second_result.status == CommunicationSubmissionStatus.REJECTED.value
    assert second_result.response_code in {"R9704", "R9709"}
    assert state.status == "ACTIVE"
    assert second_submission.attempt_number == 2


def test_termination_requires_active_state_in_same_ccc(db):
    company, employee, contract = create_contract(
        db,
        start_date=date(2026, 6, 1),
        end_date=date(2026, 7, 10),
    )
    db.add(
        AffiliationWorkerState(
            employee_id=employee.id,
            company_id=company.id,
            contract_id=contract.id,
            ccc="14123456789",
            status="INACTIVE",
        )
    )
    db.commit()

    _, submission = prepare_submission(db, f"B:{contract.id}:2026-07-10")
    result = process_affiliation_submission(db, submission)

    assert result.status == CommunicationSubmissionStatus.REJECTED.value
    assert result.response_code == "R9705"
    assert db.query(AffiliationWorkerState).one().status == "INACTIVE"


def test_valid_registration_then_termination_updates_external_state(db):
    company, employee, contract = create_contract(db, end_date=date(2026, 7, 31))
    alta_draft, alta_submission = prepare_submission(db, f"A:{contract.id}:2026-07-10")
    assert process_affiliation_submission(db, alta_submission).status == "ACCEPTED"

    baja_draft, baja_submission = prepare_submission(db, f"B:{contract.id}:2026-07-31")
    baja_result = process_affiliation_submission(db, baja_submission)
    state = db.query(AffiliationWorkerState).filter_by(employee_id=employee.id, company_id=company.id).one()

    assert baja_result.status == "ACCEPTED"
    assert state.status == "INACTIVE"
    assert state.last_movement_type == "BAJA"
    assert alta_draft.id != baja_draft.id


@pytest.mark.parametrize(
    ("dni", "naf", "expected_code"),
    [
        ("12345678A", "141234567890", "R9701"),
        ("12345678Z", "12345", "R9702"),
    ],
)
def test_identity_and_naf_errors_are_returned_by_siltra(db, dni, naf, expected_code):
    _, _, contract = create_contract(db, dni=dni, naf=naf)
    _, submission = prepare_submission(db, f"A:{contract.id}:2026-07-10")

    result = process_affiliation_submission(db, submission)
    messages = json.loads(result.messages)

    assert result.status == "REJECTED"
    assert result.response_code == expected_code
    assert any(message["code"] == expected_code for message in messages)


def test_progressive_draft_can_mix_companies_and_selected_movements(db):
    _, _, first_contract = create_contract(db)
    _, _, second_contract = create_contract(
        db,
        company_name="Empresa Dos",
        cif="B87654321",
        ccc="28123456789",
        employee_code="2",
        dni="00000000T",
        naf="281234567890",
    )
    first_key = f"A:{first_contract.id}:2026-07-10"
    second_key = f"A:{second_contract.id}:2026-07-10"

    draft = create_draft(db, [first_key])
    draft = add_movements(db, draft, [second_key])
    serialized = serialize_draft(db, draft)

    assert serialized["movement_count"] == 2
    assert serialized["company_count"] == 2
    assert serialized["ccc_count"] == 2
    assert {item["movement_key"] for item in serialized["movements"]} == {first_key, second_key}
