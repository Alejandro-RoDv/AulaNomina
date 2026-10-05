import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.student import Student
from app.models.training_workspace import TrainingWorkspace
from app.schemas.workspace import TutorialState
from app.services.auth_service import AuthPrincipal
from app.workspace_routes import get_tutorial_state, update_tutorial_state


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


def _student_workspace(db, code: str):
    student = Student(
        student_code=code,
        first_name=code,
        last_name="Alumno",
        email=f"{code.lower()}@example.test",
        status="active",
        is_active=True,
    )
    db.add(student)
    db.flush()
    workspace = TrainingWorkspace(
        student_id=student.id,
        workspace_code=f"WS-{code}",
        status="active",
        seed_version="2026.1",
        reset_generation=0,
    )
    db.add(workspace)
    db.commit()
    principal = AuthPrincipal(
        user_id=100 + student.id,
        email=student.email,
        role="student",
        student_id=student.id,
        student_name=student.full_name,
        workspace_id=workspace.id,
        workspace_code=workspace.workspace_code,
        session_id=200 + student.id,
    )
    return workspace, principal


def test_tutorial_progress_is_persisted_per_student_workspace(db):
    workspace_a, principal_a = _student_workspace(db, "TA44")
    workspace_b, principal_b = _student_workspace(db, "TB44")

    initial_a = get_tutorial_state(db=db, principal=principal_a)
    initial_b = get_tutorial_state(db=db, principal=principal_b)
    assert initial_a.initialized is False
    assert initial_b.initialized is False
    assert initial_a.phase == "onboarding"
    assert initial_b.phase == "onboarding"

    saved_a = update_tutorial_state(
        TutorialState(
            phase="familiarization",
            slideIndex=3,
            familiarizationIndex=2,
            completed=False,
            dismissed=True,
        ),
        db=db,
        principal=principal_a,
    )
    assert saved_a.initialized is True
    assert saved_a.workspace_id == workspace_a.id
    assert saved_a.familiarizationIndex == 2
    assert saved_a.dismissed is True

    reloaded_a = get_tutorial_state(db=db, principal=principal_a)
    untouched_b = get_tutorial_state(db=db, principal=principal_b)
    assert reloaded_a.phase == "familiarization"
    assert reloaded_a.familiarizationIndex == 2
    assert reloaded_a.dismissed is True
    assert untouched_b.workspace_id == workspace_b.id
    assert untouched_b.initialized is False
    assert untouched_b.familiarizationIndex == 0

    db.refresh(workspace_a)
    persisted_payload = json.loads(workspace_a.tutorial_state)
    assert persisted_payload["phase"] == "familiarization"
    assert persisted_payload["familiarizationIndex"] == 2


def test_completed_tutorial_state_survives_a_new_read_session(db):
    workspace, principal = _student_workspace(db, "TC44")
    update_tutorial_state(
        TutorialState(
            phase="hidden",
            slideIndex=3,
            familiarizationIndex=3,
            completed=True,
            dismissed=False,
        ),
        db=db,
        principal=principal,
    )

    db.expire_all()
    restored = get_tutorial_state(db=db, principal=principal)
    assert restored.workspace_id == workspace.id
    assert restored.initialized is True
    assert restored.phase == "hidden"
    assert restored.completed is True
    assert restored.familiarizationIndex == 3
