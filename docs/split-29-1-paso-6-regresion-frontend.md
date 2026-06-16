# Split 29.1 — Paso 6: regresión automatizada del frontend

## Estado

Implementado en `codex/split-29-1` y añadido al PR #14.

## Objetivo

Añadir una protección automática mínima antes de eliminar las versiones antiguas del módulo Convenios.

El frontend no disponía de framework de pruebas ni de un script `test`. Para evitar incorporar dependencias nuevas y modificar el lockfile, las pruebas utilizan las herramientas ya instaladas:

- Vite para transformar y cargar JSX en modo SSR.
- `react-dom/server` para renderizar los componentes reales.
- `node:assert/strict` para las comprobaciones.

## Ejecución

Comando local:

```bash
cd frontend
npm run test:convenios
```

También se ha añadido:

```bash
npm test
```

## Cobertura actual

### Gestión del convenio

Se renderiza `CollectiveAgreementsManagementPageV3.jsx` con un convenio completo de prueba y se comprueban las cinco pestañas:

1. Resumen.
2. Clasificación profesional.
3. Tablas salariales.
4. Jornada, vacaciones y permisos.
5. Antigüedad histórica.

Cada prueba verifica que la pestaña contiene sus textos y datos representativos.

### Workspaces

- Estructura salarial: verifica las seis subpestañas y el aviso cuando no existen tablas salariales.
- Criterios laborales: verifica Criterios generales, Antigüedad y el estado de carga diferida.

### Utilidades

- Formato de fechas.
- Formato monetario.
- Estado del convenio.
- Limpieza de payloads antes de enviarlos a la API.

## Integración continua

El workflow `Frontend checks` ejecuta ahora:

1. `npm ci`.
2. ESLint sobre los archivos del Split 29.1.
3. `npm run test:convenios`.
4. `npm run build`.

Una regresión de renderizado, una expectativa incorrecta o un error de compilación bloquea el workflow.

## Archivos

- `frontend/scripts/run-convenios-tests.mjs`
- `frontend/src/tests/convenios-smoke.jsx`
- `frontend/package.json`
- `.github/workflows/frontend-checks.yml`

## Limitaciones

Estas pruebas son de humo mediante SSR. Protegen frente a:

- imports rotos;
- JSX inválido;
- props incompatibles;
- componentes que no pueden renderizar;
- desaparición accidental de apartados clave;
- regresiones en utilidades compartidas.

No sustituyen las pruebas de navegador para:

- clics reales;
- formularios controlados;
- peticiones HTTP;
- confirmaciones de borrado;
- estados de carga en cliente;
- medición de peticiones en Network.

## Siguiente paso

Ejecutar la regresión manual completa en navegador. Si el flujo es correcto, eliminar los componentes V2 y actualizar las referencias/documentación para cerrar el Split 29.1.
