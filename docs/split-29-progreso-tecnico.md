# Split 29 - Progreso técnico

## Estado general

El módulo de Convenios ha evolucionado desde una ficha informativa hacia una parametrización laboral reutilizable por contratos y nóminas.

El núcleo comercial del Split 29 ya incluye:

- estructura profesional;
- tablas salariales versionadas;
- conceptos retributivos;
- revisiones y migraciones;
- pagas extraordinarias;
- prorrata mensual;
- regularizaciones retroactivas;
- antigüedad con vencimientos reales.

## Backend

### Parametrización general

Implementado:

- Modelo cabecera-detalle para reglas internas de convenio.
- Catálogo de conceptos.
- Conceptos salariales por convenio, tabla anual y categoría profesional.
- CRUD de reglas, detalles, catálogo y conceptos salariales.
- Valores mínimo y máximo para tramos, duraciones y límites.
- Cabecera ERP ampliada:
  - denominación oficial e interna;
  - prórroga;
  - alertas BOE;
  - términos de búsqueda.
- Parametrización efectiva por contrato.
- Puente convenio -> conceptos permanentes del contrato.

### Tablas salariales

Implementado:

- Versionado mediante `salary_table_id`.
- Duplicación transaccional de tablas.
- Incremento masivo de filas y conceptos.
- Activación controlada de una única tabla por convenio.
- Vista previa de contratos afectados.
- Migración explícita de contratos.
- Protección para impedir dos tablas activas.
- Comparación de conceptos por código estable.
- Acciones selectivas:
  - crear;
  - actualizar;
  - reactivar;
  - desactivar.
- Conservación de conceptos personalizados y de sistema.
- Ejecución conjunta de fila, salario base y conceptos.

### Pagas extraordinarias

Implementado:

- Versión por tabla salarial.
- Período de devengo.
- Mes y período especial de abono.
- Prorrateo permitido y por defecto.
- Conceptos participantes.
- Porcentaje o importe fijo.
- Reglas generales y específicas por categoría.
- Vista previa por tabla y categoría.
- Copia al ejercicio siguiente.
- Cálculo por contrato.
- Ajuste por alta, baja, IT, ausencia e inactividad.
- Generación de pagas 13 y 14.

### Prorrata mensual

Implementado:

- Aplicación a contratos de doce pagas.
- Resolución por convenio, tabla y categoría.
- Uso de valores contractuales.
- Parcialidad.
- Período de devengo.
- Incidencias.
- Inclusión en bruto, bases, IRPF y coste empresa.
- Prevención de doble reducción.
- Líneas automáticas `PRORRATA_EXTRA_`.
- Recalculo idempotente.
- Simulación futura y recibo.

### Regularizaciones retroactivas

Implementado:

- Comparación de tabla origen y destino.
- Salario base y conceptos versionados.
- Prorratas extraordinarias.
- Ajuste según lo realmente remunerado.
- Vista previa por trabajador, mes y concepto.
- Selección individual.
- Generación de nómina complementaria en período 15.
- Cotizaciones, IRPF, neto y coste empresa.
- Líneas `RETRO_TABLE_`.
- Protección de duplicados.
- Nóminas históricas inalteradas.

### Antigüedad

Implementado:

- Reglas por convenio, tabla y categoría.
- Trienios, quinquenios y módulos personalizados.
- Importe fijo, porcentaje o importe de fila salarial.
- Fecha reconocida, fecha contractual o inicio de contrato.
- Módulos consolidados.
- Próximo vencimiento.
- Límite máximo.
- Prorrateo diario del mes de vencimiento.
- Parcialidad.
- Ajuste por días cotizados.
- Cotización e IRPF configurables.
- Participación opcional en pagas 13 y 14.
- Campo `payrolls.seniority_amount`.
- Líneas automáticas `SENIORITY_AUTO_`.
- Copia de reglas al duplicar una tabla salarial.

## Endpoints principales

### Parametrización

- `GET /collective-agreements/{agreement_id}/parameterization`
- `POST /collective-agreements/{agreement_id}/parameterization/seed`
- `GET /contracts/{contract_id}/agreement-parameterization`
- `POST /contracts/{contract_id}/load-agreement-concepts`

### Tablas salariales

- `POST /collective-agreements/salary-tables/{source_table_id}/duplicate`
- `GET /collective-agreements/salary-tables/{table_id}/activation-preview`
- `POST /collective-agreements/salary-tables/{table_id}/activate`
- `POST /collective-agreements/salary-tables/{table_id}/migrate-contracts`

### Regularizaciones

- `POST /collective-agreements/salary-tables/{table_id}/regularization-preview`
- `POST /collective-agreements/salary-tables/{table_id}/regularizations`

### Pagas extraordinarias

