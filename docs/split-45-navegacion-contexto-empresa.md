# Split 45 — Navegación, dashboards y empresa de trabajo

## Cambios

- Selector de empresa en la cabecera, con búsqueda por nombre o CIF y opción «Todas las empresas». La selección se conserva durante la sesión de la pestaña y se limpia al iniciar/cerrar sesión.
- Formularios, listados, informes y dashboards comparten la empresa elegida. Cambiar de empresa limpia las selecciones dependientes de trabajador, contrato y centro para evitar mezclar registros. La ficha de empresa conserva su confirmación de cambios sin guardar.
- Dashboards de empresas/centros, personas, contratación, gestión laboral, nómina, documentación y fiscalidad con indicadores y gráficas de los datos disponibles. Seguridad Social conserva su dashboard existente.
- Navegación superior compartida con accesos a los submódulos y a «Resumen». Organización conserva su apertura del menú; «Empresas / centros» abre su dashboard.
- Sesión y rol situados al pie del menú lateral; el control de cuenta autenticada queda en la esquina inferior.
- Botones de datos ficticios para empresas, centros, trabajadores y contratos. Las empresas ofrecen centro educativo privado, servicios, comercio y ETT; cada nueva pulsación cambia los ejemplos. Se retira el preset de fundación.
- Los generadores rellenan campos sin guardar automáticamente. Trabajadores requieren una empresa con centro; contratos usan trabajadores de esa empresa con centro válido y sin contrato activo/borrador. Los ejemplos alternan contrato indefinido completo/parcial con jornada y datos de alta coherentes.
- Eliminados los botones redundantes «Abrir Modelo 190» y «Abrir Modelo 111» de Informes. Los módulos fiscales siguen accesibles desde su navegación.

El contexto de empresa es un filtro de interfaz. Los permisos siguen correspondiendo al backend. No se incorporan dependencias de producción ni migraciones. SILTRA queda para el split 47.

## Validación realizada

- `cd frontend && npm test`: 106 pruebas de Node y smoke de convenios correctos, incluidas cinco pruebas nuevas de generadores, relaciones entre registros y selección de empresa.
- `npm run build`: correcto; persiste el aviso de tamaño del bundle.
- `npm run design-system:audit`: estructura correcta; informa de deuda de estilos existente.
- `git diff --check`: correcto.
- Comparación ESLint de los archivos JS/JSX modificados y nuevos respecto a la base: ningún aumento de errores por regla/archivo; 43 errores anteriores frente a 35 actuales. El lint global no constituye una validación verde.
- Recorrido en Chromium con frontend Vite y API real local: crear empresa, centro, trabajador y contrato con alta SS mediante los botones; abrir preparación mensual con la empresa conservada; navegar por documentos/informes; cambiar entre dos empresas con limpieza de campos dependientes; sincronizar selector local y global; buscar sin resultados; comprobar el ámbito del documento HTML de informes.

La prueba de navegador utilizó una base SQLite aislada creada desde los modelos actuales y arrancó la API sin las migraciones de inicio específicas de PostgreSQL. Verifica los flujos de aplicación, no las migraciones ni un despliegue de producción. No se calculó una nómina en este recorrido.

## Comprobación manual

1. Abrir Organización → Empresas / centros y entrar en Nueva empresa desde la barra superior. Pulsar dos veces cada preset y comprobar el cambio de datos antes de guardar.
2. Guardar una empresa, crear su centro con datos de prueba y crear un trabajador. Comprobar la empresa preseleccionada.
3. Abrir Contratación → Nuevo contrato, rellenar el ejemplo y guardar contrato + alta SS. Abrir Nómina → Preparación mensual y comprobar el ámbito.
4. Crear una segunda empresa con centro y trabajador. Cambiar de empresa en la cabecera con un formulario abierto y comprobar que se eliminan trabajador/contrato/centro incompatibles.
5. Abrir los módulos desde el lateral y recorrer sus submódulos desde la barra superior. Comprobar indicadores para una empresa y para «Todas las empresas».
6. Abrir Documentación → Informes, comprobar los accesos fiscales retirados y cambiar de empresa: tanto los listados como el trabajador del documento HTML deben seguir el nuevo ámbito.

## Retoques posteriores

- Selector de empresa más visible con acento de marca y foco azul, siguiendo los tokens del diseño.
- Plantillas de informes con columnas de empresa, trabajador, contrato, nóminas, incidencias y documentación; guardar, cargar, editar, eliminar, previsualizar y exportar CSV. Una fila por trabajador; nóminas/incidencias agregadas del periodo filtrado y contrato activo o más reciente. Persistencia local por usuario en el navegador actual; no sincroniza entre equipos.
- Dos ejemplos estatales adicionales: Consultoría/TI y Contact Center. Se cargan desde «Cargar demo» en Convenios; contienen enlace BOE y clasificación/tablas salariales ficticias claramente identificadas. El seed no sobrescribe estos ejemplos si ya existen.
- Servicios antes que educación; mutuas variables, IBAN con checksum, representante, pólizas, web, formación y contacto ampliados.
- Separación adicional de la barra de crear empresa respecto a IBAN y régimen fiscal.

