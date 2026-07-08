# Split 34 — Regularizaciones base de nómina

## Objetivo

Iniciar el módulo de regularizaciones como pieza separada del recibo de nómina.

El objetivo no es recalcular históricamente y sobrescribir nóminas cerradas, sino crear una primera base profesional para:

- previsualizar diferencias económicas
- aplicar ajustes trazables en una nómina destino abierta
- mantener la nómina origen cerrada o histórica sin reescritura
- generar líneas de concepto identificables como regularización
- preparar el camino para regularizaciones automáticas futuras

## Decisión técnica

En esta primera fase no se crea una tabla nueva de regularizaciones.

Se utiliza la infraestructura ya estabilizada de conceptos y líneas de nómina:

- `PayrollConcept`
- `PayrollItem`
- `source_type`
- `source_key`
- `calculation_trace`

Cada regularización aplicada crea líneas automáticas con prefijo:

```text
REGULARIZACION:{payroll_id}:{sequence}:{line_index}:{concept_code}
```

Esto evita una migración prematura y permite validar rápido el flujo funcional.

## Principio funcional

Una regularización:

1. toma una nómina destino abierta
2. opcionalmente referencia una nómina origen
3. calcula el impacto económico
4. genera líneas automáticas trazables
5. actualiza importes agregados de la nómina destino
6. no reabre ni modifica la nómina origen

Una reversión:

1. toma una regularización ya aplicada
2. calcula importes inversos
3. no borra las líneas originales
4. genera una contra-regularización trazable
5. deja referencia `reversal_of` al grupo original

## Endpoints añadidos

### Listar grupos de regularización

```http
GET /payrolls/{payroll_id}/regularizations
```

Agrupa líneas por clave:

```text
REGULARIZACION:{payroll_id}:{sequence}
```

### Previsualizar regularización

```http
POST /payrolls/{payroll_id}/regularizations/preview
```

Devuelve el impacto previsto sin modificar datos.

### Aplicar regularización

```http
POST /payrolls/{payroll_id}/regularizations/apply
```

Aplica la regularización sobre la nómina destino.

### Previsualizar reversión

```http
POST /payrolls/{payroll_id}/regularizations/reversal/preview
```

### Aplicar reversión

```http
POST /payrolls/{payroll_id}/regularizations/reversal/apply
```

La reversión genera una nueva regularización con importes inversos.

Bloquea nóminas destino con estado:

- `closed`
- `cancelled`

## Request base

```json
{
  "origin_payroll_id": 10,
  "reason": "INCIDENCIA_TARDIA",
  "description": "Regularización por IT comunicada fuera de plazo",
  "gross_delta": "150.00",
  "employee_deduction_delta": "9.53",
  "irpf_delta": "15.00",
  "company_cost_delta": "47.85",
  "contribution_base_delta": null,
  "irpf_base_delta": null,
  "taxable": true,
  "contribution_base": true,
  "actor": "regularization"
}
```

## Request de reversión

```json
{
  "regularization_group_key": "REGULARIZACION:25:1",
  "description": "Reversión controlada de regularización aplicada por error",
  "actor": "regularization_reversal"
}
```

## Motivos soportados

- `INCIDENCIA_TARDIA`
- `BAJA_TARDIA`
- `CAMBIO_SALARIAL`
- `ANTIGUEDAD`
- `CONVENIO`
- `IRPF`
- `SEGURIDAD_SOCIAL`
- `MANUAL`
- `REVERSION`

## Conceptos automáticos

El servicio crea o reutiliza estos conceptos de sistema:

| Código | Tipo | Uso |
|---|---|---|
| `REGULARIZACION_DEVENGO` | `DEVENGO` | Ajuste de bruto |
| `REGULARIZACION_DEDUCCION` | `DEDUCCION` | Ajuste de deducciones de trabajador |
| `REGULARIZACION_IRPF` | `DEDUCCION` | Ajuste específico de IRPF |
| `REGULARIZACION_COSTE_EMPRESA` | `BASE_INFORMATIVA` | Ajuste informativo de coste empresa |

Todos quedan en categoría:

```text
REGULARIZACION
```

## Impacto calculado

La previsualización devuelve:

- bruto regularizado
- deducción de trabajador regularizada
- IRPF regularizado
- total de deducciones regularizado
- base de cotización regularizada
- base de IRPF regularizada
- coste empresa regularizado
- neto regularizado
- líneas que se generarían
- advertencias
- explicación didáctica

## Actualización agregada de la nómina destino

Al aplicar una regularización o reversión se actualizan:

- `gross_salary`
- `common_contingencies_base`
- `professional_contingencies_base`
- `unemployment_training_fogasa_base`
- `irpf_base`
- `employee_social_security`
- `irpf`
- `total_deductions`
- `net_salary`
- `company_total_social_security`
- `company_total_cost`
- `calculation_version`
- `calculation_engine_version`

