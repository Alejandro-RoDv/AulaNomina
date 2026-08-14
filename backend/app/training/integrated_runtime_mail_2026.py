"""Entradas de correo para los capstones C01, C03 y C06."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.employee import Employee
from app.models.mail import EmailAttachment, EmailMessage, EmailThread, Mailbox
from app.training.integrated_runtime_cases_2026 import INTEGRATED_SCENARIO_CODES


MAIL_CASES = {
    "C01": {
        "legacy_reference": None,
        "subject": "Nueva incorporación: Clara Benítez · 15/09/2026",
        "preview": "Dirección confirma la incorporación y remite la información necesaria para tramitar el expediente completo.",
        "priority": "high",
        "category": "contract",
        "sender_name": "Dirección · Colegio San Rafael",
        "sender_address": "direccion.sanrafael@aulanomina.demo",
        "sent_at": datetime(2026, 9, 10, 9, 20),
        "body": (
            "Buenos días:\n\nConfirmamos la incorporación de Clara Benítez Mora el 15 de septiembre como administrativa del Colegio San Rafael. "
            "La relación será indefinida y a jornada completa de 40 horas semanales.\n\n"
            "En los adjuntos tienes sus datos identificativos y el listado de documentación entregada. Necesitamos que el expediente, contrato, "
            "alta de Seguridad Social y documentación queden coordinados y que revises su primera nómina de septiembre.\n\n"
            "No cierres la incorporación si detectas incoherencias entre módulos."
        ),
        "context_actions": ["employees", "contracts", "affiliations", "documents", "payroll-history"],
        "attachments": [
            {
                "filename": "Datos_Clara_Benitez.txt",
                "content_type": "text/plain",
                "document_type": "employee_data",
                "content_text": (
                    "CLARA BENITEZ MORA\nDNI=31000001H\nNAF=143100000001\nNACIMIENTO=18/02/1997\n"
                    "NACIONALIDAD=Española\nEMAIL=clara.benitez@aulanomina.demo\nPUESTO=Administrativa\n"
                    "CENTRO=Colegio San Rafael\nINICIO=15/09/2026\nJORNADA=40 horas"
                ),
            },
            {
                "filename": "Documentacion_incorporacion_Clara.txt",
                "content_type": "text/plain",
                "document_type": "document_checklist",
                "content_text": (
                    "Documentación aportada para el ejercicio:\n- DNI/NIE\n- NAF\n- Contrato firmado\n- Modelo 145\n"
                    "- Certificado de delitos sexuales actualizado\n\nTodos los documentos deben quedar relacionados con el expediente."
                ),
            },
        ],
    },
    "C03": {
        "legacy_reference": "NOM-2026-014",
        "subject": "Reclamación de antigüedad: nómina de Ana Martín",
        "preview": "Ana solicita revisar por qué el complemento de antigüedad no aparece correctamente en julio.",
        "priority": "high",
        "category": "payroll",
        "sender_name": "María López · Administración",
        "sender_address": "administracion@empresa-demo.es",
        "sent_at": datetime(2026, 8, 5, 8, 12),
        "body": (
            "Buenos días:\n\nAna Martín reclama que su nómina de julio no refleja el complemento de antigüedad que, según su expediente, "
            "produce efectos desde el 1 de julio de 2026.\n\n"
            "Necesitamos que investigues el origen de la diferencia, corrijas lo que proceda y regularices la nómina. "
            "Cuando el resultado esté documentado, responde por este mismo hilo explicando el cierre de la reclamación."
        ),
        "context_actions": ["employee-record", "payroll-history", "regularizations"],
        "attachments": [],
    },
    "C06": {
        "legacy_reference": None,
        "subject": "Cierre laboral de Lucía Prieto · efectos 31/12/2026",
        "preview": "Dirección comunica una extinción objetiva y solicita coordinar baja, liquidación y cierre documental.",
        "priority": "urgent",
        "category": "contract",
        "sender_name": "Dirección general",
        "sender_address": "direccion@aulanomina.demo",
        "sent_at": datetime(2026, 12, 20, 10, 0),
        "body": (
            "Buenos días:\n\nSe ha comunicado a Lucía Prieto Solís la extinción objetiva de su contrato con efectos del 31 de diciembre. "
            "La referencia documental del expediente es CARTA-OBJ-A49-2026.\n\n"
            "Tramita el cese completo: revisa la indemnización, liquida conceptos pendientes, prepara la baja de afiliación y deja el expediente cerrado. "
            "Cuando contrato, baja y finiquito estén coordinados, confirma el cierre por este hilo."
        ),
        "context_actions": ["contracts", "affiliations", "payroll-history", "documents"],
        "attachments": [
            {
                "filename": "Comunicacion_extincion_Lucia_Prieto.pdf",
                "content_type": "application/pdf",
                "document_type": "termination_notice",
                "content_text": (
                    "COMUNICACIÓN DE EXTINCIÓN OBJETIVA · SIMULACIÓN DOCENTE\n\nTrabajadora: Lucía Prieto Solís\n"
                    "Fecha de efectos: 31/12/2026\nReferencia: CARTA-OBJ-A49-2026\n"
                    "La causa y los cálculos deberán quedar registrados en el expediente de AulaNomina."
                ),
            }
        ],
    },
}


def _employee_for_case(db: Session, code: str) -> Employee | None:
    if code == "C03":
        return db.query(Employee).filter(Employee.dni == "31000003D").first()
    if code == "C06":
        return db.query(Employee).filter(Employee.dni == "30000004T").first()
    return None


def _case_context(db: Session, code: str):
    scenario_code = INTEGRATED_SCENARIO_CODES[code]
    case_study = db.query(CaseStudy).filter(CaseStudy.scenario_code == scenario_code).first()
    if case_study is None:
        return None, None, None
    assignment = (
        db.query(CaseAssignment)
        .filter(CaseAssignment.case_study_id == case_study.id)
        .order_by(CaseAssignment.id.asc())
        .first()
    )
    first_task = (
        db.query(CaseTask)
        .filter(CaseTask.case_study_id == case_study.id)
        .order_by(CaseTask.task_order.asc(), CaseTask.id.asc())
        .first()
    )
    return case_study, assignment, first_task


def _upsert_thread(db: Session, mailbox: Mailbox, code: str) -> EmailThread | None:
    definition = MAIL_CASES[code]
    case_study, assignment, first_task = _case_context(db, code)
    if case_study is None:
        return None

    scenario_code = INTEGRATED_SCENARIO_CODES[code]
    references = [scenario_code]
    if definition.get("legacy_reference"):
        references.append(definition["legacy_reference"])
    thread = (
        db.query(EmailThread)
        .filter(EmailThread.mailbox_id == mailbox.id, EmailThread.case_reference.in_(references))
        .order_by(EmailThread.id.asc())
        .first()
    )
    employee = _employee_for_case(db, code)
    values = {
        "company_id": employee.company_id if employee else case_study.company_id,
        "employee_id": employee.id if employee else None,
        "case_study_id": case_study.id,
        "case_assignment_id": assignment.id if assignment else None,
        "case_task_id": first_task.id if first_task else None,
        "related_entity_type": "employee" if employee else "case_study",
        "related_entity_id": employee.id if employee else case_study.id,
        "subject": definition["subject"],
        "preview": definition["preview"],
        "folder": "inbox",
        "status": "open" if not assignment or assignment.status == "assigned" else "in_progress",
        "priority": definition["priority"],
        "category": definition["category"],
        "case_reference": scenario_code,
        "is_read": False,
        "expected_actions": [task.title for task in sorted(case_study.tasks, key=lambda item: item.task_order)],
        "context_actions": definition["context_actions"],
        "updated_at": definition["sent_at"],
    }
    if thread is None:
        thread = EmailThread(
            mailbox_id=mailbox.id,
            created_at=definition["sent_at"],
            **values,
        )
        db.add(thread)
        db.flush()
    else:
        for field, value in values.items():
            setattr(thread, field, value)

    initial = (
        db.query(EmailMessage)
        .filter(EmailMessage.thread_id == thread.id, EmailMessage.message_type == "initial")
        .order_by(EmailMessage.id.asc())
        .first()
    )
    if initial is None:
        initial = EmailMessage(
            thread_id=thread.id,
            sender_name=definition["sender_name"],
            sender_address=definition["sender_address"],
            recipient_name=mailbox.display_name,
            recipient_address=mailbox.address,
            body_text=definition["body"],
            sent_at=definition["sent_at"],
            direction="incoming",
            message_type="initial",
        )
        db.add(initial)
        db.flush()
    else:
        initial.sender_name = definition["sender_name"]
        initial.sender_address = definition["sender_address"]
        initial.recipient_name = mailbox.display_name
        initial.recipient_address = mailbox.address
        initial.body_text = definition["body"]
        initial.sent_at = definition["sent_at"]
        initial.direction = "incoming"

    existing = {attachment.filename: attachment for attachment in initial.attachments}
    for attachment_definition in definition["attachments"]:
        attachment = existing.get(attachment_definition["filename"])
        values = {
            **attachment_definition,
            "storage_reference": f"demo://mail/{scenario_code}/{attachment_definition['filename']}",
            "size_bytes": len(attachment_definition["content_text"].encode("utf-8")),
        }
        if attachment is None:
            db.add(EmailAttachment(message_id=initial.id, **values))
        else:
            for field, value in values.items():
                setattr(attachment, field, value)
    db.flush()
    return thread


def ensure_integrated_training_mail_2026(db: Session, mailbox: Mailbox) -> list[int]:
    thread_ids = []
    for code in ("C01", "C03", "C06"):
        thread = _upsert_thread(db, mailbox, code)
        if thread:
            thread_ids.append(thread.id)
    db.commit()
    return thread_ids
