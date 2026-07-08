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

## Endpoints añadidos

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

## Motivos soportados

- `INCIDENCIA_TARDIA`
- `BAJA_TARDIA`
- `CAMBIO_SALARIAL`
- `ANTIGUEDAD`
- `CONVENIO`
- `IRPF`
- `SEGURIDAD_SOCIAL`
- `MANUAL`

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

Al aplicar una regularización se actualizan:

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

La nómina destino queda marcada con:

```text
split-34-regularization
```

## Frontend

### Helpers API

- `previewPayrollRegularization(payrollId, payload)`
- `applyPayrollRegularization(payrollId, payload)`

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

## Tests añadidos

Archivo:

```text
backend/tests/test_payroll_regularization.py
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

## Alcance deliberadamente fuera

No se implementa todavía:

- tabla persistente específica de regularizaciones
- comparación automática contra snapshots anteriores
- regularización automática por incidencia tardía
- asistente docente paso a paso
- reversión de regularizaciones
- listado histórico específico de regularizaciones

## Siguiente bloque recomendado

Mejorar la trazabilidad post-aplicación:

1. mostrar regularizaciones existentes dentro del desglose de conceptos
2. marcar líneas de regularización en el recibo
3. añadir bloque didáctico específico de regularizaciones
4. preparar reversión controlada de una regularización
