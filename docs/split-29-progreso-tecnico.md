# Split 29 - Progreso técnico

## Estado implementado

Se ha avanzado desde un módulo de Convenios informativo hacia una base de parametrización reutilizable por Nóminas.

### Backend

Implementado:

- Modelo Cabecera -> Detalle para reglas de convenio.
- Catálogo de conceptos de convenio.
- Conceptos salariales asociados al convenio y, opcionalmente, a categoría profesional.
- CRUD de reglas, detalles, catálogo y conceptos salariales.
- Cabecera ERP ampliada de convenio:
  - denominación oficial,
  - denominación interna,
  - convenio prorrogable,
  - alertas BOE preparadas,
  - términos de búsqueda BOE.
- Endpoint de cabecera ampliada:
  - `GET /collective-agreements/{agreement_id}/header`
  - `PUT /collective-agreements/{agreement_id}/header`
- Endpoint de parametrización por convenio:
  - `GET /collective-agreements/{agreement_id}/parameterization`
  - `POST /collective-agreements/{agreement_id}/parameterization/seed`
- Endpoint de parametrización efectiva por contrato:
  - `GET /contracts/{contract_id}/agreement-parameterization`

### Base de datos

Implementado:

- Parche conservador de arranque para añadir columnas nuevas a `collective_agreements` si la tabla ya existía.
- Backfill del convenio demo `SIM-ADM-2026` con cabecera ERP inicial.

### Semilla base

La semilla de parametrización crea una base inicial con:

- Salario base.
- Complemento convenio.
- Paga extraordinaria.
- Antigüedad.
- Vacaciones.
- Dietas.
- IRPF.
- Contingencias comunes.
- Opciones globales.
- Criterios generales.
- SMI/IPREM.
- Tipos de cotización.
- Vacaciones.
- Pagas extra.
- Complementos IT.

### Frontend

Implementado:

- Ficha `Cabecera ERP` en la pantalla de Convenios.
- Edición rápida de denominación oficial, denominación interna, prórroga, alertas BOE, términos BOE y URL fuente.
- Botón `Parametrización` en la pantalla de Convenios.
- Modal de consulta de reglas, catálogo y conceptos salariales.
- Acción `Cargar base` desde el modal.
- Edición rápida para crear reglas y conceptos de catálogo.
- Cliente API para parametrización por convenio.
- Cliente API para parametrización efectiva por contrato.

## Uso esperado en demo

1. Crear o cargar un convenio demo.
2. Entrar en Convenios.
3. Revisar la ficha `Cabecera ERP`.
4. Editar denominación oficial/interna, prórroga y alertas BOE si procede.
5. Pulsar `Parametrización`.
6. Pulsar `Cargar base`.
7. Revisar reglas y conceptos creados.
8. Crear reglas o conceptos adicionales con edición rápida.
9. Asociar un contrato a ese convenio.
10. Consultar la parametrización aplicable al contrato mediante el endpoint de contrato.

## Pendiente

### UI profesional definitiva

La UI actual resuelve la demo técnica, pero debe migrarse a una pestaña React integrada dentro de `CollectiveAgreementsPage.jsx`:

- Pestaña `Parametrización`.
- Formularios por bloque: SMI/IPREM, cotización, vacaciones, pagas extra, antigüedad, IT.
- Gestión de detalles de reglas.
- Alta de conceptos salariales por categoría.

### Motor de nómina

Pendiente consumir `GET /contracts/{contract_id}/agreement-parameterization` desde el cálculo de nómina simulada.

El motor no debe tener lógica fija de convenio en código. Debe leer reglas y conceptos parametrizados y aplicar, como mínimo, las reglas globales de pagas extra, vacaciones, antigüedad y tipos de cotización.

### Bloques funcionales pendientes

- Coeficientes reductores.
- Bases de cotización por régimen/grupo.
- AT/EP y reglas por CNAE/ocupación.
- Pagas extra con conceptos participantes y fechas de devengo/pago.
- Vacaciones con valoración, medias y conceptos asociados.
- Antigüedad con vencimientos reales.
- Complementos IT con tramos, diagnósticos y límites.
- Contratación y período de prueba por categoría.