La reversión deja la nómina destino marcada con:

```text
split-34-regularization-reversal
```

## Frontend

### Helpers API

- `fetchPayrollRegularizations(payrollId)`
- `previewPayrollRegularization(payrollId, payload)`
- `applyPayrollRegularization(payrollId, payload)`
- `previewPayrollRegularizationReversal(payrollId, payload)`
- `applyPayrollRegularizationReversal(payrollId, payload)`

### Panel visual

Se añade el componente:

```text
frontend/src/components/payrolls/PayrollRegularizationModal.jsx
```

Se integra en:

```text
frontend/src/components/payrolls/PayrollTable.jsx
frontend/src/pages/PayrollsPage.jsx
```

La tabla de nóminas incorpora el botón:

```text
Regularizar
```

El panel permite:

1. seleccionar nómina origen opcional
2. elegir motivo de regularización
3. describir el ajuste
4. introducir bruto, deducción trabajador, IRPF y coste empresa
5. indicar si cotiza y si tributa
6. sobrescribir base de cotización o base IRPF si procede
7. previsualizar antes de aplicar
8. ver advertencias funcionales
9. confirmar explícitamente la aplicación
10. refrescar el listado de nóminas
11. abrir el recibo actualizado tras aplicar

### Restricciones visuales

Si la nómina destino está `closed` o `cancelled`, el panel permite previsualizar pero desactiva la aplicación.

## Trazabilidad en recibo y desglose

Se añade el servicio:

```text
backend/app/services/payroll_regularization_trace.py
```

Este servicio enriquece el recibo sin modificar el motor base:

- detecta líneas `REGULARIZACION_*`
- detecta `source_key` con prefijo `REGULARIZACION:{payroll_id}:...`
- añade líneas de regularización al recibo aunque existan líneas `ENGINE:*`
- recalcula las secciones visibles del recibo
- añade resumen de regularizaciones
- añade explicación didáctica por línea de regularización
- mantiene visible la nómina origen, el motivo y el impacto

El endpoint de recibo usa ahora la versión enriquecida:

```http
GET /payrolls/{payroll_id}/receipt
GET /payrolls/{payroll_id}/receipt/print
```

El schema del recibo expone:

- `regularization_summary`
- `regularization_explanations`
- `is_regularization` en líneas del recibo
- `regularization_reason`
- `origin_payroll_id`

El desglose de conceptos clasifica como regularización:

- conceptos `REGULARIZACION_*`
- categoría `REGULARIZACION`
- `source_type = regularization`
- `source_key` con prefijo `REGULARIZACION:{payroll_id}:...`

## Reversión controlada

Se añade el servicio:

```text
backend/app/services/payroll_regularization_reversal.py
```

Principios:

- no elimina líneas originales
- no modifica la nómina histórica origen
- no permite revertir directamente una reversión
- si detecta reversión previa, lo muestra como advertencia
- aplica importes inversos mediante una nueva regularización
- marca las nuevas líneas con:

```json
{
  "is_reversal": true,
  "reversal_of": "REGULARIZACION:25:1",
  "reversal_source_item_ids": [1, 2, 3, 4]
}
```

## Tests añadidos

Archivos:

```text
backend/tests/test_payroll_regularization.py
backend/tests/test_payroll_regularization_trace.py
backend/tests/test_payroll_regularization_reversal.py
```

Cobertura:

- normalización del motivo
- cálculo de deltas principales
- exclusión de bases si no cotiza/no tributa
- override explícito de bases
- líneas automáticas esperadas
- advertencia si nómina origen y destino coinciden
- deducciones negativas como devolución
- actualización de importes agregados
- bloqueo de nóminas destino cerradas o canceladas
- detección de líneas de regularización por código, categoría, origen o traza
- resumen de bruto, deducciones, neto y coste empresa regularizados
- explicación con motivo y nómina origen
- clasificación de regularizaciones en el desglose
- parseo de claves `REGULARIZACION:{payroll_id}:{sequence}:{line_index}:{concept_code}`
- validación de grupo contra nómina destino
- cálculo inverso de reversión
- detección de reversión por `reversal_of`, `is_reversal` o motivo `REVERSION`

## Alcance deliberadamente fuera

No se implementa todavía:

- tabla persistente específica de regularizaciones
- comparación automática contra snapshots anteriores
- regularización automática por incidencia tardía
- asistente docente paso a paso
- UI completa para listar y revertir regularizaciones

## Siguiente bloque recomendado

Crear UI de reversión:

1. listar grupos aplicados dentro del panel de regularizaciones
2. mostrar si un grupo ya fue revertido
3. previsualizar la contra-regularización
4. confirmar aplicación
5. abrir recibo actualizado
