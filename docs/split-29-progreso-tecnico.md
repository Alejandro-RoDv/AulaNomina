# Split 29 - Progreso técnico

## Estado implementado

El módulo de Convenios ha evolucionado desde una ficha informativa hacia una parametrización laboral reutilizable por contratos y nóminas.

## Backend

Implementado:

- Modelo Cabecera -> Detalle para reglas internas de convenio.
- Catálogo de conceptos.
- Conceptos salariales por convenio, tabla anual y categoría profesional.
- CRUD de reglas, detalles, catálogo y conceptos salariales.
- Valores mínimo y máximo para tramos, duraciones y límites.
- Cabecera ERP ampliada:
  - denominación oficial e interna,
  - prórroga,
  - alertas BOE,
  - términos de búsqueda.
- Parametrización efectiva por contrato.
- Puente convenio -> conceptos permanentes del contrato.
- Versionado de conceptos mediante `salary_table_id`.
- Duplicación transaccional de tablas salariales.
- Incremento masivo de filas y conceptos salariales.
- Activación controlada de una única tabla por convenio.
- Vista previa de contratos afectados.
- Migración explícita de contratos a la nueva tabla.
- Protección global para impedir dos tablas activas en el mismo convenio.
- Comparación de conceptos permanentes por código estable.
- Acciones selectivas por contrato y concepto:
  - crear,
  - actualizar,
  - reactivar,
  - desactivar.
- Conservación automática de conceptos personalizados y de sistema.
- Ejecución transaccional conjunta de fila salarial, salario base y conceptos.
- Pagas extraordinarias configurables:
  - versión por tabla salarial,
  - período de devengo,
  - mes de abono,
  - prorrateo permitido y por defecto,
  - conceptos participantes,
  - porcentaje o importe fijo,
  - reglas generales y específicas por categoría,
  - vista previa por tabla y categoría.
- Copia de pagas y líneas al duplicar una tabla salarial.

### Endpoints principales

- `GET /collective-agreements/{agreement_id}/parameterization`
- `POST /collective-agreements/{agreement_id}/parameterization/seed`
- `GET /contracts/{contract_id}/agreement-parameterization`
- `POST /contracts/{contract_id}/load-agreement-concepts`
- `POST /collective-agreements/salary-tables/{source_table_id}/duplicate`
- `GET /collective-agreements/salary-tables/{table_id}/activation-preview`
- `POST /collective-agreements/salary-tables/{table_id}/activate`
- `POST /collective-agreements/salary-tables/{table_id}/migrate-contracts`
- `GET /collective-agreements/{agreement_id}/extra-pays`
- `POST /collective-agreements/{agreement_id}/extra-pays`
- `GET /collective-agreements/{agreement_id}/extra-pay-candidates`
- `GET /collective-agreements/extra-pays/{extra_pay_id}/preview`

## Base de datos

Implementado:

- Parche conservador para la cabecera ampliada del convenio.
- Campos `minimum_value` y `maximum_value` en detalles de reglas.
- Campo `salary_table_id` en conceptos salariales.
- Tablas nuevas:
  - `agreement_extra_pays`,
  - `agreement_extra_pay_concepts`.
- Compatibilidad con bases existentes mediante `Base.metadata.create_all`.
- Backfill del convenio demo.

La actualización selectiva de conceptos reutiliza las tablas actuales de conceptos permanentes y no requiere nuevas columnas.

## Frontend

### Enfoque corregido

Se eliminaron los widgets técnicos, la edición de JSON y el modal de parametrización inyectado en el DOM.

La interfaz es React y utiliza términos laborales reconocibles.

### Workspace de Convenios

El módulo dispone de tres vistas:

1. `Gestión del convenio`
   - resumen,
   - clasificación,
   - tablas y filas salariales,
   - jornada y permisos,
   - antigüedad.

2. `Estructura salarial`
   - selector de tabla anual,
   - categorías a la izquierda,
   - conceptos aplicables a la derecha,
   - salario base y complementos de referencia,
   - naturaleza salarial o no salarial,
   - forma de pago y cálculo,
   - cotización,
   - IRPF,
   - código CRA,
   - crear, editar y eliminar conceptos,
   - convertir filas antiguas en conceptos,
   - duplicar una tabla hacia un nuevo ejercicio,
   - aplicar incrementos,
   - activar una revisión,
   - revisar y migrar contratos,
   - comparar y seleccionar cambios en conceptos permanentes,
   - configurar y simular pagas extraordinarias.

