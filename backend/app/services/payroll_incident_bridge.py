from __future__ import annotations


def install_payroll_incident_bridge() -> None:
    """Wrap the existing payroll CRUD without duplicating its preparation flow."""

    import app.crud.payroll as payroll_crud

    if getattr(payroll_crud, "_incident_engine_bridge_installed", False):
        return

    from app.services.incident_payroll_orchestrator import process_payroll_incidents

    original_create_payroll = payroll_crud.create_payroll
    original_update_payroll = payroll_crud.update_payroll

    def create_payroll_with_incidents(db, payroll):
        created = original_create_payroll(db, payroll)
        if created and created.period_month in range(1, 13) and created.status != "closed":
            process_payroll_incidents(db, created.id, actor="payroll_create")
            return payroll_crud.get_payroll(db, created.id)
        return created

    def update_payroll_with_incidents(db, payroll_id, payroll_data):
        updated = original_update_payroll(db, payroll_id, payroll_data)
        if updated and updated.period_month in range(1, 13) and updated.status != "closed":
            process_payroll_incidents(db, updated.id, actor="payroll_update")
            return payroll_crud.get_payroll(db, updated.id)
        return updated

    payroll_crud.create_payroll = create_payroll_with_incidents
    payroll_crud.update_payroll = update_payroll_with_incidents
    payroll_crud._incident_engine_bridge_installed = True
