# Split 29 - Progreso: antigüedad y vencimientos

## Estado

Implementación funcional terminada y pendiente de ejecución local de pruebas y build.

## Backend

### Modelo

Nueva entidad:

`AgreementSeniorityRule`

Permite configurar:

- convenio;
- tabla salarial;
- categoría;
- años por módulo;
- importe fijo, porcentaje o importe de tabla;
- máximo de módulos;
- parcialidad;
- prorrateo diario;
- cotización;
- IRPF;
- pagas extraordinarias;
- vigencia;
- estado y orden.

### Resolución

- Prioridad de fecha reconocida, contractual e inicio del contrato.
- Prioridad de regla por tabla y categoría.
- Cálculo de años completos.
- Cálculo de módulos consolidados.
- Límite máximo.
- Próximo vencimiento.
- Aniversarios del 29 de febrero.
- Bloqueo de reglas sin importe resoluble.

### Nómina

- Campo `seniority_amount` en cabecera.
- Inclusión en bruto.
- Inclusión configurable en cotización.
- Inclusión configurable en IRPF.
- Ajuste por parcialidad.
- Ajuste por días cotizados.
- Prorrateo del nuevo módulo en el mes de vencimiento.
- Inclusión opcional en pagas 13 y 14.
- Exclusión automática del período 15.
- Recalculo idempotente.

### Trazabilidad

Prefijo:

`SENIORITY_AUTO_`

Las líneas automáticas informan de:

- módulos consolidados;
- vencimiento del mes;
- fecha;
- días reconocidos;
- ajuste por cotización.

Las líneas no vuelven a incrementar bruto, bases o IRPF.

### Versionado

- Copia opcional de reglas vinculadas a tabla.
- Reglas generales no duplicadas.
- Incremento de importes fijos.
- Conservación de porcentajes.
- Uso de las filas salariales incrementadas para `table_amount`.

### Base de datos

- Tabla `agreement_seniority_rules`.
- Columna `payrolls.seniority_amount`.
- Compatibilidad con bases existentes mediante parche conservador.

## API

```http
GET  /collective-agreements/{agreement_id}/seniority-rules
POST /collective-agreements/{agreement_id}/seniority-rules
PUT  /collective-agreements/seniority-rules/{rule_id}
DELETE /collective-agreements/seniority-rules/{rule_id}
GET /contracts/{contract_id}/seniority-preview
GET /collective-agreements/{agreement_id}/seniority-preview
```

## Frontend

Nuevo panel:

`frontend/src/components/agreements/AgreementSeniorityPanel.jsx`

Ubicación:

`Convenios -> Criterios laborales`

Incluye:

- CRUD de reglas;
- selección de tabla y categoría;
- forma de cálculo;
- periodicidad y límite;
- indicadores laborales;
- vigencia;
- vista previa de trabajadores;
- módulos e importes;
- próximo vencimiento;
- detalle histórico.

La antigüedad también aparece en:

- preparación mensual;
- listado general de nóminas;
- desglose automático;
- recibo individual;
- simulación futura.

## Convenio demo

La semilla de parametrización crea una regla general de trienios basada en el importe de la fila salarial cuando no existe ninguna regla de antigüedad.

## Archivos principales

### Backend

- `backend/app/models/agreement_seniority.py`
- `backend/app/schemas/agreement_seniority.py`
- `backend/app/crud/agreement_seniority.py`
- `backend/app/services/agreement_seniority.py`
- `backend/app/services/seniority_payroll_items.py`
- `backend/app/agreement_seniority_routes.py`
- `backend/app/services/payroll_engine.py`
- `backend/app/crud/payroll.py`
- `backend/app/models/payroll.py`
- `backend/app/db_schema_patches.py`
- `backend/app/services/salary_table_revision.py`

### Frontend

- `frontend/src/components/agreements/AgreementSeniorityPanel.jsx`
- `frontend/src/pages/CollectiveAgreementsWorkspacePage.jsx`
- `frontend/src/components/payrolls/MonthlyPayrollPreparation.jsx`
- `frontend/src/components/payrolls/FuturePayrollSimulator.jsx`
- `frontend/src/components/payrolls/PayrollTable.jsx`
- `frontend/src/components/payrolls/PayrollConceptBreakdown.jsx`
- `frontend/src/services/collectiveAgreementApi.js`

### Pruebas

- `backend/tests/test_agreement_seniority.py`
- `backend/tests/test_seniority_table_revision.py`

## Casos cubiertos

- fecha reconocida;
- trienios;
- parcialidad;
- vencimiento a mitad de mes;
- prorrateo diario;
- días cotizados;
- bruto y bases;
- trazas automáticas;
- recalculo sin duplicados;
- límite de módulos;
- año bisiesto;
- copia de reglas;
- incremento de importe fijo.

## Validación pendiente

```bash
cd backend
python -m unittest discover -s tests -p "test_*.py"
```

```bash
cd frontend
npm run build
```

No se han ejecutado desde el entorno asistido porque no existe un workflow de CI disponible y el contenedor no dispone de acceso operativo al repositorio.

## Límites conocidos

- Sin histórico de parcialidad o categoría por fecha.
- Sin división mensual entre dos reglas que cambian a mitad de mes.
- Sin atrasos automáticos por reconocimiento tardío.
- Sin períodos históricos no computables.
- Sin proyección anual específica de futuros vencimientos para el tipo sugerido de IRPF.
