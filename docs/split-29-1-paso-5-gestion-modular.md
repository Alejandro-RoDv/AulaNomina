# Split 29.1 — Paso 5: gestión modular del convenio

## Estado

Implementado en `codex/split-29-1` y añadido al PR #14.

## Problema anterior

`CollectiveAgreementsManagementPageV2.jsx` concentraba en un único archivo:

- selección del convenio;
- cabecera y navegación;
- modal de creación;
- estado de ocho formularios;
- operaciones CRUD;
- pestaña Resumen;
- Clasificación profesional;
- Tablas salariales;
- Jornada, vacaciones y permisos;
- histórico de antigüedad;
- tablas, formularios y estilos reutilizables.

Esto dificultaba localizar regresiones y obligaba a modificar un componente muy amplio para cualquier ajuste visual.

## Solución aplicada

Se ha creado `CollectiveAgreementsManagementPageV3.jsx` como contenedor de coordinación. Mantiene únicamente:

- estado compartido de formularios;
- llamadas a la API;
- mensajes y errores;
- selección de pestaña;
- composición de los componentes funcionales.

La interfaz se ha distribuido en componentes especializados:

- `AgreementOverviewTab.jsx`
- `AgreementClassificationTab.jsx`
- `AgreementSalaryTablesTab.jsx`
- `AgreementRulesTab.jsx`
- `AgreementSeniorityHistoryTab.jsx`
- `AgreementManagementShell.jsx`
- `ManagementUi.jsx`
- `managementConfig.js`

## Responsabilidades

### Contenedor V3

- Ejecuta altas, modificaciones y eliminaciones.
- Decide qué pestaña está visible.
- Actualiza únicamente el convenio afectado.
- Distribuye datos y callbacks a cada pestaña.

### Componentes de pestaña

- Renderizan exclusivamente su área funcional.
- Mantienen los formularios visuales y tablas de su apartado.
- No conocen la API ni realizan recargas globales.

### Shell y UI compartida

- Cabecera, selector, estado y acciones del convenio.
- Navegación entre pestañas.
- Modal de creación.
- Tablas, secciones, campos, botones y estilos comunes.

## Compatibilidad

- La funcionalidad y los endpoints se mantienen.
- `CollectiveAgreementsManagementPageV2.jsx` se conserva temporalmente como respaldo.
- El workspace utiliza ya la versión V3.
- No se modifica backend ni base de datos.

## Resultado esperado

- Menor complejidad por archivo.
- Cambios visuales aislados por pestaña.
- Menor riesgo de romper áreas no relacionadas.
- Componentes reutilizables y fáciles de probar.
- Preparación para añadir pruebas de renderizado por pestaña.

## Regresión pendiente

- Abrir las cinco pestañas de Gestión.
- Crear, editar y eliminar un grupo y una categoría.
- Crear, editar y eliminar una tabla y una fila salarial.
- Crear, editar y eliminar jornada, vacaciones y permisos.
- Editar una fila desde la pestaña Antigüedad.
- Crear un convenio desde el modal.
- Activar y caducar un convenio.
- Revisar consola y Network.
