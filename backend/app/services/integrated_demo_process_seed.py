from __future__ import annotations

from datetime import date, datetime
import unicodedata

from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.employee import Employee
from app.models.fie import FieCommunication, FieProcessingEvent


INTEGRATED_FIE_MESSAGE_ID = "FIE-LAB-2026-001"
INTEGRATED_FIE_PROCESS_REFERENCE = "IT-2026-JRS-0506"


def _normalize(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _employee_name(employee: Employee) -> str:
    return " ".join(
        part for part in [employee.first_name, employee.last_name, employee.second_last_name] if part
    )


def _find_employee(db: Session, expected_name: str) -> Employee | None:
    expected = _normalize(expected_name)
    return next(
        (
            employee
            for employee in db.query(Employee).all()
            if _normalize(_employee_name(employee)) == expected
        ),
        None,
    )


def ensure_integrated_fie_communication(db: Session) -> FieCommunication | None:
    employee = _find_employee(db, "Javier Romero Sánchez")
    if employee is None or employee.company_id is None:
        return None

    communication = (
        db.query(FieCommunication)
        .filter(FieCommunication.external_message_id == INTEGRATED_FIE_MESSAGE_ID)
        .first()
    )
    contract = (
        db.query(Contract)
        .filter(
            Contract.employee_id == employee.id,
            Contract.start_date <= date(2026, 5, 6),
        )
        .order_by(Contract.start_date.desc(), Contract.id.desc())
        .first()
    )
    values = {
        "company_id": employee.company_id,
        "employee_id": employee.id,
        "contract_id": contract.id if contract else None,
        "incident_id": None,
        "ccc_id": contract.company.ccc if contract and contract.company else None,
        "naf": employee.naf,
        "external_worker_name": _employee_name(employee),
        "external_nif": employee.dni,
        "process_reference": INTEGRATED_FIE_PROCESS_REFERENCE,
        "previous_process_reference": None,
        "communication_type": "SICK_LEAVE",
        "contingency_type": "COMMON_DISEASE",
        "event_date": date(2026, 5, 6),
        "sick_leave_date": date(2026, 5, 6),
        "confirmation_date": None,
        "medical_discharge_date": None,
        "relapse_date": None,
        "estimated_duration": 8,
        "source": "SIMULATION",
        "priority": "URGENT",
        "received_at": datetime(2026, 5, 6, 8, 45),
        "read_at": None,
        "status": "RECEIVED",
        "reconciliation_result": {},
        "payroll_impact": "PENDING_RECALCULATION",
        "raw_content": {
            "format": "AULANOMINA_FIE_V1",
            "simulation": True,
            "scenario_code": "LAB-2026-001",
            "worker": {
                "employee_id": employee.id,
                "name": _employee_name(employee),
                "nif": employee.dni,
                "naf": employee.naf,
            },
            "process": {
                "reference": INTEGRATED_FIE_PROCESS_REFERENCE,
                "communication_type": "SICK_LEAVE",
                "contingency": "COMMON_DISEASE",
                "event_date": "2026-05-06",
                "sick_leave_date": "2026-05-06",
                "estimated_duration": 8,
            },
        },
        "notes": "Comunicación asociada al caso integral LAB-2026-001.",
        "created_by": "Demo comercial AulaNomina",
    }

    if communication is None:
        communication = FieCommunication(
            external_message_id=INTEGRATED_FIE_MESSAGE_ID,
            **values,
        )
        db.add(communication)
        db.flush()
        db.add(
            FieProcessingEvent(
                communication_id=communication.id,
                event_type="RECEIVED",
                actor="INSS simulado",
                detail="Comunicación FIE recibida para el caso integral LAB-2026-001.",
                payload={"scenario_code": "LAB-2026-001"},
                created_at=datetime(2026, 5, 6, 8, 45),
            )
        )
    elif communication.status == "RECEIVED" and communication.read_at is None:
        for field, value in values.items():
            setattr(communication, field, value)

    db.commit()
    db.refresh(communication)
    return communication
