# Split 22 — Jornada, parcialidad y aplicación salarial

## 1. Objetivo funcional

El objetivo de este split es que AulaNomina deje de tratar el contrato como una simple relación trabajador-empresa y empiece a entender un dato esencial en cualquier proceso laboral: **cuánto trabaja realmente la persona**.

Hasta este punto el sistema ya tenía:

```txt
Trabajador
Contrato
Convenio
Conceptos salariales
Nómina
IRPF
```

Pero faltaba una capa crítica:

```txt
Jornada contractual
Parcialidad
Aplicación salarial según jornada
```

Este split permite que un trabajador a tiempo parcial no tenga los mismos importes aplicados que un trabajador a jornada completa, siempre que el concepto salarial esté marcado como proporcional a la jornada.

## 2. Principio didáctico

El módulo no busca calcular nóminas reales de forma cerrada. Busca que el alumno vea y entienda la relación entre:

```txt
jornada pactada
porcentaje de parcialidad
salario teórico
salario aplicado
complementos que se reducen
complementos que no se reducen
coste empresa estimado
```

Ejemplo docente:

```txt
Salario base teórico: 2.000 €
Trabajador: 50% jornada
Salario aplicado: 1.000 €
```

Pero:

```txt
Plus transporte: 100 €
Aplica % jornada: No
Resultado: 100 €
```

Este comportamiento permite explicar por qué no todos los conceptos se comportan igual ante una reducción de jornada.

## 3. Alcance implementado

### 3.1. Jornada contractual

El contrato incorpora los siguientes campos:

```txt
working_day_type
weekly_hours
full_time_weekly_hours
annual_agreement_hours
monthly_hours
annual_hours
partiality_coefficient
```

Significado:

```txt
working_day_type             Tipo de jornada: completa, parcial, fijo discontinuo
weekly_hours                 Horas semanales reales del trabajador
full_time_weekly_hours       Jornada semanal equivalente a tiempo completo
annual_agreement_hours       Jornada anual establecida por convenio
monthly_hours                Horas mensuales estimadas o manuales
annual_hours                 Horas anuales reales estimadas o manuales
partiality_coefficient       Porcentaje de jornada del trabajador
```

Ejemplos:

```txt
40 h semanales sobre 40 h -> 100%
30 h semanales sobre 40 h -> 75%
20 h semanales sobre 40 h -> 50%
```

### 3.2. Autocálculo de parcialidad y horas

Al crear o editar un contrato, backend y frontend calculan automáticamente:

```txt
partiality_coefficient = weekly_hours / full_time_weekly_hours * 100
monthly_hours = weekly_hours * 52 / 12
annual_hours = weekly_hours * 52
```

Ejemplo:

```txt
weekly_hours = 20
full_time_weekly_hours = 40
partiality_coefficient = 50
monthly_hours = 86,67
annual_hours = 1040
```

Estos valores son editables manualmente porque el MVP tiene enfoque docente y debe permitir casos prácticos no estándar.

### 3.3. Aplicación automática del porcentaje de jornada

Los conceptos salariales ya tenían el campo:

```txt
applies_workday_percentage
```

Este split hace que ese campo tenga efecto real al cargar conceptos permanentes del contrato en una nómina.

Ejemplo con reducción:

```txt
Concepto: Salario base
Importe: 2.000 €
Aplica % jornada: Sí
Parcialidad: 50%
Importe aplicado: 1.000 €
```

Ejemplo sin reducción:

```txt
Concepto: Plus transporte
Importe: 100 €
Aplica % jornada: No
Parcialidad: 50%
Importe aplicado: 100 €
```

La línea generada en nómina deja una nota de trazabilidad:

```txt
Aplicado % jornada: 50.00%
```

O bien:

```txt
No aplica % jornada
```

### 3.4. Resumen retributivo contractual

Se añade un resumen retributivo del contrato para consultar, sin necesidad de generar una nómina completa.

Endpoint:

```http
GET /contracts/{contract_id}/salary-summary
```

Devuelve:

