# Split 32 — consolidación estructural de incidencias

## Objetivo

Consolidar el backend del módulo de incidencias antes de continuar con el rediseño del frontend y el dashboard.

## Cambios aplicados

### Punto de entrada único para el motor de nómina

Se añade `app.services.incident_payroll_service` como fachada canónica.

Deben importar desde esta fachada:

- el endpoint manual de procesamiento de incidencias en nómina;
- el puente que procesa incidencias al crear o actualizar una nómina;
- futuras integraciones con el motor.

La implementación completa continúa en `incident_payroll_orchestrator`, que recalcula importes de nómina, Seguridad Social, IRPF, neto y coste empresarial. El antiguo `incident_payroll_processor` queda limitado a primitivas reutilizables de consulta y persistencia para las llamadas internas actuales.

Esto elimina la divergencia práctica entre el procesamiento manual y el automático.

### Ciclo de vida controlado

Una incidencia nueva solo puede crearse como:

- `draft`;
- `open`.

La edición general permite trabajar con los estados de preparación:

- `draft`;
- `open`;
- `pending`;
- `validated`.

Los estados siguientes quedan reservados para acciones controladas:

- `processed`;
- `closed`;
- `regularized`;
- `cancelled`.

Para mantener compatibilidad con el formulario actual, una edición puede reenviar el mismo estado, la misma nómina procesada y el mismo importe generado. No puede cambiar esos datos mediante el `PUT` general.

### Protección de datos calculados

`processed_payroll_id` y `generated_amount` no pueden alterarse mediante la edición general. Solo pueden cambiar por los procesos de:

- procesamiento;
- recálculo;
- regularización;
- anulación controlada cuando corresponda.

### Pruebas y CI

Se añade `test_incident_structural_contracts.py`, que verifica:

- estados iniciales permitidos;
- rechazo de resultados de nómina inyectados al crear;
- transiciones permitidas en edición general;
- protección de nómina procesada e importe generado;
- uso de la fachada canónica por rutas y puente de nómina.

El workflow general de backend ejecuta estas pruebas junto al motor de incidencias existente.

## Fuera de alcance de este bloque

Se dejan para un split posterior:

- rediseño de `IncidentForm`;
- retirada visual de campos auxiliares ambiguos;
- dashboard global de incidencias;
- historial paginado en servidor;
- vista previa visual de segmentos;
- regularización económica completa;
- eliminación definitiva de los bridges instalados por efectos laterales de importación.
