from __future__ import annotations

from copy import deepcopy
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.contract import Contract
from app.models.document import Document
from app.models.employee import Employee
from app.models.employee_assignment_history import EmployeeAssignmentHistory
from app.models.incident import Incident
from app.models.incident_calculation import PayrollSegment
from app.models.incident_detail import IncidentAudit, IncidentConfirmation, IncidentDetail
from app.models.payroll import Payroll
from app.models.payroll_calculation_snapshot import PayrollCalculationSnapshot
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollItem
from app.models.social_security_registration import SocialSecurityRegistration
from app.models.tax_profile import TaxProfile
from app.models.training_workspace import TrainingWorkspace
from app.models.work_center import WorkCenter


def _values(instance, *, skip: set[str] | None = None) -> dict:
    omitted = {"id", *(skip or set())}
    return {
        column.name: deepcopy(getattr(instance, column.name))
        for column in instance.__table__.columns
        if column.name not in omitted
    }


def _baseline_rows(db: Session, model):
    if hasattr(model, "workspace_id"):
        return db.query(model).filter(model.workspace_id.is_(None)).order_by(model.id).all()
    return db.query(model).order_by(model.id).all()


def _clone(db: Session, model, source, **overrides):
    data = _values(source, skip=set(overrides))
    data.update(overrides)
    target = model(**data)
    db.add(target)
    db.flush()
    return target


def workspace_has_domain_data(db: Session, workspace_id: int) -> bool:
    return db.query(Company.id).filter(Company.workspace_id == workspace_id).first() is not None


