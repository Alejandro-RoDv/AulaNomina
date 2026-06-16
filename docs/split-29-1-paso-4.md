# Split 29.1 — Paso 4: criterios y antigüedad bajo demanda

## Estado

Implementado en `codex/split-29-1` y añadido al PR #14.

## Problema anterior

Al abrir Criterios laborales se montaban a la vez el panel general y Antigüedad. El panel de Antigüedad consultaba sus reglas y calculaba la vista previa de todos los contratos aunque el usuario solo quisiera revisar SMI, pagas, atrasos, contratación, período de prueba o IT.

## Solución

Se ha creado `AgreementCriteriaWorkspace.jsx` con dos subpestañas:

1. Criterios generales.
2. Antigüedad y vencimientos.

Ambos paneles se importan mediante `React.lazy` y solo se monta el apartado abierto.

## Comportamiento

- Al entrar en Criterios solo se monta el panel general.
- Antigüedad no realiza peticiones mientras su pestaña permanezca cerrada.
- Las reglas y la vista previa de contratos se consultan al abrir Antigüedad.
- La tarjeta Abrir antigüedad cambia directamente a esa subpestaña.
- La tarjeta Vacaciones continúa navegando a Gestión > Jornada y permisos.
- Al cambiar de convenio, el workspace vuelve a Criterios generales.

## Archivos

- `frontend/src/components/agreements/AgreementCriteriaWorkspace.jsx`
- `frontend/src/pages/CollectiveAgreementsWorkspacePageV2.jsx`
- `.github/workflows/frontend-checks.yml`

## Regresión pendiente

- Entrar en Criterios y comprobar que no se consulta la vista previa de antigüedad.
- Abrir Antigüedad desde la subpestaña y desde la tarjeta del índice.
- Volver a Criterios generales.
- Abrir Vacaciones y comprobar la navegación a Jornada y permisos.
- Cambiar de convenio y verificar que el apartado se reinicia.
- Revisar consola y Network.
