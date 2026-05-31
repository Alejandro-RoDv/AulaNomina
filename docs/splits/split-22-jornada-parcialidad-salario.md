# Split 22 — Jornada, parcialidad y aplicación salarial

## Objetivo

Que AulaNomina entienda cuánto trabaja realmente una persona y pueda aplicar esa jornada a importes salariales de forma didáctica.

Este split no introduce control horario real. Deja preparada la base funcional para futuras horas extra, absentismo, vacaciones, IT y regularizaciones.

## Alcance implementado

### 1. Jornada contractual

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

Uso didáctico:

```txt
40 h semanales -> 100%
30 h semanales -> 75%
20 h semanales -> 50%
```

### 2. Autocálculo de parcialidad y horas

Al crear o editar contrato, backend y frontend calculan:

```txt
partiality_coefficient = weekly_hours / full_time_weekly_hours * 100
monthly_hours = weekly_hours * 52 / 12
annual_hours = weekly_hours * 52
```

Las horas mensuales y anuales se pueden corregir manualmente para casos docentes.

### 3. Aplicación del porcentaje de jornada a conceptos

Los conceptos salariales ya tenían:

```txt
applies_workday_percentage
```

Ahora se usa al cargar conceptos permanentes del contrato en una nómina.

Ejemplo:

```txt
Salario base: 2.000 €
Aplica jornada: Sí
Trabajador al 50%
Resultado: 1.000 €
```

Ejemplo sin reducción:

```txt
Plus transporte: 100 €
Aplica jornada: No
Trabajador al 50%
Resultado: 100 €
```

La línea de nómina generada deja nota:

```txt
Aplicado % jornada: 50.00%
```

O bien:

```txt
No aplica % jornada
```

### 4. Resumen retributivo contractual

Endpoint:

```http
GET /contracts/{contract_id}/salary-summary
```

Devuelve:

```txt
trabajador
tipo de jornada
horas semanales
horas mensuales
horas anuales
jornada anual convenio
porcentaje de parcialidad
salario base teórico
salario base aplicado
complementos permanentes originales
complementos permanentes aplicados
retribución mensual
retribución anual
coste empresa estimado
detalle línea a línea de conceptos
```

El coste empresa estimado usa una aproximación didáctica:

```txt
31,5% sobre la retribución anual
```

No debe tratarse como cálculo legal definitivo.

### 5. Simulación de cambio de jornada

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

Simulación por horas:

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

### 6. Frontend

Nuevo componente:

```txt
frontend/src/components/ContractSalarySummaryPanel.jsx
```

Integrado en:

```txt
frontend/src/components/ContractTable.jsx
```

Ruta visual:

```txt
Contratos -> Detalles -> Resumen retributivo
```

Permite ver:

```txt
salario teórico
salario aplicado
complementos aplicados
retribución mensual
retribución anual
coste empresa estimado
horas semanales/mensuales/anuales
conceptos permanentes
simulación antes/después
```

### 7. Archivos principales modificados

Backend:

```txt
backend/app/models/contract.py
backend/app/schemas/contract.py
backend/app/crud/contract.py
backend/app/crud/payroll_salary_structure.py
backend/app/services/contract_salary_summary.py
backend/app/payroll_salary_structure_routes.py
backend/app/db_init.py
```

Frontend:

```txt
frontend/src/services/api.js
frontend/src/components/ContractForm.jsx
frontend/src/components/ContractTable.jsx
frontend/src/components/ContractSalarySummaryPanel.jsx
frontend/src/utils/contractPayloads.js
```

## Validaciones manuales recomendadas

### Backend

```bash
cd backend
uvicorn app.main:app --reload
```

Probar:

```http
GET /contracts/1/salary-summary
```

```http
POST /contracts/1/simulate-workday
```

Body:

```json
{
  "target_partiality_coefficient": 75
}
```

### Frontend

```bash
cd frontend
npm run dev
```

Probar:

```txt
Contratos -> Detalles -> Resumen retributivo
```

Crear o editar un contrato parcial:

```txt
weekly_hours = 20
full_time_weekly_hours = 40
partiality_coefficient = 50
```

Crear conceptos permanentes:

```txt
Salario base o complemento salarial: aplica jornada = Sí
Plus transporte: aplica jornada = No
```

Cargar conceptos del contrato en nómina y comprobar importes.

## Pendiente para splits futuros

No abordar todavía en este split:

```txt
control horario real
calendarios laborales
cómputo mensual exacto por días naturales/laborables
horas extra
absentismo
vacaciones
IT
regularizaciones de jornada a mitad de mes
histórico de cambios de jornada
```

Siguiente split lógico:

```txt
Histórico de cambios contractuales y tramos de jornada
```

Ese split permitiría simular cambios reales dentro de un mes:

```txt
01/01 - 14/01: 50%
15/01 - 31/01: 75%
```
