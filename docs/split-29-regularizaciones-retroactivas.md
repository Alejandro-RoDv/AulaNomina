# Split 29 - Regularizaciones retroactivas por revisión salarial

## Objetivo

Calcular y liquidar diferencias salariales cuando una nueva tabla de convenio tiene efectos anteriores a su activación o a la migración de los contratos.

El proceso no modifica las nóminas históricas. Genera una nómina complementaria independiente y conserva un desglose trazable de cada diferencia.

## Ubicación

`Convenios -> Estructura salarial -> Regularización retroactiva`

El flujo recomendado es:

1. Crear una revisión de la tabla salarial.
2. Revisar y activar la tabla nueva.
3. Migrar los contratos cuando corresponda.
4. Calcular los atrasos.
5. Revisar trabajadores e importes.
6. Generar las nóminas complementarias.

La migración actualiza el contrato hacia adelante. La regularización liquida las diferencias del pasado. Son procesos distintos.

## Tablas comparadas

La vista previa necesita:

- tabla salarial de origen;
- tabla salarial de destino;
- fecha inicial;
- fecha final.

Las tablas deben:

- ser diferentes;
- pertenecer al mismo convenio;
- contener una fila para la categoría profesional del contrato.

La generación exige que la tabla de destino esté activa. Una tabla en borrador puede utilizarse para revisar diferencias, pero no para liquidarlas.

## Período

La primera versión admite períodos contenidos dentro de un único ejercicio.

Ejemplo válido:

`01/01/2026 - 31/05/2026`

Ejemplo bloqueado:

`01/10/2025 - 31/03/2026`

La nómina complementaria se crea en el período 15 del ejercicio seleccionado.

## Nóminas históricas incluidas

Se revisan las nóminas:

- correspondientes al contrato;
- comprendidas entre los meses 1 y 12;
- del ejercicio seleccionado;
- con estado borrador, pendiente, calculada, revisada o cerrada;
- cuyo mes se solape con el período retroactivo.

No se modifican sus importes, estados ni líneas.

## Conceptos comparados

La vista previa permite incluir o excluir:

- salario base;
- conceptos salariales versionados;
- conceptos no salariales;
- prorrata de pagas extraordinarias.

Los conceptos de tabla se resuelven con el mismo mecanismo usado en la migración contractual. Esto evita que un plus se duplique por existir simultáneamente en una fila salarial y en el catálogo parametrizado.

Las deducciones no forman parte del cálculo de atrasos salariales.

## Diferencia mensual teórica

Por cada concepto:

`diferencia teórica = importe tabla destino - importe tabla origen`

Si la tabla almacena importes anuales, se convierten a mensualidades utilizando el número de pagas de la tabla.

La opción `Solo diferencias positivas` impide generar descuentos por revisiones a la baja.

## Parcialidad

Para salario base y conceptos mensuales:

`diferencia por jornada = diferencia teórica x parcialidad`

La primera versión utiliza la parcialidad actualmente registrada en el contrato.

No existe todavía un histórico versionado de cambios de jornada. Por ello, cada contrato muestra una advertencia indicando esta limitación.

## Proporción realmente remunerada

La diferencia se ajusta según lo realmente remunerado en cada nómina histórica:

`proporción remunerada = (salario trabajado + prestación IT + complemento IT) / salario base del mes`

La proporción queda limitada entre 0 y 1.

Esto permite:

- reducir los atrasos cuando hubo ausencias no retribuidas;
- mantener el derecho completo cuando una IT fue complementada hasta el 100 %;
- respetar meses de alta o baja parcial reflejados en la nómina.

Cuando no existe salario base en la cabecera se utiliza como respaldo:

`días cotizados / 30`

## Importe liquidable

Para salario base y conceptos:

`atraso = diferencia teórica x parcialidad x proporción remunerada`

Para prorratas extraordinarias:

`atraso = diferencia de prorrata ya parcializada x proporción remunerada`

La parcialidad no se aplica dos veces a las prorratas.

## Pagas extraordinarias prorrateadas

En contratos con doce pagas se comparan las pagas extraordinarias configuradas en ambas tablas.

Se consideran:

- conceptos participantes;
- porcentajes o importes fijos;
- meses de devengo;
- parcialidad configurada en la paga;
- mes histórico de la nómina.

Solo se calcula diferencia durante meses comprendidos en el período de devengo de cada paga.

## Vista previa

La pantalla muestra:

- contratos encontrados;
- contratos liquidables;
- contratos bloqueados;
- nóminas históricas revisadas;
- diferencia bruta pendiente;
- diferencia cotizable;
- trabajador y categoría;
- número de meses;
- detalle por mes y concepto.

