# Split 29 - Progreso técnico

## Estado implementado

Se ha avanzado desde un módulo de Convenios informativo hacia una base de parametrización reutilizable por Nóminas.

### Backend

Implementado:

- Modelo Cabecera -> Detalle para reglas de convenio.
- Catálogo de conceptos de convenio.
- Conceptos salariales asociados al convenio y, opcionalmente, a categoría profesional.
- CRUD de reglas, detalles, catálogo y conceptos salariales.
- Endpoint de parametrización por convenio:
  - `GET /collective-agreements/{agreement_id}/parameterization`
  - `POST /collective-agreements/{agreement_id}/parameterization/seed`
- Endpoint de parametrización efectiva por contrato:
  - `GET /contracts/{contract_id}/agreement-parameterization`

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

- Botón `Parametrización` en la pantalla de Convenios.
- Modal de consulta de reglas, catálogo y conceptos salariales.
- Acción `Cargar base` desde el modal.
- Edición rápida para crear reglas y conceptos de catálogo.
- Cliente API para parametrización por convenio.
- Cliente API para parametrización efectiva por contrato.

## Uso esperado en demo

1. Crear o cargar un convenio demo.
2. Entrar en Convenios.
3. Pulsar `Parametrización`.
4. Pulsar `Cargar base`.
5. Revisar reglas y conceptos creados.
6. Crear reglas o conceptos adicionales con edición rápida.
7. Asociar un contrato a ese convenio.
8. Consultar la parametrización aplicable al contrato mediante el endpoint de contrato.

## Pendiente

### UI profesional definitiva

La UI actual resuelve la demo técnica, pero debe migrarse a una pestaña React integrada dentro de `CollectiveAgreementsPage.jsx`:

- Pestaña `Parametrización`.
- Formularios por bloque: SMI/IPREM, cotización, vacaciones, pagas extra, antigüedad, IT.
- Gestión de detalles de reglas.
- Alta de conceptos salariales por categoría.

### Cabecera ampliada de convenio

Pendiente añadir campos específicos:

- Denominación oficial.
- Denominación interna.
- Convenio prorrogable.
- Alertas BOE preparadas.
- Términos de búsqueda BOE.

### Motor de nómina

Pendiente consumir `GET /contracts/{contract_id}/agreement-parameterization` desde el cálculo de nómina simulada.

El motor no debe tener lógica fija de convenio en código. Debe leer reglas y conceptos parametrizados y aplicar, como mínimo, las reglas globales de pagas extra, vacaciones, antigüedad y tipos de cotización.