```txt
contract_id
employee_name
working_day_type
weekly_hours
monthly_hours
annual_hours
annual_agreement_hours
full_time_weekly_hours
partiality_coefficient
salary_base_theoretical
salary_base_applied
permanent_concepts_original
permanent_concepts_applied
monthly_remuneration
annual_remuneration
estimated_company_social_security
estimated_company_cost
concept_lines
```

El coste empresa estimado usa una aproximación didáctica:

```txt
31,5% sobre la retribución anual
```

No debe tratarse como cálculo oficial definitivo. Es una referencia para que el alumno visualice impacto empresarial.

### 3.5. Simulación de cambio de jornada

Se añade una simulación para comparar una jornada actual contra una jornada objetivo.

Endpoint:

```http
POST /contracts/{contract_id}/simulate-workday
```

Simulación por parcialidad:

```json
{
  "target_partiality_coefficient": 75
}
```

Simulación por horas semanales:

```json
{
  "target_weekly_hours": 30,
  "target_full_time_weekly_hours": 40
}
```

Devuelve:

```txt
before
after
monthly_difference
annual_difference
```

Caso docente típico:

```txt
Antes: 50%
Después: 75%
Diferencia mensual: +X €
Diferencia anual: +Y €
```

## 4. Backend implementado

### 4.1. Modelo Contract

Archivo:

```txt
backend/app/models/contract.py
```

Campos añadidos o consolidados:

```txt
working_day_type
weekly_hours
full_time_weekly_hours
annual_agreement_hours
monthly_hours
annual_hours
partiality_coefficient
```

### 4.2. Schemas de contrato

Archivo:

```txt
backend/app/schemas/contract.py
```

Se amplían:

```txt
ContractBase
ContractCreate
ContractUpdate
ContractResponse
```

Se añaden schemas específicos:

```txt
ContractSalaryConceptLine
ContractSalarySummaryResponse
ContractWorkdaySimulationRequest
ContractWorkdaySimulationResponse
```

### 4.3. CRUD de contratos

Archivo:

```txt
backend/app/crud/contract.py
```

Responsabilidades nuevas:

```txt
Completar partiality_coefficient
Completar monthly_hours
Completar annual_hours
Validar coherencia básica de jornada
Persistir campos nuevos
Mantener compatibilidad con convenio y tabla salarial
```

### 4.4. Servicio de resumen salarial

Archivo nuevo:

```txt
backend/app/services/contract_salary_summary.py
```

Responsabilidades:

```txt
Obtener parcialidad real del contrato
Aplicar parcialidad sobre salario base
Aplicar parcialidad sobre conceptos permanentes si corresponde
Mantener importes íntegros en conceptos no proporcionales
Calcular retribución mensual
Calcular retribución anual
Calcular coste empresa estimado
Simular cambio de jornada sin modificar el contrato
```

### 4.5. Rutas de resumen y simulación

Archivo:

```txt
backend/app/payroll_salary_structure_routes.py
```

Endpoints añadidos:

```http
GET /contracts/{contract_id}/salary-summary
POST /contracts/{contract_id}/simulate-workday
```

### 4.6. Carga de conceptos contractuales en nómina

Archivo:

```txt
backend/app/crud/payroll_salary_structure.py
```

Cambio principal:

```txt
Al cargar conceptos permanentes del contrato en una nómina, se aplica partiality_coefficient si el concepto tiene applies_workday_percentage = true.
```

### 4.7. Parche de base de datos

Archivo:

```txt
backend/app/db_init.py
```

Se añaden columnas faltantes en entornos locales sin migraciones Alembic.

Columnas cubiertas:

```txt
annual_agreement_hours
monthly_hours
annual_hours
partiality_coefficient
weekly_hours
full_time_weekly_hours
working_day_type
```

## 5. Frontend implementado

### 5.1. Formulario de alta de contrato

Archivo:

```txt
frontend/src/components/ContractForm.jsx
```

Campos nuevos visibles:

```txt
Tipo jornada
Horas semanales
Jornada completa referencia
Coeficiente parcialidad
Jornada anual convenio
Horas mensuales
Horas anuales
```

Comportamiento:

```txt
Al introducir horas semanales y jornada completa de referencia, se calcula parcialidad.
Al introducir horas semanales, se calculan horas mensuales y anuales.
Los valores pueden ser corregidos manualmente.
```

