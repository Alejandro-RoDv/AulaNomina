# Split 29 - Progreso técnico

## Estado implementado

Se ha avanzado desde un módulo de Convenios informativo hacia una base de parametrización reutilizable por Nóminas.

### Backend

Implementado:

- Modelo Cabecera -> Detalle para reglas de convenio.
- Catálogo de conceptos de convenio.
- Conceptos salariales asociados al convenio y, opcionalmente, a categoría profesional.
- CRUD de reglas, detalles, catálogo y conceptos salariales.
- Actualización segura de opciones JSON de reglas: las opciones nuevas se fusionan con las existentes para no borrar campos futuros.
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
- Puente convenio -> conceptos permanentes del contrato:
  - `POST /contracts/{contract_id}/load-agreement-concepts`
  - resuelve conceptos globales y específicos por categoría,
  - utiliza la fila salarial asignada al contrato,
  - vincula automáticamente la fila salarial activa si falta,
  - actualiza el salario base solo si está vacío o se confirma su sobrescritura,
  - evita duplicar o sobrescribir conceptos permanentes activos,
  - reactiva conceptos de convenio previamente desactivados.

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
- Formularios rápidos de parametrización para:
  - opciones globales,
  - SMI/IPREM,
  - vacaciones,
  - pagas extra,
  - antigüedad,
  - complementos IT.
- Cliente API para parametrización por convenio.
- Cliente API para parametrización efectiva por contrato.
- Acción `Cargar desde convenio` en Conceptos permanentes:
  - confirmación independiente para sobrescribir o conservar salario base,
  - resumen de conceptos creados, reactivados y conservados,
  - observaciones sobre categoría y fila salarial,
  - columna de origen: Sistema, Convenio o Personalizado.

## Uso esperado en demo

1. Crear o cargar un convenio demo.
2. Entrar en Convenios.
3. Revisar la ficha `Cabecera ERP`.
4. Editar denominación oficial/interna, prórroga y alertas BOE si procede.
5. Pulsar `Parametrización`.
6. Pulsar `Cargar base`.
7. Revisar reglas y conceptos creados.
8. Editar los bloques rápidos: SMI/IPREM, pagas extra, vacaciones, antigüedad e IT.
9. Asociar un contrato al convenio y a una categoría profesional.
10. Entrar en `Conceptos permanentes` y seleccionar el contrato.
11. Pulsar `Cargar desde convenio`.
12. Revisar salario base, complementos creados, fila salarial vinculada y origen de cada concepto.
13. Preparar una nómina y cargar los conceptos permanentes del contrato.

## Pendiente

### UI profesional definitiva

La UI actual resuelve la demo técnica, pero debe migrarse a una pestaña React integrada dentro de `CollectiveAgreementsPage.jsx`:

- Pestaña `Parametrización`.
- Gestión de detalles de reglas.
- Alta de conceptos salariales por categoría.
- Pantallas completas para cotización, bases, pagas extra, vacaciones, antigüedad e IT.

### Motor de nómina

El convenio ya puede alimentar la estructura salarial permanente del contrato. Sigue pendiente que el motor de nómina consuma directamente las reglas avanzadas de parametrización para:

- prorrateo de pagas extra,
- vacaciones,
- antigüedad por vencimientos,
- complementos IT,
- tipos y bases de cotización.

El motor no debe tener lógica fija de convenio en código. Debe leer reglas y conceptos parametrizados.

### Bloques funcionales pendientes

- Coeficientes reductores.
- Bases de cotización por régimen/grupo.
- AT/EP y reglas por CNAE/ocupación.
- Pagas extra con conceptos participantes y fechas de devengo/pago.
- Vacaciones con valoración, medias y conceptos asociados.
- Antigüedad con vencimientos reales.
- Complementos IT con tramos, diagnósticos y límites.
- Contratación y período de prueba por categoría.