La vista previa no modifica datos.

## Contratos bloqueados

Un contrato se bloquea cuando:

- no tiene categoría profesional;
- falta su fila en la tabla de origen;
- falta su fila en la tabla de destino;
- no existen nóminas históricas en el intervalo;
- no existen diferencias liquidables;
- ya tiene una nómina complementaria activa del mismo ejercicio.

Cuando existe una complementaria activa, sus importes se excluyen de los totales pendientes de la vista previa.

## Generación

La generación crea una nómina por contrato con:

- período 15;
- ejercicio de la regularización;
- bruto igual a la suma de diferencias;
- bases de cotización según los conceptos afectados;
- base de IRPF según los conceptos tributables;
- cotizaciones de trabajador y empresa;
- IRPF automático, voluntario o manual;
- líquido y coste empresarial;
- estado pendiente por defecto.

## IRPF

La pantalla permite elegir:

- automático;
- voluntario registrado en el trabajador;
- manual.

El cálculo utiliza el mismo servicio de IRPF que las nóminas ordinarias.

## Trazabilidad

Cada línea liquidada crea una traza informativa con código:

`RETRO_TABLE_{tabla_origen}_{tabla_destino}_{concepto}`

La línea guarda:

- nómina histórica de origen;
- mes y ejercicio;
- concepto;
- importe de origen;
- importe de destino;
- diferencia teórica;
- parcialidad;
- proporción remunerada;
- importe final.

Las líneas son informativas. El importe efectivo se almacena en la cabecera de la nómina complementaria para evitar dobles cómputos en bruto, bases o IRPF.

## Prevención de duplicados

No se permite generar una segunda nómina complementaria activa para el mismo contrato y ejercicio.

Se consideran activas las complementarias con estado:

- borrador;
- pendiente;
- calculada;
- revisada;
- cerrada.

Una complementaria anulada no bloquea una nueva generación.

## Endpoints

### Vista previa

```http
POST /collective-agreements/salary-tables/{tabla_destino}/regularization-preview
```

### Generación

```http
POST /collective-agreements/salary-tables/{tabla_destino}/regularizations
```

La generación vuelve a calcular internamente la vista previa. No confía en importes enviados desde el navegador.

## Pruebas

Archivo:

`backend/tests/test_salary_regularization.py`

Casos cubiertos:

- diferencia mensual completa;
- mes remunerado al 50 %;
- suma de atrasos de 150 euros;
- generación de período 15;
- líneas informativas por mes;
- bloqueo de duplicados;
- exclusión del contrato liquidado de los totales pendientes.

Ejecución:

```bash
cd backend
python -m unittest discover -s tests -p "test_*.py"
```

Build de frontend:

```bash
cd frontend
npm run build
```

## Validación manual

1. Crear una tabla salarial nueva desde una tabla histórica.
2. Incrementar salario base o complementos.
3. Activar la tabla destino.
4. Abrir `Regularización retroactiva`.
5. Seleccionar tabla de origen y destino.
6. Introducir un período con nóminas ya calculadas.
7. Generar la vista previa.
8. Revisar el detalle mensual de un trabajador.
9. Desmarcar los contratos que no deban liquidarse.
10. Elegir el tratamiento de IRPF.
11. Generar las complementarias.
12. Abrir Nóminas y localizar el período 15.
13. Revisar el recibo y sus líneas de atrasos.
14. Volver a la vista previa y comprobar que el contrato aparece bloqueado.
15. Confirmar que las nóminas históricas permanecen intactas.

## Limitaciones actuales

- No existe histórico de cambios de parcialidad o categoría por fecha.
- No se liquidan diferencias que atraviesen dos ejercicios en una sola operación.
- No se generan ficheros de cotización complementaria.
- No se calculan recargos, intereses ni diferencias de bonificaciones.
- No se regularizan automáticamente embargos, anticipos o topes legales.
- La clasificación de complementaria se representa didácticamente mediante el período 15.
- La revisión de importes negativos queda disponible para vista previa, pero la generación comercial inicial está orientada a atrasos positivos.

## Evolución posterior

- historial contractual efectivo por fechas;
- regularizaciones multiejercicio;
- múltiples complementarias diferenciadas por revisión;
- liquidaciones L03/L90 simuladas;
- actualización retroactiva de bases y tramos;
- regularización de antigüedad;
- revisión de pagas extraordinarias ya abonadas;
- informe consolidado por empresa, centro y concepto.
