# Split 32 — consolidación estructural de incidencias

## Objetivo

Consolidar el backend del módulo de incidencias antes de continuar con el frontend y el dashboard.

## Arquitectura aplicada

### Entrada única al motor

`app.services.incident_payroll_service` es la fachada canónica para el endpoint manual, la creación y actualización de nóminas, la preparación mensual y futuras integraciones.

La implementación completa vive en `incident_payroll_orchestrator`, que coordina cálculo, Seguridad Social, IRPF, neto, coste empresarial, auditoría y transacción.

El antiguo `incident_payroll_processor.py` se ha eliminado. Sus responsabilidades quedan separadas en:

- `incident_payroll_segments.py`: consulta y persistencia idempotente de segmentos;
- `incident_payroll_concepts.py`: catálogo y sincronización de conceptos automáticos;
- `incident_payroll_orchestrator.py`: coordinación del proceso completo.

Así desaparece la segunda implementación del motor.

### Dependencias explícitas del segmentador

El segmentador recibe una política inmutable `IncidentCalculationPolicy` con los resolutores de base reguladora y complemento de IT por convenio.

Se ha eliminado `advanced_incident_bridge.py`. La traza avanzada y las reglas de convenio se incorporan directamente durante la construcción de cada segmento.

### Flujo explícito de nómina

`payroll_application_service.py` coordina el alta, actualización y preparación mensual de nóminas con la ejecución posterior del motor de incidencias.

`app.models` ya no modifica funciones de `app.crud.payroll` durante la importación. Se ha eliminado `payroll_incident_bridge.py`.

## Ciclo de vida

Una incidencia nueva solo puede crearse como:

- `draft`;
- `open`.

La edición general permite los estados de preparación:

- `draft`;
- `open`;
- `pending`;
- `validated`.

Los estados `processed`, `closed`, `regularized` y `cancelled` quedan reservados para acciones controladas.

Para mantener compatibilidad con el formulario actual, una edición puede reenviar el mismo estado, la misma nómina procesada y el mismo importe generado, pero no puede alterarlos mediante el `PUT` general.

## Datos calculados protegidos

`processed_payroll_id` y `generated_amount` solo pueden cambiar mediante procesos controlados de cálculo, regularización o anulación.

## Pruebas y CI

Las pruebas cubren:

- estados iniciales y transiciones;
- protección de resultados calculados;
- uso de la fachada canónica;
- política de cálculo inyectable;
- ausencia de sustituciones dinámicas de funciones;
- procesamiento automático en alta, actualización y preparación mensual;
- idempotencia de segmentos y conceptos.

Los workflows compilan el backend, ejecutan las pruebas del motor y validan la importación completa de FastAPI.

## Fuera de alcance

Quedan para bloques posteriores:

- rediseño de `IncidentForm`;
- retirada visual de campos auxiliares ambiguos;
- dashboard global e historial paginado;
- vista previa visual de segmentos;
- regularización económica completa;
- sensibilidad de todos los conceptos salariales ante incidencias;
- cálculo completo de topes y bases de cotización.
