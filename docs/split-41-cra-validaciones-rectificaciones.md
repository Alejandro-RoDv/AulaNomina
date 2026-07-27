# Split 41 · Validaciones y rectificaciones CRA

## Objetivo

Añadir al flujo CRA una simulación didáctica de respuestas SILTRA y una comunicación correctora trazable.

## Estados

- `ACCEPTED`: fichero sin errores ni avisos.
- `ACCEPTED_WITH_WARNINGS`: fichero válido con incidencias no bloqueantes.
- `REJECTED`: fichero con errores estructurales o escenario de rechazo.

## Validaciones

- XML y segmentos CRA/DDE/TRB/CRE.
- Coincidencia de CCC y periodo.
- NAF obligatorio de 12 dígitos.
- Clave CRA e indicador I/E permitidos.
- Actuaciones A, M, B y C.
- Importes positivos y límite de 9.999.999,99.
- Registros duplicados.
- Conceptos de nómina sin vinculación CRA.
- Alta duplicada de un concepto ya aceptado.
- M/B/C sin comunicación aceptada previa.

## Escenarios de práctica

- Automático: el resultado depende de las validaciones.
- Aceptación con avisos: añade un aviso didáctico si no existen errores bloqueantes.
- Rechazo: fuerza un error didáctico para practicar la corrección.

## Comunicación correctora

- Si el fichero anterior fue rechazado, se genera una nueva comunicación con actuación `A`.
- Si fue aceptado o aceptado con avisos, se genera una comunicación con actuación `M`, que sustituye el importe previamente comunicado.
- El fichero original y el corrector quedan vinculados mediante metadatos `replacement_of_file_id` y `superseded_by_file_id`.

## Frontend

El módulo incorpora un panel de validación con:

- contadores por estado;
- selección del escenario de práctica;
- mensajes de error, aviso e información;
- respuesta RCA;
- trazabilidad entre fichero original y corrector;
- acciones `Validar y enviar` y `Crear correctora`.

## Referencia funcional

El manual CRA de julio de 2026 establece que las rectificaciones de importes ya comunicados se realizan mediante `M` (modificación), `B` (baja) o `C` (complemento). No se admiten importes negativos.
