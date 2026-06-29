# Split 32 — estabilidad estructural del motor de incidencias

## Objetivo

Endurecer el backend del módulo de incidencias antes de continuar con el frontend, el dashboard y la regularización económica.

## Arquitectura consolidada

`app.services.incident_payroll_service` es la fachada canónica para procesamiento, vista previa, preparación mensual y overrides controlados.

Las responsabilidades quedan separadas en:

- `incident_payroll_segments.py`: consulta y persistencia idempotente de segmentos;
- `incident_payroll_concepts.py`: conceptos automáticos y trazabilidad de reducciones;
- `incident_payroll_calculator.py`: cálculo puro;
- `incident_payroll_result.py`: resultado inmutable;
- `incident_payroll_orchestrator.py`: bloqueo, versión, persistencia y transacción;
- `incident_payroll_snapshot.py`: snapshot reproducible y huella del cálculo;
- `incident_overlap_policy.py`: validación explícita de solapamientos.

Se han eliminado los procesadores duplicados, bridges dinámicos y sustituciones de funciones en tiempo de importación.

## 1. Bases de cotización frescas

Las bases ya no reutilizan los importes calculados en una ejecución anterior.

En cada cálculo se reconstruyen a partir de:

- segmentos actuales;
- tratamiento de cotización de cada segmento;
- complementos, antigüedad, incentivos y prorrata ajustados;
- horas extraordinarias.

Los tratamientos admitidos son `maintain`, `reduce` y `none`. Un valor desconocido bloquea el cálculo en lugar de aplicar una aproximación silenciosa.

Los únicos valores manuales persistentes son:

- `common_contingencies_base_override`;
- `professional_contingencies_base_override`;
- `unemployment_training_fogasa_base_override`.

El endpoint controlado de overrides recalcula inmediatamente la nómina y exige opcionalmente la versión esperada. Un valor `null` elimina el override y devuelve la base a cálculo automático.

La vista previa y la respuesta del procesamiento muestran la base automática, el override, el valor resuelto y su origen.

## 2. Solapamientos de incidencias

El motor ya no elige una incidencia por fecha e identificador cuando existen varias incidencias salariales incompatibles en un mismo día.

La política de solapamientos:

- separa incidencias primarias de incidencias combinables;
- permite horas extraordinarias como incidencia adicional;
- asigna prioridades explícitas por tipo;
- agrupa días consecutivos con el mismo conflicto;
- devuelve HTTP 409 con código `incident_overlap_conflict`;
- incluye fechas, identificadores, tipos y prioridades implicadas.

La nómina no se calcula hasta que el conflicto se resuelve.

## 3. Concurrencia y versionado

El procesamiento bloquea la fila de `payrolls` mediante `SELECT ... FOR UPDATE` en PostgreSQL.

El bloqueo se limita a la nómina, evitando bloquear relaciones cargadas con `LEFT JOIN`.

Cada cálculo correcto incrementa `calculation_version`. Las operaciones pueden enviar `expected_version`; si otra transacción ya ha recalculado la nómina, se devuelve HTTP 409 con código `payroll_calculation_version_conflict`.

El `commit` y el `rollback` permanecen en el límite del orquestador. Un error en cálculo, segmentos, conceptos, auditoría o snapshot revierte toda la operación.

## 4. Pruebas PostgreSQL

`Backend checks` incorpora PostgreSQL 16 como servicio real y ejecuta pruebas de integración para:

- bloqueo de fila;
- dos procesamientos concurrentes sobre la misma versión;
- aceptación de una única transacción;
- rechazo de la petición obsoleta;
- persistencia de un único snapshot;
- rollback completo ante solapamientos;
- JSON y decimales sobre PostgreSQL.

SQLite se mantiene para la batería rápida y PostgreSQL para los contratos transaccionales críticos.

## 5. Snapshot reproducible

Cada procesamiento correcto crea un `PayrollCalculationSnapshot` con:

- versión de cálculo;
- versión del motor;
- actor;
- huella SHA-256;
- referencias de reglas y fundamentos registrados;
- datos salariales y contractuales de entrada;
- incidencias que afectan al cálculo;
- ajustes de componentes;
- resolución de bases de cotización;
- segmentos e importes finales.

La huella solo utiliza datos que afectan al resultado económico. Un recálculo idéntico conserva la misma huella aunque cambie el estado administrativo de la incidencia de abierta a procesada.

La combinación `(payroll_id, calculation_version)` es única.

## Resultado inmutable y sensibilidad

`IncidentPayrollCalculationResult` congela segmentos, ajustes, importes de nómina e importes por incidencia antes de persistirlos.

Las reglas pueden definir `concept_sensitivity` para:

- `salary_supplements`;
- `seniority_amount`;
- `variable_incentives`;
- `extra_pay_proration`.

Los modos disponibles son `maintain`, `salary_percentage`, `worked`, `exclude` y porcentaje configurable.

Los importes fuente no se sobrescriben. Los ajustes afectan a bruto, IRPF, neto, bases y coste empresarial, y generan líneas informativas automáticas sin producir reducciones acumulativas.

## Ciclo de vida

Una incidencia nueva solo puede crearse como `draft` u `open`.

La edición general admite `draft`, `open`, `pending` y `validated`. Los estados `processed`, `closed`, `regularized` y `cancelled` quedan reservados para acciones controladas.

`processed_payroll_id` y `generated_amount` están protegidos frente a edición manual.

## Verificación

Las workflows verifican:

- compilación completa del backend;
- importación de FastAPI;
- resultado inmutable;
- bases frescas y overrides;
- sensibilidad e idempotencia;
- conflictos de solapamiento;
- bloqueo y versionado;
- snapshots reproducibles;
- concurrencia y rollback sobre PostgreSQL;
- pruebas existentes del frontend de incidencias.

## Fuera de alcance

Quedan para bloques posteriores:

- rediseño de `IncidentForm` y retirada visual de campos ambiguos;
- dashboard global e historial paginado;
- interfaz visual completa de vista previa y explicación;
- regularización económica completa;
- configuración visual de reglas y sensibilidad;
- topes y bases de cotización jurídicamente completos.
