from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.document import Document
from app.models.employee import Employee
from app.models.work_center import WorkCenter
from app.schemas.document import DocumentCreate, DocumentUpdate


def _validate_dates(issue_date, expiry_date):
    if issue_date and expiry_date and expiry_date < issue_date:
        raise HTTPException(status_code=400, detail="expiry_date no puede ser menor que issue_date")


def create_document(db: Session, document: DocumentCreate):
    employee = db.query(Employee).filter(Employee.id == document.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    company_id = document.company_id or employee.company_id
    center_id = document.center_id if document.center_id is not None else employee.center_id

    if company_id is None:
        raise HTTPException(status_code=400, detail="No se puede crear el documento sin empresa vinculada")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if employee.company_id and employee.company_id != company_id:
        raise HTTPException(status_code=400, detail="La empresa no coincide con la del trabajador")

    if center_id is not None:
        center = db.query(WorkCenter).filter(WorkCenter.id == center_id).first()
        if not center:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if center.company_id != company_id:
            raise HTTPException(status_code=400, detail="El centro no pertenece a la empresa indicada")

    _validate_dates(document.issue_date, document.expiry_date)

    document_data = document.model_dump()
    document_data["company_id"] = company_id
    document_data["center_id"] = center_id

    db_document = Document(**document_data)
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return get_document(db, db_document.id)


def get_documents(db: Session):
    return db.query(Document).options(
        joinedload(Document.employee),
        joinedload(Document.company),
        joinedload(Document.work_center),
    ).all()


def get_document(db: Session, document_id: int):
    return db.query(Document).options(
        joinedload(Document.employee),
        joinedload(Document.company),
        joinedload(Document.work_center),
    ).filter(Document.id == document_id).first()


def get_documents_by_employee(db: Session, employee_id: int):
    return db.query(Document).options(
        joinedload(Document.employee),
        joinedload(Document.company),
        joinedload(Document.work_center),
    ).filter(Document.employee_id == employee_id).all()


def update_document(db: Session, document_id: int, data: DocumentUpdate):
    db_document = db.query(Document).filter(Document.id == document_id).first()
    if not db_document:
        return None

    update_data = data.model_dump(exclude_unset=True)

    new_issue_date = update_data.get("issue_date", db_document.issue_date)
    new_expiry_date = update_data.get("expiry_date", db_document.expiry_date)
    _validate_dates(new_issue_date, new_expiry_date)

    if "center_id" in update_data and update_data["center_id"] is not None:
        center = db.query(WorkCenter).filter(WorkCenter.id == update_data["center_id"]).first()
        if not center:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if center.company_id != db_document.company_id:
            raise HTTPException(status_code=400, detail="El centro no pertenece a la empresa del documento")

    for key, value in update_data.items():
        setattr(db_document, key, value)

    db.commit()
    db.refresh(db_document)
    return get_document(db, document_id)


def mark_document_not_applicable(db: Session, document_id: int):
    db_document = db.query(Document).filter(Document.id == document_id).first()
    if not db_document:
        return None

    db_document.status = "not_applicable"
    db.commit()
    db.refresh(db_document)
    return get_document(db, document_id)


def delete_document(db: Session, document_id: int):
    """Compatibilidad con el endpoint DELETE.

    En el MVP no eliminamos físicamente el documento: lo marcamos como no aplicable
    para conservar trazabilidad docente y evitar pérdida accidental de datos demo.
    """
    return mark_document_not_applicable(db, document_id)
