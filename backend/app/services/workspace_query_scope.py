from __future__ import annotations

from sqlalchemy import event, select
from sqlalchemy.orm import Session as OrmSession, with_loader_criteria

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
from app.models.wage_garnishment import WageGarnishment
from app.models.wage_garnishment_movement import WageGarnishmentMovement
from app.models.work_center import WorkCenter
from app.services.workspace_context import current_workspace_id


DIRECT_WORKSPACE_SCOPED_MODELS = (
    Company,
    WorkCenter,
    Employee,
    Contract,
    Incident,
    Payroll,
    Document,
    TaxProfile,
)

# Models without a workspace_id inherit their workspace from one required parent.
# Keeping this relationship in one place means direct queries such as
# /payroll-items/{id} or /incident-confirmations/{id} cannot bypass isolation.
INDIRECT_PARENT_MODELS = {
    CompanyPreferences: ("company_id", Company),
    CompanyBankAccount: ("company_id", Company),
    CompanyPaymentAssignment: ("company_id", Company),
    EmployeeAssignmentHistory: ("employee_id", Employee),
    ContractPayrollConcept: ("contract_id", Contract),
    SocialSecurityRegistration: ("contract_id", Contract),
    ContractLifecycleEvent: ("contract_id", Contract),
    EmploymentTermination: ("contract_id", Contract),
    IncidentDetail: ("incident_id", Incident),
    IncidentAudit: ("incident_id", Incident),
    IncidentConfirmation: ("incident_id", Incident),
    PayrollItem: ("payroll_id", Payroll),
    PayrollSegment: ("payroll_id", Payroll),
    PayrollCalculationSnapshot: ("payroll_id", Payroll),
    WageGarnishment: ("employee_id", Employee),
    WageGarnishmentMovement: ("wage_garnishment_id", WageGarnishment),
    CommunicationFile: ("company_id", Company),
    CommunicationFileEvent: ("communication_file_id", CommunicationFile),
    CommunicationSubmission: ("company_id", Company),
    AffiliationWorkerState: ("employee_id", Employee),
    FieCommunication: ("company_id", Company),
    FieProcessingEvent: ("communication_id", FieCommunication),
    SocialSecuritySettlement: ("company_id", Company),
    SocialSecuritySettlementLine: ("settlement_id", SocialSecuritySettlement),
    Professional: ("company_id", Company),
    ProfessionalInvoice: ("company_id", Company),
    TaxWithholdingAdjustment: ("company_id", Company),
    Model111Declaration: ("company_id", Company),
    Model111Line: ("declaration_id", Model111Declaration),
    Model190Declaration: ("company_id", Company),
    Model190Recipient: ("declaration_id", Model190Declaration),
    Model190RecipientLine: ("model190_recipient_id", Model190Recipient),
    Model190RecipientOverride: ("company_id", Company),
}

WORKSPACE_SCOPED_MODELS = DIRECT_WORKSPACE_SCOPED_MODELS + tuple(INDIRECT_PARENT_MODELS)
_INSTALLED = False


def _workspace_condition(model, workspace_id: int):
    if model in DIRECT_WORKSPACE_SCOPED_MODELS:
        return model.workspace_id == workspace_id

    parent_spec = INDIRECT_PARENT_MODELS.get(model)
    if parent_spec is None:
        raise KeyError(f"Modelo sin regla de workspace: {model.__name__}")

    foreign_key_name, parent_model = parent_spec
    foreign_key = getattr(model, foreign_key_name)
    return foreign_key.in_(
        select(parent_model.id).where(_workspace_condition(parent_model, workspace_id))
    )


def _apply_workspace_filter(execute_state) -> None:
    workspace_id = current_workspace_id()
    if workspace_id is None:
        return

    if execute_state.is_select:
        statement = execute_state.statement
        for model in WORKSPACE_SCOPED_MODELS:
            statement = statement.options(
                with_loader_criteria(
                    model,
                    _workspace_condition(model, workspace_id),
                    include_aliases=True,
                )
            )
        execute_state.statement = statement
        return

    if not (execute_state.is_update or execute_state.is_delete):
        return

    mapper = getattr(execute_state, "bind_mapper", None)
    model = getattr(mapper, "class_", None)
    if model in WORKSPACE_SCOPED_MODELS:
        execute_state.statement = execute_state.statement.where(
            _workspace_condition(model, workspace_id)
        )


def _parent_exists_in_workspace(session: OrmSession, instance, workspace_id: int) -> bool:
    parent_spec = INDIRECT_PARENT_MODELS.get(type(instance))
    if parent_spec is None:
        return True

    foreign_key_name, parent_model = parent_spec
    parent_id = getattr(instance, foreign_key_name, None)
    if parent_id is None:
        return False

    statement = select(parent_model.id).where(
        parent_model.id == parent_id,
        _workspace_condition(parent_model, workspace_id),
    )
    return session.connection().execute(statement).scalar_one_or_none() is not None


def _assign_and_guard_workspace(session: OrmSession, _flush_context, _instances) -> None:
    workspace_id = current_workspace_id()
    if workspace_id is None:
        return

    for instance in session.new:
        if isinstance(instance, DIRECT_WORKSPACE_SCOPED_MODELS):
            current = getattr(instance, "workspace_id", None)
            if current is None:
                instance.workspace_id = workspace_id
            elif int(current) != int(workspace_id):
                raise RuntimeError("No se puede crear un registro fuera del workspace activo")
        elif type(instance) in INDIRECT_PARENT_MODELS:
            if not _parent_exists_in_workspace(session, instance, workspace_id):
                raise RuntimeError("No se puede crear un registro hijo fuera del workspace activo")

    for collection in (session.dirty, session.deleted):
        for instance in collection:
            if isinstance(instance, DIRECT_WORKSPACE_SCOPED_MODELS):
                current = getattr(instance, "workspace_id", None)
                if current is None or int(current) != int(workspace_id):
                    raise RuntimeError("No se puede modificar un registro fuera del workspace activo")
            elif type(instance) in INDIRECT_PARENT_MODELS:
                if not _parent_exists_in_workspace(session, instance, workspace_id):
                    raise RuntimeError("No se puede modificar un registro hijo fuera del workspace activo")


def install_workspace_query_scope() -> None:
    global _INSTALLED
    if _INSTALLED:
        return
    event.listen(OrmSession, "do_orm_execute", _apply_workspace_filter)
    event.listen(OrmSession, "before_flush", _assign_and_guard_workspace)
    _INSTALLED = True


install_workspace_query_scope()
