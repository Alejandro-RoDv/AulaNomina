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

## Decisiones de interfaz

La aplicación de correo ocupa toda la pestaña para mantener una separación clara respecto al ERP principal. Conserva un patrón reconocible de tres columnas:

1. carpetas y estados de casos;
2. bandeja de mensajes;
3. lectura, documentación y accesos al proceso relacionado.

La identidad visual utiliza el azul del icono de correo y la marca AulaNomina, evitando copiar logos, nombres o recursos de Microsoft Outlook.

## Siguientes pasos

1. Dominio persistente: `Mailbox`, `EmailThread`, `EmailMessage` y `EmailAttachment`.
2. API de bandeja, lectura, archivado, borradores y respuestas.
3. Dominio de `CaseScenario` y `CaseScenarioStep`.
4. Enlaces reales desde el mensaje hacia trabajador, contrato, nómina, incidencia, FIE, SILTRA y modelos fiscales.
5. Motor de validación de acciones y respuestas automáticas.
6. Panel básico de profesor y caso demo integral.
