# Split 32 — Addendum de ciclo de vida

Este documento actualiza el estado funcional de `split-32-mejoras-incidencias`.

## Operativo

- Anulación lógica con motivo y versión esperada.
- Procesamiento idempotente en una nómina.
- Solicitud de recálculo o regularización.
- Consulta de auditoría.
- Resumen mensual por trabajador y vida laboral.
- Alta, edición y anulación de partes de confirmación.
- Interfaz para anular incidencias, solicitar recálculo y gestionar partes.
- Bloqueo optimista con respuesta HTTP 409.

## Endpoints

- `GET /incidents/{incident_id}/history`
- `POST /incidents/{incident_id}/cancel`
- `POST /incidents/{incident_id}/process`
- `POST /incidents/{incident_id}/request-recalculation`
- `POST /incidents/{incident_id}/confirmations`
- `PUT /incidents/{incident_id}/confirmations/{confirmation_id}`
- `POST /incidents/{incident_id}/confirmations/{confirmation_id}/cancel`
- `GET /incidents/employee/{employee_id}/monthly-summary`

## Archivos adicionales

- `backend/app/schemas/incident_actions.py`
- `backend/app/services/incident_actions.py`
- `backend/app/incident_routes.py`
- `frontend/src/components/incidents/IncidentTableContent.jsx`
- `frontend/src/components/incidents/incidentTable.css`

La página usa `IncidentTableContent.jsx`. `IncidentTable.jsx` queda como implementación heredada sin uso y excluida del lint hasta su retirada.

## Limitaciones vigentes

No se ha implementado el motor jurídico completo de IT, absentismo, vacaciones u horas extraordinarias. Tampoco se generan todavía conceptos de nómina por incidencia ni existe autorización efectiva para datos sanitarios.
