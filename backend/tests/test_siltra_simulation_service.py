import json
from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - registra todas las tablas en Base
from app.db import Base
from app.models.communication_file import CommunicationFile
from app.models.company import Company
from app.services.communication_file_workflow import CommunicationFileStatus, CommunicationFileType
from app.services.siltra_simulation_service import (
    CommunicationSubmissionStatus,
    SiltraSimulationDomainError,
    cancel_submission,
    create_submission,
    determine_result,
    generate_submission_number,
    send_submission,
    submit_communication_file,
)


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


def valid_payload(**overrides):
    worker = {
        "payroll_id": 42,
        "employee_id": 15,
        "employee_name": "Trabajadora de prueba",
        "naf": "141234567890",
        "contribution_group": "05",
        "contribution_days": 30,
        "bases": {
            "common": "1500.00",
            "professional": "1500.00",
            "unemployment_training_fogasa": "1500.00",
        },
        "total_due": "510.00",
    }
    payload = {
        "format": "AULANOMINA_SOCIAL_SECURITY_SETTLEMENT_V1",
        "settlement_id": 7,
        "company_id": 1,
        "ccc": "14123456789",
        "period": "2026-06",
        "totals": {
            "worker_count": 1,
            "bases": {
                "common": "1500.00",
                "professional": "1500.00",
                "unemployment_training_fogasa": "1500.00",
            },
            "total_due": "510.00",
        },
        "workers": [worker],
    }
    for key, value in overrides.items():
        if key == "worker":
            payload["workers"] = [{**worker, **value}]
        elif key == "totals":
            payload["totals"] = {**payload["totals"], **value}
        else:
            payload[key] = value
    return payload


