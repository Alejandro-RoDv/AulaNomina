# Split 29.1 — Cierre posterior al merge

## Objetivo

Eliminar nombres temporales de la estabilización y reducir el código incluido en la carga inicial de AulaNomina.

## Cambios

- `CollectiveAgreementsWorkspacePageV2.jsx` pasa a `CollectiveAgreementsWorkspacePage.jsx`.
- `CollectiveAgreementsManagementPageV3.jsx` pasa a `CollectiveAgreementsManagementPage.jsx`.
- El punto de entrada del módulo pasa a `CollectiveAgreementsPage.jsx`.
- Las pruebas SSR utilizan los nombres canónicos.
- El workflow de frontend valida las rutas canónicas.
- Los archivos con sufijos `V2` y `V3` se eliminan.

## Carga diferida del módulo

`CollectiveAgreementsPage.jsx` utiliza `React.lazy` y `Suspense` para cargar el workspace completo únicamente cuando el usuario entra en Convenios.

Esto evita incorporar en el bundle inicial:

- Gestión del convenio.
- Estructura salarial.
- Criterios laborales.
- Componentes de revisión, atrasos, pagas y antigüedad.

Los paneles internos mantienen además su propia carga bajo demanda.

## Validación

El PR debe superar:

1. ESLint de los archivos de Convenios.
2. Regresión SSR con `npm run test:convenios`.
3. Build completo con `npm run build`.

No se modifica backend, base de datos ni funcionalidad laboral.
