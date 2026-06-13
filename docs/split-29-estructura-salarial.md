# Split 29 - Estructura salarial del convenio

## Objetivo

Sustituir el uso exclusivo de filas rígidas con cuatro importes por una estructura salarial editable, versionada por tabla anual y organizada por categoría profesional.

La información continúa siendo manual y didáctica. El módulo no interpreta automáticamente el texto de un convenio ni impone cálculos reales.

## Navegación

El módulo Convenios dispone de tres áreas:

1. `Gestión del convenio`
2. `Estructura salarial`
3. `Criterios laborales`

## Modelo de datos

`AgreementSalaryConcept` incorpora `salary_table_id`.

Cada concepto puede quedar asociado a:

- convenio,
- tabla salarial anual,
- categoría profesional opcional,
- concepto de catálogo opcional.

Esto permite conservar estructuras distintas para 2025, 2026, revisiones salariales o tablas de atrasos sin sobrescribir ejercicios anteriores.

Los conceptos sin `salary_table_id` se consideran referencias generales heredadas y siguen siendo compatibles con los datos existentes.

## Pantalla Estructura salarial

### Selector superior

Permite elegir la tabla salarial por:

- nombre,
- ejercicio,
- estado.

### Panel izquierdo

Lista manual de categorías profesionales ya creadas en el convenio.

Incluye:

- aplicación general,
- nombre de categoría,
- código o nivel,
- número de conceptos aplicables.

Cuando se selecciona una categoría, se muestran tanto sus conceptos específicos como los conceptos generales del convenio.

### Panel derecho

Muestra:

- categoría seleccionada,
- fila salarial histórica de referencia,
- salario base,
- plus convenio,
- antigüedad,
- complemento específico,
- total de la fila,
- totales salariales, no salariales y deducciones,
- tabla de conceptos editables.

### Campos de un concepto

- catálogo opcional,
- denominación,
- carácter:
  - salarial,
  - no salarial,
  - deducción,
- importe o valor,
- forma de pago:
  - mensual,
  - anual,
  - diario,
  - paga extra,
  - por unidad,
  - pago único,
- forma de cálculo:
  - importe fijo,
  - porcentaje,
  - por unidad,
  - manual,
  - sin definir,
- cotiza,
- tributa en IRPF,
- código CRA,
- observaciones.

La pantalla permite crear, editar y eliminar conceptos.

## Conversión de filas anteriores

La acción `Crear desde fila salarial` transforma, cuando tengan importe, los campos históricos:

- salario base,
- plus convenio,
- antigüedad,
- complemento específico.

La operación:

- crea conceptos para la tabla y categoría seleccionadas,
- no crea conceptos con importe cero,
- evita duplicados por denominación dentro de la misma tabla y categoría,
- conserva la fila salarial original como referencia.

## Revisión y duplicación de tablas salariales

La acción `Crear nueva revisión` permite generar un ejercicio nuevo a partir de una tabla existente.

### Datos de la revisión

- tabla de origen,
- nombre de la nueva tabla,
- ejercicio,
- fecha de inicio y fin,
- estado inicial,
- porcentaje de incremento,
- observaciones.

### Opciones

- copiar filas salariales,
- copiar conceptos editables,
- aplicar el incremento a conceptos no salariales,
- marcar la tabla de origen como histórica.

### Comportamiento

La operación se ejecuta en una única transacción:

- se crea la nueva tabla,
- se copian sus filas,
- se copian los conceptos vinculados a la tabla de origen,
- se aplica el porcentaje a importes salariales,
- los conceptos no salariales solo se incrementan si se marca expresamente,
- las deducciones se copian sin incremento,
- los conceptos generales sin versión no se duplican porque continúan heredándose,
- si falla cualquier elemento, se revierte toda la operación.

El API impide crear otra tabla con el mismo nombre y ejercicio dentro del convenio.

Endpoint:

`POST /collective-agreements/salary-tables/{source_table_id}/duplicate`

## Validaciones backend

El API comprueba que:

- la tabla salarial pertenece al convenio,
- la categoría profesional pertenece al convenio,
- el concepto de catálogo pertenece al convenio.

No se permite vincular accidentalmente datos de convenios diferentes.

## Integración con contratos

Al cargar conceptos de convenio en un contrato:

1. se resuelve su fila salarial;
2. se identifica la tabla salarial de esa fila;
3. se cargan conceptos generales sin versión y conceptos de la tabla exacta;
4. se priorizan conceptos de la tabla exacta;
5. se priorizan conceptos específicos de la categoría;
6. se evita mezclar ejercicios salariales diferentes.

## Validación manual

1. Reiniciar backend para aplicar la columna `salary_table_id`.
2. Entrar en Convenios.
3. Crear al menos una tabla salarial y una categoría.
4. Crear una fila salarial para esa categoría.
5. Abrir `Estructura salarial`.
6. Seleccionar tabla y categoría.
7. Pulsar `Crear desde fila salarial`.
8. Comprobar la aparición de los conceptos con sus importes.
9. Crear un concepto manual con cotización, IRPF y CRA.
10. Editarlo y eliminarlo.
11. Abrir `Crear nueva revisión`.
12. Seleccionar la tabla de origen.
13. Indicar el nuevo ejercicio y un porcentaje de incremento.
14. Crear la revisión.
15. Verificar que aparecen la tabla nueva, sus filas y sus conceptos.
16. Comparar los importes con la tabla de origen.
17. Comprobar que las deducciones no han sido incrementadas.
18. Comprobar que los conceptos generales no se han duplicado.
19. Vincular un contrato a la categoría y fila salarial nueva.
20. Usar `Cargar desde convenio` en Conceptos permanentes.
21. Verificar que se importan los conceptos del ejercicio correspondiente.

## Pendiente posterior

- Activación controlada de una tabla y cierre automático de la anterior.
- Revisión salarial selectiva por concepto o categoría.
- Conceptos participantes en pagas extraordinarias.
- Fórmulas de porcentaje y cálculo por unidad.
- Histórico de cambios y fecha de publicación de cada revisión.