def create_source(db, *, status="GENERATED", content=None, ccc="14123456789"):
    company = db.query(Company).first()
    if not company:
        company = Company(name="Empresa Demo", cif="B12345678", ccc="14123456789")
        db.add(company)
        db.flush()
    payload = valid_payload(company_id=company.id, ccc=ccc) if content is None else content
    source = CommunicationFile(
        company_id=company.id,
        ccc_id=ccc,
        period="2026-06",
        file_type=CommunicationFileType.SOCIAL_SECURITY_SETTLEMENT.value,
        status=status,
        generated_at=datetime.utcnow(),
        original_filename="SS_demo_202606.json",
        content=json.dumps(payload) if not isinstance(payload, str) else payload,
        file_metadata=json.dumps(
            {
                "settlement_id": 7,
                "format": "AULANOMINA_SOCIAL_SECURITY_SETTLEMENT_V1",
                "worker_count": 1,
                "total_due": "510.00",
            }
        ),
        validation_errors="[]",
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def test_submission_number_is_year_scoped_and_incremental(db):
    assert generate_submission_number(db, datetime(2026, 7, 14)) == "SILTRA-SIM-2026-000001"
    source = create_source(db)
    first = create_submission(db, source.id)
    assert first.submission_number == "SILTRA-SIM-2026-000001"
    cancel_submission(db, first)
    assert generate_submission_number(db, datetime(2026, 7, 14)) == "SILTRA-SIM-2026-000002"


def test_attempt_number_increments_without_overwriting_history(db):
    source = create_source(db)
    first = submit_communication_file(db, source.id)
    second = submit_communication_file(db, source.id)
    assert first.attempt_number == 1
    assert second.attempt_number == 2
    assert first.id != second.id
    assert first.status == CommunicationSubmissionStatus.ACCEPTED.value
    assert second.status == CommunicationSubmissionStatus.ACCEPTED_WITH_WARNINGS.value


def test_rejects_non_generated_and_empty_files(db):
    draft = create_source(db, status=CommunicationFileStatus.DRAFT.value)
    with pytest.raises(SiltraSimulationDomainError):
        create_submission(db, draft.id)

    draft.status = CommunicationFileStatus.GENERATED.value
    draft.content = ""
    db.commit()
    with pytest.raises(SiltraSimulationDomainError):
        create_submission(db, draft.id)


def test_accepts_correct_file_and_creates_linked_response(db):
    source = create_source(db)
    submission = submit_communication_file(db, source.id)
    db.refresh(source)
    assert submission.status == CommunicationSubmissionStatus.ACCEPTED.value
    assert submission.response_code == "A0000"
    assert submission.response_file_id is not None
    assert source.status == CommunicationFileStatus.ACCEPTED.value
    assert source.response_file_id == submission.response_file_id
    assert submission.response_file.file_type == CommunicationFileType.SILTRA_RESPONSE.value
    response = json.loads(submission.response_file.content)
    assert response["format"] == "AULANOMINA_SILTRA_RESPONSE_V1"
    assert response["submission_number"] == submission.submission_number


def test_accepts_with_zero_day_warning(db):
    payload = valid_payload(worker={"contribution_days": 0})
    source = create_source(db, content=payload)
    submission = submit_communication_file(db, source.id)
    assert submission.status == CommunicationSubmissionStatus.ACCEPTED_WITH_WARNINGS.value
    assert submission.response_code == "W9603"


@pytest.mark.parametrize(
    ("worker_changes", "expected_code"),
    [
        ({"naf": None}, "R9501"),
        ({"contribution_group": None}, "R9505"),
        ({"bases": {"common": "-1.00"}}, "R9504"),
    ],
)
def test_worker_blocking_errors_reject(db, worker_changes, expected_code):
    source = create_source(db, content=valid_payload(worker=worker_changes))
    submission = submit_communication_file(db, source.id)
    assert submission.status == CommunicationSubmissionStatus.REJECTED.value
    assert submission.response_code == expected_code


def test_invalid_ccc_and_negative_total_reject(db):
    source = create_source(db, ccc="14999999999")
    submission = submit_communication_file(db, source.id)
    assert submission.response_code == "R9511"

    second_source = create_source(db, content=valid_payload(totals={"total_due": "-1.00"}))
    second = submit_communication_file(db, second_source.id)
    assert second.response_code == "R9506"


def test_errors_take_priority_over_warnings():
    status, code, _ = determine_result(
        [
            {"severity": "WARNING", "code": "W9603", "message": "warning"},
            {"severity": "ERROR", "code": "R9501", "message": "error"},
        ]
    )
    assert status == CommunicationSubmissionStatus.REJECTED
    assert code == "R9501"


def test_source_state_events_are_conserved(db):
    source = create_source(db)
    submission = submit_communication_file(db, source.id)
    db.refresh(source)
    transitions = [(event.from_status, event.to_status) for event in source.events]
    assert (CommunicationFileStatus.GENERATED.value, CommunicationFileStatus.SENT.value) in transitions
    assert (CommunicationFileStatus.SENT.value, CommunicationFileStatus.PROCESSING.value) in transitions
    assert (CommunicationFileStatus.PROCESSING.value, CommunicationFileStatus.ACCEPTED.value) in transitions
    assert any(str(submission.id) in event.details for event in source.events)


def test_cancel_is_only_valid_before_processing_finishes(db):
    source = create_source(db)
    pending = create_submission(db, source.id)
    assert cancel_submission(db, pending).status == CommunicationSubmissionStatus.CANCELLED.value

    sent = send_submission(db, create_submission(db, source.id))
    assert cancel_submission(db, sent).status == CommunicationSubmissionStatus.CANCELLED.value
    db.refresh(source)
    assert source.status == CommunicationFileStatus.GENERATED.value

    final = submit_communication_file(db, source.id)
    with pytest.raises(SiltraSimulationDomainError):
        cancel_submission(db, final)


def test_prevents_two_active_attempts_for_same_file(db):
    source = create_source(db)
    create_submission(db, source.id)
    with pytest.raises(SiltraSimulationDomainError, match="intento activo"):
        create_submission(db, source.id)


def test_invalid_period_invalid_json_and_empty_workers_reject(db):
    source = create_source(db)
    source.period = "2026-Q2"
    db.commit()
    assert submit_communication_file(db, source.id).response_code == "R9503"

    invalid_json = create_source(db, content="{not-json")
    assert submit_communication_file(db, invalid_json.id).response_code == "R9508"

    without_workers = create_source(db, content=valid_payload(workers=[]))
    assert submit_communication_file(db, without_workers.id).response_code == "R9507"


def test_rounding_difference_is_warning(db):
    source = create_source(db, content=valid_payload(totals={"total_due": "510.02"}))
    submission = submit_communication_file(db, source.id)
    assert submission.status == CommunicationSubmissionStatus.ACCEPTED_WITH_WARNINGS.value
    assert submission.response_code == "W9602"
