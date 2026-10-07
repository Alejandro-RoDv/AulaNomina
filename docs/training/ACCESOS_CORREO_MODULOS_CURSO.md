# Accesos desde las actividades

El botón de correo de una actividad abre su hilo mediante `mailThread`. La ruta prepara el mensaje y transmite el identificador al buzón, que lo selecciona automáticamente. Un hilo inexistente o inaccesible muestra un error, sin seleccionar otro mensaje.

La apertura de la pestaña ocurre directamente durante el clic. El desbloqueo del correo formativo se realiza en la pestaña de destino para evitar que una petición previa bloquee la ventana.

Los accesos de una actividad conservan empresa, trabajador, asignación y tarea. Las acciones de respuesta también transmiten el hilo de esa actividad. Los módulos Modelo 111, Modelo 190, CRA y SILTRA tienen destinos explícitos; CRA abre su pantalla de ficheros.

Validación: 29 pruebas de correo y navegación y 18 de actividades superadas; compilación de producción y lint con las reglas del workflow correctos. Comprobación en navegador con datos preparados: el enlace directo selecciona A04 sin pulsar el mensaje, el botón de A04 abre ese mismo hilo, el acceso ERP abre Trabajadores con la tarea del caso y un hilo inexistente muestra el error previsto.
