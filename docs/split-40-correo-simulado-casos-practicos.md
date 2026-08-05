# Split 40 — Correo simulado y casos prácticos

## Objetivo

Incorporar a AulaNomina un correo interno persistente que funcione como entrada realista a los procesos del ERP. El alumno debe interpretar comunicaciones laborales, revisar documentación y actuar en los módulos relacionados. La orientación educativa se mantiene como ayuda secundaria y no como elemento dominante.

## Correo persistente

El dominio utiliza:

- `Mailbox` para el buzón del usuario;
- `EmailThread` para conversaciones y su relación con empresa, trabajador, expediente o caso;
- `EmailMessage` para mensajes recibidos, enviados, borradores y comunicaciones automáticas;
- `EmailAttachment` para adjuntos simulados o vinculados al gestor documental.

La API permite listar, buscar, filtrar, leer, archivar, eliminar, responder, reenviar, guardar borradores y crear nuevos hilos. Los adjuntos disponen de vista previa y descarga educativa en formatos habituales.

## Relación con casos

No se ha creado un dominio docente paralelo. Se reutilizan:

- `CaseStudy` como definición del escenario;
- `CaseTask` como operación ordenada;
- `CaseAssignment` como asignación al alumno o grupo;
- `CaseTaskProgress` como progreso independiente por asignación.

El caso se inicia al abrir por primera vez un correo vinculado. Los pasos bloqueantes avanzan en orden y las operaciones compatibles se validan contra la información almacenada en el ERP.

## Jerarquía de uso

La lectura profesional tiene prioridad:

1. asunto y remitente;
2. contenido de la conversación;
3. adjuntos;
4. acciones de correo;
5. referencia del expediente;
6. ayuda opcional.

La ayuda visible se limita al siguiente proceso, una pista opcional y el acceso al módulo relacionado. Los controles técnicos, reinicios y comprobaciones manuales quedan ocultos salvo cuando una validación automática no resulte posible.

## Navegación contextual

El contexto conserva, cuando está disponible:

- empresa y trabajador;
- periodo de nómina;
- fecha de efectos;
- expediente relacionado;
- asignación y paso activo;
- acción esperada.

Se han conectado filtros y preselecciones en nóminas, incidencias, contratos y FIE. Los pasos correspondientes a la sustitución utilizan a la persona sustituta; FIE, IT y nómina mantienen como referencia al trabajador ausente.

## Caso comercial integral `LAB-2026-001`

El recorrido **Baja médica, sustitución y cierre de comunicaciones** conecta:

1. lectura de una comunicación FIE;
2. comprobación de la incapacidad temporal;
3. conciliación FIE con la incidencia;
4. alta de la persona sustituta;
5. contrato de sustitución;
6. preparación del movimiento de afiliación;
7. envío de afiliación mediante SILTRA;
8. recálculo de la nómina afectada;
9. envío de la liquidación en SILTRA;
10. respuesta final a la dirección del centro.

El correo incorpora un parte médico, una comunicación FIE, la ficha de la sustituta y las condiciones contractuales. Los documentos contienen datos coherentes y utilizables durante el recorrido.

La demo prepara una comunicación FIE real en la base de datos para Javier Romero Sánchez. La IT demo se normaliza al código compatible con la conciliación y la bandeja FIE se filtra por el trabajador del caso. Al restaurar el buzón se reinician también la comunicación FIE y el progreso del recorrido integral.

## Respuestas profesionales

Las operaciones externas generan comunicaciones dentro del hilo desde remitentes simulados:

- INSS para conciliaciones FIE;
- SILTRA para afiliación y liquidaciones;
- AEAT para modelos 111 y 190;
- control de nómina y administración para recálculos y regularizaciones.

Las respuestas distinguen aceptación, resultado pendiente y rechazo. El cliente conserva códigos, mensajes y referencias devueltos por el proceso. El identificador del evento impide duplicar comunicaciones.

## Trazabilidad

El cliente HTTP registra únicamente operaciones compatibles con el paso activo. Cada evento incluye acción, módulo, ruta, código HTTP, recurso, trabajador, empresa, periodo y resultado de dominio. La validación puede completar el paso, mantenerlo pendiente o registrar un error.

La ampliación del panel docente queda congelada para el MVP. El módulo debe seguir comportándose como un simulador ERP y no como un LMS.

## API principal

- `POST /mail/mailboxes/{mailbox_id}/threads`
- `GET /mail/attachments/{attachment_id}/preview`
- `GET /mail/attachments/{attachment_id}/download`
- `GET /case-assignments/{assignment_id}/scenario`
- `POST /case-assignments/{assignment_id}/events`
- `POST /case-assignments/{assignment_id}/steps/{task_id}/validate`

## Pendiente posterior

- revisión gráfica y responsive del correo;
- ejecución manual completa del recorrido comercial en navegador;
- incorporación de nuevas respuestas solo cuando se añadan procesos ERP relevantes;
- replanteamiento futuro de la capa docente.
