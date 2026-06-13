# Split 29 - Progreso: paga extraordinaria por contrato

## Implementado

### Configuración

- Período especial 13, 14 o 15.
- Aplicación configurable de parcialidad.
- Descuento configurable de IT.
- Descuento configurable de ausencias no retribuidas.
- Descuento configurable de inactividad.
- Parche compatible con bases de datos existentes.
- Copia de estas reglas al duplicar una tabla salarial.

### Vista previa contractual

- Cruce entre vigencia del contrato y período de devengo.
- Contratos activos y finalizados.
- Días naturales totales del período.
- Días de vigencia del contrato.
- Días excluidos por incidencia o inactividad.
- Control de solapamientos mediante conjuntos de fechas.
- Cálculo de días efectivamente devengados.
- Aplicación del porcentaje de jornada.
- Salario base tomado del contrato.
- Complementos tomados de conceptos permanentes activos.
- Fallback a la tabla salarial.
- Fallback a la tabla del contrato para pagas generales sin versión propia.
- Desglose por concepto y origen del importe.
- Importe íntegro, importe con parcialidad e importe final.
- Prorrata mensual informativa.

### Generación

- Creación transaccional de `Payroll`.
- Períodos especiales 13, 14 y 15.
- IRPF automático o manual.
- Creación de una línea `PayrollItem` por concepto.
- Trazabilidad en las notas de cada línea.
- Bases de cotización a cero en la nómina especial.
- Prevención de duplicados para estados activos.
- Bloqueo de generación para pagas prorrateadas.
- Resumen de bruto, IRPF y neto.

### Frontend

Nuevo bloque:

`Convenios -> Estructura salarial -> Cálculo por contrato`

Permite:

- seleccionar tabla, paga, contrato y ejercicio,
- editar reglas de devengo,
- calcular la vista previa,
- revisar incidencias y días,
- revisar el origen de cada importe,
- introducir un IRPF manual o dejarlo automático,
- generar la nómina especial,
- comprobar el bloqueo posterior por duplicidad.

### API

- `GET /collective-agreements/extra-pays/{extra_pay_id}/contracts/{contract_id}/preview`
- `POST /collective-agreements/extra-pays/{extra_pay_id}/contracts/{contract_id}/payroll`

### Pruebas añadidas

`backend/tests/test_contract_extra_pay.py`

Cubre:

- alta posterior al inicio del devengo,
- contrato al 50 %,
- salario base contractual,
- complemento permanente personalizado,
- ausencia no retribuida,
- IT configurable,
- generación de nómina 13,
- IRPF manual,
- suma de líneas igual al bruto,
- prevención de duplicados.

## Pendiente

- Ejecutar la batería de pruebas en un entorno con el repositorio disponible.
- Generación masiva por empresa o centro.
- Prorrateo automático en las doce nóminas mensuales.
- Cambios de jornada dentro del período de devengo.
- Bases medias de conceptos variables.
- Histórico temporal de reglas de paga extraordinaria.
