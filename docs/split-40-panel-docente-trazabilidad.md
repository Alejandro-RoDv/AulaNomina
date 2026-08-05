# Split 40 — Panel docente de trazabilidad

## Objetivo

Convertir el panel del profesor en una vista de supervisión real de los casos prácticos vinculados al correo. El docente debe poder identificar rápidamente qué alumno o grupo está trabajando, dónde se ha detenido, qué errores ha cometido y qué respuestas ha generado el tutor automático.

## Endpoints

- `GET /case-assignments/teacher-dashboard`
- `GET /case-assignments/{assignment_id}/teacher-detail`

El primer endpoint devuelve métricas y un resumen filtrable de las asignaciones. El segundo construye el detalle completo de una asignación y su cronología.

## Información agregada

La vista docente muestra:

- estado de la asignación;
- porcentaje y pasos completados;
- paso actual;
- tiempo transcurrido desde el inicio;
- última actividad;
- operaciones fallidas;
- mensajes emitidos por el tutor automático;
- fecha límite;
- alumno o grupo destinatario.

Las métricas generales incluyen asignaciones totales, progreso medio, operaciones fallidas y respuestas del tutor.

## Detalle por paso

Cada paso conserva y presenta:

- módulo y acción esperada;
- estado actual;
- intentos registrados;
- operaciones realizadas;
- errores de API;
- anotaciones del alumno;
- última validación automática;
- fecha de inicio y finalización.

## Cronología

La cronología se obtiene de la información ya almacenada en `CaseTaskProgress.validation_result`, de los estados de progreso y de los mensajes asociados al hilo. No se introduce todavía una tabla de auditoría adicional.

Se ordenan de forma descendente:

- asignación del caso;
- inicio de pasos;
- operaciones del ERP;
- errores de operación;
- validaciones automáticas;
- finalización de pasos;
- respuestas del tutor automático;
- entrega del caso.

## Interfaz

El panel se integra dentro de `#teacher-dashboard` y mantiene la identidad visual del módulo docente. Incluye:

- cuatro indicadores principales;
- filtros por texto, estado y tipo de destinatario;
- listado lateral de asignaciones;
- progreso y alertas de error por asignación;
- secuencia visual de pasos;
- cronología detallada con actor, fecha y resultado;
- actualización automática cuando otra pestaña del ERP registra una operación.

## Limitaciones actuales

El tiempo mostrado es tiempo transcurrido entre el inicio y la última actividad o finalización; no equivale todavía a tiempo efectivo de trabajo. Los eventos proceden de las operaciones instrumentadas y de las validaciones existentes. La ampliación futura podrá añadir pausas, rúbricas, comentarios del profesor y exportación de resultados.
