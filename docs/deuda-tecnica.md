# Deuda técnica AulaNomina

Este documento recoge deuda técnica detectada durante la normalización del MVP. No bloquea la demo, pero conviene cerrarla antes de escalar módulos.

## 1. Frontend: cliente HTTP común

Estado: iniciado.

Se ha creado:

```text
frontend/src/services/httpClient.js
```

Objetivo:

```text
Centralizar VITE_API_BASE_URL
Unificar control de errores
Evitar repetir fetch y response.json en cada servicio
```

Variable esperada:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Archivo de ejemplo:

```text
frontend/.env.example
```

## 2. Separar servicios frontend por dominio

Estado: parcialmente hecho.

Estructura deseada:

```text
frontend/src/services/companyApi.js
frontend/src/services/workCenterApi.js
frontend/src/services/employeeApi.js
frontend/src/services/contractApi.js
frontend/src/services/incidentApi.js
frontend/src/services/payrollApi.js
frontend/src/services/demoApi.js
```

Pendiente:

```text
Sacar contratos desde api.js a contractApi.js
Sacar reset demo desde api.js a demoApi.js
Dejar api.js solo para compatibilidad temporal o eliminarlo
```

## 3. App.jsx demasiado grande

Estado: pendiente.

Problema:

```text
App.jsx concentra estado, formularios, handlers, navegación y carga de datos.
```

Riesgo:

```text
Cada módulo nuevo aumenta complejidad y posibilidad de romper otros módulos.
```

Refactor recomendado:

```text
frontend/src/hooks/useAulaNominaData.js
frontend/src/hooks/useEmployeeActions.js
frontend/src/hooks/useContractActions.js
frontend/src/hooks/useIncidentActions.js
frontend/src/hooks/usePayrollActions.js
```

Objetivo:

```text
App.jsx debe quedarse como contenedor de navegación y renderizado de páginas.
```

## 4. Backend: main.py demasiado grande

Estado: pendiente.

Estructura recomendada:

```text
backend/app/api/employees.py
backend/app/api/companies.py
backend/app/api/work_centers.py
backend/app/api/contracts.py
backend/app/api/incidents.py
backend/app/api/payrolls.py
backend/app/api/demo.py
```

Y en main.py:

```python
app.include_router(employee_router)
app.include_router(company_router)
app.include_router(work_center_router)
app.include_router(contract_router)
app.include_router(incident_router)
app.include_router(payroll_router)
app.include_router(demo_router)
```

No conviene hacerlo justo antes de una demo sin pruebas manuales completas.

## 5. Migraciones reales

Estado: pendiente.

Ahora el proyecto depende demasiado de creación/ajuste directo de tablas.

Herramienta recomendada:

```text
Alembic
```

Orden sugerido:

```text
1. Congelar modelo actual
2. Crear migración inicial
3. Sustituir ajustes manuales progresivamente
4. Documentar comandos de upgrade/downgrade
```

## 6. Diccionario común de etiquetas

Estado: pendiente.

Crear:

```text
frontend/src/utils/labels.js
```

Para centralizar:

```text
Estados de contrato
Estados de nómina
Tipos de incidencia
Sistemas de pagas
Meses/periodos
```

Evita inconsistencias visuales y traducciones duplicadas.

## 7. Tests mínimos

Estado: pendiente.

No hace falta testing pesado todavía, pero sí pruebas básicas de humo.

Backend:

```text
Crear empresa
Crear centro
Crear trabajador
Crear contrato
Crear incidencia
Preparar nómina mensual
Reset demo
```

Frontend:

```text
Carga de dashboard
Crear contrato desde trabajador
Crear incidencia desde contrato activo
Preparar nóminas y refrescar listado
Abrir ficha de trabajador
```

## Orden recomendado

Prioridad inmediata:

```text
1. Separar contractApi.js y demoApi.js
2. Conectar Dashboard con workCenters, incidents y payrolls desde App.jsx
3. Crear labels.js
4. Refactor ligero de App.jsx a hooks
5. Separar routers backend
6. Alembic
7. Tests mínimos
```