### 5.2. Payload de contrato

Archivo:

```txt
frontend/src/utils/contractPayloads.js
```

Se incorporan los nuevos campos numéricos al payload:

```txt
annual_agreement_hours
monthly_hours
annual_hours
weekly_hours
full_time_weekly_hours
partiality_coefficient
```

También se amplían validaciones de coherencia:

```txt
contrato 5xx debe ser parcial
contrato 4xx debe ser completo
jornada completa debe tener parcialidad 100%
jornada parcial debe tener parcialidad entre 0 y 100
horas no negativas
```

### 5.3. API frontend

Archivo:

```txt
frontend/src/services/api.js
```

Funciones añadidas:

```txt
fetchContractSalarySummary(contractId)
simulateContractWorkday(contractId, payload)
```

### 5.4. Panel de resumen retributivo

Archivo nuevo:

```txt
frontend/src/components/ContractSalarySummaryPanel.jsx
```

Muestra:

```txt
Salario teórico
Salario aplicado
Complementos aplicados
Retribución mensual
Retribución anual
Coste empresa estimado
Horas semanales
Horas mensuales
Horas anuales
Jornada anual convenio
Conceptos permanentes
Simulación de nueva jornada
Alertas inteligentes
```

### 5.5. Rediseño de contratos

Archivo:

```txt
frontend/src/components/ContractTable.jsx
```

Se mejora la vista de contratos con:

```txt
Panel superior de métricas
Filtros rápidos
Filtros avanzados
Vista compacta / amplia
Tabla enriquecida
Edición por pestañas
Presets de jornada 100%, 75%, 50%
```

Pestañas de edición:

```txt
Resumen
Contrato
Jornada
Retribución
Seguridad Social
```

## 6. Alertas inteligentes

Incluidas en:

```txt
frontend/src/components/ContractSalarySummaryPanel.jsx
```

Alertas implementadas:

```txt
Salario base no informado
Parcialidad sin calcular
Horas semanales vacías
Jornada completa de referencia inválida
Parcialidad incoherente con las horas semanales
Horas mensuales/anuales incompletas
Jornada anual de convenio no informada
Sin complementos permanentes
Conceptos que no aplican parcialidad en contrato parcial
Parcialidad superior al 100%
```

Ejemplo:

```txt
Parcialidad incoherente con las horas
Con 30 h sobre 40 h, la parcialidad esperada sería 75%.
```

Valor docente:

```txt
El sistema detecta errores habituales del alumno y los convierte en aprendizaje.
```

## 7. Ajustes relacionados en Convenios

Durante este split también se corrigió y mejoró parte del módulo Convenios porque afecta directamente a jornada contractual.

### 7.1. Corrección de refresco tras crear reglas hijas

Archivo:

```txt
frontend/src/pages/CollectiveAgreementsPage.jsx
```

Problema detectado:

```txt
Al crear una regla de jornada, el backend devolvía el ID de la regla creada.
El frontend interpretaba ese ID como si fuera el ID del convenio.
Resultado: GET /collective-agreements/{id_regla} -> 404
```

Solución:

```txt
Al crear grupos, categorías, tablas, filas salariales, jornadas, vacaciones o permisos, se refresca siempre el convenio activo.
```

### 7.2. Mejora visual del historial de reglas

Archivo:

```txt
frontend/src/pages/CollectiveAgreementsPage.jsx
```

Cambio:

```txt
La tabla técnica de reglas se sustituye por un historial visual con contadores y tarjetas por tipo.
```

Tipos:

```txt
Jornada
Vacaciones
Permisos
```

Nota de diseño:

```txt
Esta mejora es funcional, pero se ha detectado que el módulo Convenios sigue teniendo una estética demasiado informal. Se recomienda rediseño profesional posterior.
```

## 8. Archivos modificados

### Backend

```txt
backend/app/models/contract.py
backend/app/schemas/contract.py
backend/app/crud/contract.py
backend/app/crud/payroll_salary_structure.py
backend/app/services/contract_salary_summary.py
backend/app/payroll_salary_structure_routes.py
backend/app/db_init.py
```

