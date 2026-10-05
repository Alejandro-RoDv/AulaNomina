from __future__ import annotations

from copy import deepcopy
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.affiliation_worker_state import AffiliationWorkerState
from app.models.communication_file import CommunicationFile, CommunicationFileEvent
from app.models.communication_submission import CommunicationSubmission
from app.models.company import Company
from app.models.company_bank_account import CompanyBankAccount, CompanyPaymentAssignment
from app.models.company_preferences import CompanyPreferences
from app.models.contract import Contract
from app.models.contract_lifecycle_event import ContractLifecycleEvent
from app.models.document import Document
from app.models.employee import Employee
from app.models.employee_assignment_history import EmployeeAssignmentHistory
from app.models.employment_termination import EmploymentTermination
from app.models.fie import FieCommunication, FieProcessingEvent
from app.models.incident import Incident
from app.models.incident_calculation import PayrollSegment
from app.models.incident_detail import IncidentAudit, IncidentConfirmation, IncidentDetail
from app.models.model111 import (
    Model111Declaration,
    Model111Line,
    Professional,
    ProfessionalInvoice,
    TaxWithholdingAdjustment,
)
from app.models.model190 import (
    Model190Declaration,
    Model190Recipient,
    Model190RecipientLine,
    Model190RecipientOverride,
)
from app.models.payroll import Payroll
from app.models.payroll_calculation_snapshot import PayrollCalculationSnapshot
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollItem
from app.models.social_security_registration import SocialSecurityRegistration
from app.models.social_security_settlement import SocialSecuritySettlement, SocialSecuritySettlementLine
from app.models.tax_profile import TaxProfile
from app.models.training_workspace import TrainingWorkspace
from app.models.wage_garnishment import WageGarnishment
from app.models.wage_garnishment_movement import WageGarnishmentMovement
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


def _scoped_unique(value, workspace_id: int, max_length: int | None = None):
    if value in (None, ""):
        return value
    suffix = f"-WS{workspace_id}"
    base = str(value)
    if max_length is not None:
        base = base[: max(0, max_length - len(suffix))]
    return f"{base}{suffix}"