def seed_workspace_from_baseline(db: Session, workspace: TrainingWorkspace) -> bool:
    """Clone the global demo baseline into one learner workspace.

    Global rows (workspace_id NULL) remain the immutable template used by the
    legacy demo/staff view. Learners receive new database IDs so later writes
    never touch another learner's scenario.
    """
    if workspace_has_domain_data(db, workspace.id):
        return False

    company_map: dict[int, int] = {}
    center_map: dict[int, int] = {}
    employee_map: dict[int, int] = {}
    contract_map: dict[int, int] = {}
    incident_map: dict[int, int] = {}
    payroll_map: dict[int, int] = {}
    segment_map: dict[int, int] = {}
    document_map: dict[int, int] = {}

    try:
        for source in _baseline_rows(db, Company):
            target = _clone(db, Company, source, workspace_id=workspace.id)
            company_map[source.id] = target.id

        for source in _baseline_rows(db, WorkCenter):
            company_id = company_map.get(source.company_id)
            if source.company_id and company_id is None:
                continue
            target = _clone(
                db,
                WorkCenter,
                source,
                workspace_id=workspace.id,
                company_id=company_id,
            )
            center_map[source.id] = target.id

        for source in _baseline_rows(db, Employee):
            target = _clone(
                db,
                Employee,
                source,
                workspace_id=workspace.id,
                company_id=company_map.get(source.company_id) if source.company_id else None,
                center_id=center_map.get(source.center_id) if source.center_id else None,
            )
            employee_map[source.id] = target.id

        for source in db.query(EmployeeAssignmentHistory).order_by(EmployeeAssignmentHistory.id).all():
            employee_id = employee_map.get(source.employee_id)
            if employee_id is None:
                continue
            _clone(
                db,
                EmployeeAssignmentHistory,
                source,
                employee_id=employee_id,
                company_id=company_map.get(source.company_id) if source.company_id else None,
                center_id=center_map.get(source.center_id) if source.center_id else None,
            )

        for source in _baseline_rows(db, TaxProfile):
            employee_id = employee_map.get(source.employee_id)
            if employee_id is None:
                continue
            _clone(
                db,
                TaxProfile,
                source,
                workspace_id=workspace.id,
                employee_id=employee_id,
            )

        contract_sources = _baseline_rows(db, Contract)
        for source in contract_sources:
            employee_id = employee_map.get(source.employee_id)
            if employee_id is None:
                continue
            target = _clone(
                db,
                Contract,
                source,
                workspace_id=workspace.id,
                employee_id=employee_id,
                company_id=company_map.get(source.company_id) if source.company_id else None,
                center_id=center_map.get(source.center_id) if source.center_id else None,
                transformation_from_contract_id=None,
            )
            contract_map[source.id] = target.id

        for source in contract_sources:
            if not source.transformation_from_contract_id:
                continue
            target_id = contract_map.get(source.id)
            previous_id = contract_map.get(source.transformation_from_contract_id)
            if target_id and previous_id:
                db.query(Contract).filter(Contract.id == target_id).update(
                    {Contract.transformation_from_contract_id: previous_id},
                    synchronize_session=False,
                )
        db.flush()

        for source in db.query(ContractPayrollConcept).order_by(ContractPayrollConcept.id).all():
            contract_id = contract_map.get(source.contract_id)
            if contract_id is None:
                continue
            _clone(db, ContractPayrollConcept, source, contract_id=contract_id)

        for source in db.query(SocialSecurityRegistration).order_by(SocialSecurityRegistration.id).all():
            contract_id = contract_map.get(source.contract_id)
            if contract_id is None:
                continue
            _clone(db, SocialSecurityRegistration, source, contract_id=contract_id)

        for source in _baseline_rows(db, Incident):
            employee_id = employee_map.get(source.employee_id)
            contract_id = contract_map.get(source.contract_id)
            company_id = company_map.get(source.company_id)
            if employee_id is None or contract_id is None or company_id is None:
                continue
            target = _clone(
                db,
                Incident,
                source,
                workspace_id=workspace.id,
                employee_id=employee_id,
                contract_id=contract_id,
                company_id=company_id,
                center_id=center_map.get(source.center_id) if source.center_id else None,
            )
            incident_map[source.id] = target.id

        for source in _baseline_rows(db, Payroll):
            employee_id = employee_map.get(source.employee_id)
            contract_id = contract_map.get(source.contract_id)
            company_id = company_map.get(source.company_id)
            if employee_id is None or contract_id is None or company_id is None:
                continue
            target = _clone(
                db,
                Payroll,
                source,
                workspace_id=workspace.id,
                employee_id=employee_id,
                contract_id=contract_id,
                company_id=company_id,
                center_id=center_map.get(source.center_id) if source.center_id else None,
            )
            payroll_map[source.id] = target.id

        for source in db.query(PayrollSegment).order_by(PayrollSegment.id).all():
            payroll_id = payroll_map.get(source.payroll_id)
            if payroll_id is None:
                continue
            target = _clone(
                db,
                PayrollSegment,
                source,
                payroll_id=payroll_id,
                incident_id=incident_map.get(source.incident_id) if source.incident_id else None,
                segment_key=f"{source.segment_key}:ws:{workspace.id}",
            )
            segment_map[source.id] = target.id

        for source in db.query(PayrollItem).order_by(PayrollItem.id).all():
            payroll_id = payroll_map.get(source.payroll_id)
            if payroll_id is None:
                continue
            source_id = source.source_id
            if source_id in incident_map:
                source_id = incident_map[source_id]
            _clone(
                db,
                PayrollItem,
                source,
                payroll_id=payroll_id,
                segment_id=segment_map.get(source.segment_id) if source.segment_id else None,
                source_id=source_id,
                source_key=f"{source.source_key}:ws:{workspace.id}" if source.source_key else None,
            )

        for source in db.query(PayrollCalculationSnapshot).order_by(PayrollCalculationSnapshot.id).all():
            payroll_id = payroll_map.get(source.payroll_id)
            if payroll_id is None:
                continue
            _clone(db, PayrollCalculationSnapshot, source, payroll_id=payroll_id)

        for source in _baseline_rows(db, Document):
            employee_id = employee_map.get(source.employee_id)
            company_id = company_map.get(source.company_id)
            if employee_id is None or company_id is None:
                continue
            target = _clone(
                db,
                Document,
                source,
                workspace_id=workspace.id,
                employee_id=employee_id,
                company_id=company_id,
                center_id=center_map.get(source.center_id) if source.center_id else None,
                wage_garnishment_id=None,
            )
            document_map[source.id] = target.id

        for source in db.query(IncidentDetail).order_by(IncidentDetail.id).all():
            incident_id = incident_map.get(source.incident_id)
            if incident_id is None:
                continue
            _clone(
                db,
                IncidentDetail,
                source,
                incident_id=incident_id,
                processed_payroll_id=payroll_map.get(source.processed_payroll_id) if source.processed_payroll_id else None,
            )

        for source in db.query(IncidentAudit).order_by(IncidentAudit.id).all():
            incident_id = incident_map.get(source.incident_id)
            if incident_id is None:
                continue
            _clone(db, IncidentAudit, source, incident_id=incident_id)

        for source in db.query(IncidentConfirmation).order_by(IncidentConfirmation.id).all():
            incident_id = incident_map.get(source.incident_id)
            if incident_id is None:
                continue
            _clone(
                db,
                IncidentConfirmation,
                source,
                incident_id=incident_id,
                document_id=document_map.get(source.document_id) if source.document_id else None,
            )

        workspace.seed_version = workspace.seed_version or "2026.1"
        workspace.updated_at = datetime.utcnow()
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
