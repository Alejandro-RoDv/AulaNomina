# Split 40 — Correo simulado y casos prácticos guiados

## Objetivo

Convertir el correo interno en el punto de entrada de los ejercicios de AulaNomina. El alumno recibe una comunicación, revisa la documentación, abre el proceso relacionado y resuelve el caso mediante acciones reales del ERP educativo.

## Primera entrega: acceso y bandeja visual

Esta rama incorpora la base visual del módulo:

- acceso **Correo** en la cabecera, situado junto a SILTRA;
- apertura en una pestaña nueva mediante la ruta `#mail`;
- interfaz de escritorio inspirada en un cliente de correo profesional, sin reproducir Outlook de forma literal;
- columna de carpetas y vistas de casos;
- columna de mensajes;
- panel de lectura y acciones contextuales;
- mensajes de demostración relacionados con nómina, IT/FIE, contratación, fiscalidad y documentación;
- búsqueda, selección, leído/no leído, archivado y papelera en estado local;
- adjuntos simulados y lista de acciones esperadas del ejercicio.

## Segunda entrega: dominio persistente y API

Se ha añadido la base backend del correo simulado:

- entidades `Mailbox`, `EmailThread`, `EmailMessage` y `EmailAttachment`;
- relaciones y eliminación en cascada entre buzón, hilos, mensajes y adjuntos;
- carpetas persistentes: entrada, enviados, borradores, archivados y papelera;
- estados de caso: abierto, en progreso, en espera y resuelto;
- prioridades y categorías laborales;
- acciones esperadas y accesos contextuales asociados al hilo;
- buzón demo autocreado con ocho conversaciones educativas;
- búsqueda y filtrado por carpeta, estado y texto;
- lectura/no lectura, archivado, papelera y actualización de prioridad;
- creación de respuestas y borradores dentro de un hilo;
- contadores del buzón y reinicio independiente de los datos demo;
- cliente frontend preparado para consumir y adaptar la API al formato visual actual.

### Endpoints disponibles

- `GET /mail/demo-mailbox`
- `POST /mail/demo-mailbox/reset`
- `GET /mail/mailboxes/{mailbox_id}/threads`
- `GET /mail/mailboxes/{mailbox_id}/stats`
- `GET /mail/threads/{thread_id}`
- `PATCH /mail/threads/{thread_id}`
- `POST /mail/threads/{thread_id}/messages`

## Tercera entrega: interfaz conectada y operaciones persistentes

La bandeja React ya trabaja contra la API del correo:

- carga automática del buzón demo persistente;
- filtrado remoto por carpeta y estado del caso;
- búsqueda remota con espera breve para evitar llamadas por cada pulsación;
- selección de mensajes y marcado persistente como leído;
- marcado leído/no leído desde la barra superior;
- archivado y envío a papelera guardados en base de datos;
- conversación completa con mensajes entrantes, salientes y borradores;
- editor integrado para responder, responder a todos y reenviar;
- guardado persistente de borradores;
- envío simulado de respuestas dentro del hilo;
- restauración del buzón demo desde la interfaz;
- tratamiento visible de carga, errores de API y reintentos;
- contador global de no leídos sincronizado con el backend;
- pruebas frontend para la adaptación de hilos al formato visual.

El correo deja de depender de los mensajes estáticos definidos en React. Al recargar la pestaña se mantienen la lectura, las carpetas, los borradores y las respuestas realizadas.

## Decisiones de interfaz

La aplicación de correo ocupa toda la pestaña para mantener una separación clara respecto al ERP principal. Conserva un patrón reconocible de tres columnas:

1. carpetas y estados de casos;
2. bandeja de mensajes;
3. lectura, conversación, documentación y accesos al proceso relacionado.

La identidad visual utiliza el azul del icono de correo y la marca AulaNomina, evitando copiar logos, nombres o recursos de Microsoft Outlook.

## Siguientes pasos

1. Definir `CaseScenario` y `CaseScenarioStep` sobre la base docente existente.
2. Vincular hilos y mensajes a escenarios, pasos y asignaciones de alumnos.
3. Activar enlaces reales hacia trabajador, contrato, nómina, incidencia, FIE, SILTRA y modelos fiscales.
4. Incorporar motor de validación de acciones y respuestas automáticas.
5. Añadir panel básico de profesor y trazabilidad del alumno.
6. Construir el caso demo integral de baja médica, sustitución, nómina y discrepancia FIE.
