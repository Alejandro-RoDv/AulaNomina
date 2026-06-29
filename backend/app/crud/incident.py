from datetime import date, datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.incident import Incident
from app.models.incident_detail import IncidentDetail
from app.models.payroll import Payroll
from app.models.work_center import WorkCenter
from app.schemas.incident import (
    INCIDENT_ACTION_ONLY_STATUSES,
    IncidentCreate,
    IncidentUpdate,
)
from app.services.incident_service import (
    BASE_FIELDS,
    DETAIL_FIELDS,
    find_incident_conflicts,
    incident_snapshot,
    payroll_change_flags,
    register_incident_audit,
    validate_incident_period,
    validate_or_authorize_conflicts,
)

ACTIVE_PAYROLL_STATUSES = {"draft", "pending", "calculated", "reviewed", "closed"}
GENERAL_STATUS_TRANSITIONS = {
    "draft": {"draft", "open"},
    "open": {"open", "pending", "validated"},
    "pending": {"pending", "open", "validated"},
    "validated": {"validated", "open", "pending"},
}


def iter_months_between(start_date: date, end_date: date | None):
    current = date(start_date.year, start_date.month, 1)
    effective_end = end_date or start_date
    final = date(effective_end.year, effective_end.month, 1)
    while current <= final:
        yield current.month, current.year
        current = date(current.year + 1, 1, 1) if current.month == 12 else date(current.year, current.month + 1, 1)


def get_impacted_payrolls_count(db: Session, incident: Incident) -> int:
    if not incident.affects_payroll:
        return 0
    periods = list(iter_months_between(incident.start_date, incident.end_date))
    if not periods:
        return 0
    query = db.query(Payroll).filter(
        Payroll.contract_id == incident.contract_id,
        Payroll.status.in_(ACTIVE_PAYROLL_STATUSES),
    )
    combined_filter = (Payroll.period_month == periods[0][0]) & (Payroll.period_year == periods[0][1])
    for month, year in periods[1:]:
        combined_filter = combined_filter | ((Payroll.period_month == month) & (Payroll.period_year == year))
    return query.filter(combined_filter).count()


def annotate_incident_payroll_impact(db: Session, incident: Incident | None):
    if not incident:
        return incident
    impacted_count = get_impacted_payrolls_count(db, incident)
    incident.impacted_payrolls_count = impacted_count
    incident.has_impacted_payrolls = impacted_count > 0
    incident.payroll_message = (
        "Esta incidencia afecta a una nómina ya generada. Debe recalcularse o regularizarse sin modificar silenciosamente la nómina cerrada."
        if impacted_count > 0
        else None
    )
    return incident


