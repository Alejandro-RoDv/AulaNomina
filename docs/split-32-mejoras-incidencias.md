# Split 32 — Mejoras del módulo de incidencias

## Objetivo

Evolucionar el registro genérico de incidencias existente hacia un núcleo histórico, versionado y preparado para nómina, sin duplicar `Employee`, `Contract`, `Company`, `WorkCenter`, `Payroll`, `Document`, convenios ni la calculadora de embargos.

Este split prioriza el dominio de **incidencias fechadas**. Los módulos maestros de convenio, tabla salarial, devengos permanentes, contratación, preferencias de empresa y embargos continúan en sus módulos existentes y se enlazan conceptualmente desde la vida laboral seleccionada.

## Arquitectura detectada

- Backend: FastAPI.
- ORM: SQLAlchemy 2.
- Base de datos objetivo: PostgreSQL.
- Inicialización de esquema actual: `Base.metadata.create_all()` más parches conservadores en `db_init.py`; el proyecto todavía no utiliza Alembic.
- Frontend: React 19 con Vite.
- Estilos: componentes existentes e inline styles de aspecto ERP.
- API actual: endpoints directos en `app/main.py`, con separación model/schema/crud/service.
- Autenticación y permisos efectivos: no existe todavía middleware de autenticación/autorización aplicado a los endpoints. No se ha simulado seguridad inexistente.

## Entidades reutilizadas

- `Employee`: trabajador.
- `Contract`: vida laboral o relación laboral seleccionada.
- `Company` y `WorkCenter`: adscripción organizativa.
- `Payroll`: nómina afectada y detección de cierre.
- `Document`: referencia disponible para futuros adjuntos y partes.
- `CollectiveAgreement`, categorías y tablas salariales: información contractual ya relacionada desde `Contract`.
- `WageGarnishment`: módulo de embargo previo, sin duplicar su cálculo.

## Entidades añadidas

### `IncidentDetail`

Extensión uno a uno de `Incident`. Evita alterar destructivamente la tabla histórica existente y añade:

- unidad, horas y días;
- retribución y efecto de nómina;
- nómina procesada e importe generado;
- anulación lógica;
- recálculo y regularización;
- autorización de solapamiento;
- origen;
- detalle JSON por subtipo;
- usuario lógico;
- fecha de actualización;
- versión de bloqueo optimista.

### `IncidentAudit`

Registro inmutable de creación, modificación y anulación con fotografía anterior/nueva, versión, usuario, motivo y fecha.

### `IncidentConfirmation`

Estructura persistente para partes de confirmación de IT, vinculada a la incidencia y preparada para documento adjunto. La interfaz/API específica de alta y anulación de partes queda pendiente de un router propio; la tabla y las relaciones ya están disponibles.

## Flujo implementado

1. Selección del trabajador.
2. Selección de una de sus vidas laborales/contratos, no solo el contrato activo.
3. Carga de empresa, centro, convenio, categoría, grupo y jornada desde el contrato.
4. Registro del subtipo de incidencia.
5. Validación de fechas dentro de la vida laboral.
6. Detección de duplicados y solapamientos incompatibles.
7. Autorización explícita del solapamiento con motivo.
8. Persistencia del detalle especializado.
9. Auditoría de la operación.
10. Detección de nóminas afectadas.
11. Marcado de recálculo o regularización si existe una nómina cerrada.
12. Edición protegida mediante versión esperada.
13. Anulación lógica sin borrado físico.

## Subtipos disponibles en interfaz

- Incapacidad temporal.
- Recaída.
- Nacimiento y cuidado.
- Riesgo durante el embarazo.
- Riesgo durante la lactancia.
- Cuidado de menor.
- Vacaciones.
- Ausencia.
- Permiso retribuido.
- Permiso no retribuido.
- Suspensión.
- Sanción.
- Horas extraordinarias.
- Movimiento/cambio del trabajador.

La lógica jurídica o económica no confirmada no se calcula en la interfaz. Los datos especializados se guardan en `IncidentDetail.details` para que servicios de nómina posteriores los procesen de forma testeable.

## Validaciones implementadas

- Fecha final no anterior a la inicial.
- Incidencia dentro de la vida laboral.
- Regularización fuera de contrato solo mediante indicador explícito en los metadatos.
- Contrato perteneciente al trabajador.
- Empresa coherente con el contrato.
- Centro perteneciente a la empresa.
- Horas entre 0 y 24.
- Importes y días no negativos.
- Horas extraordinarias con número de horas.
- Duplicados exactos.
- Solapamientos incompatibles entre IT, vacaciones, ausencias, permisos no retribuidos, suspensiones y prestaciones.
- Solapamiento forzado únicamente con motivo.
- Nómina procesada perteneciente a la misma vida laboral.
- Conflicto de edición por versión, con respuesta HTTP 409.
- Anulación física sustituida por anulación lógica.
- Incidencia procesada no eliminable por el endpoint heredado.