Validación de retoques: suite frontend completa (108 pruebas Node y smoke de convenios), compilación, pruebas de agregación sin cruces entre empresas y checksum IBAN, seed SQLite ejecutado dos veces sin duplicados, navegador con guardar/recargar/editar/eliminar plantilla y vista previa. No se validaron migraciones PostgreSQL ni sincronización entre navegadores.

## Rework de Retribución

Nuevo contrato usa ahora tres bloques: convenio/clasificación, salario base/pagas y complementos fijos. La referencia salarial muestra solo bases mensuales de la categoría elegida. El catálogo de complementos tiene búsqueda, selección explícita, origen e importe editable; evita duplicados y omite los conceptos de incidencias, atrasos, extras, indemnizaciones y salario base. Se mantienen conceptos manuales.

Los importes de referencia son mensuales a jornada completa. El resumen aplica la jornada del contrato y muestra base, complementos, prorrata, mensualidad y anual. Prorratear redistribuye el anual en 12 mensualidades, sin reducirlo. El anual es una estimación con dos extras ordinarias; las reglas particulares de convenio se resuelven en nómina. Los ejemplos de contrato se ajustan a la nueva indicación explícita del salario de referencia.

Verificado con tres pruebas adicionales de cálculo/filtro, suite frontend completa (114 pruebas Node más smoke de convenios), build, lint de los nuevos módulos y Chromium con complemento manual, eliminación, cambio de pagas y guardado del anual en un contrato parcial con alta SS. Persisten los errores anteriores de lint del formulario contenedor.

## Contratos, incidencias y embargos

- Guardar de nuevo el borrador tras el guardado muestra «Borrador ya guardado». Se bloquean envíos simultáneos y se validan trabajador, tipo y fecha inicial con mensajes en español.
- Historial contratos contiene la tabla. Datos y gestión del contrato y Bajas y finiquitos tienen accesos separados; los enlaces desde casos prácticos apuntan al apartado correspondiente.
- Los motivos de baja muestran sus códigos del catálogo RED; la selección del modal de baja se conserva en contrato/SS. La liquidación final muestra los códigos de las seis causas parametrizadas.
- IT, absentismo, vacaciones y horas extra usan formularios breves con observaciones, sin campos auxiliares ni autorización de solapamiento. Los conflictos siguen requiriendo corregir las fechas o las incidencias existentes.
- Horas extra: cantidad, horas/días, horas por día, cálculo automático o importe total manual y compensación con pago/descanso. El total se guarda como configuración del precio por hora, nunca como importe de una nómina procesada. Se admiten totales superiores a 24 horas y se registra cada mes por separado. El cálculo definitivo mantiene la regla existente del valor mínimo de hora ordinaria; la vista muestra una estimación.
- Histórico de variaciones sustituye al registro manual de cambios del trabajador. Cada edición real del contrato guarda antes/después en la tabla de eventos existente y permite consultar la versión anterior completa. Guardar sin cambios no genera eventos. Los registros anteriores a este cambio no disponen de versiones retroactivas.
- Embargos dispone del conjunto completo de trabajadores/contratos para que su contexto de empresa sea independiente de la cabecera. Calculadora actualizada con bordes suaves, fondos claros y acciones azules; las fórmulas se conservan.

Validación: 119 pruebas Node más smoke de convenios; 15 pruebas backend (histórico contractual, ciclo de incidencias y puente de nómina); build y lint de componentes/helpers nuevos. Navegador con API SQLite: tres pulsaciones de borrador crean un único contrato, vistas de contratación independientes, horas extra manuales guardadas, versión anterior consultable, empresa distinta en embargos y calculadora integrada. El entorno SQLite no tenía SMI sembrado: se verificó la presentación de la calculadora, y la aritmética con sus cinco pruebas existentes. No se ha probado PostgreSQL ni despliegue de producción; persiste el aviso previo de tamaño del bundle.

## Recálculo de nóminas y carga del histórico

El histórico consulta la API al abrirse y al cambiar de empresa, descarta respuestas antiguas y actualiza la lista tras editar, eliminar, regularizar o recalcular. La generación también actualiza los datos compartidos de la aplicación.

Preparación mensual incorpora «Recalcular y generar», guarda los cambios pendientes y actualiza la nómina del mismo contrato/periodo. «Quitar» excluye el concepto con un ajuste a cero, conservando su valor original para restablecerlo. La reapertura conserva las filas nuevas y evita peticiones simultáneas de reapertura. El histórico ofrece «Recalcular» por nómina y el listado de generación permite seleccionar las ya generadas.

