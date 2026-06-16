# Split 29.1 — Paso 3: carga bajo demanda de Estructura salarial

## Estado

Implementado en la rama `codex/split-29-1` y añadido al PR #14.

## Problema anterior

Al abrir Estructura salarial se montaban al mismo tiempo:

- revisión de tablas;
- activación y migración de contratos;
- regularizaciones retroactivas;
- configuración de pagas extraordinarias;
- simulación de pagas por contrato;
- conceptos salariales.

Aunque algunos bloques aplazaban sus peticiones hasta abrir un panel interno, React creaba todos sus estados, efectos y árboles de componentes desde el primer render.

## Solución aplicada

Se ha creado `AgreementSalaryWorkspace.jsx` con seis subpestañas:

1. Conceptos.
2. Revisión.
3. Activación y contratos.
4. Atrasos.
5. Pagas extra.
6. Cálculo por contrato.

Solo se renderiza una subpestaña cada vez.

Además, los seis paneles se importan mediante `React.lazy`. Esto permite que Vite genere fragmentos independientes y que el navegador descargue el código del proceso únicamente cuando el usuario lo abre.

## Comportamiento

- La vista inicial abre Conceptos salariales.
- Cambiar de proceso desmonta el anterior y libera su estado local.
- Cambiar de convenio conserva el proceso seleccionado, pero crea una instancia limpia para el nuevo convenio.
- Los procesos que necesitan una tabla muestran una indicación si todavía no existe ninguna.
- Atrasos exige al menos dos tablas para poder comparar ejercicios.
- Las operaciones que modifican el convenio siguen refrescando solo su detalle.

## Resultado esperado

- Menos componentes montados simultáneamente.
- Menos efectos React activos.
- Ninguna petición de contratos al entrar en Estructura salarial.
- Ninguna petición de pagas extraordinarias hasta abrir Pagas extra o Cálculo por contrato.
- Ninguna consulta de activación hasta solicitar su vista previa.
- Ningún cálculo de atrasos hasta abrir el proceso y pulsar Vista previa.
- Bundle principal más pequeño gracias a la división automática de código de Vite.

## Archivos

- `frontend/src/components/agreements/AgreementSalaryWorkspace.jsx`
- `frontend/src/pages/CollectiveAgreementsWorkspacePageV2.jsx`
- `.github/workflows/frontend-checks.yml`

## Regresión manual pendiente

- Abrir cada una de las seis subpestañas.
- Confirmar que solo aparece un proceso cada vez.
- Cambiar de convenio dentro de cada proceso.
- Crear un concepto salarial.
- Crear una revisión de tabla.
- Abrir la vista previa de activación.
- Abrir la vista previa de atrasos.
- Crear o editar una paga extraordinaria.
- Abrir el cálculo por contrato.
- Revisar consola y pestaña Network.
