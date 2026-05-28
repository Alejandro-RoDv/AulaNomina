# Split 20 - Convenios

## Objetivo funcional

El módulo Convenios permite registrar parámetros de un convenio colectivo para usarlos como referencia didáctica dentro de AulaNomina.

No está diseñado para aplicar automáticamente un convenio real ni para sustituir la interpretación jurídica. Su objetivo es permitir que el profesor o el alumno introduzcan manualmente la información relevante de un convenio y la consulten durante la creación de contratos, incidencias y nóminas simuladas.

## Principio didáctico

El módulo Convenios informa, pero no calcula.

La aplicación puede proponer el salario base mínimo de una categoría al crear un contrato, pero el alumno debe calcular manualmente:

- complementos salariales
- pagas extraordinarias
- vacaciones
- permisos
- mejoras de incapacidad temporal
- regularizaciones
- descuentos
- finiquitos
- cualquier regla específica de convenio

Esto mantiene el enfoque de AulaNomina como laboratorio de aprendizaje y no como gestor laboral automático.

## Alcance implementado

### Backend

Modelos SQLAlchemy añadidos:

- `CollectiveAgreement`
- `ProfessionalGroup`
- `ProfessionalCategory`
- `SalaryTable`
- `SalaryTableRow`
- `AgreementComplement`
- `WorkTimeRule`
- `VacationRule`
- `LeaveRule`

Schemas Pydantic añadidos para creación, actualización y respuesta de las entidades principales.

CRUD añadido en:

```text
backend/app/crud/collective_agreement.py
```

Rutas FastAPI añadidas en:

```text
backend/app/collective_agreement_routes.py
```

Rutas principales:

```text
GET    /collective-agreements
POST   /collective-agreements
GET    /collective-agreements/{agreement_id}
PUT    /collective-agreements/{agreement_id}
DELETE /collective-agreements/{agreement_id}

GET    /collective-agreements/{agreement_id}/professional-groups
POST   /collective-agreements/{agreement_id}/professional-groups

GET    /collective-agreements/{agreement_id}/professional-categories
POST   /collective-agreements/{agreement_id}/professional-categories

GET    /collective-agreements/{agreement_id}/salary-tables
POST   /collective-agreements/{agreement_id}/salary-tables

GET    /collective-agreements/salary-tables/{salary_table_id}/rows
POST   /collective-agreements/salary-tables/{salary_table_id}/rows

GET/POST/PUT para complementos, jornada, vacaciones y permisos
```

### Frontend

Servicio añadido:

```text
frontend/src/services/collectiveAgreementApi.js
```

Página añadida:

```text
frontend/src/pages/CollectiveAgreementsPage.jsx
```

La pantalla permite:

- crear convenio
- cargar convenio demo
- ver resumen del convenio
- crear grupos profesionales
- crear categorías profesionales
- crear tablas salariales
- crear filas salariales
- crear reglas básicas de jornada
- crear reglas de vacaciones
- crear permisos
- consultar datos en tablas

### Integración con contratos

El modelo `Contract` incluye ahora referencias opcionales a convenio:

- `collective_agreement_id`
- `professional_category_id`
- `salary_table_row_id`
- `collective_agreement_code`
- `professional_category`

En el formulario de contratos se puede seleccionar:

- convenio colectivo
- categoría de convenio
- fila salarial

Cuando se selecciona una fila salarial, la aplicación propone el salario base mínimo si el campo salario base está vacío.

El usuario puede modificar manualmente el salario base. No se bloquea ni se fuerza el importe.

## Datos demo

Archivo añadido:

```text
backend/app/seed_demo_agreements.py
```

Convenio ficticio:

```text
Convenio Simulado de Servicios Administrativos
Código: SIM-ADM-2026
```

Incluye:

- 3 grupos profesionales
- 6 categorías profesionales
- tabla salarial 2026
- filas salariales por categoría
- plus convenio
- nocturnidad
- mejora IT informativa
- jornada ordinaria
- vacaciones
- permisos retribuidos y no retribuidos

El seed está disponible mediante:

```text
POST /collective-agreements/seed-demo
```

También se integra en:

```text
POST /seed-demo
```

## Límites voluntarios del módulo

No se ha implementado:

- importación automática de convenios desde PDF o BOE
- interpretación automática de artículos
- motor de cálculo de convenio
- aplicación automática de IT según convenio
- cálculo automático de vacaciones
- cálculo automático de antigüedad
- cálculo automático de pagas extra
- validación jurídica de cláusulas

Estos límites son intencionados para mantener el enfoque didáctico y reducir complejidad del MVP.

## Uso esperado en clase

Ejemplo de flujo:

1. El profesor crea o carga un convenio.
2. Introduce grupos, categorías y tabla salarial.
3. Crea un caso práctico indicando qué convenio debe consultarse.
4. El alumno crea un contrato y selecciona convenio/categoría.
5. La aplicación propone salario base mínimo.
6. El alumno calcula manualmente la nómina y aplica los conceptos que correspondan.

## Pendientes recomendados

### Corto plazo

- Probar `npm run build` en frontend.
- Probar arranque backend con base de datos limpia.
- Probar arranque backend con base de datos ya existente.
- Revisar que `CollectiveAgreementDetailResponse` devuelve correctamente `salary_tables[].rows`.
- Crear un contrato seleccionando fila salarial demo.
- Verificar que el salario base se propone correctamente.

### Medio plazo

- Mejorar edición visual de convenios.
- Añadir borrado/edición de grupos, categorías, tablas y reglas desde frontend.
- Añadir duplicar convenio.
- Añadir versiones por año.
- Añadir notas docentes por bloque.
- Relacionar casos prácticos con convenio.

### Largo plazo

- Importación asistida desde texto pegado por el profesor.
- Plantillas genéricas de convenio.
- Comparador de tablas salariales por año.
- Exportación de convenio simulado a PDF didáctico.
