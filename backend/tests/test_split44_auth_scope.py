import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
import app.services.activity_service as activity_service
from app.db import Base
from app.models.case_assignment import CaseAssignment
from app.models.case_progress import CaseTaskProgress
from app.models.case_study import CaseStudy, CaseTask
from app.models.mail import EmailMessage, EmailThread, Mailbox
from app.models.student import Student
from app.models.student_group import StudentGroup
from app.models.training_workspace import TrainingWorkspace
from app.models.user import User
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.auth_service import (
    create_user_session,
    hash_password,
    resolve_principal,
    revoke_session,
    verify_password,
)
from app.services.case_scenario_service import update_assignment_step
from app.services.learner_course_service import _ASSIGNMENT_SCOPE
from app.services.learner_scope_service import (
    assert_assignment_access,
    materialize_group_assignments,
)


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def _build_group_training(db):
    group = StudentGroup(
        group_code="G-S44",
        name="Grupo Split 44",
        status="active",
        is_active=True,
    )
    db.add(group)
    db.flush()

    users = []
    students = []
    for index, name in enumerate(("Ana", "Bruno"), start=1):
        email = f"{name.lower()}@aulanomina.test"
        user = User(
            email=email,
            password_hash=hash_password("ClaveDemo2026"),
            role="student",
            is_active=True,
        )
        db.add(user)
        db.flush()
        student = Student(
            user_id=user.id,
            student_code=f"S44-{index}",
            first_name=name,
            last_name="Alumno",
            email=email,
            group_id=group.id,
            status="active",
            is_active=True,
        )
        db.add(student)
        db.flush()
        users.append(user)
        students.append(student)

    case = CaseStudy(
        scenario_code="S44-GROUP-001",
        title="Caso de grupo aislado",
        description="Caso para comprobar aislamiento.",
        difficulty="basic",
        category="general",
        status="active",
        initial_state={},
        validation_rules=[],
    )
    db.add(case)
    db.flush()
    task = CaseTask(
        case_study_id=case.id,
        title="Revisar expediente",
        module="employees",
        expected_action="review_employee",
        expected_result="Expediente revisado",
        task_order=1,
        is_required=True,
        blocking=True,
    )
    db.add(task)
    db.flush()

    template = CaseAssignment(
        case_study_id=case.id,
        group_id=group.id,
        assigned_by="Docente",
        status="assigned",
    )
    source_mailbox = Mailbox(
        role="student",
        display_name="Plantilla Grupo",
        address="grupo-s44@aulanomina.local",
    )
    db.add_all([template, source_mailbox])
    db.flush()
    thread = EmailThread(
        mailbox_id=source_mailbox.id,
        case_study_id=case.id,
        case_assignment_id=template.id,
        case_task_id=task.id,
        subject="Revisa tu expediente",
        folder="inbox",
        status="open",
        priority="normal",
        category="general",
        expected_actions=[],
        context_actions=[],
    )
    db.add(thread)
    db.flush()
    db.add(
        EmailMessage(
            thread_id=thread.id,
            sender_name="Tutor",
            sender_address="tutor@aulanomina.local",
            recipient_name="Grupo",
            recipient_address=source_mailbox.address,
            body_text="Realiza la actividad asignada.",
            direction="incoming",
            message_type="initial",
        )
    )
    db.commit()
    return users, students, case, task, template


def test_password_hash_and_session_resolution(db):
    users, students, _, _, _ = _build_group_training(db)
    user = users[0]

    assert verify_password("ClaveDemo2026", user.password_hash) is True
    assert verify_password("incorrecta", user.password_hash) is False

    raw_token, session, linked_student = create_user_session(db, user)
    principal = resolve_principal(db, raw_token)

    assert linked_student.id == students[0].id
    assert principal is not None
    assert principal.user_id == user.id
    assert principal.student_id == students[0].id
    assert principal.workspace_id is not None
    assert principal.workspace_code.startswith("WS-")
    workspace = db.query(TrainingWorkspace).filter_by(id=principal.workspace_id).one()
    assert workspace.student_id == students[0].id

    revoke_session(db, session.id)
    assert resolve_principal(db, raw_token) is None


def test_group_template_materializes_private_assignments_progress_and_mail(db):
    users, students, _, task, template = _build_group_training(db)
    principals = []
    for user in users:
        token, _, _ = create_user_session(db, user)
        principals.append(resolve_principal(db, token))

    assignments_a = materialize_group_assignments(db, principals[0])
    assignments_b = materialize_group_assignments(db, principals[1])

    assignment_a = next(item for item in assignments_a if item.case_study_id == template.case_study_id)
    assignment_b = next(item for item in assignments_b if item.case_study_id == template.case_study_id)

    assert principals[0].workspace_id != principals[1].workspace_id
    assert assignment_a.id != assignment_b.id
    assert assignment_a.id != template.id
    assert assignment_b.id != template.id
    assert assignment_a.student_id == students[0].id
    assert assignment_b.student_id == students[1].id
    assert assignment_a.workspace_id == principals[0].workspace_id
    assert assignment_b.workspace_id == principals[1].workspace_id
    assert assignment_a.group_id is None
    assert assignment_b.group_id is None

    progress_a = db.query(CaseTaskProgress).filter_by(assignment_id=assignment_a.id, task_id=task.id).one()
    progress_b = db.query(CaseTaskProgress).filter_by(assignment_id=assignment_b.id, task_id=task.id).one()
    assert progress_a.status == "pending"
    assert progress_b.status == "pending"

    update_assignment_step(
        db,
        assignment_a.id,
        task.id,
        CaseTaskProgressUpdate(status="completed", validation_result={"manual_check": True}),
    )
    db.refresh(progress_b)
    assert progress_b.status == "pending"

    mailboxes = db.query(Mailbox).filter(Mailbox.user_id.in_([users[0].id, users[1].id])).all()
    assert len(mailboxes) == 2
    assert mailboxes[0].id != mailboxes[1].id
    for mailbox in mailboxes:
        cloned = db.query(EmailThread).filter_by(mailbox_id=mailbox.id).all()
        assert len(cloned) == 1
        assert cloned[0].case_assignment_id in {assignment_a.id, assignment_b.id}
        assert len(cloned[0].messages) == 1


def test_student_cannot_access_another_students_assignment(db):
    users, _, _, _, _ = _build_group_training(db)
    principals = []
    for user in users:
        token, _, _ = create_user_session(db, user)
        principals.append(resolve_principal(db, token))

    assignment_a = materialize_group_assignments(db, principals[0])[0]
    assignment_b = materialize_group_assignments(db, principals[1])[0]

    assert_assignment_access(db, principals[0], assignment_a.id)
    with pytest.raises(HTTPException) as exc_info:
        assert_assignment_access(db, principals[0], assignment_b.id)
    assert exc_info.value.status_code == 403


def test_activity_selector_respects_request_scoped_assignment_ids(db):
    users, _, case, _, template = _build_group_training(db)
    token, _, _ = create_user_session(db, users[0])
    principal = resolve_principal(db, token)
    private_assignment = materialize_group_assignments(db, principal)[0]

    scope_token = _ASSIGNMENT_SCOPE.set(frozenset({private_assignment.id}))
    try:
        selected = activity_service._select_assignments(db)
    finally:
        _ASSIGNMENT_SCOPE.reset(scope_token)

    chosen = next(item for item in selected if item.case_study_id == case.id)
    assert chosen.id == private_assignment.id
    assert chosen.id != template.id
