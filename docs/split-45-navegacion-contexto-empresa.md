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
