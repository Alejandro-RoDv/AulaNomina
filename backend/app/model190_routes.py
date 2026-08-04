from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.model190 import (
    Model190DeclarationCreate,
    Model190PresentationRequest,
)
from app.services.model190_calculator import Model190DomainError, build_model190_preview
from app.services.model190_declaration_service import (
    generate_model190_declaration,
    get_model190_declaration,
    get_model190_file,
    list_model190_declarations,
)
from app.services.model190_presentation_service import (
    build_model190_error_report,
    present_model190_declaration,
    validate_model190_import,
)
from app.services.model190_receipt_service import render_model190_receipt
from app.services.model190_reconciliation import build_model190_reconciliation
from app.services.model190_validation import build_model190_validations


router = APIRouter(prefix="/model-190", tags=["model-190"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def domain_guard(callback, *args, **kwargs):
    try:
        return callback(*args, **kwargs)
    except Model190DomainError as exc:
        detail = {"code": exc.code, "message": exc.message}
        if exc.context:
            detail["context"] = exc.context
        raise HTTPException(status_code=exc.status_code, detail=detail) from exc


@router.get("/preview")
def get_preview(
    company_id: int = Query(...),
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    return domain_guard(build_model190_preview, db, company_id, year)


@router.get("/reconciliation")
def get_reconciliation(
    company_id: int = Query(...),
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    return domain_guard(build_model190_reconciliation, db, company_id, year)


@router.get("/validations")
def get_validations(
    company_id: int = Query(...),
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    preview = domain_guard(build_model190_preview, db, company_id, year)
    reconciliation = domain_guard(build_model190_reconciliation, db, company_id, year)
    return build_model190_validations(db, preview, reconciliation)


@router.get("/declarations")
def get_declarations(
    company_id: int | None = Query(default=None),
    year: int | None = Query(default=None, ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    return list_model190_declarations(db, company_id=company_id, year=year)


@router.post("/declarations", status_code=201)
def post_declaration(
    payload: Model190DeclarationCreate,
    db: Session = Depends(get_db),
):
    return domain_guard(generate_model190_declaration, db, payload)


@router.get("/declarations/{declaration_id}")
def get_declaration(declaration_id: int, db: Session = Depends(get_db)):
    return domain_guard(get_model190_declaration, db, declaration_id)


@router.get("/declarations/{declaration_id}/file")
def download_declaration_file(
    declaration_id: int,
    format: str = Query(default="fixed_width", pattern="^(readable|fixed_width)$"),
    db: Session = Depends(get_db),
):
    file_data = domain_guard(get_model190_file, db, declaration_id, format)
    return Response(
        content=file_data["content"],
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{file_data["filename"]}"',
            "X-AulaNomina-Simulation": "educational-not-presentable",
            "X-AulaNomina-File-SHA256": file_data["sha256"],
        },
    )


@router.get("/declarations/{declaration_id}/import-validation")
def get_import_validation(
    declaration_id: int,
    db: Session = Depends(get_db),
):
    return domain_guard(validate_model190_import, db, declaration_id)


@router.get("/declarations/{declaration_id}/errors")
def download_import_errors(
    declaration_id: int,
    db: Session = Depends(get_db),
):
    report = domain_guard(build_model190_error_report, db, declaration_id)
    return Response(
        content=report["content"],
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{report["filename"]}"',
            "X-AulaNomina-Simulation": "educational-error-report",
            "X-AulaNomina-File-SHA256": report["sha256"],
        },
    )


@router.post("/declarations/{declaration_id}/present")
def present_declaration(
    declaration_id: int,
    payload: Model190PresentationRequest,
    db: Session = Depends(get_db),
):
    return domain_guard(present_model190_declaration, db, declaration_id, payload)


@router.get(
    "/declarations/{declaration_id}/receipt",
    response_class=HTMLResponse,
)
def get_declaration_receipt(
    declaration_id: int,
    db: Session = Depends(get_db),
):
    content = domain_guard(render_model190_receipt, db, declaration_id)
    return HTMLResponse(
        content=content,
        headers={
            "Content-Disposition": f'inline; filename="modelo-190-{declaration_id}-justificante.html"',
            "X-AulaNomina-Simulation": "educational-receipt",
        },
    )
