"""Casos ejecutables A51-A54 · Gestión documental y comunicaciones."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.company import Company
from app.models.contract import Contract
from app.models.document import Document
from app.models.employee import Employee
from app.models.mail import EmailAttachment, EmailMessage, EmailThread, Mailbox
from app.models.student import Student
from app.models.work_center import WorkCenter
from app.schemas.case_study import CaseStudyCreate, CaseTaskCreate
from app.services.case_scenario_service import ensure_assignment_progress


COURSE_CODE = "AN-GL-2026"
COURSE_VERSION = "2026.1-phase-a"
DEMO_COMPANY_CIF = "G14999999"
DEMO_CENTER_CODE = "1.1"
DEMO_MAILBOX_ADDRESS = "usuario.demo@aulanomina.local"
DEMO_MAILBOX_NAME = "Usuario demo"

DOCUMENT_SCENARIO_CODES = {
    "TRAIN-2026-DOC-A51",
    "TRAIN-2026-DOC-A52",
    "TRAIN-2026-DOC-A53",
    "TRAIN-2026-DOC-A54",
}

REQUIRED_ONBOARDING_DOCUMENTS = [
    "DNI_NIE",
    "NAF",
    "SIGNED_CONTRACT",
    "MODEL_145",
    "SEXUAL_OFFENCES_CERTIFICATE",
    "CONFIDENTIALITY_COMMITMENT",
    "DATA_CONSENT",
]

DOCUMENT_EMPLOYEES: dict[str, dict[str, Any]] = {
    "A51": {
        "employee_code": "E.51",
        "dni": "31000001L",
        "naf": "143100000001",
        "first_name": "Nuria",
        "last_name": "Beltrán Soto",
        "start_date": date(2026, 9, 1),
    },
    "A52": {
        "employee_code": "E.52",
        "dni": "31000002C",
        "naf": "143100000002",
        "first_name": "Pablo",
        "last_name": "Ortega Ruiz",
        "start_date": date(2026, 9, 1),
    },
    "A53": {
        "employee_code": "E.53",
        "dni": "31000003K",
        "naf": "143100000003",
        "first_name": "Eva",
        "last_name": "Martín Salas",
        "start_date": date(2026, 9, 1),
    },
    "A54": {
        "employee_code": "E.54",
        "dni": "31000004E",
        "naf": "143100000004",
        "first_name": "Irene",
        "last_name": "Vidal Mora",
        "start_date": date(2026, 7, 1),
    },
}


def _employee_name(data: dict[str, Any]) -> str:
    return f"{data['first_name']} {data['last_name']}"


def _task(
    *,
    training_code: str,
    title: str,
    description: str,
    expected_result: str,
    expected_action: str,
    order: int = 1,
    trigger_type: str = "system",
) -> CaseTaskCreate:
    return CaseTaskCreate(
        title=title,
        description=description,
        module="documents",
        expected_result=expected_result,
        expected_action=expected_action,
        trigger_type=trigger_type,
        trigger_condition={
            "course_code": COURSE_CODE,
            "course_version": COURSE_VERSION,
            "training_code": training_code,
            "validation_interaction": "explicit_review",
        },
        validation_rules=[],
        task_order=order,
        is_required=True,
        blocking=True,
        status="pending",
    )


def build_document_runtime_cases_2026() -> list[CaseStudyCreate]:
    a51 = DOCUMENT_EMPLOYEES["A51"]
    a52 = DOCUMENT_EMPLOYEES["A52"]
    a53 = DOCUMENT_EMPLOYEES["A53"]
    a54 = DOCUMENT_EMPLOYEES["A54"]
    return [
        CaseStudyCreate(
            scenario_code="TRAIN-2026-DOC-A51",
            title="Checklist documental de incorporación",
            description="Práctica A51: completar el checklist documental mínimo de una persona ya contratada sin falsear documentos todavía no recibidos.",
            difficulty="basic",
            category="document",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A51"],
                "employee": _employee_name(a51),
                "company_name": "Fundación AulaNomina",
                "start_date": a51["start_date"].isoformat(),
                "document_data": {
                    "required_types": REQUIRED_ONBOARDING_DOCUMENTS,
                    "received_types": ["DNI_NIE", "NAF"],
                    "pending_types": [
                        "SIGNED_CONTRACT",
                        "MODEL_145",
                        "SEXUAL_OFFENCES_CERTIFICATE",
                        "CONFIDENTIALITY_COMMITMENT",
                        "DATA_CONSENT",
                    ],
                },
            },
            completion_message="El checklist de incorporación contiene todos los documentos mínimos y diferencia correctamente recibidos y pendientes.",
            tasks=[
                _task(
                    training_code="A51",
                    title="Completar el checklist de incorporación",
                    description="Abre Documentación, selecciona a Nuria Beltrán Soto y genera el checklist básico. DNI/NIE y NAF ya constan recibidos; los cinco documentos restantes deben quedar pendientes, no recibidos.",
                    expected_result="Siete documentos mínimos presentes: dos recibidos y cinco pendientes",
                    expected_action="review_onboarding_document_checklist",
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-DOC-A52",
            title="Resolución de estados documentales",
            description="Práctica A52: resolver un expediente con documentación recibida, pendiente, caducada y no aplicable manteniendo una justificación comprensible.",
            difficulty="intermediate",
            category="document",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A52"],
                "employee": _employee_name(a52),
                "company_name": "Fundación AulaNomina",
                "document_data": {
                    "expected_statuses": {
                        "DNI_NIE": "received",
                        "NAF": "received",
                        "SIGNED_CONTRACT": "received",
                        "MODEL_145": "received",
                        "SEXUAL_OFFENCES_CERTIFICATE": "expired",
                        "CONFIDENTIALITY_COMMITMENT": "received",
                        "DATA_CONSENT": "not_applicable",
                    },
                    "expired_type": "SEXUAL_OFFENCES_CERTIFICATE",
                    "expired_on": "2026-07-31",
                    "not_applicable_type": "DATA_CONSENT",
                    "not_applicable_note_keywords": ["no aplica", "no aplicable", "exceptuado"],
                },
            },
            completion_message="El expediente distingue correctamente documentación recibida, caducada y no aplicable, conservando la justificación del cierre.",
            tasks=[
                _task(
                    training_code="A52",
                    title="Resolver documentos pendientes y caducados",
                    description="Revisa el expediente de Pablo Ortega Ruiz. Deja el Modelo 145 y el compromiso de confidencialidad como recibidos, conserva el certificado de delitos sexuales como caducado y marca el consentimiento de datos como no aplicable justificándolo en observaciones.",
                    expected_result="Estados documentales coherentes, caducidad identificada y no aplicable justificado",
                    expected_action="review_document_status_resolution",
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-DOC-A53",
            title="Respuesta profesional basada en el expediente",
            description="Práctica A53: interpretar una solicitud recibida por correo, contrastarla con el expediente documental y responder sin inventar información.",
            difficulty="intermediate",
            category="document",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A53"],
                "employee": _employee_name(a53),
                "company_name": "Fundación AulaNomina",
                "document_data": {
                    "document_type": "SEXUAL_OFFENCES_CERTIFICATE",
                    "status": "expired",
                    "expiry_date": "2026-08-01",
                },
                "mail_data": {
                    "subject": "Vigencia del certificado de delitos sexuales · Eva Martín",
                    "required_concepts": ["certificado", "caduc", "actualiz"],
                    "forbidden_claims": ["está vigente", "esta vigente", "certificado recibido", "ya está recibido", "ya esta recibido"],
                },
            },
            completion_message="La respuesta identifica correctamente la caducidad y solicita una actualización sin afirmar hechos que no constan en el expediente.",
            tasks=[
                _task(
                    training_code="A53",
                    title="Responder a la solicitud documental",
                    description="Consulta el expediente de Eva Martín Salas y responde en el mismo hilo. Debes indicar que el certificado consta caducado y que es necesario solicitar o aportar uno actualizado. No afirmes que el nuevo certificado ya se ha recibido.",
                    expected_result="Respuesta enviada en el hilo, coherente con el expediente y sin datos inventados",
                    expected_action="review_document_mail_response",
                    trigger_type="mail_response",
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-DOC-A54",
            title="Reconstrucción de evidencia documental",
            description="Práctica A54: demostrar la trazabilidad de un proceso terminado relacionando el correo, su adjunto y el documento archivado en el ERP.",
            difficulty="intermediate",
            category="document",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A54"],
                "employee": _employee_name(a54),
                "company_name": "Fundación AulaNomina",
                "document_data": {
                    "document_type": "SEXUAL_OFFENCES_CERTIFICATE",
                    "status": "received",
                    "issue_date": "2026-08-10",
                    "expiry_date": "2027-08-10",
                },
                "evidence_data": {
                    "subject": "Certificado actualizado incorporado · Irene Vidal",
                    "attachment_filename": "Certificado_actualizado_Irene_Vidal.pdf",
                    "required_link": "mail_attachment_to_document",
                },
            },
            completion_message="El proceso puede reconstruirse desde el correo hasta el documento recibido mediante una evidencia vinculada de forma explícita.",
            tasks=[
                _task(
                    training_code="A54",
                    title="Vincular la evidencia al expediente",
                    description="Abre el correo del caso, revisa el certificado adjunto y vincúlalo al documento de tipo Certificado delitos sexuales que ya consta recibido en el expediente de Irene Vidal Mora.",
                    expected_result="Adjunto del correo vinculado al documento ERP correcto y trazabilidad del proceso verificable",
                    expected_action="review_process_document_evidence",
                )
            ],
        ),
    ]


def _task_values(task: CaseTaskCreate) -> dict[str, Any]:
    return task.model_dump()


def _reset_case_progress(case_study: CaseStudy) -> None:
    for assignment in case_study.assignments:
        assignment.progress_entries.clear()
        assignment.current_task_order = 1
        assignment.completion_percentage = 0
        assignment.started_at = None
        assignment.completed_at = None
        assignment.status = "assigned"


def seed_document_runtime_cases_2026(db: Session) -> None:
    for definition in build_document_runtime_cases_2026():
        case_study = db.query(CaseStudy).filter(CaseStudy.scenario_code == definition.scenario_code).first()
        if case_study is None:
            case_study = CaseStudy(**definition.model_dump(exclude={"tasks"}))
            db.add(case_study)
            db.flush()
            for task in definition.tasks:
                db.add(CaseTask(case_study_id=case_study.id, **_task_values(task)))
            db.commit()
            continue

        changed = False
        for field, value in definition.model_dump(exclude={"tasks"}).items():
            if getattr(case_study, field) != value:
                setattr(case_study, field, value)
                changed = True
        existing_by_order = {task.task_order: task for task in case_study.tasks}
        valid_orders = {task.task_order for task in definition.tasks}
        for task_definition in definition.tasks:
            values = _task_values(task_definition)
            existing = existing_by_order.get(task_definition.task_order)
            if existing is None:
                db.add(CaseTask(case_study_id=case_study.id, **values))
                changed = True
            else:
                for field, value in values.items():
                    if getattr(existing, field) != value:
                        setattr(existing, field, value)
                        changed = True
        for stale in list(case_study.tasks):
            if stale.task_order not in valid_orders:
                db.delete(stale)
                changed = True
        if changed:
            _reset_case_progress(case_study)
        db.commit()


def _upsert_employee(db: Session, company: Company, center: WorkCenter, data: dict[str, Any]) -> Employee:
    employee = db.query(Employee).filter(Employee.dni == data["dni"]).first()
    values = {
        "employee_code": data["employee_code"],
        "company_id": company.id,
        "center_id": center.id,
        "dni": data["dni"],
        "naf": data["naf"],
        "first_name": data["first_name"],
        "last_name": data["last_name"],
        "birth_date": date(1992, 4, 18),
        "nationality": "Española",
        "email": f"{data['employee_code'].lower().replace('.', '')}@aulanomina.demo",
        "is_active": True,
        "status": "active",
    }
    if employee is None:
        employee = Employee(**values)
        db.add(employee)
        db.flush()
    else:
        for key, value in values.items():
            setattr(employee, key, value)
    return employee


def _upsert_contract(db: Session, employee: Employee, company: Company, center: WorkCenter, data: dict[str, Any]) -> Contract:
    contract = db.query(Contract).filter(
        Contract.employee_id == employee.id,
        Contract.start_date == data["start_date"],
    ).first()
    values = {
        "employee_id": employee.id,
        "company_id": company.id,
        "center_id": center.id,
        "contract_type": "Indefinido",
        "contract_family": "indefinite",
        "contract_code": "100",
        "start_date": data["start_date"],
        "end_date": None,
        "termination_reason": None,
        "status": "active",
        "working_day_type": "full_time",
        "weekly_hours": 40,
        "full_time_weekly_hours": 40,
        "partiality_coefficient": 100,
        "salary_base": 1800,
        "gross_annual_salary": 25200,
        "pay_schedule": "not_prorated_14",
    }
    if contract is None:
        contract = Contract(**values)
        db.add(contract)
        db.flush()
    else:
        for key, value in values.items():
            setattr(contract, key, value)
    return contract


def _upsert_document(
    db: Session,
    employee: Employee,
    *,
    document_type: str,
    document_name: str,
    status: str,
    issue_date: date | None = None,
    expiry_date: date | None = None,
    notes: str | None = None,
) -> Document:
    document = db.query(Document).filter(
        Document.employee_id == employee.id,
        Document.document_type == document_type,
    ).first()
    values = {
        "employee_id": employee.id,
        "company_id": employee.company_id,
        "center_id": employee.center_id,
        "document_type": document_type,
        "document_name": document_name,
        "status": status,
        "issue_date": issue_date,
        "expiry_date": expiry_date,
        "notes": notes,
    }
    if document is None:
        document = Document(**values)
        db.add(document)
        db.flush()
    else:
        for key, value in values.items():
            setattr(document, key, value)
    return document


def _reset_employee_documents(db: Session, employee: Employee) -> None:
    db.query(Document).filter(Document.employee_id == employee.id).delete(synchronize_session=False)


def _seed_a51_documents(db: Session, employee: Employee) -> None:
    _reset_employee_documents(db, employee)
    _upsert_document(db, employee, document_type="DNI_NIE", document_name="DNI / NIE", status="received", issue_date=date(2026, 8, 20))
    _upsert_document(db, employee, document_type="NAF", document_name="NAF", status="received", issue_date=date(2026, 8, 20))


def _seed_a52_documents(db: Session, employee: Employee) -> None:
    _reset_employee_documents(db, employee)
    _upsert_document(db, employee, document_type="DNI_NIE", document_name="DNI / NIE", status="received")
    _upsert_document(db, employee, document_type="NAF", document_name="NAF", status="received")
    _upsert_document(db, employee, document_type="SIGNED_CONTRACT", document_name="Contrato firmado", status="received")
    _upsert_document(db, employee, document_type="MODEL_145", document_name="Modelo 145", status="pending", issue_date=date(2026, 8, 25))
    _upsert_document(
        db,
        employee,
        document_type="SEXUAL_OFFENCES_CERTIFICATE",
        document_name="Certificado delitos sexuales",
        status="expired",
        issue_date=date(2025, 8, 1),
        expiry_date=date(2026, 7, 31),
        notes="El documento aportado ha superado la fecha de vigencia del caso.",
    )
    _upsert_document(db, employee, document_type="CONFIDENTIALITY_COMMITMENT", document_name="Compromiso confidencialidad", status="pending", issue_date=date(2026, 8, 25))
    _upsert_document(db, employee, document_type="DATA_CONSENT", document_name="Consentimiento datos", status="pending")


def _seed_a53_documents(db: Session, employee: Employee) -> None:
    _reset_employee_documents(db, employee)
    _upsert_document(
        db,
        employee,
        document_type="SEXUAL_OFFENCES_CERTIFICATE",
        document_name="Certificado delitos sexuales",
        status="expired",
        issue_date=date(2025, 8, 1),
        expiry_date=date(2026, 8, 1),
        notes="Pendiente de solicitar certificado actualizado.",
    )


def _seed_a54_documents(db: Session, employee: Employee) -> Document:
    _reset_employee_documents(db, employee)
    return _upsert_document(
        db,
        employee,
        document_type="SEXUAL_OFFENCES_CERTIFICATE",
        document_name="Certificado delitos sexuales · renovación 2026",
        status="received",
        issue_date=date(2026, 8, 10),
        expiry_date=date(2027, 8, 10),
        notes="Documento recibido como cierre de la renovación solicitada por correo.",
    )


def _mailbox(db: Session) -> Mailbox:
    mailbox = db.query(Mailbox).filter(Mailbox.address == DEMO_MAILBOX_ADDRESS).first()
    if mailbox is None:
        mailbox = Mailbox(role="student", display_name=DEMO_MAILBOX_NAME, address=DEMO_MAILBOX_ADDRESS)
        db.add(mailbox)
        db.flush()
    return mailbox


def _replace_case_thread(
    db: Session,
    mailbox: Mailbox,
    assignment: CaseAssignment,
    employee: Employee,
    *,
    subject: str,
    preview: str,
    body: str,
    sent_at: datetime,
    attachment: tuple[str, str, str] | None = None,
) -> EmailThread:
    existing = db.query(EmailThread).filter(
        EmailThread.mailbox_id == mailbox.id,
        EmailThread.case_reference == assignment.case_study.scenario_code,
    ).all()
    for thread in existing:
        db.delete(thread)
    db.flush()

    task = sorted(assignment.case_study.tasks, key=lambda item: (item.task_order, item.id))[0]
    thread = EmailThread(
        mailbox_id=mailbox.id,
        company_id=employee.company_id,
        employee_id=employee.id,
        case_study_id=assignment.case_study_id,
        case_assignment_id=assignment.id,
        case_task_id=task.id,
        related_entity_type="document",
        subject=subject,
        preview=preview,
        folder="inbox",
        status="open",
        priority="normal",
        category="document",
        case_reference=assignment.case_study.scenario_code,
        is_read=False,
        expected_actions=[task.expected_result or task.title],
        context_actions=["documents"],
        created_at=sent_at,
        updated_at=sent_at,
    )
    db.add(thread)
    db.flush()
    message = EmailMessage(
        thread_id=thread.id,
        sender_name="Administración del centro",
        sender_address="administracion@centro-demo.es",
        recipient_name=mailbox.display_name,
        recipient_address=mailbox.address,
        body_text=body,
        sent_at=sent_at,
        direction="incoming",
        message_type="initial",
    )
    db.add(message)
    db.flush()
    if attachment:
        filename, content_type, content_text = attachment
        db.add(
            EmailAttachment(
                message_id=message.id,
                filename=filename,
                content_type=content_type,
                storage_reference=f"demo://mail/{assignment.case_study.scenario_code}/{filename}",
                document_type="SEXUAL_OFFENCES_CERTIFICATE",
                content_text=content_text,
                linked_document_id=None,
                size_bytes=len(content_text.encode("utf-8")),
            )
        )
    return thread


def seed_document_runtime_assignments_2026(db: Session) -> None:
    student = db.query(Student).order_by(Student.id.asc()).first()
    if student is None:
        return
    cases = (
        db.query(CaseStudy)
        .filter(CaseStudy.scenario_code.in_(sorted(DOCUMENT_SCENARIO_CODES)))
        .order_by(CaseStudy.id.asc())
        .all()
    )
    for case_study in cases:
        assignment = db.query(CaseAssignment).filter(
            CaseAssignment.case_study_id == case_study.id,
            CaseAssignment.student_id == student.id,
        ).first()
        if assignment is None:
            assignment = CaseAssignment(
                case_study_id=case_study.id,
                student_id=student.id,
                assigned_by="Profesor demo",
                status="assigned",
                notes="Práctica guiada de gestión documental y comunicaciones del Temario Maestro 2026.",
            )
            db.add(assignment)
            db.commit()
        else:
            assignment.status = "assigned"
            assignment.started_at = None
            assignment.completed_at = None
            assignment.current_task_order = 1
            assignment.completion_percentage = 0
            assignment.progress_entries.clear()
            db.commit()
        ensure_assignment_progress(db, assignment.id)


def prepare_document_training_data_2026(db: Session) -> dict[str, int] | None:
    company = db.query(Company).filter(Company.cif == DEMO_COMPANY_CIF).first()
    if company is None:
        return None
    center = db.query(WorkCenter).filter(
        WorkCenter.company_id == company.id,
        WorkCenter.center_code == DEMO_CENTER_CODE,
    ).first()
    if center is None:
        return None

    result: dict[str, int] = {}
    employees: dict[str, Employee] = {}
    for code, data in DOCUMENT_EMPLOYEES.items():
        employee = _upsert_employee(db, company, center, data)
        _upsert_contract(db, employee, company, center, data)
        employees[code] = employee
        result[f"{code}_employee_id"] = employee.id

    _seed_a51_documents(db, employees["A51"])
    _seed_a52_documents(db, employees["A52"])
    _seed_a53_documents(db, employees["A53"])
    a54_document = _seed_a54_documents(db, employees["A54"])
    result["A54_document_id"] = a54_document.id
    db.commit()

    mailbox = _mailbox(db)
    for code in ("A53", "A54"):
        case_study = db.query(CaseStudy).filter(CaseStudy.scenario_code == f"TRAIN-2026-DOC-{code}").first()
        if not case_study:
            continue
        assignment = db.query(CaseAssignment).filter(CaseAssignment.case_study_id == case_study.id).order_by(CaseAssignment.id.asc()).first()
        if not assignment:
            continue
        if code == "A53":
            thread = _replace_case_thread(
                db,
                mailbox,
                assignment,
                employees[code],
                subject="Vigencia del certificado de delitos sexuales · Eva Martín",
                preview="Necesitamos confirmar si el certificado actual sigue vigente antes de la incorporación.",
                body=(
                    "Buenos días:\n\nAntes de la incorporación de Eva Martín necesitamos confirmar si el certificado "
                    "de delitos sexuales que consta en su expediente sigue vigente. Si no lo está, indícanos qué "
                    "debemos solicitar para dejar el expediente correcto.\n\nGracias."
                ),
                sent_at=datetime(2026, 8, 28, 9, 15),
            )
        else:
            thread = _replace_case_thread(
                db,
                mailbox,
                assignment,
                employees[code],
                subject="Certificado actualizado incorporado · Irene Vidal",
                preview="Se remite el certificado actualizado para cerrar la renovación documental.",
                body=(
                    "Buenos días:\n\nAdjunto el certificado actualizado de Irene Vidal. El documento fue emitido el "
                    "10/08/2026 y debe quedar relacionado con el expediente para que pueda reconstruirse el cierre "
                    "de la renovación.\n\nUn saludo."
                ),
                sent_at=datetime(2026, 8, 12, 10, 30),
                attachment=(
                    "Certificado_actualizado_Irene_Vidal.pdf",
                    "application/pdf",
                    "CERTIFICADO NEGATIVO DE DELITOS DE NATURALEZA SEXUAL\n\nTitular: Irene Vidal Mora\nFecha de emisión: 10/08/2026\nVigencia del caso: hasta 10/08/2027\nDocumento simulado para práctica educativa.",
                ),
            )
        result[f"{code}_thread_id"] = thread.id
    db.commit()
    return result