def _ensure_relations(db: Session, incident: IncidentCreate):
    employee = db.query(Employee).filter(Employee.id == incident.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    contract = db.query(Contract).filter(Contract.id == incident.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    if contract.employee_id != employee.id:
        raise HTTPException(status_code=400, detail="El contrato seleccionado no pertenece al trabajador")

    company_id = incident.company_id or contract.company_id or employee.company_id
    center_id = incident.center_id if incident.center_id is not None else contract.center_id or employee.center_id
    if company_id is None:
        raise HTTPException(status_code=400, detail="No se puede crear la incidencia sin empresa vinculada")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    if contract.company_id and contract.company_id != company_id:
        raise HTTPException(status_code=400, detail="La empresa no coincide con la del contrato")

    if center_id is not None:
        center = db.query(WorkCenter).filter(WorkCenter.id == center_id).first()
        if not center:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if center.company_id != company_id:
            raise HTTPException(status_code=400, detail="El centro no pertenece a la empresa indicada")

    return employee, contract, company_id, center_id


def _detail_payload(data: dict) -> dict:
    payload = {key: data.get(key) for key in DETAIL_FIELDS if key in data}
    payload["details"] = payload.get("details") or {}
    payload["payroll_effect"] = payload.get("payroll_effect") or "pending"
    payload["origin"] = payload.get("origin") or "manual"
    payload["created_by"] = data.get("created_by")
    payload["updated_by"] = data.get("updated_by") or data.get("created_by")
    return payload


def _same_nullable_decimal(current, requested) -> bool:
    if current is None or requested is None:
        return current is None and requested is None
    return Decimal(str(current)) == Decimal(str(requested))


def _sanitize_general_update(db_incident: Incident, update_data: dict) -> None:
    requested_status = update_data.pop("status", None)
    if requested_status is not None and requested_status != db_incident.status:
        if db_incident.status in INCIDENT_ACTION_ONLY_STATUSES or requested_status in INCIDENT_ACTION_ONLY_STATUSES:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Los estados processed, closed, regularized y cancelled solo pueden modificarse "
                    "mediante sus acciones controladas"
                ),
            )
        allowed = GENERAL_STATUS_TRANSITIONS.get(db_incident.status, {db_incident.status})
        if requested_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Transición de estado no permitida: {db_incident.status} -> {requested_status}",
            )
        update_data["status"] = requested_status

    if "processed_payroll_id" in update_data:
        requested_payroll_id = update_data.pop("processed_payroll_id")
        if requested_payroll_id != db_incident.processed_payroll_id:
            raise HTTPException(
                status_code=409,
                detail="La nómina procesada solo puede asignarse mediante la acción de procesamiento",
            )

    if "generated_amount" in update_data:
        requested_amount = update_data.pop("generated_amount")
        if not _same_nullable_decimal(db_incident.generated_amount, requested_amount):
            raise HTTPException(
                status_code=409,
                detail="El importe generado solo puede cambiar mediante procesamiento, recálculo o regularización",
            )


def create_incident(db: Session, incident: IncidentCreate):
    _, contract, company_id, center_id = _ensure_relations(db, incident)
    validate_incident_period(contract, incident.start_date, incident.end_date, incident.details)
    conflicts = find_incident_conflicts(
        db,
        employee_id=incident.employee_id,
        contract_id=incident.contract_id,
        incident_type=incident.incident_type,
        start_date=incident.start_date,
        end_date=incident.end_date,
    )
    validate_or_authorize_conflicts(conflicts, incident.overlap_override, incident.overlap_reason)

    data = incident.model_dump()
    base_data = {
        "employee_id": incident.employee_id,
        "contract_id": incident.contract_id,
        "company_id": company_id,
        "center_id": center_id,
        "incident_type": incident.incident_type,
        "start_date": incident.start_date,
        "end_date": incident.end_date,
        "description": incident.description,
        "status": incident.status,
    }
    db_incident = Incident(**base_data)
    db.add(db_incident)
    db.flush()
    db_incident.detail = IncidentDetail(incident_id=db_incident.id, **_detail_payload(data))
    db.flush()
    register_incident_audit(
        db,
        db_incident,
        action="created",
        actor=incident.created_by,
        reason=None,
        previous_values=None,
        new_values=incident_snapshot(db_incident),
    )
    db.commit()
    return get_incident(db, db_incident.id)


def get_incidents(db: Session):
    incidents = (
        db.query(Incident)
        .options(
            joinedload(Incident.employee),
            joinedload(Incident.contract),
            joinedload(Incident.company),
            joinedload(Incident.work_center),
            joinedload(Incident.detail),
            joinedload(Incident.audit_entries),
            joinedload(Incident.confirmations),
        )
        .order_by(Incident.start_date.desc(), Incident.id.desc())
        .all()
    )
    return [annotate_incident_payroll_impact(db, incident) for incident in incidents]


def get_incident(db: Session, incident_id: int):
    incident = (
        db.query(Incident)
        .options(
            joinedload(Incident.employee),
            joinedload(Incident.contract),
            joinedload(Incident.company),
            joinedload(Incident.work_center),
            joinedload(Incident.detail),
            joinedload(Incident.audit_entries),
            joinedload(Incident.confirmations),
        )
        .filter(Incident.id == incident_id)
        .first()
    )
    return annotate_incident_payroll_impact(db, incident)


