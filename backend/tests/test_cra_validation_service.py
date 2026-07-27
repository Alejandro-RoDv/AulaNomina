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
from app.services.cra_validation_service import determine_cra_result, validate_cra_file


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


def cra_xml(*, naf="141234567890", action="A", amount="1500.00"):
    return f'''<?xml version="1.0"?>
<CRA version="AULANOMINA-EDU-1" simulated="true">
  <DDE companyId="1" companyName="Empresa Demo" ccc="14123456789" period="2026-06">
    <TRB employeeId="9" name="Trabajadora Demo" naf="{naf}" payrollId="44">
      <CRE code="0001" indicator="I" amount="{amount}" action="{action}" />
    </TRB>
  </DDE>
</CRA>'''


def create_source(db, *, content=None, status="GENERATED", metadata=None):
    company = db.query(Company).first()
    if not company:
        company = Company(name="Empresa Demo", cif="B12345678", ccc="14123456789")
        db.add(company)
        db.flush()
    item = CommunicationFile(
        company_id=company.id,
        ccc_id="14123456789",
        period="2026-06",
        file_type=CommunicationFileType.CRA.value,
        status=status,
        generated_at=datetime.utcnow(),
        original_filename="CRA-demo.xml",
        content=content or cra_xml(),
        file_metadata=json.dumps(metadata or {}),
        validation_errors="[]",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def test_valid_cra_is_accepted_automatically(db):
    source = create_source(db)
    messages = validate_cra_file(db, source)
    status, code, _, result_messages = determine_cra_result(messages, "AUTO")

    assert status == CommunicationFileStatus.ACCEPTED.value
    assert code == "A0000"
    assert not [item for item in result_messages if item["severity"] == "ERROR"]


def test_missing_naf_rejects_the_file(db):
    source = create_source(db, content=cra_xml(naf="SIN_NAF"))
    messages = validate_cra_file(db, source)
    status, code, _, result_messages = determine_cra_result(messages, "AUTO")

    assert status == CommunicationFileStatus.REJECTED.value
    assert code == "R1000"
    assert any(item["code"] == "RCRA007" for item in result_messages)


def test_practice_warning_scenario_returns_accepted_with_warnings(db):
    source = create_source(db)
    messages = validate_cra_file(db, source)
    status, code, _, result_messages = determine_cra_result(messages, "WARNINGS")

    assert status == CommunicationFileStatus.ACCEPTED_WITH_WARNINGS.value
    assert code == "W1000"
    assert any(item["code"] == "WCRA900" for item in result_messages)


def test_practice_rejection_scenario_returns_rejected(db):
    source = create_source(db)
    messages = validate_cra_file(db, source)
    status, code, _, result_messages = determine_cra_result(messages, "REJECTED")

    assert status == CommunicationFileStatus.REJECTED.value
    assert code == "R1000"
    assert any(item["code"] == "RCRA900" for item in result_messages)


def test_duplicate_high_after_accepted_requires_rectification(db):
    create_source(db, status=CommunicationFileStatus.ACCEPTED.value)
    duplicate = create_source(db)
    messages = validate_cra_file(db, duplicate)

    assert any(item["code"] == "RCRA015" for item in messages)


def test_modification_requires_an_accepted_previous_record(db):
    modification = create_source(db, content=cra_xml(action="M"))
    messages = validate_cra_file(db, modification)

    assert any(item["code"] == "RCRA016" for item in messages)
