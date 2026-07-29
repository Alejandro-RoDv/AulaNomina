# Split 38 — Modelo 111

## Objetivo

Construir un módulo educativo completo para calcular, conciliar, generar y presentar de forma simulada el Modelo 111 a partir de nóminas, facturas de profesionales y ajustes fiscales.

La implementación no realiza presentaciones reales ni sustituye software fiscal. Todas las pantallas de sede y justificantes se identifican como simulación educativa.

## 38.1 — Dominio fiscal y origen de datos

Incluye las entidades:

- `Professional`: maestro de profesionales por empresa.
- `ProfessionalInvoice`: factura simplificada con base, retención, total, estado y fecha fiscal.
- `TaxWithholdingAdjustment`: ajustes manuales, regularizaciones y atrasos.
- `Model111Declaration`: cabecera persistente de la declaración.
- `Model111Line`: fotografía congelada y trazable de cada documento origen.

Orígenes admitidos:

- nóminas revisadas o cerradas;
- facturas profesionales confirmadas o pagadas;
- ajustes fiscales confirmados.

## 38.2 — Motor de cálculo

El motor soporta inicialmente los periodos `1T`, `2T`, `3T` y `4T`, y queda preparado para periodos mensuales `01`–`12`.

Calcula:

- perceptores, base y retenciones de rendimientos del trabajo;
- perceptores, base y retenciones de actividades económicas;
- total de retenciones;
- resultado ordinario o complementario;
- conciliación por mes y tipo de origen.

Distingue expresamente:

- **sin actividad**: no existen rentas declarables y no procede generar el modelo;
- **declaración negativa**: existen rentas declarables, pero las retenciones suman 0,00 €;
- **a ingresar**: el resultado es positivo.

## 38.3 — Resumen trimestral ERP

La pantalla permite seleccionar empresa, ejercicio y trimestre. Presenta:

- tarjetas de trabajo, profesionales y resultado;
- conciliación por origen;
- detalle navegable de cada percepción;
- validaciones bloqueantes y avisos;
- alta rápida de profesionales y facturas.

## 38.4 — Generación y persistencia

Al generar una declaración:

1. se recalcula el periodo;
2. se ejecutan las validaciones;
3. se impide generar cuando no hay actividad;
4. se congela el detalle origen;
5. se persiste un payload técnico con las casillas principales;
6. se bloquea la duplicidad de una ordinaria para empresa, ejercicio y periodo.

Casillas incluidas en el payload inicial:

- 01, 02 y 03: rendimientos del trabajo;
- 07, 08 y 09: actividades económicas;
- 28: total de retenciones;
- 29: resultados previos en complementarias;
- 30: resultado de la autoliquidación.

## 38.5 — Presentación AEAT simulada

Flujo implementado:

1. acceso con certificado educativo;
2. validación de la declaración congelada;
3. selección de NRC simulado o declaración negativa;
4. conformidad, firma y envío;
5. respuesta simulada.

Las opciones de domiciliación y reconocimiento de deuda se muestran como escenarios avanzados no habilitados en esta primera iteración.

## 38.6 — Justificante, bloqueo y complementarias

La presentación genera:

- fecha y hora;
- número de justificante;
- CSV simulado;
- NRC cuando procede;
- estado presentado y bloqueo de edición.

Una declaración presentada puede utilizarse como origen de una complementaria. La original no se modifica y el resultado complementario descuenta las declaraciones presentadas previamente para el mismo periodo.

## API

Prefijo: `/model-111`

- `GET/POST/PUT /professionals`
- `GET/POST/PUT /invoices`
- `GET/POST /adjustments`
- `GET /preview`
- `GET/POST /declarations`
- `GET /declarations/{id}`
- `POST /declarations/{id}/present`

## Validaciones iniciales

- empresa existente y con NIF/CIF;
- nóminas del periodo revisadas o cerradas;
- NIF de cada perceptor;
- facturas pagadas con fecha de pago;
- retenciones negativas solo mediante regularización;
- total de retenciones no negativo;
- declaración ordinaria no duplicada;
- complementaria vinculada a una original presentada;
- complementaria con resultado positivo.

## Criterio de cierre

- [x] Nóminas finales generan percepciones fiscales.
- [x] Facturas profesionales generan retenciones.
- [x] Cálculo trimestral y soporte mensual interno.
- [x] Trazabilidad hasta documentos origen.
- [x] Diferenciación entre sin actividad y negativa.
- [x] Declaración persistente con detalle congelado.
- [x] Presentación AEAT simulada.
- [x] Justificante simulado.
- [x] Bloqueo tras presentación.
- [x] Inicio de complementaria sin alterar la original.
- [ ] PDF imprimible específico del justificante.
- [ ] Gestión visual completa de ajustes y regularizaciones.
- [ ] Escenarios avanzados de domiciliación y deuda.
