# Split 34 — Liquidaciones de Seguridad Social y sistema común de ficheros

## Alcance

El split incorpora los dos bloques previstos:

- **Bloque A:** infraestructura común de comunicaciones y ficheros.
- **Bloque B:** preparación, validación, confirmación y generación simulada de liquidaciones de Seguridad Social por empresa, CCC y periodo.

No se incluyen todavía CRA, FIE, movimientos masivos, interfaz SILTRA ni modelos AEAT funcionales.

## Bloque A — Sistema común de comunicaciones

### Paso A1 — Dominio común

- Tipos iniciales: `SOCIAL_SECURITY_SETTLEMENT`, `CRA`, `FIE`, `MASS_REGISTRATION`, `MASS_TERMINATION`, `AEAT_111` y `AEAT_190`.
- Estados comunes desde `DRAFT` hasta `ACCEPTED`, `REJECTED` o `CANCELLED`.
- Grafo explícito de transiciones para impedir saltos incoherentes.
- Periodicidad validada según el organismo: mensual para Seguridad Social, mensual o trimestral para 111 y anual para 190.

Estado: implementado.

### Paso A2 — Persistencia e historial

- Tabla `communication_files` con empresa, CCC, periodo, tipo, estado, contenido, metadatos, errores, respuesta y fechas del flujo.
- Tabla `communication_file_events` para registrar creación, edición, validación, generación y cambios de estado.
- `response_file_id` permite enlazar una respuesta futura con el fichero original.
- La columna SQL `metadata` se expone como `metadata` en la API y se mapea internamente como `file_metadata`, porque `metadata` es un atributo reservado de SQLAlchemy.

Estado: implementado.

### Paso A3 — Servicios y API

Endpoints:

- `POST /communications`
- `GET /communications`
- `GET /communications/{id}`
- `PUT /communications/{id}`
- `POST /communications/{id}/validate`
- `POST /communications/{id}/generate`
- `POST /communications/{id}/transition`
- `GET /communications/{id}/events`

El listado permite filtrar por empresa, CCC, periodo, tipo y estado. La edición queda restringida a borradores, errores de validación y rechazados. La generación solo es posible desde `READY` y deja el fichero en `GENERATED`, pendiente de envío.

Estado: implementado.

## Bloque B — Liquidaciones de Seguridad Social

### Paso B1 — Modelo de liquidación y líneas por trabajador

Se crean:

- `social_security_settlements`
- `social_security_settlement_lines`

Cada liquidación queda identificada de forma única por empresa, CCC, año y mes. Las líneas conservan una fotografía de cada nómina incluida para que el histórico no dependa de cambios posteriores en la ficha del trabajador o contrato.

Se persisten:

- trabajador, contrato, centro, documento, NAF y grupo de cotización;
- días cotizados;
- bases de contingencias comunes, profesionales, desempleo, formación y FOGASA;
- base de horas extraordinarias;
- cuotas del trabajador;
- cuotas empresariales;
- bonificaciones y reducciones;
- total a ingresar;
- errores y advertencias de validación.

Estado: implementado.

### Paso B2 — Recuperación de nóminas, CCC y validaciones

La preparación recibe empresa, CCC y periodo. Recupera las nóminas mensuales no canceladas, resuelve el CCC con esta prioridad:

1. `WorkCenter.main_ccc`.
2. `WorkCenter.general_ccc`.
3. `Company.ccc`.

La liquidación detecta, entre otros casos:

- ausencia de nóminas para el CCC y periodo;
- trabajador sin NAF;
- contrato sin grupo de cotización;
- días cotizados fuera de rango;
- bases negativas;
- bases positivas con cero días cotizados;
- nóminas pendientes de revisión;
- ausencia de marca de cálculo estable;
- descuadre entre cuota empresarial total y suma de componentes;
- nóminas del periodo sin CCC resoluble.

Los errores bloquean la confirmación. Las advertencias se muestran, pero permiten continuar.

Estado: implementado.

### Paso B3 — Totales, confirmación y fichero simulado

Estados propios de la liquidación:

- `DRAFT`
- `VALIDATION_ERROR`
- `READY`
- `CONFIRMED`
- `GENERATED`
- `CANCELLED`

Flujo:

1. Preparar liquidación.
2. Crear una línea por nómina del CCC.
3. Agregar bases, cuotas, bonificaciones, reducciones y total a ingresar.
4. Dejarla en `VALIDATION_ERROR` o `READY`.
5. Confirmarla desde `READY`.
6. Generar un fichero JSON simulado desde `CONFIRMED`.
7. Crear y validar automáticamente un `CommunicationFile` de tipo `SOCIAL_SECURITY_SETTLEMENT`.
8. Dejar ambos registros en `GENERATED`.

El fichero usa el formato educativo `AULANOMINA_SOCIAL_SECURITY_SETTLEMENT_V1` e incluye totales y desglose por trabajador.

Estado: implementado.

### Paso B4 — API e historial

Endpoints:

- `GET /social-security-settlements/ccc-options`
- `POST /social-security-settlements/prepare`
- `GET /social-security-settlements`
- `GET /social-security-settlements/{id}`
- `POST /social-security-settlements/{id}/confirm`
- `POST /social-security-settlements/{id}/generate`

El listado permite construir el historial por empresa, CCC, año, mes y estado. El fichero generado queda enlazado mediante `communication_file_id` y visible también en el historial común de comunicaciones.

Estado: implementado.

## Origen provisional de horas extraordinarias, bonificaciones y reducciones

La nómina actual no dispone de columnas específicas para estos importes. El motor de liquidación los obtiene de conceptos de nómina mediante códigos o categorías reconocibles:

- horas extraordinarias: `HORA_EXTRA`, `HORAS_EXTRA` u `OVERTIME`;
- bonificaciones: `BONIFICACION_SS`, `BONIF_SS` o `SOCIAL_SECURITY_BONUS`;
- reducciones: `REDUCCION_SS`, `REDUCCION_COTIZACION` o `SOCIAL_SECURITY_REDUCTION`.

Si no existen conceptos compatibles, los importes quedan a cero. Esta convención permite conectar posteriormente catálogos específicos sin alterar el modelo de liquidación.

## Decisión provisional sobre `ccc_id`

El proyecto no dispone todavía de una tabla maestra independiente para cuentas de cotización. Actualmente el CCC vive en `Company.ccc` y en `WorkCenter.general_ccc` / `WorkCenter.main_ccc`.

Por ese motivo, `ccc_id` se almacena como código textual normalizado. Durante la validación se comprueba que pertenezca a la empresa o a uno de sus centros. Esto evita introducir en este split un módulo maestro de CCC y permite migrarlo más adelante sin bloquear Seguros Sociales.

## Flujo mínimo cubierto

`Abrir Seguros Sociales → seleccionar empresa, CCC y agosto de 2026 → recuperar nóminas → mostrar trabajadores, bases y cuotas → detectar datos incompletos → confirmar liquidación → generar fichero → guardar comunicación en GENERATED`.

## Fuera de alcance

- CRA y FIE funcionales.
- Altas y bajas masivas.
- Transporte o interfaz SILTRA.
- Respuestas simuladas de SILTRA.
- Modelos 111 y 190 funcionales.
- Cambios generales de frontend.
- Panel docente y casos prácticos.