3. `Criterios laborales`
   - SMI e IPREM,
   - atrasos,
   - contratación,
   - período de prueba,
   - complementos de IT,
   - accesos a antigüedad y vacaciones.

### Activación y migración

La pantalla muestra:

- tabla candidata,
- tablas activas actuales,
- contratos migrables,
- contratos ya actualizados,
- contratos bloqueados y motivo,
- fila y salario base de destino,
- selección individual o conjunta,
- opción de conservar o actualizar salario base,
- conceptos nuevos,
- conceptos con importe distinto,
- conceptos inactivos a reactivar,
- conceptos obsoletos susceptibles de baja,
- conceptos sin cambios,
- conceptos personalizados o de sistema conservados.

La selección recomendada incluye altas, cambios y reactivaciones. Las bajas requieren selección expresa.

La activación no modifica contratos. La migración se realiza después y aplica únicamente las acciones marcadas.

### Pagas extraordinarias

La pantalla permite:

- crear varias pagas por tabla salarial,
- definir código, denominación y abono,
- definir inicio, fin y meses de devengo,
- permitir o impedir prorrateo,
- marcar prorrateo por defecto,
- añadir conceptos al porcentaje indicado,
- añadir importes fijos,
- aplicar reglas a todas las categorías,
- sobrescribir una regla para una categoría concreta,
- excluir deducciones,
- calcular importe íntegro y prorrata teórica,
- copiar la configuración al ejercicio siguiente.

### Conceptos permanentes

Implementado:

- acción `Cargar desde convenio`,
- conservación o sustitución de salario base,
- conceptos globales y específicos,
- resolución por tabla anual,
- columna de origen,
- prevención de duplicados,
- actualización selectiva durante una migración salarial.

## Pruebas

Añadidos:

- `backend/tests/test_salary_table_concept_migration.py`
- `backend/tests/test_agreement_extra_pay.py`

Utilizan `unittest` y SQLite en memoria, sin nuevas dependencias.

Cubren:

- clasificación de conceptos,
- conservación de personalizados,
- aplicación de acciones seleccionadas,
- migración conjunta de fila, salario base y conceptos,
- exclusión de deducciones en pagas extra,
- cálculo porcentual y fijo,
- prevalencia de categoría,
- prorrata mensual,
- copia de pagas al duplicar una tabla.

Ejecución:

```bash
cd backend
python -m unittest discover -s tests -p "test_*.py"
```

## Uso esperado en demo

1. Crear o cargar un convenio.
2. Crear grupos y categorías.
3. Crear una tabla salarial y sus filas.
4. Convertir las filas en conceptos editables.
5. Configurar criterios laborales.
6. Crear pagas extraordinarias y seleccionar conceptos.
7. Mostrar una vista previa por categoría.
8. Crear una revisión del ejercicio siguiente.
9. Aplicar un incremento general y copiar las pagas.
10. Revisar contratos afectados.
11. Comparar conceptos actuales y nuevos.
12. Seleccionar únicamente los cambios deseados.
13. Activar la tabla nueva.
14. Migrar únicamente contratos válidos.
15. Revisar el resumen de altas, cambios, reactivaciones y bajas.
16. Preparar la nómina simulada.

## Pendiente

### Criterios laborales

- Bases de cotización por régimen y grupo.
- Coeficientes reductores.
- AT/EP por CNAE u ocupación.
- Valoración y medias de vacaciones.
- Vencimientos reales de antigüedad.
- Diagnósticos y exclusiones avanzadas de IT.

### Estructura salarial

- Revisión selectiva por categoría antes de duplicar una tabla.
- Fórmulas reales de porcentaje y cálculo por unidad.
- Histórico de revisiones y usuario responsable.

### Motor de nómina

Pendiente consumir directamente las reglas avanzadas para:

- cálculo de paga extra por contrato,
- ajuste por alta, baja, IT y períodos no devengados,
- prorrateo mensual de pagas extra,
- vacaciones,
- antigüedad por vencimientos,
- complementos IT,
- tipos y bases de cotización.

La lógica específica del convenio debe permanecer parametrizada y no codificada de forma fija en el motor.
