# Split 29 - Prorrata mensual de pagas extraordinarias

## Objetivo

Aplicar automáticamente en las nóminas ordinarias la prorrata de las pagas extraordinarias configuradas en el convenio cuando el contrato utiliza doce pagas.

La funcionalidad sustituye la cifra genérica anterior por un cálculo basado en:

- convenio del contrato,
- tabla salarial,
- categoría profesional,
- pagas activas,
- conceptos participantes,
- importes personalizados del contrato,
- jornada,
- período de devengo,
- incidencias e inactividad.

## Contratos afectados

La prorrata configurada se aplica cuando:

- el período de nómina está entre 1 y 12,
- `pay_schedule = prorated_12`,
- el contrato tiene convenio,
- el contrato tiene categoría profesional,
- el contrato tiene fila de tabla salarial,
- existen pagas activas que permiten prorrateo.

En los períodos 13, 14 y 15 la prorrata mensual es siempre cero.

## Compatibilidad con contratos antiguos

Cuando falta alguno de los datos necesarios o no existen pagas configuradas, se conserva el cálculo histórico:

`((salario / 14) x 2) / 12`

El resultado queda identificado con origen `legacy` para distinguirlo del cálculo parametrizado.

## Selección de pagas

Se cargan pagas del mismo convenio que:

- estén activas,
- permitan prorrateo,
- sean generales o correspondan a la tabla salarial del contrato.

Si existe una paga general y otra específica de tabla con el mismo código o nombre, prevalece la específica.

## Meses de aplicación

Cada paga se aplica únicamente durante sus meses de devengo.

Ejemplos:

- enero a junio: se prorratea en enero, febrero, marzo, abril, mayo y junio;
- julio a diciembre: se prorratea de julio a diciembre;
- julio a junio: se aplica en los doce meses atravesando el cambio de ejercicio.

## Resolución de importes

Por cada concepto participante se utiliza esta prioridad:

1. Salario base del contrato.
2. Concepto permanente activo del contrato.
3. Importe de la tabla salarial.
4. Importe fijo configurado en la paga.

Después se aplican:

1. porcentaje o importe fijo,
2. parcialidad, cuando la paga lo establece,
3. división entre meses de devengo,
4. proporción de días del mes con derecho a devengo.

## Fórmula

Por cada concepto:

`importe mensual = importe de paga x parcialidad / meses de devengo`

Cuando existen días excluidos:

`importe final = importe mensual x días con derecho / días naturales del mes`

El total de la cabecera es la suma redondeada de todas las líneas.

## Incidencias

Se reutilizan las reglas configuradas en la paga:

- descontar IT,
- descontar ausencia no retribuida,
- descontar inactividad.

Los días se calculan como conjuntos de fechas. Un día coincidente en varias incidencias solo se descuenta una vez.

La incidencia se evalúa en el mes de nómina, sin anticipar incidencias futuras del resto del período de devengo.

## Bases de cotización

La prorrata:

- forma parte del bruto,
- forma parte de la base de contingencias comunes,
- forma parte de la base profesional,
- forma parte de desempleo, formación y FOGASA,
- forma parte de la base de IRPF.

La prorrata ya llega ajustada por sus días de devengo. El motor la incorpora directamente a las bases para evitar reducirla una segunda vez mediante el coeficiente general de días cotizados.

## Persistencia

La cabecera de nómina guarda:

- `extra_pay_proration`: total mensual.

El desglose crea una línea automática por concepto participante.

Los códigos comienzan por:

`PRORRATA_EXTRA_`

Esto permite:

- identificarlas,
- sustituirlas al recalcular,
- impedir duplicados,
- conservar conceptos manuales,
- mostrar el origen en el recibo.

La creación y sustitución de líneas se realiza en la misma transacción que la cabecera de nómina.

## Recalculo

Al editar o recalcular una nómina:

1. se recalcula la prorrata,
2. se eliminan sus líneas automáticas anteriores,
3. se crean las nuevas líneas,
4. se conservan las líneas manuales,
5. se confirma toda la operación conjuntamente.

## Preparación mensual

En `Nóminas -> Preparación mensual` se muestra:

- prorrata de cada nómina,
- bruto total,
- suma de prorratas del lote,
- incidencias y estado.

## Recibo individual

El recibo muestra una línea por paga y concepto cuando existe desglose automático.

Las líneas automáticas no activan por sí solas el modo de desglose manual.

Cuando hay conceptos manuales, ambos grupos se presentan conjuntamente, pero se mantienen diferenciados internamente.

## Simulación futura

La simulación muestra:

- prorrata mensual,
- suma prevista de prorratas,
- origen del cálculo:
  - Convenio,
  - Histórica,
  - No aplica.

También incorpora el importe al bruto, cotizaciones, IRPF y neto proyectados.

## Pruebas

Archivo:

`backend/tests/test_monthly_extra_pay_proration.py`

Casos cubiertos:

- contrato al 50 %,
- alta posterior al inicio del semestre,
- permiso no retribuido,
- reducción configurable por IT,
- ajuste de días una sola vez,
- inclusión en bruto y bases,
- persistencia de líneas automáticas,
- recalculo idempotente,
- período 13 sin prorrata mensual,
- fallback histórico.

Ejecución:

```bash
cd backend
python -m unittest discover -s tests -p "test_*.py"
```

## Validación manual

1. Crear una paga con devengo enero-junio.
2. Añadir salario base y un complemento participante.
3. Marcar el contrato como doce pagas.
4. Preparar una nómina entre enero y junio.
5. Comprobar la columna `Prorrata extra`.
6. Abrir el recibo.
7. Revisar las líneas automáticas.
8. Revisar bases de cotización e IRPF.
9. Editar y guardar la nómina.
10. Verificar que las líneas no se duplican.
11. Añadir una ausencia no retribuida y recalcular.
12. Comprobar la reducción proporcional.
13. Simular meses futuros y revisar el origen.
14. Generar un período 13 y comprobar que la prorrata mensual es cero.

## Pendiente posterior

- histórico de cambios de jornada dentro de un mismo mes,
- medias de conceptos variables,
- tratamiento de cambios de tabla durante el devengo,
- generación de informes anuales de prorrata,
- regularizaciones retroactivas por modificación de una paga ya devengada.
