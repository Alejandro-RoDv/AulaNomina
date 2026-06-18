# Split 29.2 — Robustez operativa de Convenios

## Objetivo

Cerrar los riesgos detectados tras la estabilización del Split 29.1 sin añadir nuevas reglas laborales.

## Cambios realizados

### Selección segura de convenio

- Las respuestas antiguas de la API se descartan mediante un identificador de petición.
- Un convenio recién creado puede quedar seleccionado aunque todavía no estuviera presente en el listado anterior.
- Al cambiar de convenio se desmonta la pantalla de Gestión y se reinician formularios, paneles abiertos, mensajes y selección de grupo.

### Errores visibles y reintento

- Los errores cargando el detalle se muestran en las tres vistas del módulo.
- Se añade una acción `Reintentar carga`.
- Gestión deja de confundir un fallo de API con la ausencia de convenio seleccionado.

### Recarga selectiva

- Crear, cargar demo, activar o caducar un convenio solicita únicamente `/collective-agreements`.
- `loadData("collective-agreements")` actualiza solo el listado de convenios.
- El resto de operaciones globales conserva la carga completa.
- Los fallos del refresco selectivo permanecen dentro de Convenios y no marcan otros módulos como erróneos.

### Errores de carga inicial

- Los fallos capturados durante la carga global ya invocan el callback `onLoadError`.
- La aplicación deja de limitarse a registrar esos fallos en consola y mostrar listas vacías sin explicación.

### Antigüedad bajo petición

- Al abrir Antigüedad solo se consultan las reglas configuradas.
- La vista previa de contratos no se calcula automáticamente.
- El usuario selecciona la fecha y pulsa `Calcular vencimientos`.
- Guardar o desactivar una regla invalida la vista previa anterior.

### Limpieza nominal

- `AgreementExtraPayPanelV2.jsx` se sustituye por `AgreementExtraPayPanel.jsx`.
- El workspace salarial utiliza exclusivamente el nombre canónico.

## Validación

El workflow debe ejecutar:

1. ESLint de hooks, workspaces y componentes modificados.
2. `npm run test:convenios`.
3. `npm run build`.

La regresión SSR comprueba además que Antigüedad muestra el cálculo manual antes de consultar contratos.

## Alcance

No se modifica backend, base de datos ni reglas de cálculo laboral.
