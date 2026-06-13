# Split 29 - Antigüedad parametrizada y vencimientos

## Objetivo

Convertir la antigüedad del convenio en una regla laboral calculable y trazable.

La antigüedad deja de ser únicamente una cifra informativa dentro de la fila salarial y pasa a disponer de:

- periodicidad propia;
- ámbito por tabla salarial y categoría;
- forma de cálculo;
- límite de módulos;
- fecha de antigüedad reconocida;
- vencimientos históricos;
- próximo vencimiento;
- integración en nómina;
- participación opcional en pagas extraordinarias.

## Ubicación

`Convenios -> Criterios laborales -> Antigüedad y vencimientos`

El panel contiene:

1. reglas configuradas;
2. formulario de alta y edición;
3. vista previa de contratos;
4. módulos consolidados;
5. importe mensual;
6. próximo vencimiento;
7. detalle de aniversarios.

## Regla de antigüedad

Cada regla puede definir:

- convenio;
- tabla salarial concreta o todas las tablas;
- categoría profesional concreta o todas las categorías;
- código y denominación;
- años por módulo;
- forma de cálculo;
- máximo de módulos;
- aplicación de parcialidad;
- prorrateo diario en el mes del vencimiento;
- cotización;
- tributación en IRPF;
- participación en pagas extraordinarias;
- vigencia temporal;
- estado activo o inactivo.

## Periodicidad

El campo `module_years` permite representar:

- trienios: 3 años;
- quinquenios: 5 años;
- bienios: 2 años;
- módulos personalizados.

El número de módulos consolidados se obtiene con:

`años completos de antigüedad / años por módulo`

El resultado se limita mediante `max_modules` cuando el convenio establece un tope.

## Prioridad de la fecha de antigüedad

Se aplica este orden:

1. `recognized_seniority_date`;
2. `seniority_date`;
3. `start_date` del contrato.

La fecha reconocida permite reflejar subrogaciones, sucesiones de empresa o reconocimientos de servicios anteriores.

Cuando se utiliza la fecha de inicio del contrato por falta de otra fecha, la vista previa muestra una advertencia.

## Prioridad de reglas

Cuando varias reglas podrían aplicarse, prevalece la más específica:

1. regla de la tabla y categoría del contrato;
2. regla de la tabla para todas las categorías;
3. regla general de categoría;
4. regla general del convenio.

Además, la regla debe estar activa y vigente en la fecha de cálculo.

## Formas de cálculo

### Importe de la fila salarial

La regla utiliza:

`salary_table_row.seniority_amount`

Es apropiado cuando cada categoría tiene un importe diferente por módulo.

### Importe fijo por módulo

La regla almacena directamente el importe de cada trienio, quinquenio u otro módulo.

Ejemplo:

`45 euros por trienio`

### Porcentaje del salario base

La regla calcula:

`salario base teórico x porcentaje / 100`

Ejemplo:

`5 % del salario base por trienio`

## Parcialidad

Cuando `applies_partiality` está activo:

`importe por módulo aplicado = importe teórico x parcialidad del contrato`

Ejemplo:

- importe teórico por trienio: 90 euros;
- jornada: 50 %;
- importe aplicado por trienio: 45 euros.

La parcialidad se aplica antes de multiplicar por el número de módulos.

## Vencimiento durante el mes

Cuando el nuevo módulo vence durante el mes y está activo el prorrateo diario:

`importe nuevo módulo = importe por módulo x días desde el vencimiento hasta final de mes / días naturales del mes`

Ejemplo:

- tercer trienio: 45 euros;
- vencimiento: 15 de marzo;
- días con derecho: 17;
- días de marzo: 31;
- importe del tercer trienio en marzo: 24,68 euros.

Los módulos anteriores se abonan completos durante el mes.

Cuando el prorrateo está desactivado, el nuevo módulo se reconoce completo en el mes del vencimiento.

## Ajuste por días cotizados

El importe mensual calculado se ajusta después mediante:

`días cotizados / 30`

Esto evita abonar el complemento completo durante períodos sin derecho retributivo.

La reducción se aplica una única vez.

## Nómina ordinaria

La cabecera de nómina dispone del campo:

`seniority_amount`

La antigüedad se incorpora a:

- bruto;
- base de contingencias comunes, cuando cotiza;
- base profesional, cuando cotiza;
- desempleo, formación y FOGASA, cuando cotiza;
- base de IRPF, cuando tributa;
- deducciones;
- líquido;
- coste empresarial.

No se mezcla con `salary_supplements`, por lo que puede consultarse y auditarse de forma independiente.

## Pagas extraordinarias

En los períodos 13 y 14 la antigüedad se incorpora cuando la regla tiene activado:

`affects_extra_payments`

Se utiliza el importe vigente en julio o diciembre, respectivamente.

El período 15 no añade antigüedad automáticamente, porque se reserva para complementarias y regularizaciones específicas.

## Trazabilidad

Cada nómina genera líneas automáticas informativas con prefijo:

`SENIORITY_AUTO_`

Estas líneas describen:

- módulos consolidados;
- nuevo vencimiento del mes;
- fecha del vencimiento;
- días reconocidos;
- ajuste por días cotizados.

Las líneas son informativas. El importe efectivo se almacena en `payroll.seniority_amount`, evitando dobles cómputos.

