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
- búsqueda, selección, leído/no leído, archivado y papelera;
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
- contadores del buzón y reinicio independiente de los datos demo.

### Endpoints del correo

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
- contador global de no leídos sincronizado con el backend.

El correo deja de depender de mensajes estáticos definidos en React. Al recargar la pestaña se mantienen la lectura, las carpetas, los borradores y las respuestas realizadas.

## Cuarta entrega: escenarios guiados y progreso por asignación

No se ha creado un segundo dominio docente paralelo. Se reutilizan y amplían las entidades existentes `CaseStudy`, `CaseTask` y `CaseAssignment`:

- `CaseStudy` actúa como definición del escenario;
- `CaseTask` actúa como paso ordenado del escenario;
- `CaseAssignment` representa el ejercicio asignado a un alumno o grupo;
- `CaseTaskProgress` registra el estado independiente de cada paso para cada asignación.

Los casos pueden almacenar ahora:

- código de escenario relacionado con el correo;
- categoría y dificultad;
- estado inicial del ejercicio;
- reglas de validación declarativas;
- mensaje de finalización;
- acción esperada por paso;
- tipo y condición de activación;
- reglas de validación específicas;
- condición bloqueante respecto a pasos anteriores.

El progreso incluye:

- pendiente, en curso, completado o con error;
- intentos realizados;
- anotaciones del alumno;
- resultado de validación;
- fecha de inicio y finalización;
- porcentaje agregado de la asignación;
- paso actual.

Los pasos bloqueantes deben completarse en orden. Al completar un paso, el siguiente se activa automáticamente. Cuando todos los pasos obligatorios terminan, la asignación pasa a entregada y el hilo relacionado queda resuelto.

### Endpoints de escenarios

- `GET /case-assignments/{assignment_id}/scenario`
- `POST /case-assignments/{assignment_id}/start`
- `PATCH /case-assignments/{assignment_id}/steps/{task_id}`
- `POST /case-assignments/{assignment_id}/reset-progress`

### Integración en el correo

Los mensajes demo de antigüedad, incapacidad temporal y sustitución quedan vinculados a casos y asignaciones reales. Dentro del panel de lectura, el alumno puede:

- consultar el título, dificultad, destinatario y porcentaje del ejercicio;
- iniciar el caso;
- seguir la secuencia de pasos;
- añadir una anotación;
- confirmar manualmente un paso en esta fase inicial;
- registrar un error y reabrirlo;
- reiniciar el progreso;
- comprobar cómo cambia el estado del hilo y de la asignación.

La confirmación manual se identifica como modo educativo de demostración. Las reglas ya están estructuradas, pero su comprobación automática contra trabajadores, contratos, incidencias, nóminas, FIE o SILTRA corresponde al siguiente bloque.

## Decisiones de interfaz

La aplicación de correo ocupa toda la pestaña para mantener una separación clara respecto al ERP principal. Conserva un patrón reconocible de tres columnas:

1. carpetas y estados de casos;
2. bandeja de mensajes;
3. lectura, conversación, progreso del ejercicio, documentación y accesos al proceso relacionado.

La identidad visual utiliza el azul del icono de correo y la marca AulaNomina, evitando copiar logos, nombres o recursos de Microsoft Outlook.

## Siguientes pasos

1. Activar los enlaces reales hacia trabajador, contrato, nómina, incidencia, FIE, SILTRA y modelos fiscales.
2. Registrar eventos de los módulos del ERP y evaluarlos contra las reglas declarativas de cada paso.
3. Generar respuestas automáticas distintas para aciertos y errores.
4. Adaptar la vista de alumno y el panel docente al progreso por asignación.
5. Añadir trazabilidad detallada de acciones, intentos y tiempos.
6. Construir el caso demo integral de baja médica, sustitución, nómina y discrepancia FIE.