La API acepta `recalculate_existing` de forma explícita; conserva la prevención de duplicados para otros clientes. Los cambios de conceptos devuelven la nómina a borrador. El recálculo mantiene los ajustes manuales de cotizaciones/bases/deducciones y las exclusiones, incrementa la versión de cálculo y conserva el ID. También permite actualizar conceptos guardados en pagas extra existentes y nóminas históricas cuyo contrato ya ha terminado.

Validación: 119 pruebas Node más smoke de convenios, 15 pruebas backend (preparación, paga extra, puente de incidencias y prorrata), build y recorrido Chromium con API real SQLite: editar salario, generar, añadir concepto a nómina generada, volver a generar, excluir concepto, recalcular desde histórico, regenerar desde listado y entrar varias veces al histórico sin actualizar manualmente. Lint limpio en Histórico, tabla y preparación V4; persisten dos errores previos de efectos en la página de generación. No se ha probado despliegue PostgreSQL.

### Selector de empresa en Seguridad Social, Fiscalidad y Documentación

El selector compartido utiliza azul claro para el botón, el borde, el desplegable y la selección activa. La cabecera deja margen vertical y se adapta en móvil. CRA, FIE, Documentos, Informes y Trabajadores toman la altura real de la barra superior mediante ResizeObserver, evitando que sus paneles fijos recorten el selector. Los paneles conservan su cabecera propia y quedan debajo de la barra superior.

Validación: compilación frontend y comprobación en navegador de Seguros sociales, Liquidaciones, Ficheros generados, CRA, Comunicaciones FIE, Fiscalidad, Documentación y selector móvil, incluidos apertura, selección activa y cierre con Escape.

### Generación masiva por empresas

Generar nóminas permite elegir una empresa, un grupo de empresas marcado mediante casillas o todas las empresas activas. Recibe los contratos y trabajadores completos en lugar de los filtrados por la empresa global. La empresa de la cabecera sirve como selección inicial; los cambios en el ámbito de generación son independientes. Se seleccionan los contratos activos y se pueden excluir trabajadores antes de generar. El envío incluye company_ids y contract_ids explícitos, y mantiene recalculate_existing para actualizar el mismo registro sin duplicarlo. El resultado muestra resumen por empresa y empresa de cada trabajador, con los motivos de omisión. Los controles se bloquean durante el envío. Se conserva la selección para poder repetir la generación.

Validación: build, lint de PayrollSimulationPage, 13 pruebas test:split45 y navegador con tres empresas activas y una inactiva: generación de una empresa distinta de la global, grupo de dos empresas, todas las activas, exclusión de trabajadores y recálculo conservando los mismos IDs.

### Desplegables de la navegación lateral

Todos los grupos navegan a su resumen al abrirse y se repliegan al pulsarlos de nuevo, sin una segunda navegación que los reabra. En la primera apertura se expanden todos los submenús del grupo. Los submenús funcionan de forma independiente y sus preferencias se conservan en localStorage; las preferencias antiguas de un único submenú se convierten a listas. Abrir un enlace revela su submenú sin cerrar los hermanos. El texto y la flecha de cada submenú permiten abrirlo y cerrarlo. En móvil, expandir grupos y submenús mantiene el panel de navegación abierto.

Validación: build, lint de Sidebar y utilidades, 17 pruebas test:split45, y navegador con apertura/cierre de los ocho grupos, primera expansión de todos los submenús, alternancia independiente de Afiliación/Cotización/Comunicaciones, persistencia tras recarga y controles móviles.

### Datos ficticios y claridad de los casos

El caso de alta A04 utiliza Daniel Ortega Vidal, con los dos apellidos separados y datos completos ficticios (identificadores con control, contacto y domicilio). El correo y los datos de la actividad utilizan la misma ficha. Los casos y correos relacionados identifican a Ana Martín García, Laura Sánchez Romero, Clara Benítez Mora, Lucía Prieto Solís y Javier Romero Sánchez por su nombre completo. Los correos conservan los saltos de línea y separan los datos de referencia de las instrucciones; las respuestas y borradores del alumno se conservan.

Los generadores de empresas, centros y personas usan nombres neutros y 18 localidades de distintas zonas de España. Ciudad/provincia/código postal y prefijos telefónicos y de cotización son coherentes; representantes y contactos incluyen dos apellidos. No se modifican empresas o trabajadores creados por el usuario.

Validación: 18 pruebas Node de split45, tres pruebas backend específicas, 20 comprobaciones del correo y del runtime formativo existente, build y lint del generador; navegador con el correo de alta A04 y campos legibles en líneas separadas.
