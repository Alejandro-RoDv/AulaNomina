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

### Pasos

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

### Implementado

- Endpoint:
  - `GET /payrolls/{payroll_id}/receipt`
- Schema:
  - `backend/app/schemas/payroll_receipt.py`
- Servicio:
  - `backend/app/services/payroll_receipt.py`
- Frontend:
  - `frontend/src/components/payrolls/PayrollReceiptModal.jsx`
  - acción `Recibo` en `PayrollTable.jsx`

## Fase 4 — Integración total con incidencias

### Pasos

1. Mantener la segmentación de incidencias como motor especializado.
2. Procesar incidencias sobre nóminas mensuales.
3. Aplicar cambios al resultado agregado de la nómina.
4. Regenerar líneas canónicas de concepto tras el procesamiento de incidencias.
5. Mantener snapshots y control de versión.
6. Mostrar explicación didáctica de incidencias dentro del recibo.

### Implementado

- `incident_payroll_orchestrator` sincroniza las líneas canónicas tras aplicar incidencias.
- `payroll_application_service` sincroniza líneas canónicas tras crear, actualizar o preparar nóminas.
- El recibo expone:
  - `incident_summary`
  - `incident_explanations`
- La modal de recibo muestra un bloque de lectura didáctica antes del desglose económico.

## Subfase Split 33 — Recibo didáctico de incidencias

### Objetivo

Evitar que la integración con incidencias sea solo una suma de importes. El alumno debe ver por qué una incidencia modifica salario, prestación, complemento, descuento, bases y líquido.

### Implementado

- Resumen global de incidencias en el recibo:
  - días de incidencia
  - días de IT
  - días no cotizados
  - total de prestaciones
  - total de complementos empresa
  - total de descuentos
  - efecto neto mostrado por los segmentos
- Explicación por segmento:
  - tipo de incidencia
  - periodo afectado
  - días naturales
  - días de nómina
  - salario del tramo
  - prestación
  - complemento
  - descuento
  - tratamiento de cotización
  - conceptos relacionados
  - puntos de aprendizaje
- Vista frontend:
  - panel `LECTURA DIDÁCTICA`
  - tarjetas por segmento
  - chips de conceptos relacionados

### Archivos tocados

- `backend/app/services/payroll_receipt.py`
- `backend/app/schemas/payroll_receipt.py`
- `frontend/src/components/payrolls/PayrollReceiptModal.jsx`
- `backend/tests/test_payroll_receipt.py`

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
- `backend/tests/test_payroll_receipt.py`

Cobertura principal:

- nómina ordinaria completa
- salario reducido por incidencia/IT
- construcción de conceptos desde objeto `Payroll`
- agrupación de líneas de recibo
- totales agregados frente a totales por conceptos
- explicación didáctica de segmentos de incidencia
- resumen económico de incidencias

## Pendiente inmediato recomendado

1. Endurecer casos reales de demo con IT, recaída y ausencia no retribuida.
2. Añadir explicación didáctica de bases de cotización afectadas por incidencia.
3. Añadir explicación línea por línea para alumnos.
4. Exportación PDF real.
5. Regularizaciones como módulo separado, no antes de cerrar recibo e integración visual con incidencias.
