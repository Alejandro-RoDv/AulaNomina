# Split 34 — Cálculo avanzado de IT

## Objetivo

Ampliar el motor del Split 33 sin introducir excepciones rígidas en el segmentador.

1. Base reguladora específica para contratos a tiempo parcial y fijos discontinuos.
2. Base profesional separando horas extraordinarias del mes anterior y añadiendo su promedio anual.
3. Complementos de IT configurables desde las reglas parametrizadas del convenio.

## Base reguladora

### Tiempo completo mensual

Se conserva la regla del Split 33: base de cotización del mes anterior dividida entre los días cotizados.

### Tiempo parcial y fijo discontinuo

Se agregan las bases de contingencias del periodo de referencia anterior y se dividen entre los días efectivamente cotizados de ese periodo. El periodo general inicial es de tres meses y queda identificado en la traza.

Cuando faltan meses se utilizan únicamente los periodos disponibles y se genera una advertencia. Si no existe ninguno, se mantiene el respaldo salarial explícito del Split 33.

### Contingencias profesionales

La base diaria se divide en dos componentes:

- base profesional ordinaria del mes anterior, excluyendo las horas extra identificadas;
- promedio diario de horas extraordinarias de los doce meses anteriores.

La traza conserva ambos componentes y las nóminas utilizadas.

## Complementos de convenio

Se reutilizan `AgreementRuleHeader` y `AgreementRuleDetail`.

Cabecera:

- `rule_type`: `it_complement`;
- `effective_from` y `effective_to`;
- `options.process_types`: procesos admitidos;
- `options.target_percentage`: porcentaje por defecto;
- ámbito global o por categoría.

Detalles:

- `minimum_value`: primer día del tramo;
- `maximum_value`: último día, opcional;
- `percentage` o `company_percentage`: porcentaje objetivo total;
- `professional_category_id`: restricción opcional;
- `options.process_types`: sobreescritura opcional del proceso.

El porcentaje empresarial es la diferencia positiva entre el objetivo del convenio y la prestación legal. Nunca reduce la prestación ni genera complemento negativo.

## Trazabilidad

Cada segmento incorpora:

- método de base reguladora;
- nóminas de referencia;
- suma de bases y días;
- horas extra del mes anterior;
- promedio anual de horas extra;
- regla de convenio y tramo aplicados;
- porcentaje objetivo y porcentaje empresarial resultante.
