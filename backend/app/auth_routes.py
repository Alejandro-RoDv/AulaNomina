from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth_dependencies import auth_required, get_current_principal, get_db
from app.models.student import Student
from app.models.user import User
from app.schemas.auth import AuthUserResponse, LoginRequest, LoginResponse, MeResponse
from app.services.auth_service import (
    AuthPrincipal,
    authenticate_user,
    create_user_session,
    hash_password,
    revoke_session,
)


router = APIRouter(prefix="/auth", tags=["auth"])


class DevStudentBootstrapRequest(BaseModel):
    password: str


def _student_name(student: Student | None) -> str | None:
    return student.full_name if student else None


def _dev_auth_enabled() -> bool:
    return os.getenv("AULANOMINA_ENABLE_DEV_AUTH", "false").strip().lower() in {
        "1", "true", "yes", "on"
    }


@router.get("/config")
def auth_config():
    return {
        "required": auth_required(),
        "dev_bootstrap_enabled": _dev_auth_enabled(),
    }


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")

    token, session, student = create_user_session(db, user)
    if user.role == "student" and student is None:
        revoke_session(db, session.id)
        raise HTTPException(
            status_code=403,
            detail="La cuenta de alumno no está vinculada a un perfil formativo",
        )

    return LoginResponse(
        access_token=token,
        user=AuthUserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            student_id=student.id if student else None,
            student_name=_student_name(student),
            expires_at=session.expires_at,
        ),
    )


@router.get("/me", response_model=MeResponse)
def me(principal: AuthPrincipal = Depends(get_current_principal)):
    return MeResponse(
        id=principal.user_id,
        email=principal.email,
        role=principal.role,
        student_id=principal.student_id,
        student_name=principal.student_name,
    )


@router.post("/logout")
def logout(
    principal: AuthPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    revoke_session(db, principal.session_id)
    return {"ok": True}


@router.post("/dev/bootstrap-students")
def bootstrap_student_accounts(
    payload: DevStudentBootstrapRequest,
    db: Session = Depends(get_db),
):
    """Create local demo accounts only when explicitly enabled by environment."""
    if not _dev_auth_enabled():
        raise HTTPException(status_code=404, detail="Endpoint no disponible")
    if len(payload.password or "") < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")

    created = 0
    linked = 0
    for student in db.query(Student).filter(Student.is_active.is_(True)).order_by(Student.id.asc()).all():
        if not student.email:
            continue
        user = db.query(User).filter(User.email == student.email.strip().lower()).first()
        if not user:
            user = User(
                email=student.email.strip().lower(),
                password_hash=hash_password(payload.password),
                role="student",
                is_active=True,
            )
            db.add(user)
            db.flush()
            created += 1
        if student.user_id != user.id:
            student.user_id = user.id
            linked += 1
    db.commit()
    return {"ok": True, "created_users": created, "linked_students": linked}
