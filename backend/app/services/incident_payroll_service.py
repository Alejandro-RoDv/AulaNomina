"""Punto de entrada canónico para el motor de incidencias en nómina.

Los endpoints, integraciones y procesos automáticos deben importar desde este
módulo. La implementación completa vive en el orquestador y las primitivas de
persistencia permanecen separadas del flujo de cálculo.
"""

from app.services.incident_payroll_orchestrator import process_payroll_incidents
from app.services.incident_payroll_segments import period_incidents

__all__ = ["period_incidents", "process_payroll_incidents"]
