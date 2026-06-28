# Split 33 — Motor de incidencias y segmentación de nómina

## Objetivo

Resolver las tres limitaciones prioritarias del Split 32:

1. Motor de reglas para IT, absentismo, vacaciones y horas extraordinarias.
2. Generación automática e idempotente de líneas `PayrollItem`.
3. Segmentación intramensual auditable.

La arquitectura separa el registro de la incidencia, la interpretación jurídica, la segmentación temporal y la persistencia económica. El frontend no realiza cálculos jurídicos.

## Principios

- Una incidencia es el origen; una nómina es el destino.
- Cada resultado automático debe conservar su origen y su traza.
- Reprocesar una nómina no puede duplicar líneas.
- Una regla debe poder cambiar por fecha y convenio sin reescribir el motor.
- Los días naturales de prestación y los días salariales normalizados no se confunden.
- Las nóminas cerradas no se reescriben: generan necesidad de regularización.

## Paso 1 — Modelo de dominio

### Regla versionada

`IncidentCalculationRule` define:

- tipo de incidencia y proceso;
- convenio opcional;
- vigencia;
- prioridad;
- bandas por día de proceso;
- tratamiento salarial, de cotización y fiscal;
- referencia normativa o convencional.

### Segmento intramensual

`PayrollSegment` conserva:

- periodo real de calendario;
- días naturales;
- días salariales normalizados;
- incidencia origen;
- día inicial y final del proceso;
- porcentajes aplicados;
- base diaria;
- salario, prestación, complemento y deducción;
- traza del cálculo;
- clave idempotente.

### Origen de líneas de nómina

`PayrollItem` se amplía con:

- `source_type`;
- `source_id`;
- `source_key` único;
- `segment_id`;
- `is_automatic`;
- `calculation_trace`;
- `updated_at`.

## Paso 2 — Segmentador temporal

El periodo mensual se recorre día a día y se comprime en segmentos consecutivos con la misma regla.

Se separan:

- días naturales, usados en prestaciones;
- días salariales, normalizados a 30 para trabajadores mensuales;
- días de cotización;
- días trabajados;
- umbrales jurídicos del proceso de IT.

Los puntos de corte incluyen:

- inicio y fin de cada incidencia;
- día 4, 16 y 21 en contingencias comunes;
- día 2 en accidente de trabajo o enfermedad profesional;
- cambios de regla por convenio o fecha.

## Paso 3 — Motor por subtipo

### IT común y accidente no laboral

- días 1 a 3: sin prestación legal general;
- días 4 a 15: 60 %, a cargo empresarial;
- días 16 a 20: 60 %, pago delegado;
- desde el día 21: 75 %.

### Accidente de trabajo y enfermedad profesional

- día de la baja: salario íntegro a cargo empresarial;
- desde el día siguiente: 75 % de base reguladora.

### Prestaciones protegidas

Nacimiento y cuidado, riesgo durante embarazo o lactancia y cuidado de menor se modelan mediante perfiles configurables. El perfil general inicial admite sustitución al 100 %, pero queda separado para permitir reglas específicas posteriores.

### Absentismo

- permiso retribuido: informativo, sin descuento;
- ausencia y permiso no retribuido: deducción salarial;
- suspensión y sanción: deducción y tratamiento de cotización configurable;
- causa y convenio pueden sobreescribir el perfil general.

### Vacaciones

- no reducen salario ni cotización;
- generan segmento e información de días disfrutados;
- sirven como base para el futuro saldo anual.

### Horas extraordinarias

- cantidad = horas;
- precio = valor hora configurado;
- nunca inferior al valor ordinario cuando se abonan;
- pueden marcarse como compensadas con descanso y entonces no generan importe.

## Paso 4 — Generación automática de PayrollItem

El sincronizador genera o actualiza líneas por `source_key`:

- deducción de salario no trabajado;
- prestación de IT;
- complemento empresarial;
- horas extraordinarias;
- líneas informativas de vacaciones o permisos.

Si una línea previa ya no corresponde, se elimina únicamente cuando es automática y pertenece al motor de incidencias.

## Paso 5 — Integración con nómina

Nuevo servicio de procesamiento:

1. valida que la nómina sea mensual;
2. recupera incidencias activas;
3. resuelve reglas;
4. genera segmentos;
5. sincroniza `PayrollItem`;
6. recalcula importes persistidos;
7. marca incidencias como procesadas;
8. conserva traza y advertencias.

Una nómina cerrada devuelve conflicto y exige regularización.

## Paso 6 — API

- `POST /payrolls/{payroll_id}/process-incidents`
- `GET /payrolls/{payroll_id}/segments`
- `GET /payrolls/{payroll_id}/incident-calculation`
- CRUD posterior de reglas parametrizables.

## Paso 7 — Pruebas

Casos mínimos:

- IT común del día 1 al 25 con cuatro bandas;
- accidente laboral iniciado a mitad de mes;
- IT que cruza dos meses;
- recaída con fecha de proceso original;
- ausencia no retribuida parcial;
- vacaciones sin descuento;
- horas extra pagadas y compensadas;
- reprocesado idempotente;
- cambio de incidencia que actualiza líneas existentes;
- nómina cerrada bloqueada;
- suma de días salariales igual a 30 en meses de 28, 30 y 31 días.

## Alcance de esta ejecución

Esta rama implementa el modelo, el segmentador, las reglas legales generales, la generación automática de líneas, la API y los tests del núcleo. Los complementos concretos de cada convenio se resolverán mediante reglas versionadas y no se codifican como excepciones fijas.