Al recalcular una nómina:

1. se eliminan las líneas automáticas anteriores;
2. se recalculan los vencimientos;
3. se crean las líneas actuales;
4. se mantienen intactas las líneas manuales.

## Versionado de tablas salariales

Al crear una revisión salarial puede marcarse:

`Copiar reglas de antigüedad`

Se copian únicamente las reglas vinculadas a la tabla origen.

Las reglas generales del convenio no se duplican.

Tratamiento del incremento general:

- `table_amount`: el importe cambia mediante la fila salarial copiada;
- `fixed_amount`: el importe fijo recibe el porcentaje de incremento;
- `percentage`: el porcentaje se conserva y se aplicará sobre el nuevo salario base.

Las fechas de vigencia de la nueva tabla se trasladan a las reglas copiadas.

## Vista previa del convenio

La vista muestra por contrato:

- trabajador y código;
- fecha de antigüedad utilizada;
- origen de la fecha;
- regla aplicable;
- módulos consolidados;
- importe por módulo;
- importe mensual;
- siguiente vencimiento;
- límite alcanzado;
- detalle de vencimientos anteriores.

Los contratos se bloquean cuando:

- no tienen convenio;
- no existe una regla aplicable;
- la regla no produce importe;
- falta una fila salarial necesaria para el modo `table_amount`.

## Interfaz de nóminas

La antigüedad aparece en:

- preparación mensual;
- listado general de nóminas;
- desglose de conceptos;
- recibo individual;
- simulación futura.

Las líneas automáticas aparecen en modo consulta y no pueden editarse ni eliminarse manualmente.

## Endpoints

### Reglas

```http
GET  /collective-agreements/{agreement_id}/seniority-rules
POST /collective-agreements/{agreement_id}/seniority-rules
PUT  /collective-agreements/seniority-rules/{rule_id}
DELETE /collective-agreements/seniority-rules/{rule_id}
```

### Vistas previas

```http
GET /contracts/{contract_id}/seniority-preview
GET /collective-agreements/{agreement_id}/seniority-preview
```

Ambos endpoints admiten una fecha de referencia mediante `as_of`.

## Base de datos

Nueva tabla:

`agreement_seniority_rules`

Nueva columna:

`payrolls.seniority_amount`

Las instalaciones nuevas crean la tabla mediante `Base.metadata.create_all`.

Las bases existentes reciben la nueva columna mediante el puente conservador de esquema al arrancar el backend.

## Convenio demo

La carga de parametrización base crea una regla didáctica de trienios cuando el convenio todavía no dispone de reglas de antigüedad.

La regla utiliza el importe de antigüedad informado en cada fila salarial.

## Pruebas

Archivos:

- `backend/tests/test_agreement_seniority.py`
- `backend/tests/test_seniority_table_revision.py`

Casos cubiertos:

- prioridad de fecha reconocida;
- cálculo de trienios;
- parcialidad;
- vencimiento a mitad de mes;
- prorrateo diario;
- ajuste por días cotizados;
- inclusión en bruto y bases;
- creación de líneas automáticas;
- recalculo idempotente;
- límite de módulos;
- aniversario del 29 de febrero;
- copia de reglas al ejercicio siguiente;
- incremento de importes fijos versionados.

Ejecución:

```bash
cd backend
python -m unittest discover -s tests -p "test_*.py"
```

Build:

```bash
cd frontend
npm run build
```

## Validación manual

1. Abrir `Convenios -> Criterios laborales`.
2. Crear una regla de trienios.
3. Seleccionar una tabla o dejarla general.
4. Seleccionar una categoría o dejarla global.
5. Elegir el importe de la fila salarial.
6. Introducir una fecha de antigüedad reconocida en un contrato.
7. Actualizar la vista previa.
8. Revisar módulos y próximo vencimiento.
9. Preparar una nómina ordinaria.
10. Comprobar la columna de antigüedad.
11. Abrir el desglose y revisar las líneas automáticas.
12. Recalcular la nómina y comprobar que no aparecen duplicados.
13. Simular meses futuros, incluyendo un mes de vencimiento.
14. Crear una revisión salarial y copiar las reglas de antigüedad.
15. Verificar que la nueva tabla contiene su propia regla versionada.

## Limitaciones actuales

- No existe un histórico completo de cambios de parcialidad o categoría por fecha.
- El cálculo usa la parcialidad y categoría actualmente registradas en el contrato.
- Una regla que entra en vigor a mitad de mes se resuelve por su vigencia al final del período; todavía no se divide el mes entre dos reglas.
- El cálculo automático del tipo anual sugerido de IRPF no añade todavía una estimación anual específica de futuros vencimientos de antigüedad, aunque el importe real mensual sí forma parte de la base de IRPF.
- No se generan todavía atrasos automáticos por reconocimiento tardío de una fecha de antigüedad.
- No se gestionan suspensiones históricas que interrumpan el cómputo de antigüedad.

## Evolución posterior

- atrasos por reconocimiento tardío;
- historial efectivo de jornada y categoría;
- períodos no computables para antigüedad;
- múltiples escalas de módulos dentro de una misma regla;
- importes diferentes por cada número de módulo;
- alertas próximas de vencimiento para profesor y administración;
- informe consolidado de vencimientos por empresa y centro.
