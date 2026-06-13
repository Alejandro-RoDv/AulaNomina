# Split 29 - Pagas extraordinarias configurables

## Objetivo

Permitir definir manualmente qué integra cada paga extraordinaria de un convenio, versionando la regla por tabla salarial y categoría profesional.

Esta fase configura y simula la paga. Todavía no genera automáticamente una nómina de paga extra ni incorpora la prorrata al motor mensual.

## Modelo de datos

### AgreementExtraPay

Representa una paga extraordinaria:

- convenio,
- tabla salarial opcional,
- código interno,
- denominación,
- mes de abono,
- inicio del devengo,
- fin del devengo,
- número de meses de devengo,
- prorrateo permitido,
- prorrateo por defecto,
- estado,
- observaciones.

### AgreementExtraPayConcept

Representa la participación de un concepto salarial:

- paga extraordinaria,
- categoría profesional opcional,
- clave estable del concepto,
- denominación,
- modo de cálculo,
- porcentaje,
- importe fijo,
- orden,
- estado,
- observaciones.

Una regla específica de categoría prevalece sobre una regla general con la misma clave de concepto.

## Interfaz

Ruta funcional:

`Convenios -> Estructura salarial -> Pagas extraordinarias`

La pantalla permite:

1. Seleccionar tabla salarial.
2. Seleccionar categoría profesional.
3. Crear o editar una paga.
4. Configurar período de devengo y mes de abono.
5. Permitir o impedir el prorrateo.
6. Añadir conceptos salariales.
7. Aplicar un porcentaje del concepto.
8. Aplicar un importe fijo.
9. Crear reglas generales o específicas de categoría.
10. Eliminar conceptos o la paga completa.
11. Calcular una vista previa.

## Conceptos disponibles

La lista utiliza el mismo resolvedor empleado por contratos y migraciones salariales.

Puede incluir:

- salario base,
- antigüedad,
- plus convenio,
- complemento específico,
- conceptos generales,
- conceptos específicos de categoría,
- otros conceptos salariales o no salariales configurados.

Las deducciones se excluyen de la selección.

## Vista previa

La vista previa resuelve la estructura salarial para una tabla y categoría.

Por cada línea muestra:

- concepto,
- importe base,
- porcentaje o importe fijo,
- importe computable,
- incidencias de resolución.

El resultado incluye:

- importe íntegro de la paga,
- prorrata mensual teórica,
- mes de abono,
- período de devengo,
- líneas incluidas,
- líneas no resueltas.

### Fórmula porcentual

`importe computable = importe del concepto x porcentaje / 100`

### Fórmula fija

`importe computable = importe fijo configurado`

### Prorrata

`prorrata mensual = importe íntegro / meses de devengo`

Solo se calcula cuando el prorrateo está permitido.

## Reglas de precedencia

Cuando existen dos líneas con la misma clave:

- una general,
- otra para la categoría seleccionada,

se aplica la específica de categoría.

## Versionado anual

Las pagas pueden vincularse a una tabla salarial concreta.

Al crear una revisión anual se pueden copiar:

- definición de pagas,
- períodos de devengo,
- configuración de prorrateo,
- conceptos participantes,
- porcentajes,
- importes fijos,
- ámbitos por categoría.

Los porcentajes e importes fijos propios de la paga se copian sin incremento automático. La subida general se aplica a las filas y conceptos salariales de la tabla, no a la regla interna de la paga.

## Endpoints

- `GET /collective-agreements/{agreement_id}/extra-pays`
- `POST /collective-agreements/{agreement_id}/extra-pays`
- `PUT /collective-agreements/extra-pays/{extra_pay_id}`
- `DELETE /collective-agreements/extra-pays/{extra_pay_id}`
- `POST /collective-agreements/extra-pays/{extra_pay_id}/concepts`
- `PUT /collective-agreements/extra-pay-concepts/{concept_line_id}`
- `DELETE /collective-agreements/extra-pay-concepts/{concept_line_id}`
- `GET /collective-agreements/{agreement_id}/extra-pay-candidates`
- `GET /collective-agreements/extra-pays/{extra_pay_id}/preview`

## Validaciones

- Meses entre 1 y 12.
- Devengo entre 1 y 12 meses.
- No se permite prorrateo por defecto si está prohibido.
- Porcentaje entre 0 y 1000.
- Importe fijo no negativo.
- Tabla y categoría deben pertenecer al convenio.
- No se repite una paga con el mismo código en la misma tabla.
- No se repite un concepto para la misma paga y ámbito.
- Las deducciones no se ofrecen como conceptos participantes.

## Pruebas

Archivo:

`backend/tests/test_agreement_extra_pay.py`

Ejecución:

```bash
cd backend
python -m unittest discover -s tests -p "test_*.py"
```

Casos cubiertos:

- exclusión de deducciones,
- resolución de salario base y complementos,
- prevalencia de categoría sobre regla general,
- cálculo porcentual,
- cálculo fijo,
- prorrata mensual,
- copia de pagas y líneas al duplicar una tabla salarial.

## Validación manual

1. Reiniciar backend y frontend.
2. Entrar en `Convenios -> Estructura salarial`.
3. Abrir `Configurar pagas extra`.
4. Seleccionar tabla y categoría.
5. Crear `Paga de verano`.
6. Indicar abono en julio y devengo de enero a junio.
7. Añadir salario base al 100 %.
8. Añadir plus convenio al porcentaje deseado.
9. Añadir una regla específica para una categoría.
10. Calcular la vista previa.
11. Comprobar importe íntegro y prorrata.
12. Crear una revisión de tabla salarial.
13. Mantener marcada `Copiar pagas extraordinarias`.
14. Verificar las pagas en la tabla nueva.

## Pendiente posterior

- Calcular paga extra para un contrato concreto y su jornada.
- Ajustar por altas, bajas, IT y períodos no devengados.
- Crear automáticamente la nómina especial 13, 14 o 15.
- Incorporar la prorrata al cálculo mensual.
- Permitir bases medias o variables durante el período de devengo.