def update_incident(db: Session, incident_id: int, data: IncidentUpdate):
    db_incident = get_incident(db, incident_id)
    if not db_incident:
        return None
    if not db_incident.detail:
        db_incident.detail = IncidentDetail(incident_id=db_incident.id)
        db.flush()

    update_data = data.model_dump(exclude_unset=True)
    expected_version = update_data.pop("expected_version", None)
    change_reason = update_data.pop("change_reason", None)
    if expected_version is not None and expected_version != db_incident.version:
        raise HTTPException(
            status_code=409,
            detail="La incidencia fue modificada por otro usuario. Recargue el registro antes de guardar.",
        )

    _sanitize_general_update(db_incident, update_data)

    new_start = update_data.get("start_date", db_incident.start_date)
    new_end = update_data.get("end_date", db_incident.end_date)
    new_type = update_data.get("incident_type", db_incident.incident_type)
    new_details = update_data.get("details", db_incident.details)
    validate_incident_period(db_incident.contract, new_start, new_end, new_details)

    overlap_override = update_data.get("overlap_override", db_incident.overlap_override)
    overlap_reason = update_data.get("overlap_reason", db_incident.overlap_reason)
    conflicts = find_incident_conflicts(
        db,
        employee_id=db_incident.employee_id,
        contract_id=db_incident.contract_id,
        incident_type=new_type,
        start_date=new_start,
        end_date=new_end,
        exclude_incident_id=db_incident.id,
    )
    validate_or_authorize_conflicts(conflicts, overlap_override, overlap_reason)

    if "center_id" in update_data and update_data["center_id"] is not None:
        center = db.query(WorkCenter).filter(WorkCenter.id == update_data["center_id"]).first()
        if not center:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if center.company_id != db_incident.company_id:
            raise HTTPException(status_code=400, detail="El centro no pertenece a la empresa de la incidencia")

    previous = incident_snapshot(db_incident)
    changed_business_data = any(key in update_data for key in BASE_FIELDS | DETAIL_FIELDS)
    for key, value in update_data.items():
        if key in BASE_FIELDS:
            setattr(db_incident, key, value)
        elif key in DETAIL_FIELDS:
            if key == "details" and value is not None:
                db_incident.detail.details = {**(db_incident.detail.details or {}), **value}
            else:
                setattr(db_incident.detail, key, value)

    requires_recalculation, requires_regularization = payroll_change_flags(db, db_incident)
    if changed_business_data and (db_incident.processed_payroll_id or requires_recalculation):
        db_incident.detail.requires_recalculation = True
        db_incident.detail.requires_regularization = requires_regularization

    db_incident.detail.version += 1
    db_incident.detail.updated_at = datetime.utcnow()
    db.flush()
    register_incident_audit(
        db,
        db_incident,
        action="updated",
        actor=data.updated_by,
        reason=change_reason,
        previous_values=previous,
        new_values=incident_snapshot(db_incident),
    )
    db.commit()
    return get_incident(db, incident_id)


def delete_incident(db: Session, incident_id: int):
    db_incident = get_incident(db, incident_id)
    if not db_incident:
        return None
    if not db_incident.detail:
        db_incident.detail = IncidentDetail(incident_id=db_incident.id)
        db.flush()
    if db_incident.processed_payroll_id:
        raise HTTPException(
            status_code=400,
            detail="Una incidencia procesada no puede eliminarse. Debe anularse con motivo y generar la regularización correspondiente.",
        )

    previous = incident_snapshot(db_incident)
    db_incident.status = "cancelled"
    db_incident.detail.is_cancelled = True
    db_incident.detail.cancelled_at = datetime.utcnow()
    db_incident.detail.cancellation_reason = "Anulación solicitada desde la interfaz"
    db_incident.detail.version += 1
    db.flush()
    register_incident_audit(
        db,
        db_incident,
        action="cancelled",
        actor=db_incident.updated_by,
        reason=db_incident.cancellation_reason,
        previous_values=previous,
        new_values=incident_snapshot(db_incident),
    )
    db.commit()
    return db_incident
