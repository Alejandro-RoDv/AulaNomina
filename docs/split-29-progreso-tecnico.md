# Split 29 - Progreso técnico

## Estado implementado

Se ha avanzado desde un módulo de Convenios informativo hacia una base de parametrización reutilizable por contratos y nóminas.

## Backend

Implementado:

- Modelo Cabecera -> Detalle para reglas internas de convenio.
- Catálogo de conceptos de convenio.
- Conceptos salariales asociados al convenio y, opcionalmente, a categoría profesional.
- CRUD de reglas, detalles, catálogo y conceptos salariales.
- Actualización segura de opciones JSON: las opciones nuevas se fusionan con las existentes.
- Valores mínimo y máximo en los detalles para representar:
  - tramos de IT,
  - duración contractual,
  - período de prueba,
  - límites y rangos futuros.
- Cabecera ERP ampliada de convenio:
  - denominación oficial,
  - denominación interna,
  - convenio prorrogable,
  - alertas BOE preparadas,
  - términos de búsqueda BOE.
- Endpoint de cabecera ampliada:
  - `GET /collective-agreements/{agreement_id}/header`
  - `PUT /collective-agreements/{agreement_id}/header`
- Endpoint interno de parametrización:
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

## Base de datos

Implementado:

- Parche conservador de arranque para añadir columnas nuevas a `collective_agreements`.
- Parche para añadir `minimum_value` y `maximum_value` a `agreement_rule_details` en bases existentes.
- Backfill del convenio demo `SIM-ADM-2026` con cabecera ERP inicial.

## Semilla base

La preparación inicial crea referencias para:

- salario base,
- complemento convenio,
- paga extraordinaria,
- antigüedad,
- vacaciones,
- dietas,
- IRPF,
- contingencias comunes,
- SMI/IPREM,
- tipos de cotización,
- complementos IT.

La estructura técnica permanece oculta para el usuario.

## Frontend

### Enfoque corregido

Se ha retirado la antigua interfaz técnica basada en:

- modal `Parametrización`,
- códigos internos,
- tipos de regla,
- edición de JSON,
- widgets inyectados directamente en el DOM.

Los cuatro widgets antiguos han sido eliminados del repositorio y ya no existen referencias a ellos.

### Workspace React de Convenios

La entrada del módulo dispone ahora de dos vistas React:

1. `Gestión del convenio`
   - conserva el módulo existente,
   - resumen,
   - clasificación,
   - tablas salariales,
   - jornada y permisos,
   - antigüedad.

2. `Criterios laborales`
   - selector de convenio,
   - resumen administrativo,
   - índice por materias laborales,
   - formularios y tablas comprensibles para el usuario.

### Bloques laborales disponibles

- SMI e IPREM:
  - ejercicio,
  - SMI diario y mensual,
  - IPREM diario y mensual.
- Pagas extraordinarias:
  - denominación,
  - períodos de devengo,
  - fecha de pago,
  - posibilidad de prorrateo,
  - cotización,
  - devengo durante IT,
  - código CRA.
- Atrasos:
  - aplicabilidad,
  - período revisable,
  - base de cálculo,
  - regularización de cotización,
  - observaciones.
- Contratación:
  - modalidad o supuesto,
  - categoría aplicable,
  - duración máxima,
  - número máximo de prórrogas,
  - observaciones,
  - crear, editar y eliminar.
- Período de prueba:
  - categoría profesional,
  - duración máxima,
  - unidad en días o meses,
  - observaciones,
  - crear, editar y eliminar.
- Complementos de IT:
  - día inicial y final,
  - contingencia,
  - porcentaje complementado,
  - base de referencia,
  - límite máximo,
  - observaciones,
  - crear, editar y eliminar.
- Accesos directos a las secciones existentes de:
  - antigüedad,
  - vacaciones.

### Conceptos permanentes

Implementado:

- Acción `Cargar desde convenio`.
- Confirmación para sobrescribir o conservar salario base.
- Resumen de conceptos creados, reactivados y conservados.
- Observaciones sobre categoría y fila salarial.
- Columna de origen:
  - Sistema,
  - Convenio,
  - Personalizado.

## Uso esperado en demo

1. Crear o cargar un convenio.
2. Entrar en `Convenios`.
3. Mantener grupos, categorías, tablas salariales, jornada, vacaciones y antigüedad desde `Gestión del convenio`.
4. Abrir `Criterios laborales`.
5. Seleccionar el convenio.
6. Pulsar `Preparar criterios` si todavía no tiene estructura inicial.
7. Configurar únicamente los bloques aplicables.
8. Asociar un contrato al convenio y a una categoría profesional.
9. Entrar en `Conceptos permanentes`.
10. Pulsar `Cargar desde convenio`.
11. Revisar salario base, complementos, fila salarial y origen de cada concepto.
12. Preparar una nómina y cargar los conceptos permanentes del contrato.

## Pendiente

### Criterios laborales

- Bases de cotización por régimen y grupo.
- Coeficientes reductores.
- AT/EP por CNAE u ocupación.
- Conceptos participantes en cada paga extra.
- Valoración y medias de vacaciones.
- Vencimientos reales de antigüedad.
- Diagnósticos y exclusiones avanzadas de IT.

### Tablas salariales

Pendiente evolucionar la pestaña para mostrar:

- categorías a la izquierda,
- conceptos salariales de la categoría a la derecha,
- naturaleza,
- forma de cálculo,
- cotización,
- tributación,
- código CRA.

### Motor de nómina

El convenio ya puede alimentar la estructura salarial permanente del contrato. Sigue pendiente que el motor consuma directamente reglas avanzadas para:

- prorrateo de pagas extra,
- vacaciones,
- antigüedad por vencimientos,
- complementos IT,
- tipos y bases de cotización.

La lógica específica del convenio debe permanecer parametrizada y no codificada de forma fija en el motor.
