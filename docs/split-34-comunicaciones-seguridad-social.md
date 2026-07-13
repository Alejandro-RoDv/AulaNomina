# Split 34 — Liquidaciones de Seguridad Social y sistema común de ficheros

## Alcance de esta entrega

Esta entrega implementa únicamente el **Bloque A: sistema común de comunicaciones**. No incorpora todavía liquidaciones de Seguros Sociales, CRA, FIE, altas o bajas masivas, interfaz SILTRA ni modelos AEAT.

## División del Bloque A

### Paso A1 — Dominio común

- Tipos iniciales: `SOCIAL_SECURITY_SETTLEMENT`, `CRA`, `FIE`, `MASS_REGISTRATION`, `MASS_TERMINATION`, `AEAT_111` y `AEAT_190`.
- Estados comunes desde `DRAFT` hasta `ACCEPTED`, `REJECTED` o `CANCELLED`.
- Grafo explícito de transiciones para impedir saltos incoherentes.
- Periodicidad validada según el organismo: mensual para Seguridad Social, mensual o trimestral para 111 y anual para 190.

Estado: implementado.

### Paso A2 — Persistencia e historial

- Nueva tabla `communication_files` con empresa, CCC, periodo, tipo, estado, contenido, metadatos, errores, respuesta y fechas del flujo.
- Nueva tabla `communication_file_events` para registrar creación, edición, validación, generación y cambios de estado.
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

### Paso A4 — Integración y pruebas

- Modelos registrados en `app.models` para que `Base.metadata.create_all` cree las nuevas tablas.
- Router conectado a la API existente.
- Pruebas unitarias del formato de periodos, normalización de CCC y transiciones de estado.

Estado: implementado.

## Decisión provisional sobre `ccc_id`

El proyecto no dispone todavía de una tabla maestra independiente para cuentas de cotización. Actualmente el CCC vive en `Company.ccc` y en `WorkCenter.general_ccc` / `WorkCenter.main_ccc`.

Por ese motivo, `communication_files.ccc_id` se almacena como código textual normalizado. Durante la validación se comprueba que pertenezca a la empresa o a uno de sus centros. Esto evita introducir en este split un módulo maestro de CCC y permite migrarlo más adelante sin bloquear Seguros Sociales.

## Flujo ya disponible para el siguiente bloque

1. Crear una comunicación `SOCIAL_SECURITY_SETTLEMENT` en `DRAFT`.
2. Validar empresa, CCC y periodo.
3. Dejarla en `READY`.
4. Generar el contenido simulado y el nombre del fichero.
5. Dejarla en `GENERATED`, visible en el historial y pendiente de envío.

El Bloque B reutilizará este flujo al confirmar una liquidación de Seguridad Social.

## Fuera de alcance

- Cálculo y agrupación de liquidaciones.
- CRA y FIE funcionales.
- Altas y bajas masivas.
- Transporte o interfaz SILTRA.
- Respuestas simuladas de SILTRA.
- Modelos 111 y 190 funcionales.
- Cambios generales de frontend.
- Panel docente y casos prácticos.
