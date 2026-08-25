from __future__ import annotations

import os
from collections.abc import Generator

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.services.auth_service import AuthPrincipal, resolve_principal
from app.services.workspace_context import bind_workspace, reset_workspace
import app.services.workspace_query_scope  # noqa: F401


bearer_scheme = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def auth_required() -> bool:
    return os.getenv("AULANOMINA_REQUIRE_AUTH", "false").strip().lower() in {"1", "true", "yes", "on"}


def get_optional_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Generator[AuthPrincipal | None, None, None]:
    principal: AuthPrincipal | None = None
    if credentials is None:
        if auth_required():
            raise HTTPException(status_code=401, detail="Autenticación requerida")
    else:
        if credentials.scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Esquema de autenticación no válido")
        principal = resolve_principal(db, credentials.credentials)
        if not principal:
            raise HTTPException(status_code=401, detail="Sesión no válida o caducada")

    workspace_id = None
    if principal is not None and not principal.is_staff:
        workspace_id = principal.workspace_id
    token = bind_workspace(workspace_id)
    try:
        yield principal
    finally:
        reset_workspace(token)


def get_current_principal(
    principal: AuthPrincipal | None = Depends(get_optional_principal),
) -> AuthPrincipal:
    if principal is None:
        raise HTTPException(status_code=401, detail="Autenticación requerida")
    return principal
