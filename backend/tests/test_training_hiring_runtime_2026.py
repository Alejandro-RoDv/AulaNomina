import json
from datetime import date
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - registra todas las tablas
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.contract_lifecycle_event import ContractLifecycleEvent
from app.models.employee import Employee
from app.schemas.contract_lifecycle import ContractExtensionRequest, ContractWorkdayChangeRequest
from app.services.contract_lifecycle_service import (
    ContractLifecycleError,
    register_contract_extension,
    register_workday_change,
)
from app.services.training_activity_runtime_service import _public_response_schema
from app.services.training_hiring_review_service import _decision
from app.training.hiring_runtime_cases_2026 import HIRING_SCENARIO_CODES, build_hiring_runtime_cases_2026


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


def _definitions():
    return {case.scenario_code: case for case in build_hiring_runtime_cases_2026()}


def _contract(db, *, contract_type="indefinido", contract_code="100", end_date=None):
    company = Company(name="Empresa B02", cif="B14000002", ccc="14140000002")
    db.add(company)
    db.flush()
    employee = Employee(
        employee_code="B02-1",
        company_id=company.id,
        dni="30999999K",
        first_name="Alumno",
        last_name="Contrato",
    )
    db.add(employee)
    db.flush()
    contract = Contract(
        employee_id=employee.id,
        company_id=company.id,
        contract_type=contract_type,
        contract_code=contract_code,
        start_date=date(2026, 1, 1),
        end_date=end_date,
        status="active",
        working_day_type="full_time",
        weekly_hours=40,
        full_time_weekly_hours=40,
        monthly_hours=173.33,
        annual_hours=2080,
        partiality_coefficient=100,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


def test_b02_defines_only_missing_master_practices():
    definitions = _definitions()
    assert set(definitions) == HIRING_SCENARIO_CODES
    assert sorted(case.initial_state["training_sequence"][0] for case in definitions.values()) == [
        "A06", "A08", "A10", "A11", "A12", "A13"
    ]
    assert all(case.category == "contract" for case in definitions.values())
    assert all(len(case.tasks) == 1 for case in definitions.values())


def test_b02_public_decisions_do_not_expose_server_answer_key():
    for scenario in ("TRAIN-2026-HIRE-A06", "TRAIN-2026-HIRE-A13"):
        task = _definitions()[scenario].tasks[0]
        public = _public_response_schema(task)
        assert public["type"] == "decision"
        assert "validation_key" not in public
        assert "expected_decision" not in public
        assert "evidence_keywords" not in public


def test_a06_requires_modality_and_material_justification():
    correct = _decision(
        SimpleNamespace(student_notes=json.dumps({
            "decision": "temporary_production",
            "explanation": "La necesidad es temporal por un incremento ocasional e imprevisible de producción y existe una duración limitada.",
        })),
        "A06",
    )
    assert correct["passed"] is True

    unsupported = _decision(
        SimpleNamespace(student_notes=json.dumps({
            "decision": "temporary_production",
            "explanation": "Es el contrato que elegiría.",
        })),
        "A06",
    )
    assert unsupported["passed"] is False


def test_a10_and_a11_cases_require_training_specific_data():
    definitions = _definitions()
    a10 = definitions["TRAIN-2026-HIRE-A10"].initial_state["contract_data"]
    assert a10["contract_code"] == "421"
    assert a10["training_contract_subtype"] == "alternance"
    assert a10["training_work_percentage"] == 65
    assert a10["training_plan_reference"] == "PF-A10-2026"

    a11 = definitions["TRAIN-2026-HIRE-A11"].initial_state["contract_data"]
    assert a11["contract_code"] == "420"
    assert a11["training_contract_subtype"] == "professional_practice"
    assert a11["qualification_date"] == "2025-06-20"
    assert a11["training_plan_reference"] == "PF-A11-2026"


def test_workday_change_preserves_previous_state_and_updates_contract(db):
    contract = _contract(db)
    event = register_workday_change(
        db,
        contract.id,
        ContractWorkdayChangeRequest(
            effective_date=date(2026, 9, 1),
            weekly_hours=30,
            reason="Acuerdo de reducción de jornada",
        ),
    )
    db.refresh(contract)

    assert event.event_type == "workday_change"
    assert event.previous_state["weekly_hours"] == 40
    assert event.new_state["weekly_hours"] == 30
    assert event.new_state["partiality_coefficient"] == 75
    assert contract.weekly_hours == 30
    assert contract.partiality_coefficient == 75
    assert contract.working_day_type == "part_time"


def test_workday_change_rejects_hours_above_full_time_reference(db):
    contract = _contract(db)
    with pytest.raises(ContractLifecycleError):
        register_workday_change(
            db,
            contract.id,
            ContractWorkdayChangeRequest(
                effective_date=date(2026, 9, 1),
                weekly_hours=45,
                reason="Cambio no válido",
            ),
        )


def test_extension_preserves_old_end_date_without_changing_modality(db):
    contract = _contract(db, contract_type="temporal", contract_code="402", end_date=date(2026, 8, 31))
    event = register_contract_extension(
        db,
        contract.id,
        ContractExtensionRequest(
            effective_date=date(2026, 8, 31),
            new_end_date=date(2026, 11, 30),
            reason="Continúa la misma necesidad temporal",
        ),
    )
    db.refresh(contract)

    assert event.event_type == "extension"
    assert event.previous_state["end_date"] == "2026-08-31"
    assert event.new_state["end_date"] == "2026-11-30"
    assert contract.end_date == date(2026, 11, 30)
    assert contract.contract_code == "402"
    assert db.query(ContractLifecycleEvent).filter_by(contract_id=contract.id).count() == 1


def test_extension_is_not_used_for_indefinite_contract(db):
    contract = _contract(db, contract_type="indefinido", contract_code="100", end_date=date(2026, 8, 31))
    with pytest.raises(ContractLifecycleError):
        register_contract_extension(
            db,
            contract.id,
            ContractExtensionRequest(
                effective_date=date(2026, 8, 31),
                new_end_date=date(2026, 11, 30),
                reason="No debe tratarse como prórroga",
            ),
        )
