"""A02: correo laboral en la primera apertura, sin duplicados ni datos incompletos."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.mail import EmailThread, Mailbox
from app.training.activity_mail_2026 import deliver_a02_mail_on_open, deliver_activity_mail_on_open
from app.training.foundation_runtime_cases_2026 import (
    FOUNDATION_CENTER_EXPECTED_CCC,
    FOUNDATION_COMPANY_CCC,
    build_foundation_runtime_cases_2026,
)


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def _assignment(db, scenario_code="TRAIN-2026-FOUND-A02"):
    definition = next(
        case for case in build_foundation_runtime_cases_2026()
        if case.scenario_code == scenario_code
    )
    case = CaseStudy(**definition.model_dump(exclude={"tasks"}))
    db.add(case)
    db.flush()
    for task in definition.tasks:
        db.add(CaseTask(case_study_id=case.id, **task.model_dump()))
    db.flush()
    assignment = CaseAssignment(case_study_id=case.id, assigned_by="Profesor demo")
    db.add(assignment)
    db.flush()
    return assignment


def test_first_open_delivers_realistic_company_center_brief_and_attachments(db):
    assignment = _assignment(db)
    mailbox = Mailbox(role="student", display_name="Alumna demo", address="a02@example.test")
    db.add(mailbox)
    db.commit()

    thread = deliver_a02_mail_on_open(db, mailbox, assignment.id)

    assert thread.folder == "inbox"
    assert thread.is_read is False
    assert thread.case_assignment_id == assignment.id
    assert thread.subject.startswith("A02 ·")
    assert len(thread.messages) == 1

    initial = thread.messages[0]
    assert initial.direction == "incoming"
    assert FOUNDATION_COMPANY_CCC in initial.body_text
    assert FOUNDATION_CENTER_EXPECTED_CCC in initial.body_text
    assert "Domicilio social:" in initial.body_text
    assert "Datos de empresa" not in initial.body_text
    assert "F.01" not in initial.body_text

    attachments = {document.filename: document.content_text for document in initial.attachments}
    assert set(attachments) == {
        "Ficha_identificacion_empresa_A02.txt",
        "Ficha_centro_trabajo_A02.txt",
    }
    assert FOUNDATION_COMPANY_CCC in attachments["Ficha_identificacion_empresa_A02.txt"]
    assert FOUNDATION_CENTER_EXPECTED_CCC in attachments["Ficha_centro_trabajo_A02.txt"]
    assert "Persona de contacto:" in attachments["Ficha_identificacion_empresa_A02.txt"]


def test_reopening_briefing_keeps_single_thread_and_read_archive_state(db):
    assignment = _assignment(db)
    mailbox = Mailbox(role="student", display_name="Alumno uno", address="one@example.test")
    db.add(mailbox)
    db.commit()

    first = deliver_a02_mail_on_open(db, mailbox, assignment.id)
    first_id = first.id
    first.is_read = True
    first.folder = "archive"
    db.commit()

    second = deliver_a02_mail_on_open(db, mailbox, assignment.id)
    db.refresh(second)
    assert second.id == first_id
    assert second.folder == "archive"
    assert second.is_read is True
    assert db.query(EmailThread).filter(EmailThread.mailbox_id == mailbox.id).count() == 1
    assert len(second.messages) == 1


def test_students_receive_separate_a02_threads(db):
    assignment = _assignment(db)
    first_mailbox = Mailbox(role="student", display_name="Alumno uno", address="one@example.test")
    second_mailbox = Mailbox(role="student", display_name="Alumno dos", address="two@example.test")
    db.add_all([first_mailbox, second_mailbox])
    db.commit()

    first = deliver_a02_mail_on_open(db, first_mailbox, assignment.id)
    second = deliver_a02_mail_on_open(db, second_mailbox, assignment.id)

    assert first.id != second.id
    assert first.mailbox_id != second.mailbox_id
    assert len(first.messages) == 1
    assert len(second.messages) == 1


def test_different_activity_cannot_receive_a02_documents(db):
    assignment = _assignment(db)
    assignment.case_study.scenario_code = "TRAIN-2026-FOUND-A05"
    mailbox = Mailbox(role="student", display_name="Alumno", address="nope@example.test")
    db.add(mailbox)
    db.commit()

    with pytest.raises(ValueError, match="no corresponde"):
        deliver_a02_mail_on_open(db, mailbox, assignment.id)
    assert db.query(EmailThread).count() == 0


def test_other_activities_also_receive_a_first_open_mail(db):
    assignment = _assignment(db, "TRAIN-2026-FOUND-A03")
    mailbox = Mailbox(role="student", display_name="Alumno demo", address="other@example.test")
    db.add(mailbox)
    db.commit()

    tasks = sorted(assignment.case_study.tasks, key=lambda task: task.task_order)
    first = deliver_activity_mail_on_open(db, mailbox, assignment.id, tasks[0].id)
    second = deliver_activity_mail_on_open(db, mailbox, assignment.id, tasks[1].id)

    assert first.id == second.id
    assert first.subject.startswith("A03 ·")
    assert "Elena Ruiz Mora" in first.messages[0].body_text
    assert len(first.messages) == 1
    assert db.query(EmailThread).filter(EmailThread.mailbox_id == mailbox.id).count() == 1


def test_other_activity_rejects_task_from_different_assignment(db):
    assignment = _assignment(db, "TRAIN-2026-FOUND-A03")
    wrong_assignment = _assignment(db, "TRAIN-2026-FOUND-A05")
    mailbox = Mailbox(role="student", display_name="Alumno demo", address="wrong-task@example.test")
    db.add(mailbox)
    db.commit()

    wrong_task_id = wrong_assignment.case_study.tasks[0].id
    with pytest.raises(ValueError, match="no pertenece"):
        deliver_activity_mail_on_open(db, mailbox, assignment.id, wrong_task_id)
    assert db.query(EmailThread).count() == 0
