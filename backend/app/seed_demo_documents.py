from datetime import date

from app.db import SessionLocal
from app.models import Company, Document, Employee


DEMO_COMPANY_CIF = "G14999999"


def update_fields(instance, **fields):
    for field, value in fields.items():
        setattr(instance, field, value)
    return instance


def get_or_create_document(db, employee, document_type, **fields):
    document = (
        db.query(Document)
        .filter(
            Document.employee_id == employee.id,
            Document.document_type == document_type,
        )
        .first()
    )

    base_fields = {
        "employee_id": employee.id,
        "company_id": employee.company_id,
        "center_id": employee.center_id,
        "document_type": document_type,
        **fields,
    }

    if document:
        return update_fields(document, **base_fields)

    document = Document(**base_fields)
    db.add(document)
    db.flush()
    return document


def seed_demo_documents():
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.cif == DEMO_COMPANY_CIF).first()
        if not company:
            return

        employees = {
            employee.dni: employee
            for employee in db.query(Employee).filter(Employee.company_id == company.id).all()
        }

        laura = employees.get("10000001A")
        javier = employees.get("10000002B")
        carmen = employees.get("10000003C")
        ana = employees.get("10000005E")

        if laura:
            get_or_create_document(db, laura, "DNI_NIE", document_name="DNI / NIE", status="received", issue_date=date(2024, 9, 1), expiry_date=date(2030, 9, 1), notes="Documento identificativo revisado.")
            get_or_create_document(db, laura, "SIGNED_CONTRACT", document_name="Contrato firmado", status="received", issue_date=date(2025, 9, 1), expiry_date=None, notes="Contrato indefinido firmado.")
            get_or_create_document(db, laura, "MODEL_145", document_name="Modelo 145", status="pending", issue_date=None, expiry_date=None, notes="Pendiente de entrega para regularizar datos fiscales.")
            get_or_create_document(db, laura, "SEXUAL_OFFENCES_CERTIFICATE", document_name="Certificado delitos sexuales", status="expired", issue_date=date(2024, 1, 10), expiry_date=date(2025, 1, 10), notes="Caducado. Solicitar certificado actualizado.")

        if javier:
            get_or_create_document(db, javier, "DNI_NIE", document_name="DNI / NIE", status="received", issue_date=date(2026, 1, 8), expiry_date=date(2031, 1, 8), notes="Documento identificativo revisado.")
            get_or_create_document(db, javier, "SIGNED_CONTRACT", document_name="Contrato firmado", status="received", issue_date=date(2026, 1, 8), expiry_date=None, notes="Contrato temporal firmado.")
            get_or_create_document(db, javier, "CONFIDENTIALITY_COMMITMENT", document_name="Compromiso confidencialidad", status="pending", issue_date=None, expiry_date=None, notes="Pendiente de firma.")
            get_or_create_document(db, javier, "DATA_CONSENT", document_name="Consentimiento datos", status="pending", issue_date=None, expiry_date=None, notes="Pendiente de entrega.")

        if carmen:
            get_or_create_document(db, carmen, "DNI_NIE", document_name="DNI / NIE", status="received", issue_date=date(2023, 9, 1), expiry_date=date(2030, 9, 1), notes="Documento identificativo revisado.")
            get_or_create_document(db, carmen, "NAF", document_name="NAF", status="received", issue_date=date(2023, 9, 1), expiry_date=None, notes="Número de afiliación informado.")
            get_or_create_document(db, carmen, "DEGREE_CERTIFICATE", document_name="Titulación", status="received", issue_date=date(2023, 9, 1), expiry_date=None, notes="Titulación revisada.")

        if ana:
            get_or_create_document(db, ana, "DNI_NIE", document_name="DNI / NIE", status="received", issue_date=date(2026, 3, 10), expiry_date=date(2031, 3, 10), notes="Documento identificativo revisado.")
            get_or_create_document(db, ana, "MODEL_145", document_name="Modelo 145", status="received", issue_date=date(2026, 3, 10), expiry_date=None, notes="Modelo fiscal informado.")
            get_or_create_document(db, ana, "DEGREE_CERTIFICATE", document_name="Titulación", status="not_applicable", issue_date=None, expiry_date=None, notes="No aplica para este caso práctico.")

        db.commit()
        print("Documentos demo AulaNomina insertados/actualizados correctamente.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_documents()