## Idempotencia y nómina

El modelo ya contiene la relación `processed_payroll_id`, `generated_amount` y la versión. La modificación de una incidencia vinculada o coincidente con una nómina existente marca `requires_recalculation`. Si la nómina está cerrada, marca además `requires_regularization`.

Este split **no genera conceptos de nómina nuevos ni implementa una fórmula jurídica no confirmada**. La integración de cálculo debe enlazar en un split posterior cada incidencia origen con sus `PayrollItem` resultantes y utilizar una clave única origen/nómina/concepto.

## Migración

No se modifican columnas de `incidents`. Se crean tres tablas nuevas mediante el mecanismo actual del proyecto:

- `incident_details`;
- `incident_audits`;
- `incident_confirmations`.

Al arrancar el backend, `Base.metadata.create_all()` crea las tablas ausentes. No se ha introducido Alembic en un único módulo porque el repositorio aún no lo utiliza.

Para producción, antes de abandonar el mecanismo MVP, se recomienda consolidar estos cambios en la futura migración inicial de Alembic.

## Archivos creados

- `backend/app/models/incident_detail.py`
- `backend/app/services/incident_service.py`
- `backend/tests/test_incident_lifecycle.py`
- `frontend/src/tests/incidentPayloads.test.js`
- `docs/split-32-mejoras-incidencias.md`

## Archivos modificados

- `backend/app/models/__init__.py`
- `backend/app/models/incident.py`
- `backend/app/schemas/incident.py`
- `backend/app/crud/incident.py`
- `frontend/package.json`
- `frontend/src/components/incidents/IncidentForm.jsx`
- `frontend/src/components/incidents/IncidentTable.jsx`
- `frontend/src/hooks/useIncidentsModule.js`
- `frontend/src/pages/IncidentsPage.jsx`
- `frontend/src/utils/incidentPayloads.js`

## Comandos de ejecución

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

El arranque aplica la creación de las tablas nuevas.

### Tests backend

```bash
cd backend
source .venv/bin/activate
python -m unittest discover -s tests
```

Solo el split:

```bash
python -m unittest tests.test_incident_lifecycle
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Tests, compilación y lint frontend

```bash
npm test
npm run build
npm run lint
```

## Permisos y datos sanitarios

La aplicación no tiene actualmente un control de autorización aplicado a la API. Por ese motivo:

- no se ha añadido el diagnóstico al formulario general;
- se muestra un aviso de que los datos sanitarios requieren una vista protegida;
- los campos de usuario de auditoría admiten `null` hasta que exista identidad autenticada;
- no debe considerarse implementado el permiso `consultar_datos_sanitarios` hasta disponer de autenticación y dependencias FastAPI de autorización.

Permisos previstos para el futuro router:

- `incidents.read`;
- `incidents.write`;
- `incidents.cancel`;
- `incidents.process`;
- `incidents.audit.read`;
- `incidents.medical.read`;
- `incidents.medical.write`.

## Campos pendientes de confirmación funcional

Se conservan como metadatos configurables y tooltips `TODO`, sin reglas inventadas:

1. `C`.
2. `H`.
3. `G. P.`.
4. `Grupo` de cabecera.
5. Segunda columna `Cálculo`.
6. `D. Baja`.
7. `Fecha de sustitución`.
8. Diferencia entre horas en `Nómina` y `Recibo`.
9. `Cont.`.
10. `Inc. Nómina`.
11. `Cantidad` en embargos.
12. Indicadores `IND`.
13. Iconos no identificables de las capturas.

## Limitaciones reales de este split

- No se ha creado un motor completo de prestaciones de IT, vacaciones, absentismo u horas extra: se han creado persistencia, validación, trazabilidad y puntos de integración.
- Los partes de confirmación tienen modelo persistente, pero requieren endpoints y formulario específico.
- Los adjuntos reutilizarán `Document`, pero el flujo de subida no se ha conectado todavía a cada subtipo.
- La autenticación y los permisos no existen en la API actual; no se afirma que estén implementados.
- La segmentación intramensual del motor de nómina no se implementa aquí.
- El saldo de vacaciones, catálogos de causas y tipos de hora deben convertirse en maestros propios en splits posteriores; en este split se guardan como códigos configurables.
- Devengos permanentes, particularidades de empresa, alertas/referencias de convenio y embargos conservan sus módulos actuales; no se han duplicado dentro de incidencias.
