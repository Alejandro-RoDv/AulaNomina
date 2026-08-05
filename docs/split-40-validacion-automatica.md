# Split 40 — Navegación contextual, validación y tutor automático

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

Reglas cubiertas:

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

## Registro automático de operaciones

El cliente HTTP central de AulaNomina detecta operaciones mutables realizadas mientras existe un contexto de caso activo. La instrumentación no se añade formulario a formulario, sino en el punto común de acceso a la API.

Operaciones cubiertas inicialmente:

- alta de trabajador;
- creación y actualización de contrato;
- creación de incidencia;
- recálculo o actualización de nómina;
- alta o modificación de conceptos permanentes;
- aplicación de regularizaciones;
- preparación de movimientos de afiliación;
- lectura y conciliación de comunicaciones FIE;
- actualización de documentación.

El puente solo registra la operación cuando coincide con la acción esperada del paso activo. De esta forma, una llamada auxiliar realizada durante un alta contractual no completa por error otro paso del caso.

Para cada operación se envía al endpoint:

- `POST /case-assignments/{assignment_id}/events`

El evento conserva:

- acción y módulo;
- método y ruta de API;
- resultado correcto o erróneo;
- código HTTP;
- identificador del recurso creado o actualizado;
- escenario y paso activos;
- identificador único para evitar respuestas duplicadas.

## Tutor automático por correo

Cuando una operación del ERP termina, el backend evalúa automáticamente el paso y genera una respuesta dentro del hilo del caso.

El remitente simulado es:

- `Tutor automático · AulaNomina <tutor@aulanomina.local>`

La respuesta cambia según el resultado:

- **correcto:** confirma la comprobación, completa el paso y activa el siguiente;
- **operación realizada pero condición no cumplida:** explica qué comprobaciones siguen pendientes;
- **regla no automatizable:** informa de que debe usarse la confirmación manual;
- **error de API:** registra el intento, marca el paso con error y solicita corregir los datos.

El mensaje automático deja el hilo como no leído. La pestaña del correo recibe el cambio mediante almacenamiento compartido del navegador, actualiza el progreso y vuelve a cargar la conversación sin que el alumno tenga que refrescar manualmente.

## Interfaz

El paso actual muestra:

- botón para abrir el módulo real;
- botón **Validar automáticamente**;
- resultado de cada comprobación;
- confirmación manual como alternativa explícita;
- registro de error y reapertura del paso;
- sincronización del resultado producido desde otra pestaña del ERP.

## Siguiente bloque

Queda pendiente adaptar el panel docente para consultar cronología, intentos, errores, mensajes automáticos y tiempo empleado por alumno o grupo, además de construir el caso integral de IT, sustitución, nómina y FIE.
