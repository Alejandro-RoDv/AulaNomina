# Split 33 — Motor central de nómina base

## Objetivo

Convertir la nómina en un motor central de cálculo, no en una pantalla aislada. El cálculo agregado existente se mantiene por compatibilidad, pero se añade una capa profesional de conceptos que permite explicar, imprimir, auditar e integrar incidencias.

## Fase 1 — Motor de nómina base

### Pasos

1. Mantener el cálculo ordinario mensual estable: salario base, complementos, antigüedad, incentivos, prorrata de pagas extra, bases, deducciones, coste empresa, IRPF y neto.
2. Añadir una salida canónica de líneas de concepto a partir del resultado agregado.
3. Añadir totales derivados por conceptos: devengos, deducciones, informativos, base cotizable, base tributable y neto por conceptos.
4. Cubrir con tests una nómina ordinaria y una nómina afectada por IT.

### Implementado

- `backend/app/services/payroll_concept_engine.py`
- `calculate_payroll_engine_result()` ahora devuelve:
  - `concept_lines`
  - `concept_totals`

## Fase 2 — Estructura profesional de conceptos

### Pasos

1. Ampliar `PayrollConcept` para recoger campos profesionales:
   - código
   - nombre
   - tipo
   - naturaleza
   - cotiza
   - tributa
   - afecta a bruto
   - afecta a neto
   - origen
   - orden de impresión
   - fórmula
2. Exponer esos campos por schema/API.
3. Añadir migración ligera conservadora para entornos sin Alembic.
4. Persistir líneas automáticas del motor con `source_key` propio, sin destruir líneas manuales ni líneas específicas de incidencias.

### Implementado

- Campos nuevos en `PayrollConcept`:
  - `affects_gross`
  - `affects_net`
  - `formula`
- `PayrollItemResponse` expone banderas relevantes para UI/recibo.
- `backend/app/services/payroll_concept_items.py` sincroniza líneas del motor con prefijo `ENGINE:{payroll_id}:...`.

## Fase 3 — Recibo de nómina

### Pasos previstos

1. Crear un endpoint específico de recibo profesional.
2. Separar bloques:
   - cabecera empresa
   - datos trabajador
   - periodo
   - devengos
   - deducciones
   - bases
   - líquido
   - coste empresa
   - pie legal/simulado
3. Crear una vista frontend densa tipo ERP.
4. Dejar PDF para una fase posterior.

### Preparación técnica completada

La vista de recibo ya puede alimentarse desde `concept_lines` y desde el desglose existente de nómina.

## Fase 4 — Integración total con incidencias

### Pasos

1. Mantener la segmentación de incidencias como motor especializado.
2. Procesar incidencias sobre nóminas mensuales.
3. Aplicar cambios al resultado agregado de la nómina.
4. Regenerar líneas canónicas de concepto tras el procesamiento de incidencias.
5. Mantener snapshots y control de versión.

### Implementado

- `incident_payroll_orchestrator` sincroniza las líneas canónicas tras aplicar incidencias.
- `payroll_application_service` sincroniza líneas canónicas tras crear, actualizar o preparar nóminas.

## Fase 5 — Regularizaciones

### Pasos previstos

1. Preparar conceptos de origen `REGULARIZACION`.
2. Calcular diferencias contra snapshots previos.
3. Generar línea de atraso o descuento.
4. Trazar origen: incidencia tardía, baja recibida tarde, cambio salarial retroactivo, antigüedad, convenio o recálculo.
5. Bloquear reescritura de nóminas cerradas y derivar a regularización.

### Preparación técnica completada

La estructura por conceptos ya incluye origen, fórmula, afectación a bruto/neto, base cotizable y base tributable, por lo que las regularizaciones podrán expresarse como líneas económicas trazables.

## Tests añadidos

- `backend/tests/test_payroll_concept_engine.py`

Cobertura principal:

- nómina ordinaria completa
- salario reducido por incidencia/IT
- construcción de conceptos desde objeto `Payroll`

## Pendiente inmediato recomendado

1. Endpoint específico de recibo profesional.
2. Vista frontend de recibo de nómina.
3. Tests de integración con creación real de nómina + persistencia de `PayrollItem` automáticos.
4. Regularizaciones como módulo separado, no antes de cerrar recibo e integración visual con incidencias.
