# Split 32 — consolidación estructural de incidencias

## Objetivo

Consolidar el backend del módulo de incidencias antes de continuar con el frontend y el dashboard.

## Arquitectura aplicada

### Entrada única al motor

`app.services.incident_payroll_service` es la fachada canónica para el endpoint manual, la creación y actualización de nóminas, la preparación mensual, la vista previa y futuras integraciones.

El antiguo `incident_payroll_processor.py` se ha eliminado. Sus responsabilidades quedan separadas en:

- `incident_payroll_segments.py`: consulta y persistencia idempotente de segmentos;
- `incident_payroll_concepts.py`: catálogo, líneas informativas y sincronización de conceptos automáticos;
- `incident_payroll_calculator.py`: cálculo puro del resultado mensual;
- `incident_payroll_result.py`: resultado inmutable y serialización controlada;
- `incident_payroll_orchestrator.py`: validación, persistencia, auditoría y límite transaccional.

### Resultado inmutable

`IncidentPayrollCalculationResult` contiene segmentos, advertencias, ajustes de componentes, importes finales de nómina, importes por incidencia e identificadores de incidencias calculadas.

Las estructuras internas se congelan antes de devolver el resultado. La persistencia recibe una copia descongelada, por lo que no puede alterar accidentalmente el cálculo ya producido.

### Separación cálculo/transacción

La fase `calculate_payroll_incidents` solo consulta datos y produce el resultado inmutable.

La fase `persist_payroll_incident_calculation` se limita a sincronizar segmentos y conceptos, aplicar totales y actualizar estados y auditoría.

`process_payroll_incidents` es el único límite que confirma o revierte la transacción.

La vista previa usa la misma fase de cálculo y no escribe segmentos, conceptos, reglas ni totales.

### Resolución de reglas sin escrituras ocultas

`resolve_calculation_rule` ya no inserta reglas por defecto durante una consulta. Si no existe una regla persistida aplicable, devuelve una representación inmutable de la regla general incluida en el código.

`ensure_default_incident_rules` continúa disponible únicamente como operación explícita de inicialización.

### Sensibilidad de conceptos salariales

Cada regla puede definir `concept_sensitivity` para:

- `salary_supplements`;
- `seniority_amount`;
- `variable_incentives`;
- `extra_pay_proration`.

Modos soportados:

- `maintain`: conserva el importe completo;
- `salary_percentage`: sigue el porcentaje salarial del segmento;
- `worked`: solo se devenga durante trabajo normal;
- `exclude`: no se devenga durante el segmento;
- porcentaje numérico o configuración `{ "mode": "percentage", "value": 50 }`.

Las ausencias no retribuidas, permisos no retribuidos, suspensiones y sanciones reducen los cuatro componentes de forma proporcional por defecto. Las situaciones médicas y retribuidas mantienen el comportamiento anterior salvo configuración legal o de convenio.

Los campos fuente no se sobrescriben. El motor utiliza el importe ajustado para bruto, IRPF, neto y coste, y genera líneas informativas automáticas con importe original, factor aplicado, importe ajustado y reducción. Esto evita reducciones acumulativas al recalcular.

### Dependencias explícitas del segmentador

El segmentador recibe una política inmutable `IncidentCalculationPolicy` con los resolutores de base reguladora y complemento de IT por convenio.

Se ha eliminado `advanced_incident_bridge.py`. La traza avanzada y las reglas de convenio se incorporan directamente durante la construcción de cada segmento.

### Flujo explícito de nómina

`payroll_application_service.py` coordina el alta, actualización y preparación mensual de nóminas con la ejecución posterior del motor de incidencias.

`app.models` ya no modifica funciones de `app.crud.payroll` durante la importación. Se ha eliminado `payroll_incident_bridge.py`.

## Ciclo de vida

Una incidencia nueva solo puede crearse como `draft` u `open`.

La edición general permite `draft`, `open`, `pending` y `validated`. Los estados `processed`, `closed`, `regularized` y `cancelled` quedan reservados para acciones controladas.

`processed_payroll_id` y `generated_amount` solo pueden cambiar mediante procesos controlados de cálculo, regularización o anulación.

## Pruebas y CI

Las pruebas cubren:

- inmutabilidad del resultado;
- ausencia de escrituras durante el cálculo;
- separación entre cálculo y persistencia;
- sensibilidad por defecto y configurable;
- ausencia de reducciones acumulativas;
- persistencia idempotente de cuatro líneas informativas de reducción;
- estados iniciales y transiciones;
- política de cálculo inyectable;
- ausencia de monkey patches;
- procesamiento automático e idempotencia.

Los workflows compilan el backend, ejecutan las pruebas del motor y validan la importación completa de FastAPI.

## Fuera de alcance

Quedan para bloques posteriores:

- rediseño de `IncidentForm` y retirada visual de campos ambiguos;
- dashboard global e historial paginado;
- interfaz visual completa de vista previa y explicación;
- regularización económica completa;
- configuración visual de sensibilidad por convenio;
- cálculo jurídicamente completo de topes y bases de cotización.
