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

Las revisiones se crean como borrador, pendientes de revisión o históricas. No pueden activarse directamente desde este formulario.

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

## Activación controlada

El bloque `Activación y migración` separa el cambio de estado de la modificación de contratos.

### Vista previa

Antes de activar una tabla se obtiene una vista previa con:

- tablas activas actuales,
- contratos activos o todos los contratos,
- contratos migrables,
- contratos que ya utilizan la tabla,
- contratos bloqueados,
- motivo del bloqueo,
- salario base de la fila destino,
- categorías con filas duplicadas,
- comparación de conceptos permanentes.

Un contrato queda bloqueado cuando:

- no tiene categoría profesional vinculada,
- la tabla destino no contiene una fila para su categoría.

Endpoint:

`GET /collective-agreements/salary-tables/{table_id}/activation-preview`

### Activación

La acción `Activar tabla`:

- marca la tabla elegida como activa,
- convierte en históricas las demás tablas activas del convenio,
- no modifica contratos,
- no modifica salarios,
- no modifica conceptos permanentes.

Endpoint:

`POST /collective-agreements/salary-tables/{table_id}/activate`

### Comparación de conceptos permanentes

Para cada contrato migrable se comparan los conceptos actuales con los que corresponderían en la tabla nueva.

Estados disponibles:

- `Nuevo`: todavía no existe en el contrato.
- `Importe distinto`: existe, pero el importe no coincide.
- `A reactivar`: existe, pero está desactivado.
- `Sin cambios`: ya coincide con la estructura nueva.
- `Posible baja`: pertenece al convenio anterior y ya no existe en la estructura destino.
- `Conservado`: concepto personalizado o de sistema que no debe tocarse.

La selección por defecto incluye únicamente:

- conceptos nuevos,
- conceptos con cambio de importe,
- conceptos que deben reactivarse.

Las posibles bajas requieren selección expresa. Los conceptos sin cambios, personalizados y de sistema no se pueden modificar desde esta operación.

La comparación utiliza el código estable del concepto de convenio. Un cambio de denominación no crea por sí solo un duplicado.

### Migración explícita de contratos

Después de activar la tabla se pueden seleccionar los contratos migrables.

La migración:

- vincula cada contrato a la fila equivalente de la tabla nueva,
- ignora contratos sin categoría o sin fila equivalente,
- permite conservar el salario base actual,
- permite sustituir expresamente el salario base por el de la nueva fila,
- crea únicamente los conceptos seleccionados,
- actualiza únicamente los importes seleccionados,
- reactiva únicamente los conceptos seleccionados,
- desactiva únicamente las posibles bajas seleccionadas,
- conserva los conceptos personalizados y de sistema.

La fila salarial, el salario base y las acciones de conceptos se ejecutan dentro de la misma transacción. Si falla una acción seleccionada, se revierte la operación completa.

Endpoint:

`POST /collective-agreements/salary-tables/{table_id}/migrate-contracts`

El cuerpo admite `concept_actions`, con:

- `contract_id`,
- `concept_key`,
- `action`: `upsert` o `deactivate`.

## Validaciones backend

El API comprueba que:

- la tabla salarial pertenece al convenio,
- la categoría profesional pertenece al convenio,
- el concepto de catálogo pertenece al convenio,
- la tabla está activa antes de migrar contratos,
- los contratos pertenecen al convenio de la tabla,
- existe una fila equivalente para la categoría,
- las acciones de conceptos pertenecen a contratos seleccionados,
- solo se desactivan conceptos obsoletos y activos del convenio,
- los conceptos personalizados y de sistema no reciben acciones automáticas.

No se permite vincular accidentalmente datos de convenios diferentes.

## Integración con contratos

Al cargar conceptos de convenio en un contrato:

1. se resuelve su fila salarial;
2. se identifica la tabla salarial de esa fila;
3. se cargan conceptos generales sin versión y conceptos de la tabla exacta;
4. se priorizan conceptos de la tabla exacta;
5. se priorizan conceptos específicos de la categoría;
6. se evita mezclar ejercicios salariales diferentes.

## Pruebas

Se incluyen pruebas con `unittest` y SQLite en memoria:

`backend/tests/test_salary_table_concept_migration.py`

Ejecución desde `backend`:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

Casos cubiertos:

- clasificación de nuevos, modificados, reactivados y obsoletos,
- conservación de conceptos personalizados,
- aplicación exacta de acciones seleccionadas,
- migración conjunta de fila salarial, salario base y conceptos.

## Validación manual

1. Reiniciar backend.
2. Entrar en Convenios.
3. Crear al menos una tabla salarial y una categoría.
4. Crear una fila salarial para esa categoría.
5. Abrir `Estructura salarial`.
6. Seleccionar tabla y categoría.
7. Pulsar `Crear desde fila salarial`.
8. Crear una revisión del ejercicio siguiente.
9. Abrir `Gestionar activación`.
10. Seleccionar la tabla nueva.
11. Pulsar `Revisar contratos afectados`.
12. Comprobar migrables, bloqueados y ya actualizados.
13. Revisar la comparación de conceptos.
14. Mantener seleccionados los cambios recomendados.
15. Seleccionar expresamente cualquier posible baja que deba desactivarse.
16. Activar la tabla.
17. Verificar que la anterior pasa a histórica.
18. Seleccionar uno o varios contratos migrables.
19. Decidir si se actualiza también el salario base.
20. Migrar los contratos seleccionados.
21. Revisar el resumen de conceptos creados, actualizados, reactivados y desactivados.
22. Volver a ejecutar la vista previa.
23. Comprobar que los contratos aparecen como `Ya actualizada`.

## Pendiente posterior

- Revisión salarial selectiva por categoría antes de duplicar la tabla.
- Conceptos participantes en pagas extraordinarias.
- Fórmulas de porcentaje y cálculo por unidad.
- Histórico de cambios y fecha de publicación de cada revisión.
