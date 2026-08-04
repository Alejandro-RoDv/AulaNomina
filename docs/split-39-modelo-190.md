# Split 39 — Modelo 190

## Paso 39.1 — Dominio anual y catálogo fiscal

Este paso prepara la base persistente del Modelo 190 sin implementar todavía el cálculo anual, la conciliación con el Modelo 111 ni la interfaz.

### Dominio incorporado

- `Model190Declaration`: cabecera anual, tipos ordinaria/complementaria/sustitutiva, estados, totales, payload congelado y referencias de presentación.
- `Model190Recipient`: fotografía anual nominativa agrupable por NIF, clave, subclave y ejercicio de devengo.
- `Model190RecipientLine`: trazabilidad hasta nóminas, facturas, atrasos, regularizaciones, ajustes y Modelo 111 trimestral.
- `Model190RecipientOverride`: capa de clasificación fiscal revisable sin alterar nóminas ni facturas originales.
- `Tax190Key` y `Tax190Subkey`: catálogo fiscal versionado por ejercicio.

### Reutilización del Modelo 111

No se duplican profesionales, facturas ni ajustes. `TaxWithholdingAdjustment` se amplía con:

- `model190_key`;
- `model190_subkey`;
- `accrual_year`;
- `deductible_expense_amount`.

### Catálogo educativo inicial

Se cargan únicamente las clasificaciones necesarias para los primeros casos docentes:

- clave `A`: rendimientos del trabajo de empleados por cuenta ajena, sin subclave;
- clave `G`, subclave `01`: actividad profesional con tipo general;
- clave `G`, subclave `03`: inicio de actividad profesional con tipo reducido.

El catálogo toma como referencia el diseño de registro de la AEAT para el ejercicio 2025. No se considera un catálogo exhaustivo ni garantiza validez para ejercicios posteriores; deberá revisarse por campaña antes de generar un fichero oficialmente compatible.

### Migración ligera

AulaNomina todavía no utiliza Alembic. Se añade `model190_schema_patch.py`, registrado sobre `Base.metadata.after_create`, para:

- crear las nuevas tablas mediante el metadata SQLAlchemy;
- añadir los cuatro campos del Modelo 190 a ajustes ya existentes;
- crear índices auxiliares;
- sembrar de forma idempotente el catálogo soportado.

### Fuera de este paso

- motor anual de perceptores;
- conciliación 111/190;
- endpoints;
- pantalla ERP;
- fichero de declaración;
- simulador AEAT;
- certificados de retenciones.
