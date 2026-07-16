from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.services.environment_reset_service import clear_company_workspace

router = APIRouter(tags=["environment"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/demo/clear")
def clear_demo_workspace(db: Session = Depends(get_db)):
    result = clear_company_workspace(db)
    return {
        "ok": True,
        "message": (
            f"Entorno vaciado correctamente. Se eliminaron "
            f"{result['companies_deleted']} empresa(s) y todos sus datos dependientes."
        ),
        **result,
    }
