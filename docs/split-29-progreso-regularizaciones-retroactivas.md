# Split 29 - Progreso: regularizaciones retroactivas

## Estado

Implementación funcional terminada y pendiente de ejecución local de pruebas y build.

## Backend

### API

- Vista previa de atrasos por tabla salarial.
- Generación de nóminas complementarias.
- Recálculo obligatorio en servidor antes de generar.
- Bloqueo de tabla destino no activa.
- Bloqueo de complementaria duplicada por contrato y ejercicio.

### Cálculo

- Comparación de salario base entre tabla origen y destino.
- Comparación de conceptos salariales versionados.
- Inclusión opcional de conceptos no salariales.
- Comparación de prorrata de pagas extra en contratos de doce pagas.
- Aplicación de parcialidad contractual.
- Ajuste según la proporción efectivamente remunerada en cada nómina histórica.
- Tratamiento independiente de cotización e IRPF por concepto.
- Opción para conservar únicamente diferencias positivas.

### Generación

- Nómina complementaria en período 15.
- Una nómina por contrato.
- Bases, cotizaciones, IRPF, neto y coste empresa.
- Estado pendiente por defecto.
- Líneas informativas `RETRO_TABLE_...`.
- Nóminas históricas inalteradas.
- Transacción única para cada lote de generación.

### Desglose

- Grupo `regularizaciones_automaticas`.
- Total `total_regularizacion_automatica`.
- Compatibilidad con el recibo existente mediante el grupo automático visible.
- Exclusión de dobles cómputos en cabecera y líneas.

## Frontend

Nuevo panel:

`frontend/src/components/agreements/SalaryRegularizationPanel.jsx`

Incluye:

- tabla origen;
- tabla destino;
- período;
- selección de materias retributivas;
- vista previa consolidada;
- selección por trabajador;
- detalle por mes y concepto;
- tratamiento de IRPF;
- generación controlada;
- resumen del lote creado;
- refresco posterior sin perder el resultado.

Ubicación:

`Convenios -> Estructura salarial`

## Endpoints

```http
POST /collective-agreements/salary-tables/{table_id}/regularization-preview
```

```http
POST /collective-agreements/salary-tables/{table_id}/regularizations
```

## Archivos principales

### Backend

- `backend/app/schemas/salary_regularization.py`
- `backend/app/services/salary_regularization.py`
- `backend/app/services/salary_regularization_guard.py`
- `backend/app/salary_table_revision_routes.py`
- `backend/app/services/payroll_breakdown.py`
- `backend/app/schemas/payroll_breakdown.py`

### Frontend

- `frontend/src/components/agreements/SalaryRegularizationPanel.jsx`
- `frontend/src/services/collectiveAgreementApi.js`
- `frontend/src/pages/CollectiveAgreementsWorkspacePage.jsx`

### Pruebas

- `backend/tests/test_salary_regularization.py`

## Casos de prueba

- Nómina histórica completa.
- Nómina histórica remunerada al 50 %.
- Diferencia acumulada de 150 euros.
- Generación de período 15.
- Creación de trazas por mes.
- Líneas informativas no computables por segunda vez.
- Bloqueo de duplicados.
- Exclusión del contrato liquidado de totales pendientes.

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

- Parcialidad y categoría no están versionadas históricamente.
- El intervalo debe pertenecer a un solo ejercicio.
- Una única complementaria activa por contrato y ejercicio.
- No se simulan ficheros de cotización complementaria.
- No se calculan recargos o intereses.
- No se regularizan bonificaciones, embargos o anticipos.
