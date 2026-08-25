from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import hashlib
import hmac
import secrets
from typing import Optional

from sqlalchemy.orm import Session

from app.models.student import Student
from app.models.training_workspace import TrainingWorkspace
from app.models.user import User
from app.models.user_session import UserSession


PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 210_000
SESSION_HOURS = 12
WORKSPACE_SEED_VERSION = "2026.1"


@dataclass(frozen=True)
class AuthPrincipal:
    user_id: int
    email: str
    role: str
    student_id: Optional[int]
    student_name: Optional[str]
    workspace_id: Optional[int]
    workspace_code: Optional[str]
    session_id: int

    @property
    def is_staff(self) -> bool:
        return self.role in {"teacher", "admin", "administrator"}


def hash_password(password: str) -> str:
    if len(password or "") < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("ascii"),
        PASSWORD_ITERATIONS,
    ).hex()
    return f"{PASSWORD_SCHEME}${PASSWORD_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, iterations_text, salt, expected = stored_hash.split("$", 3)
        if scheme != PASSWORD_SCHEME:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("ascii"),
            int(iterations_text),
        ).hex()
        return hmac.compare_digest(digest, expected)
    except (AttributeError, TypeError, ValueError):
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _student_for_user(db: Session, user: User) -> Student | None:
    student = db.query(Student).filter(Student.user_id == user.id).first()
    if student:
        return student

    # Compatibilidad con alumnos creados antes del Split 44. El primer login
    # enlaza de forma determinista perfiles con el mismo correo.
    if user.role == "student" and user.email:
        student = (
            db.query(Student)
            .filter(Student.email == user.email, Student.user_id.is_(None))
            .first()
        )
        if student:
            student.user_id = user.id
            db.commit()
            db.refresh(student)
    return student


def ensure_student_workspace(db: Session, student: Student | None) -> TrainingWorkspace | None:
    if student is None:
        return None
    workspace = (
        db.query(TrainingWorkspace)
        .filter(TrainingWorkspace.student_id == student.id)
        .first()
    )
    if workspace:
        return workspace

    workspace = TrainingWorkspace(
        student_id=student.id,
        workspace_code=f"WS-{student.id:06d}",
        status="active",
        seed_version=WORKSPACE_SEED_VERSION,
        reset_generation=0,
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return workspace


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email.strip().lower()).first()
    if not user or not user.is_active:
        return None
    return user if verify_password(password, user.password_hash) else None


def create_user_session(db: Session, user: User) -> tuple[str, UserSession, Student | None]:
    raw_token = secrets.token_urlsafe(48)
    now = datetime.utcnow()
    session = UserSession(
        user_id=user.id,
        token_hash=_token_hash(raw_token),
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(hours=SESSION_HOURS),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    student = _student_for_user(db, user)
    ensure_student_workspace(db, student)
    return raw_token, session, student


def resolve_principal(db: Session, raw_token: str) -> AuthPrincipal | None:
    now = datetime.utcnow()
    session = (
        db.query(UserSession)
        .filter(
            UserSession.token_hash == _token_hash(raw_token),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
        .first()
    )
    if not session or not session.user or not session.user.is_active:
        return None

    student = _student_for_user(db, session.user)
    workspace = ensure_student_workspace(db, student)
    session.last_seen_at = now
    db.commit()
    return AuthPrincipal(
        user_id=session.user.id,
        email=session.user.email,
        role=session.user.role,
        student_id=student.id if student else None,
        student_name=student.full_name if student else None,
        workspace_id=workspace.id if workspace else None,
        workspace_code=workspace.workspace_code if workspace else None,
        session_id=session.id,
    )


def revoke_session(db: Session, session_id: int) -> None:
    session = db.query(UserSession).filter(UserSession.id == session_id).first()
    if not session or session.revoked_at is not None:
        return
    session.revoked_at = datetime.utcnow()
    db.commit()