def _remap_source_id(source_type, source_id, *, payroll_map, invoice_map, adjustment_map):
    if source_id is None:
        return None
    source_key = str(source_type or "").strip().lower()
    if source_key == "payroll":
        return payroll_map.get(source_id, source_id)
    if source_key == "professional_invoice":
        return invoice_map.get(source_id, source_id)
    if source_key in {"adjustment", "tax_adjustment"}:
        return adjustment_map.get(source_id, source_id)
    return source_id


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
    bank_account_map: dict[int, int] = {}
    center_map: dict[int, int] = {}
    employee_map: dict[int, int] = {}
    professional_map: dict[int, int] = {}
    professional_invoice_map: dict[int, int] = {}
    tax_adjustment_map: dict[int, int] = {}
    contract_map: dict[int, int] = {}
    incident_map: dict[int, int] = {}
    payroll_map: dict[int, int] = {}
    communication_file_map: dict[int, int] = {}
    communication_submission_map: dict[int, int] = {}
    segment_map: dict[int, int] = {}
    wage_garnishment_map: dict[int, int] = {}
    document_map: dict[int, int] = {}
    fie_communication_map: dict[int, int] = {}
    settlement_map: dict[int, int] = {}
    model111_declaration_map: dict[int, int] = {}
    model190_declaration_map: dict[int, int] = {}
    model190_recipient_map: dict[int, int] = {}

    try:
        for source in _baseline_rows(db, Company):
            target = _clone(db, Company, source, workspace_id=workspace.id)
            company_map[source.id] = target.id

        for source in db.query(CompanyPreferences).order_by(CompanyPreferences.id).all():
            company_id = company_map.get(source.company_id)
            if company_id is None:
                continue
            _clone(
                db,
                CompanyPreferences,
                source,
                company_id=company_id,
                inherited_from_company_id=(
                    company_map.get(source.inherited_from_company_id)
                    if source.inherited_from_company_id
                    else None
                ),
            )

        for source in db.query(CompanyBankAccount).order_by(CompanyBankAccount.id).all():
            company_id = company_map.get(source.company_id)
            if company_id is None:
                continue
            target = _clone(db, CompanyBankAccount, source, company_id=company_id)
            bank_account_map[source.id] = target.id

        for source in db.query(CompanyPaymentAssignment).order_by(CompanyPaymentAssignment.id).all():
            company_id = company_map.get(source.company_id)
            account_id = bank_account_map.get(source.account_id)
            if company_id is None or account_id is None:
                continue
            _clone(
                db,
                CompanyPaymentAssignment,
                source,
                company_id=company_id,
                account_id=account_id,
            )

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

        for source in db.query(Professional).order_by(Professional.id).all():
            company_id = company_map.get(source.company_id)
            if company_id is None:
                continue
            target = _clone(db, Professional, source, company_id=company_id)
            professional_map[source.id] = target.id

        for source in db.query(ProfessionalInvoice).order_by(ProfessionalInvoice.id).all():
            company_id = company_map.get(source.company_id)
            professional_id = professional_map.get(source.professional_id)
            if company_id is None or professional_id is None:
                continue
            target = _clone(
                db,
                ProfessionalInvoice,
                source,
                company_id=company_id,
                professional_id=professional_id,
            )
            professional_invoice_map[source.id] = target.id

        for source in db.query(TaxWithholdingAdjustment).order_by(TaxWithholdingAdjustment.id).all():
            company_id = company_map.get(source.company_id)
            if company_id is None:
                continue
            target = _clone(db, TaxWithholdingAdjustment, source, company_id=company_id)
            tax_adjustment_map[source.id] = target.id

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

        for source in db.query(ContractLifecycleEvent).order_by(ContractLifecycleEvent.id).all():
            contract_id = contract_map.get(source.contract_id)
            if contract_id is None:
                continue
            _clone(
                db,
                ContractLifecycleEvent,
                source,
                contract_id=contract_id,
                related_contract_id=(
                    contract_map.get(source.related_contract_id)
                    if source.related_contract_id
                    else None
                ),
            )

        for source in db.query(EmploymentTermination).order_by(EmploymentTermination.id).all():
            contract_id = contract_map.get(source.contract_id)
            employee_id = employee_map.get(source.employee_id)
            company_id = company_map.get(source.company_id)
            if contract_id is None or employee_id is None or company_id is None:
                continue
            _clone(
                db,
                EmploymentTermination,
                source,
                contract_id=contract_id,
                employee_id=employee_id,
                company_id=company_id,
                center_id=center_map.get(source.center_id) if source.center_id else None,
            )

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

        communication_sources = db.query(CommunicationFile).order_by(CommunicationFile.id).all()
        for source in communication_sources:
            company_id = company_map.get(source.company_id)
            if company_id is None:
                continue
            target = _clone(
                db,
                CommunicationFile,
                source,
                company_id=company_id,
                response_file_id=None,
                created_by=None,
            )
            communication_file_map[source.id] = target.id

        for source in communication_sources:
            if not source.response_file_id:
                continue
            target_id = communication_file_map.get(source.id)
            response_id = communication_file_map.get(source.response_file_id)
            if target_id and response_id:
                db.query(CommunicationFile).filter(CommunicationFile.id == target_id).update(
                    {CommunicationFile.response_file_id: response_id},
                    synchronize_session=False,
                )

        for source in db.query(CommunicationFileEvent).order_by(CommunicationFileEvent.id).all():
            communication_file_id = communication_file_map.get(source.communication_file_id)
            if communication_file_id is None:
                continue
            _clone(
                db,
                CommunicationFileEvent,
                source,
                communication_file_id=communication_file_id,
                created_by=None,
            )

        for source in db.query(CommunicationSubmission).order_by(CommunicationSubmission.id).all():
            file_id = communication_file_map.get(source.communication_file_id)
            company_id = company_map.get(source.company_id)
            if file_id is None or company_id is None:
                continue
            target = _clone(
                db,
                CommunicationSubmission,
                source,
                communication_file_id=file_id,
                company_id=company_id,
                submission_number=_scoped_unique(source.submission_number, workspace.id, 40),
                response_file_id=(
                    communication_file_map.get(source.response_file_id)
                    if source.response_file_id
                    else None
                ),
                created_by=None,
            )
            communication_submission_map[source.id] = target.id

        for source in db.query(AffiliationWorkerState).order_by(AffiliationWorkerState.id).all():
            employee_id = employee_map.get(source.employee_id)
            company_id = company_map.get(source.company_id)
            if employee_id is None or company_id is None:
                continue
            _clone(
                db,
                AffiliationWorkerState,
                source,
                employee_id=employee_id,
                company_id=company_id,
                contract_id=contract_map.get(source.contract_id) if source.contract_id else None,
                source_submission_id=(
                    communication_submission_map.get(source.source_submission_id)
                    if source.source_submission_id
                    else None
                ),
            )

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

        for source in db.query(WageGarnishment).order_by(WageGarnishment.id).all():
            employee_id = employee_map.get(source.employee_id)
            company_id = company_map.get(source.company_id)
            if employee_id is None or company_id is None:
                continue
            target = _clone(
                db,
                WageGarnishment,
                source,
                employee_id=employee_id,
                company_id=company_id,
                contract_id=contract_map.get(source.contract_id) if source.contract_id else None,
            )
            wage_garnishment_map[source.id] = target.id

        for source in db.query(WageGarnishmentMovement).order_by(WageGarnishmentMovement.id).all():
            wage_garnishment_id = wage_garnishment_map.get(source.wage_garnishment_id)
            if wage_garnishment_id is None:
                continue
            _clone(
                db,
                WageGarnishmentMovement,
                source,
                wage_garnishment_id=wage_garnishment_id,
                payroll_id=payroll_map.get(source.payroll_id) if source.payroll_id else None,
            )

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
                wage_garnishment_id=(
                    wage_garnishment_map.get(source.wage_garnishment_id)
                    if source.wage_garnishment_id
                    else None
                ),
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

        for source in db.query(FieCommunication).order_by(FieCommunication.id).all():
            company_id = company_map.get(source.company_id)
            if company_id is None:
                continue
            target = _clone(
                db,
                FieCommunication,
                source,
                company_id=company_id,
                employee_id=employee_map.get(source.employee_id) if source.employee_id else None,
                contract_id=contract_map.get(source.contract_id) if source.contract_id else None,
                incident_id=incident_map.get(source.incident_id) if source.incident_id else None,
                external_message_id=_scoped_unique(source.external_message_id, workspace.id),
            )
            fie_communication_map[source.id] = target.id

        for source in db.query(FieProcessingEvent).order_by(FieProcessingEvent.id).all():
            communication_id = fie_communication_map.get(source.communication_id)
            if communication_id is None:
                continue
            _clone(db, FieProcessingEvent, source, communication_id=communication_id)

        for source in db.query(SocialSecuritySettlement).order_by(SocialSecuritySettlement.id).all():
            company_id = company_map.get(source.company_id)
            if company_id is None:
                continue
            target = _clone(
                db,
                SocialSecuritySettlement,
                source,
                company_id=company_id,
                communication_file_id=(
                    communication_file_map.get(source.communication_file_id)
                    if source.communication_file_id
                    else None
                ),
                created_by=None,
            )
            settlement_map[source.id] = target.id

        for source in db.query(SocialSecuritySettlementLine).order_by(SocialSecuritySettlementLine.id).all():
            settlement_id = settlement_map.get(source.settlement_id)
            payroll_id = payroll_map.get(source.payroll_id)
            employee_id = employee_map.get(source.employee_id)
            contract_id = contract_map.get(source.contract_id)
            if settlement_id is None or payroll_id is None or employee_id is None or contract_id is None:
                continue
            _clone(
                db,
                SocialSecuritySettlementLine,
                source,
                settlement_id=settlement_id,
                payroll_id=payroll_id,
                employee_id=employee_id,
                contract_id=contract_id,
                center_id=center_map.get(source.center_id) if source.center_id else None,
            )

        model111_sources = db.query(Model111Declaration).order_by(Model111Declaration.id).all()
        for source in model111_sources:
            company_id = company_map.get(source.company_id)
            if company_id is None:
                continue
            target = _clone(
                db,
                Model111Declaration,
                source,
                company_id=company_id,
                original_declaration_id=None,
            )
            model111_declaration_map[source.id] = target.id

        for source in model111_sources:
            if not source.original_declaration_id:
                continue
            target_id = model111_declaration_map.get(source.id)
            original_id = model111_declaration_map.get(source.original_declaration_id)
            if target_id and original_id:
                db.query(Model111Declaration).filter(Model111Declaration.id == target_id).update(
                    {Model111Declaration.original_declaration_id: original_id},
                    synchronize_session=False,
                )

        for source in db.query(Model111Line).order_by(Model111Line.id).all():
            declaration_id = model111_declaration_map.get(source.declaration_id)
            if declaration_id is None:
                continue
            _clone(
                db,
                Model111Line,
                source,
                declaration_id=declaration_id,
                source_id=_remap_source_id(
                    source.source_type,
                    source.source_id,
                    payroll_map=payroll_map,
                    invoice_map=professional_invoice_map,
                    adjustment_map=tax_adjustment_map,
                ),
            )

        model190_sources = db.query(Model190Declaration).order_by(Model190Declaration.id).all()
        for source in model190_sources:
            company_id = company_map.get(source.company_id)
            if company_id is None:
                continue
            target = _clone(
                db,
                Model190Declaration,
                source,
                company_id=company_id,
                original_declaration_id=None,
            )
            model190_declaration_map[source.id] = target.id

        for source in model190_sources:
            if not source.original_declaration_id:
                continue
            target_id = model190_declaration_map.get(source.id)
            original_id = model190_declaration_map.get(source.original_declaration_id)
            if target_id and original_id:
                db.query(Model190Declaration).filter(Model190Declaration.id == target_id).update(
                    {Model190Declaration.original_declaration_id: original_id},
                    synchronize_session=False,
                )

        for source in db.query(Model190Recipient).order_by(Model190Recipient.id).all():
            declaration_id = model190_declaration_map.get(source.declaration_id)
            if declaration_id is None:
                continue
            target = _clone(
                db,
                Model190Recipient,
                source,
                declaration_id=declaration_id,
                employee_id=employee_map.get(source.employee_id) if source.employee_id else None,
                professional_id=(
                    professional_map.get(source.professional_id)
                    if source.professional_id
                    else None
                ),
            )
            model190_recipient_map[source.id] = target.id

        for source in db.query(Model190RecipientLine).order_by(Model190RecipientLine.id).all():
            recipient_id = model190_recipient_map.get(source.model190_recipient_id)
            if recipient_id is None:
                continue
            _clone(
                db,
                Model190RecipientLine,
                source,
                model190_recipient_id=recipient_id,
                source_id=_remap_source_id(
                    source.source_type,
                    source.source_id,
                    payroll_map=payroll_map,
                    invoice_map=professional_invoice_map,
                    adjustment_map=tax_adjustment_map,
                ),
                model111_declaration_id=(
                    model111_declaration_map.get(source.model111_declaration_id)
                    if source.model111_declaration_id
                    else None
                ),
            )

        for source in db.query(Model190RecipientOverride).order_by(Model190RecipientOverride.id).all():
            company_id = company_map.get(source.company_id)
            if company_id is None:
                continue
            recipient_type = str(source.recipient_type or "").lower()
            if recipient_type == "employee":
                recipient_id = employee_map.get(source.recipient_id)
            elif recipient_type == "professional":
                recipient_id = professional_map.get(source.recipient_id)
            else:
                recipient_id = None
            if recipient_id is None:
                continue
            _clone(
                db,
                Model190RecipientOverride,
                source,
                company_id=company_id,
                recipient_id=recipient_id,
            )

        workspace.seed_version = workspace.seed_version or "2026.1"
        workspace.updated_at = datetime.utcnow()
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
