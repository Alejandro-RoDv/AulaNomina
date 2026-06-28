# Split 34 — Incidencias avanzadas

## Alcance

Este incremento completa el motor del Split 33 con:

- bases reguladoras específicas para tiempo parcial y fijo discontinuo;
- promedio de horas extraordinarias de doce meses en contingencias profesionales;
- complementos de IT parametrizados por convenio;
- tratamiento de cotización por causa de ausencia;
- segmentación de conceptos permanentes del contrato;
- regularizaciones en una nómina posterior;
- libro y saldo anual de vacaciones;
- CRUD docente de reglas;
- visualización de segmentos y trazas en el histórico de nóminas.

## Reglas avanzadas

### Tiempo parcial y fijo discontinuo

La base diaria utiliza las bases acreditadas durante un máximo de tres meses anteriores y los días naturales comprendidos en el período. Para fijos discontinuos el período comienza en el último llamamiento cuando esa fecha está disponible.

### Contingencias profesionales

La base profesional añade al componente ordinario el promedio diario de horas extraordinarias abonadas en los doce meses anteriores.

### Convenios

Las reglas `it_complement` permiten fijar un porcentaje objetivo, vigencia, prioridad y bandas. Las reglas `absence_contribution` permiten configurar `maintain`, `minimum` o `reduce`.

La marca `minimum` conserva la situación de alta y su traza. La cuantía exacta de la base mínima se conectará al futuro catálogo anual de bases y topes.

## Conceptos salariales

Cada concepto permanente se distribuye por segmento y conserva una clave idempotente. Los conceptos con `mantener en it` o `maintain_it` en sus notas no se reducen durante un proceso médico.

## Regularizaciones

Una nómina cerrada nunca se reescribe. El sistema calcula la diferencia y genera una línea automática en una nómina abierta posterior o, si no existe, en una complementaria de período 15.

## Vacaciones

El libro registra devengo proporcional, disfrute, arrastre y ajustes docentes. Usa la regla de convenio y, en su ausencia, 30 días naturales anuales.

## Interfaz

- Convenios → Criterios laborales → Reglas de incidencias.
- Histórico de nóminas → Conceptos → Segmentos y trazas.

## API

- `GET|POST /incidents/calculation-rules`
- `PUT /incidents/calculation-rules/{rule_id}`
- `POST /incidents/calculation-rules/{rule_id}/deactivate`
- `GET /incidents/employees/{employee_id}/vacation-balance`
- `POST /incidents/contracts/{contract_id}/vacation-adjustments`
- `POST /incidents/{incident_id}/generate-regularization`
- `GET /incidents/{incident_id}/regularizations`

Esta rama depende de Split 33 y debe integrarse después de la PR #32.
