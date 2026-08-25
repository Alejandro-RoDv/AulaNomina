from __future__ import annotations

from sqlalchemy import event
from sqlalchemy.orm import Session as OrmSession, with_loader_criteria

from app.models.company import Company
from app.models.contract import Contract
from app.models.document import Document
from app.models.employee import Employee
from app.models.incident import Incident
from app.models.payroll import Payroll
from app.models.tax_profile import TaxProfile
from app.models.work_center import WorkCenter
from app.services.workspace_context import current_workspace_id


WORKSPACE_SCOPED_MODELS = (
    Company,
    WorkCenter,
    Employee,
    Contract,
    Incident,
    Payroll,
    Document,
    TaxProfile,
)

_INSTALLED = False


def _apply_workspace_filter(execute_state) -> None:
    workspace_id = current_workspace_id()
    if workspace_id is None or not execute_state.is_select:
        return

    statement = execute_state.statement
    for model in WORKSPACE_SCOPED_MODELS:
        statement = statement.options(
            with_loader_criteria(
                model,
                model.workspace_id == workspace_id,
                include_aliases=True,
            )
        )
    execute_state.statement = statement


def _assign_and_guard_workspace(session: OrmSession, _flush_context, _instances) -> None:
    workspace_id = current_workspace_id()
    if workspace_id is None:
        return

    for instance in session.new:
        if not isinstance(instance, WORKSPACE_SCOPED_MODELS):
            continue
        current = getattr(instance, "workspace_id", None)
        if current is None:
            instance.workspace_id = workspace_id
        elif int(current) != int(workspace_id):
            raise RuntimeError("No se puede crear un registro fuera del workspace activo")

    for collection in (session.dirty, session.deleted):
        for instance in collection:
            if not isinstance(instance, WORKSPACE_SCOPED_MODELS):
                continue
            current = getattr(instance, "workspace_id", None)
            if current is None or int(current) != int(workspace_id):
                raise RuntimeError("No se puede modificar un registro fuera del workspace activo")


def install_workspace_query_scope() -> None:
    global _INSTALLED
    if _INSTALLED:
        return
    event.listen(OrmSession, "do_orm_execute", _apply_workspace_filter)
    event.listen(OrmSession, "before_flush", _assign_and_guard_workspace)
    _INSTALLED = True


install_workspace_query_scope()
