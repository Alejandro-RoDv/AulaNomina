# Split 29 - Paga extraordinaria por contrato

## Objetivo

Aplicar una paga extraordinaria configurada en el convenio a un contrato concreto y generar, de forma controlada, una nómina especial 13, 14 o 15.

El cálculo tiene en cuenta:

- vigencia del contrato durante el período de devengo,
- porcentaje de jornada,
- salario base del contrato,
- conceptos permanentes personalizados,
- ausencias no retribuidas,
- incapacidad temporal cuando la regla lo establezca,
- períodos de inactividad,
- duplicidad de nóminas especiales.

## Flujo funcional

Ruta:

`Convenios -> Estructura salarial -> Cálculo por contrato`

Pasos:

1. Seleccionar tabla salarial.
2. Seleccionar paga extraordinaria.
3. Seleccionar contrato.
4. Indicar ejercicio de abono.
5. Configurar las reglas de devengo.
6. Calcular la vista previa.
7. Revisar importes, días e incidencias.
8. Indicar IRPF automático o manual.
9. Generar la nómina especial.

## Reglas configurables

Cada paga extraordinaria incorpora:

- período de nómina:
  - 13: paga extra de verano,
  - 14: paga extra de diciembre,
  - 15: paga complementaria,
- aplicar parcialidad del contrato,
- descontar días de IT,
- descontar ausencias no retribuidas,
- descontar períodos de inactividad.

Valores iniciales conservadores:

- aplicar parcialidad: sí,
- descontar IT: no,
- descontar ausencias no retribuidas: sí,
- descontar inactividad: sí.

Estas reglas se guardan en la paga y se copian al crear una revisión de tabla salarial.

## Período de devengo

El sistema construye el período a partir de los meses configurados.

Ejemplos:

- enero a junio, abono en julio: enero-junio del ejercicio,
- julio a diciembre, abono en diciembre: julio-diciembre del ejercicio,
- julio a junio, abono en julio: julio del año anterior a junio del ejercicio.

Se utilizan días naturales del período.

## Vigencia del contrato

Solo devengan los días comprendidos simultáneamente entre:

- inicio y fin de devengo,
- fecha de alta y fecha de baja del contrato.

Un contrato finalizado puede aparecer en la simulación cuando haya generado derecho durante el período.

## Incidencias

Las incidencias se cruzan con los días en los que el contrato estaba vigente.

### Ausencias no retribuidas

Se identifican mediante las reglas actuales de incidencias que reducen días de cotización, por ejemplo:

- ausencia no retribuida,
- permiso no retribuido.

Solo descuentan cuando la paga lo tiene configurado.

### Incapacidad temporal

Se reconocen:

- IT,
- recaída,
- enfermedad común,
- accidente de trabajo.

La IT puede descontar o no devengo según la regla de cada paga.

### Inactividad

Se utilizan las fechas de inicio y retorno de inactividad del contrato.

La fecha de retorno se considera el primer día nuevamente activo.

### Solapamientos

Las exclusiones se calculan mediante conjuntos de fechas. Si una IT y una ausencia coinciden, el mismo día solo se descuenta una vez del devengo total.

## Resolución de importes

El cálculo utiliza esta prioridad:

1. Salario base guardado en el contrato.
2. Importe de concepto permanente activo del contrato.
3. Importe de la tabla salarial.
4. Importe fijo definido en la regla de paga.

Esto permite que una mejora, plus o complemento personalizado se refleje en la paga sin modificar la tabla general.

## Fórmula

Por cada concepto:

1. Se obtiene el importe base aplicable.
2. Se aplica el porcentaje configurado o el importe fijo.
3. Se aplica la parcialidad, si corresponde.
4. Se aplica la proporción de días devengados.

`importe final = importe completo x parcialidad x días devengados / días del período`

La vista previa muestra:

- importe de jornada completa,
- importe después de parcialidad,
- importe finalmente devengado.

## Bloqueos de generación

La nómina no puede generarse cuando:

- ya existe una nómina activa del mismo contrato, período y ejercicio,
- el contrato no tiene empresa,
- la paga o el contrato están configurados con pagas prorrateadas,
- el contrato no estuvo vigente durante el devengo,
- no quedan días devengados,
- el importe es cero.

## Generación de nómina

La acción crea:

- una cabecera `Payroll`,
- período 13, 14 o 15,
- bruto calculado,
- IRPF automático o manual,
- total de deducciones,
- neto,
- una línea `PayrollItem` por concepto participante.

Las líneas incluyen trazabilidad:

- origen del importe,
- parcialidad aplicada,
- días devengados,
- identificación de la paga.

## Cotización

La nómina especial se genera con bases de cotización a cero.

En el modelo educativo actual, la cotización de las pagas extraordinarias se integra mediante su prorrata en las bases mensuales ordinarias. La nómina especial no vuelve a cotizar para evitar duplicidades.

## Endpoints

### Vista previa

`GET /collective-agreements/extra-pays/{extra_pay_id}/contracts/{contract_id}/preview?period_year=2026`

### Generación

`POST /collective-agreements/extra-pays/{extra_pay_id}/contracts/{contract_id}/payroll`

Ejemplo:

```json
{
  "period_year": 2026,
  "irpf_percentage": 10,
  "status": "pending"
}
```

El porcentaje de IRPF puede enviarse como `null` para usar el cálculo automático.

## Base de datos

Se añaden a `agreement_extra_pays`:

- `payroll_period`,
- `apply_partiality`,
- `deduct_it_days`,
- `deduct_unpaid_absence_days`,
- `deduct_inactivity_days`.

Existe un parche conservador para bases ya creadas.

## Pruebas

Archivo:

`backend/tests/test_contract_extra_pay.py`

Casos cubiertos:

- alta posterior al inicio del devengo,
- contrato parcial,
- concepto permanente personalizado,
- ausencia no retribuida,
- IT que inicialmente no descuenta,
- activación del descuento por IT,
- generación de período 13,
- IRPF manual,
- suma de líneas igual al bruto,
- prevención de duplicados.

Ejecución:

```bash
cd backend
python -m unittest discover -s tests -p "test_*.py"
```

## Validación manual

1. Reiniciar backend y frontend.
2. Configurar una paga extraordinaria con conceptos.
3. Abrir `Cálculo por contrato`.
4. Seleccionar paga, contrato y ejercicio.
5. Revisar o guardar las reglas de devengo.
6. Pulsar `Calcular vista previa`.
7. Revisar días de vigencia, excluidos y devengados.
8. Revisar el origen de cada importe.
9. Introducir IRPF o dejarlo automático.
10. Pulsar `Generar nómina`.
11. Entrar en Nóminas y localizar el período 13, 14 o 15.
12. Comprobar las líneas de conceptos y el neto.
13. Volver a calcular la misma paga y comprobar que la generación queda bloqueada.

## Pendiente posterior

- generación masiva por empresa o centro,
- cálculo automático de prorrata en las doce nóminas mensuales,
- bases medias para conceptos variables,
- tratamiento avanzado de cambios de jornada dentro del devengo,
- histórico de cambios de reglas durante el período.
