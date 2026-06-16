# Split 29.1 — Paso 2: estado y navegación de Convenios

## Estado

Implementado en la rama `codex/split-29-1`.

## Cambios realizados

- Un único estado controla el convenio seleccionado para Gestión, Estructura salarial y Criterios laborales.
- El detalle del convenio se carga desde `useAgreementWorkspace`.
- La pantalla de Gestión deja de ejecutar su propia petición del detalle.
- Las pestañas internas de Gestión están controladas por el workspace.
- La navegación hacia Jornada y permisos se realiza mediante estado React.
- La navegación hacia Antigüedad utiliza una referencia React estable y deja de buscar encabezados por texto.
- Se elimina el uso de `document.querySelectorAll()` y de clics simulados para navegar.
- Crear, editar o eliminar grupos, categorías, tablas, filas, jornadas, vacaciones y permisos recarga únicamente el convenio afectado.
- Crear un convenio, cargar la demo, activar o caducar conserva temporalmente la actualización del listado global, porque estas operaciones modifican la colección visible para otros módulos.

## Archivos

- `frontend/src/hooks/useAgreementWorkspace.js`
- `frontend/src/pages/CollectiveAgreementsWorkspacePageV2.jsx`
- `frontend/src/pages/CollectiveAgreementsManagementPageV2.jsx`
- `frontend/src/pages/CollectiveAgreementsPage.js`

Los archivos anteriores se mantienen en el repositorio como respaldo durante la estabilización.

## Resultado técnico esperado

### Antes

Una operación CRUD interna podía ejecutar:

1. actualización del elemento;
2. `onDataChanged()`;
3. recarga global de contratos, trabajadores, empresas, centros, incidencias, nóminas, documentos y convenios;
4. nueva carga del detalle del convenio.

### Después

Una operación CRUD interna ejecuta:

1. actualización del elemento;
2. una única recarga del detalle del convenio seleccionado.

## Pendiente de validación

- Ejecutar `npm run lint`.
- Ejecutar `npm run build`.
- Comprobar manualmente la selección al cambiar entre las tres vistas.
- Confirmar que los formularios conservan la pestaña activa después de guardar.
- Medir peticiones antes y después desde la pestaña Network.

## Siguiente paso

Separar la vista Estructura salarial en pestañas o paneles cargados bajo demanda. Actualmente siguen montándose simultáneamente revisión, activación, regularizaciones, pagas, simulación y estructura salarial.
