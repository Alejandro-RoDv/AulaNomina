# Split 40 — Navegación contextual y validación automática

## Navegación desde el correo

El paso activo del caso guiado permite abrir directamente el módulo de AulaNomina relacionado con la tarea. La apertura conserva en la URL y en el almacenamiento del navegador:

- asignación activa;
- paso activo;
- código del escenario;
- trabajador relacionado cuando está definido.

El destino se resuelve por acción y módulo. Entre las rutas disponibles están trabajadores, contratos, incidencias, nóminas, afiliación, FIE, documentos, Modelos 111 y 190 y ficheros de Seguridad Social.

Cada apertura se registra dentro de `CaseTaskProgress.validation_result.events` como evidencia de navegación, sin introducir todavía una tabla adicional de auditoría.

## Validación automática

Se incorpora el endpoint:

- `POST /case-assignments/{assignment_id}/steps/{task_id}/validate`

El motor comprueba datos reales almacenados en PostgreSQL o SQLite y puede completar automáticamente el paso cuando todas sus reglas se cumplen.

Reglas cubiertas en esta entrega:

- trabajador activo existente;
- incidencia laboral existente por trabajador, tipo y fecha;
- contrato activo y modalidad de sustitución;
- preparación de afiliación con fecha de alta;
- comunicación FIE revisada;
- comunicación FIE conciliada con incidencia;
- nómina recalculada para trabajador y periodo;
- fecha de antigüedad existente en contrato;
- complemento salarial activo en contrato;
- respuesta enviada dentro del hilo del caso.

Cuando una acción todavía no dispone de comprobación fiable, el motor devuelve `manual_required=true` y mantiene disponible la confirmación manual. No se considera completado un paso únicamente por haber abierto una pantalla.

## Registro de eventos

Se incorpora el endpoint:

- `POST /case-assignments/{assignment_id}/events`

El frontend lo utiliza para registrar la apertura de módulos desde el correo. Los eventos quedan asociados al progreso del paso y conservan tipo, acción, destino, metadatos y fecha.

## Interfaz

El paso actual muestra ahora:

- botón para abrir el módulo real;
- botón **Validar automáticamente**;
- resultado de cada comprobación;
- confirmación manual como alternativa explícita;
- registro de error y reapertura del paso.

El siguiente bloque debe instrumentar las operaciones internas de los módulos para registrar eventos de creación, modificación, cálculo, conciliación y presentación sin depender de una validación solicitada por el alumno.
