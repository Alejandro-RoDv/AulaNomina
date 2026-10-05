from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_dependencies import get_optional_principal
from app.db import SessionLocal
from app.services.auth_service import AuthPrincipal
from app.services.environment_reset_service import clear_company_workspace

router = APIRouter(tags=["environment"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/demo/clear")
def clear_demo_workspace(
    db: Session = Depends(get_db),
    principal: AuthPrincipal | None = Depends(get_optional_principal),
):
    if principal is not None and not principal.is_staff:
        raise HTTPException(
            status_code=403,
            detail="El reset global del entorno está reservado a docentes y administradores",
        )
    result = clear_company_workspace(db)
    return {
        "ok": True,
        "message": (
            f"Entorno vaciado correctamente. Se eliminaron "
            f"{result['companies_deleted']} empresa(s) y todos sus datos dependientes."
        ),
        **result,
    }