### Frontend

```txt
frontend/src/services/api.js
frontend/src/components/ContractForm.jsx
frontend/src/components/ContractTable.jsx
frontend/src/components/ContractSalarySummaryPanel.jsx
frontend/src/utils/contractPayloads.js
frontend/src/pages/CollectiveAgreementsPage.jsx
```

### Documentación

```txt
docs/splits/split-22-jornada-parcialidad-salario.md
docs/splits/split-22-1-redisenio-contratos-filtros-edicion.md
```

## 9. Validación manual recomendada

### 9.1. Backend

Arrancar backend:

```bash
cd backend
uvicorn app.main:app --reload
```

Probar resumen:

```http
GET /contracts/1/salary-summary
```

Probar simulación:

```http
POST /contracts/1/simulate-workday
```

Body:

```json
{
  "target_partiality_coefficient": 75
}
```

### 9.2. Frontend

Arrancar frontend:

```bash
cd frontend
npm run dev
```

Flujo de contrato parcial:

```txt
Crear contrato
Tipo jornada: parcial
Horas semanales: 20
Jornada completa referencia: 40
Parcialidad esperada: 50
Guardar
Abrir contrato
Ir a Resumen
Comprobar resumen retributivo
Simular 75%
```

Flujo de conceptos:

```txt
Crear concepto salarial con aplica jornada = Sí
Crear plus transporte con aplica jornada = No
Vincular ambos al contrato
Cargar conceptos en nómina
Comprobar que uno se reduce y otro no
```

Flujo de alertas:

```txt
Contrato sin salario base
Contrato parcial sin horas
Contrato con 30 h / 40 h pero parcialidad 50%
Contrato parcial con conceptos sin aplicar parcialidad
```

Flujo de convenios:

```txt
Crear convenio
Crear regla de jornada
Crear vacaciones
Comprobar que no aparece Convenio no encontrado
Comprobar historial visual de reglas
```

## 10. Limitaciones conocidas

Este split no implementa todavía:

```txt
control horario real
calendarios laborales
cómputo mensual exacto por días naturales/laborables
horas extra
absentismo
vacaciones consumidas
IT
regularizaciones de jornada a mitad de mes
histórico formal de cambios de jornada
cálculo de tramos de nómina
```

La fórmula:

```txt
monthly_hours = weekly_hours * 52 / 12
```

es una aproximación docente. No sustituye un calendario laboral real.

El coste empresa:

```txt
31,5%
```

es una estimación didáctica, no un cálculo oficial de cotización.

## 11. Siguiente split recomendado

### Split 23 — Rediseño profesional del módulo Convenios

Motivo:

```txt
Convenios funciona, pero visualmente sigue siendo demasiado informal y poco ERP.
```

Alcance recomendado:

```txt
Rediseñar cabecera del módulo
Añadir fecha de entrada en vigor y fecha de caducidad al crear convenio
Crear ficha profesional del convenio
Separar grupos/categorías en vista maestro-detalle
Convertir formularios grandes en modales o paneles laterales
Sustituir tarjetas llamativas por tablas profesionales
Añadir alertas inteligentes del convenio
```

Alertas recomendadas:

```txt
Convenio sin fecha de entrada en vigor
Convenio sin fecha fin
Convenio caducado
Convenio sin grupos profesionales
Convenio sin categorías
Convenio sin tabla salarial
Tabla salarial sin filas
Jornada anual no informada
Vacaciones no informadas
```

### Split 24 — Histórico de cambios contractuales y tramos de jornada

Motivo:

```txt
Para simular nóminas más realistas no basta con una jornada actual. Hace falta histórico por fechas.
```

Ejemplo:

```txt
01/01 - 14/01: 50%
15/01 - 31/01: 75%
```

Modelo futuro posible:

```txt
contract_workday_periods
- id
- contract_id
- start_date
- end_date
- weekly_hours
- full_time_weekly_hours
- partiality_coefficient
- reason
- notes
```

Uso futuro:

```txt
nómina proporcional por tramos
regularizaciones
IT con bases distintas
vacaciones según periodo
absentismo según jornada efectiva
```
