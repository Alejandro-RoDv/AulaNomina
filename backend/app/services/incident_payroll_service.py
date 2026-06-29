"""Punto de entrada canónico para el motor de incidencias en nómina."""

from app.services.incident_payroll_orchestrator import (
    calculate_payroll_incidents,
    preview_payroll_incidents,
    process_payroll_incidents,
)
from app.services.incident_payroll_segments import period_incidents

__all__ = [
    "calculate_payroll_incidents",
    "period_incidents",
    "preview_payroll_incidents",
    "process_payroll_incidents",
]