- `GET /collective-agreements/{agreement_id}/extra-pays`
- `POST /collective-agreements/{agreement_id}/extra-pays`
- `GET /collective-agreements/{agreement_id}/extra-pay-candidates`
- `GET /collective-agreements/extra-pays/{extra_pay_id}/preview`

### Antigüedad

- `GET /collective-agreements/{agreement_id}/seniority-rules`
- `POST /collective-agreements/{agreement_id}/seniority-rules`
- `PUT /collective-agreements/seniority-rules/{rule_id}`
- `DELETE /collective-agreements/seniority-rules/{rule_id}`
- `GET /contracts/{contract_id}/seniority-preview`
- `GET /collective-agreements/{agreement_id}/seniority-preview`

## Base de datos

Implementado:

- Parche conservador para cabecera ampliada.
- Campos mínimo y máximo en detalles.
- Campo `salary_table_id` en conceptos.
- Tablas:
  - `agreement_extra_pays`;
  - `agreement_extra_pay_concepts`;
  - `agreement_seniority_rules`.
- Columnas puente en nómina:
  - `extra_pay_proration`;
  - `seniority_amount`;
  - bases y días de cotización.
- Compatibilidad con bases existentes mediante `Base.metadata.create_all` y parches conservadores.
- Backfill de datos anteriores.

## Frontend

### Workspace de Convenios

El módulo dispone de tres vistas:

1. `Gestión del convenio`
   - resumen;
   - clasificación;
   - tablas y filas salariales;
   - jornada y permisos;
   - ficha de antigüedad original.

2. `Estructura salarial`
   - selector de tabla anual;
   - categorías y conceptos;
   - salario base y complementos;
   - naturaleza, pago y cálculo;
   - cotización, IRPF y CRA;
   - CRUD de conceptos;
   - revisión salarial;
   - activación y migración;
   - regularización retroactiva;
   - pagas extraordinarias;
   - simulación por contrato.

3. `Criterios laborales`
   - SMI e IPREM;
   - atrasos;
   - contratación;
   - período de prueba;
   - complementos IT;
   - vacaciones;
   - antigüedad real y vencimientos.

### Antigüedad visible en nóminas

La partida aparece en:

- preparación mensual;
- listado general;
- desglose automático;
- recibo;
- impresión;
- simulación futura.

Las líneas automáticas son de consulta y no pueden editarse manualmente.

## Pruebas

Archivos principales:

- `backend/tests/test_salary_table_concept_migration.py`
- `backend/tests/test_agreement_extra_pay.py`
- `backend/tests/test_contract_extra_pay.py`
- `backend/tests/test_monthly_extra_pay_proration.py`
- `backend/tests/test_salary_regularization.py`
- `backend/tests/test_salary_base_semantics.py`
- `backend/tests/test_agreement_seniority.py`
- `backend/tests/test_seniority_table_revision.py`

Cubren:

- migración selectiva de conceptos;
- conservación de personalizados;
- pagas extra y prorratas;
- incidencias y parcialidad;
- regularizaciones;
- bloqueo de duplicados;
- semántica mensual del salario;
- trienios y vencimientos;
- prorrateo diario;
- límites;
- idempotencia;
- copia de reglas al ejercicio siguiente.

Ejecución:

```bash
cd backend
python -m unittest discover -s tests -p "test_*.py"
```

```bash
cd frontend
npm run build
```

## Uso esperado en demo

1. Crear o cargar un convenio.
2. Crear grupos y categorías.
3. Crear una tabla salarial.
4. Configurar conceptos.
5. Crear pagas extraordinarias.
6. Definir una regla de trienios.
7. Revisar vencimientos de trabajadores.
8. Preparar una nómina con antigüedad y prorrata.
9. Crear una revisión salarial.
10. Copiar conceptos, pagas y reglas de antigüedad.
11. Activar y migrar contratos.
12. Calcular atrasos.
13. Generar complementarias.
14. Simular nóminas futuras.

## Pendiente

### Criterios laborales

- Bases de cotización por régimen y grupo.
- Coeficientes reductores.
- AT/EP por CNAE u ocupación.
- Valoración y medias de vacaciones.
- Complementos IT por tramos y diagnósticos.

### Antigüedad avanzada

- Atrasos por reconocimiento tardío.
- Histórico de parcialidad y categoría.
- Períodos no computables.
- Escalas con importes distintos por módulo.
- Cambio de regla dentro del mismo mes.
- Alertas de próximo vencimiento.

### Motor de nómina

Pendiente consumir directamente las reglas avanzadas para:

- vacaciones;
- complementos IT;
- tipos y bases mínimas y máximas;
- AT/EP y coeficientes.

La lógica específica del convenio debe permanecer parametrizada y no codificada de forma fija en el motor.
