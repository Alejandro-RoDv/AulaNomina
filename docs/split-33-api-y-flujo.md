# Split 33 — API y flujo efectivo

## Procesamiento automático

El puente instalado al cargar los modelos envuelve las funciones existentes:

- `create_payroll`;
- `update_payroll`.

La preparación mensual también queda cubierta porque reutiliza `create_payroll` dentro del mismo módulo CRUD.

Después del cálculo ordinario se ejecutan, en una única operación lógica:

1. resolución de reglas;
2. segmentación intramensual;
3. sincronización idempotente de `PayrollItem`;
4. recálculo de bruto, bases conservadas, cotizaciones, IRPF, deducciones, neto y coste empresarial;
5. auditoría de las incidencias cuyo resultado haya cambiado.

## API activa

- `POST /incidents/payrolls/{payroll_id}/process`
- `GET /incidents/payrolls/{payroll_id}/segments`
- `GET /incidents/payrolls/{payroll_id}/preview`

El procesamiento explícito y el flujo automático utilizan el mismo dominio de reglas y segmentos.

## Protección de nóminas cerradas

Una nómina con estado `closed` no se reescribe. El motor devuelve conflicto y la corrección debe trasladarse a una regularización.
