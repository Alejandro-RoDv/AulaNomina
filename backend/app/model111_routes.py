from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.model111 import (
    Model111GenerateRequest,
    Model111PresentationRequest,
    ProfessionalCreate,
    ProfessionalInvoiceCreate,
    ProfessionalInvoiceUpdate,
    ProfessionalUpdate,
    TaxWithholdingAdjustmentCreate,
)
from app.services.model111_service import (
    Model111DomainError,
    build_model111_preview,
    create_adjustment,
    create_professional,
    create_professional_invoice,
    generate_model111_declaration,
    get_model111_declaration,
    list_adjustments,
    list_model111_declarations,
    list_professional_invoices,
    list_professionals,
    present_model111_declaration,
    update_professional,
    update_professional_invoice,
)


router = APIRouter(prefix="/model-111", tags=["model-111"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def domain_guard(callback, *args, **kwargs):
    from fastapi import HTTPException

    try:
        return callback(*args, **kwargs)
    except Model111DomainError as exc:
        detail = {"code": exc.code, "message": exc.message}
        if exc.context:
            detail["context"] = exc.context
        raise HTTPException(status_code=exc.status_code, detail=detail) from exc


@router.get("/professionals")
def get_professionals(
    company_id: int | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return list_professionals(db, company_id=company_id, include_inactive=include_inactive)


@router.post("/professionals", status_code=201)
def post_professional(payload: ProfessionalCreate, db: Session = Depends(get_db)):
    return domain_guard(create_professional, db, payload)


@router.put("/professionals/{professional_id}")
def put_professional(professional_id: int, payload: ProfessionalUpdate, db: Session = Depends(get_db)):
    return domain_guard(update_professional, db, professional_id, payload)


@router.get("/invoices")
def get_invoices(
    company_id: int | None = Query(default=None),
    year: int | None = Query(default=None, ge=2000, le=2100),
    period: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return domain_guard(
        list_professional_invoices,
        db,
        company_id=company_id,
        year=year,
        period=period,
    )


@router.post("/invoices", status_code=201)
def post_invoice(payload: ProfessionalInvoiceCreate, db: Session = Depends(get_db)):
    return domain_guard(create_professional_invoice, db, payload)


@router.put("/invoices/{invoice_id}")
def put_invoice(invoice_id: int, payload: ProfessionalInvoiceUpdate, db: Session = Depends(get_db)):
    return domain_guard(update_professional_invoice, db, invoice_id, payload)


@router.get("/adjustments")
def get_adjustments(
    company_id: int | None = Query(default=None),
    year: int | None = Query(default=None, ge=2000, le=2100),
    period: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return domain_guard(list_adjustments, db, company_id=company_id, year=year, period=period)


@router.post("/adjustments", status_code=201)
def post_adjustment(payload: TaxWithholdingAdjustmentCreate, db: Session = Depends(get_db)):
    return domain_guard(create_adjustment, db, payload)


@router.get("/preview")
def get_preview(
    company_id: int = Query(...),
    year: int = Query(..., ge=2000, le=2100),
    period: str = Query(...),
    db: Session = Depends(get_db),
):
    return domain_guard(build_model111_preview, db, company_id, year, period.upper())


@router.get("/declarations")
def get_declarations(
    company_id: int | None = Query(default=None),
    year: int | None = Query(default=None, ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    return list_model111_declarations(db, company_id=company_id, year=year)


@router.post("/declarations", status_code=201)
def post_declaration(payload: Model111GenerateRequest, db: Session = Depends(get_db)):
    return domain_guard(generate_model111_declaration, db, payload)


@router.get("/declarations/{declaration_id}")
def get_declaration(declaration_id: int, db: Session = Depends(get_db)):
    return domain_guard(get_model111_declaration, db, declaration_id)


@router.post("/declarations/{declaration_id}/present")
def present_declaration(
    declaration_id: int,
    payload: Model111PresentationRequest,
    db: Session = Depends(get_db),
):
    return domain_guard(present_model111_declaration, db, declaration_id, payload)
