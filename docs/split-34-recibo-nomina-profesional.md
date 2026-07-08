# Split 34 — Recibo profesional de nómina

## Objetivo

Crear una vista de recibo de nómina realista y comercialmente enseñable, apoyada en el motor central de conceptos introducido en Split 33.

El recibo no sustituye a un documento oficial. Es un recibo simulado con finalidad docente para explicar cómo se compone una nómina mensual.

## Backend

### Endpoint

`GET /payrolls/{payroll_id}/receipt`

### Servicio

`backend/app/services/payroll_receipt.py`

Genera un payload estructurado con:

- empresa
- centro de trabajo
- trabajador
- contrato
- periodo
- devengos
- deducciones
- bases
- coste empresa
- segmentos de incidencias
- totales agregados
- totales por conceptos
- advertencias de consistencia
- pie legal/simulado

### Schema

`backend/app/schemas/payroll_receipt.py`

Incluye modelos específicos para:

- partes del recibo
- contrato
- periodo
- líneas de concepto
- bases
- deducciones
- coste empresa
- segmentos de incidencias
- totales

## Frontend

### Servicio API

`fetchPayrollReceipt(payrollId)` en `frontend/src/services/payrollApi.js`.

### Vista

`frontend/src/components/payrolls/PayrollReceiptModal.jsx`

La modal muestra:

- cabecera de recibo
- empresa, centro y trabajador
- datos del periodo y contrato
- resumen de devengos, deducciones, neto y coste empresa
- tabla de devengos
- tabla de deducciones
- tabla de bases
- tabla de coste empresa
- segmentos de incidencias si existen
- líneas informativas
- advertencias
- pie legal simulado

### Integración

`PayrollTable.jsx` añade acción `Recibo` en cada nómina del histórico.

## Validaciones

El recibo compara los totales agregados de la nómina con los totales derivados de conceptos. Si no coinciden, devuelve advertencias para que el usuario vea que hay una diferencia entre el cálculo agregado y la explicación por líneas.

## Tests

`backend/tests/test_payroll_receipt.py`

Cubre:

- agrupación de líneas en bloques de recibo
- exposición simultánea de totales agregados y totales por conceptos

## Pendiente posterior

1. Estilos específicos de impresión/PDF.
2. Exportación PDF real.
3. Firma o sello simulado del centro docente.
4. Enlace desde panel de profesor a recibos de casos prácticos.
5. Explicación didáctica línea por línea para alumnos.
