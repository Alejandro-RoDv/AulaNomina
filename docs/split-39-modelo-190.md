# Split 39 — Modelo 190

## Paso 39.1 — Dominio anual y catálogo fiscal

Este paso prepara la base persistente del Modelo 190 sin implementar todavía la conciliación con el Modelo 111 ni la interfaz.

### Dominio incorporado

- `Model190Declaration`: cabecera anual, tipos ordinaria/complementaria/sustitutiva, estados, totales, payload congelado y referencias de presentación.
- `Model190Recipient`: fotografía anual nominativa agrupable por NIF, clave, subclave y ejercicio de devengo.
- `Model190RecipientLine`: trazabilidad hasta nóminas, facturas, atrasos, regularizaciones, ajustes y Modelo 111 trimestral.
- `Model190RecipientOverride`: capa de clasificación fiscal revisable sin alterar nóminas ni facturas originales.
- `Tax190Key` y `Tax190Subkey`: catálogo fiscal versionado por ejercicio.

### Reutilización del Modelo 111

No se duplican profesionales, facturas ni ajustes. `TaxWithholdingAdjustment` se amplía con:

- `model190_key`;
- `model190_subkey`;
- `accrual_year`;
- `deductible_expense_amount`.

### Catálogo educativo inicial

Se cargan únicamente las clasificaciones necesarias para los primeros casos docentes:

- clave `A`: rendimientos del trabajo de empleados por cuenta ajena, sin subclave;
- clave `G`, subclave `01`: actividad profesional con tipo general;
- clave `G`, subclave `03`: inicio de actividad profesional con tipo reducido.

El catálogo toma como referencia el diseño de registro de la AEAT para el ejercicio 2025. No se considera un catálogo exhaustivo ni garantiza validez para ejercicios posteriores; deberá revisarse por campaña antes de generar un fichero oficialmente compatible.

### Migración ligera

AulaNomina todavía no utiliza Alembic. Se añade `model190_schema_patch.py`, registrado sobre `Base.metadata.after_create`, para:

- crear las nuevas tablas mediante el metadata SQLAlchemy;
- añadir los cuatro campos del Modelo 190 a ajustes ya existentes;
- crear índices auxiliares;
- sembrar de forma idempotente el catálogo soportado.

## Paso 39.2 — Motor anual de perceptores

Se incorpora `backend/app/services/model190_calculator.py` como motor de extracción, normalización y acumulación anual.

### Orígenes incluidos

- nóminas del ejercicio con estado `reviewed` o `closed`;
- facturas profesionales con estado `paid` y fecha de pago dentro del ejercicio;
- ajustes, atrasos y regularizaciones confirmados cuya fecha de origen esté dentro del ejercicio declarado.

Las nóminas extraordinarias 13, 14 y 15 se asignan respectivamente a julio, diciembre y diciembre para su distribución trimestral.

### Agrupación

La clave técnica de agrupación es:

```text
NIF + clave + subclave + ejercicio de devengo
```

Esto permite que:

- dos contratos del mismo trabajador acumulen en un único perceptor anual;
- un atraso de un ejercicio anterior genere una línea anual separada;
- un mismo NIF aparezca en varias claves o subclaves cuando proceda.

### Clasificación automática

- trabajadores: clave `A`, sin subclave;
- profesionales con retención del 7 %: clave `G`, subclave `03`;
- demás profesionales soportados: clave `G`, subclave `01`;
- ajustes de trabajo sin clasificación manual: clave `A`;
- ajustes de actividad económica sin clasificación manual: clave `G`, subclave `01`.

Los `Model190RecipientOverride` prevalecen sobre la clasificación automática y pueden modificar clave, subclave, ejercicio de devengo y provincia.

### Importes acumulados

Para trabajadores se toman:

- salario bruto como percepción dineraria;
- IRPF como retención;
- Seguridad Social del trabajador como gasto deducible.

Si `employee_social_security` no está informado, el motor suma contingencias comunes, desempleo, formación profesional y MEI del trabajador.

Para profesionales se toman:

- base de la factura pagada;
- retención practicada;
- fecha de pago como fecha fiscal.

El resultado incluye totales, número de líneas, perceptores, NIF únicos y resumen por tipo de origen.

### Limitaciones declaradas

El preview identifica expresamente que el dominio actual todavía no permite acumular de forma fiable:

- percepciones en especie;
- reducciones fiscales;
- percepciones exentas y dietas separadas.

Estas capacidades permanecen desactivadas hasta que la nómina conserve esos importes de forma independiente.

## Paso 39.3 — Conciliación trimestral 111/190

Se incorpora `backend/app/services/model190_reconciliation.py` para comparar el acumulado anual vivo con las declaraciones trimestrales congeladas del Modelo 111.

### Selección de la declaración efectiva

Para cada trimestre se utiliza la última declaración presentada. Si existe una complementaria presentada posteriormente, su snapshot completo se considera la versión efectiva del trimestre.

Las declaraciones generadas o validadas, pero no presentadas:

- se muestran como pendientes;
- no computan como importes declarados;
- generan un aviso específico.

### Comparaciones

La conciliación compara por trimestre y bloque fiscal:

- percepciones de trabajo;
- retenciones de trabajo;
- percepciones de actividades económicas;
- retenciones de actividades económicas;
- número de documentos;
- número de perceptores.

También genera totales y diferencias anuales.

### Conciliación documental

Las líneas se vinculan por tipo de origen e identificador del documento:

- nómina;
- factura profesional;
- ajuste, atraso o regularización.

La respuesta identifica:

- documentos incluidos en el Modelo 190 que no aparecen en el Modelo 111 efectivo;
- documentos declarados en el Modelo 111 sin línea anual equivalente;
- documentos presentes en ambos modelos con bases o retenciones distintas.

De esta forma, dos trimestres con los mismos totales pueden seguir apareciendo como no conciliados si proceden de documentos diferentes.

### Drill-down

Cada trimestre incluye desglose:

- por perceptor y NIF;
- por bloque fiscal;
- por tipo de origen;
- por documento concreto.

### Avisos

Se generan avisos para:

- trimestre sin Modelo 111;
- Modelo 111 generado pero no presentado;
- versión posterior pendiente de presentación;
- diferencias de percepciones;
- diferencias de retenciones;
- documentos no emparejados;
- importes documentales distintos.

### API disponible

Se registran dos endpoints de lectura:

```text
GET /model-190/preview
GET /model-190/reconciliation
```

Ambos requieren `company_id` y `year`.

## Paso 39.4 — Pantalla ERP del Modelo 190

Se incorpora `frontend/src/pages/Model190Page.jsx`, accesible desde **Fiscalidad → Modelo 190** y desde el conmutador de los Modelos 111/190.

### Resumen anual

La cabecera permite seleccionar empresa y ejercicio. El resumen muestra:

- líneas anuales y NIF únicos;
- percepciones dinerarias;
- retenciones acumuladas;
- gastos deducibles;
- diferencia anual entre operaciones del 190 y Modelos 111 efectivos;
- composición por nóminas, facturas, ajustes, atrasos y regularizaciones.

### Relación nominativa

La pestaña de perceptores permite filtrar por:

- NIF o nombre;
- trabajador o profesional;
- clave;
- subclave;
- ejercicio de devengo.

Cada fila abre un panel lateral con clasificación fiscal, importes acumulados y documentos de origen.

### Conciliación

La interfaz presenta:

- estado anual;
- selector visual de los cuatro trimestres;
- comparación de bases y retenciones;
- Modelo 111 efectivo o pendiente;
- avisos trimestrales;
- desglose por perceptor;
- documentos exclusivos del 111 o del 190;
- documentos con importes diferentes.

### Validaciones de interfaz

`frontend/src/utils/model190View.js` centraliza filtros y controles previos:

- NIF obligatorio;
- clave fiscal obligatoria;
- subclave obligatoria para la clave G;
- ausencia de subclave para la clave A del catálogo educativo;
- ejercicio de devengo obligatorio;
- identificación de clasificaciones automáticas pendientes de revisión;
- advertencias por capacidades todavía no soportadas;
- incorporación de los avisos procedentes de la conciliación 111/190.

Las clasificaciones automáticas se muestran como información y no bloquean por sí solas. Los defectos estructurales se muestran como errores.

### Navegación y pruebas

- el enlace lateral del Modelo 190 queda habilitado;
- `ReportsRoute` admite `#model-190` y permite alternar entre 111 y 190;
- `model190Service.js` consume los endpoints de preview y conciliación;
- `model190View.test.js` cubre filtros, nombres fiscales, validaciones y diferencias anuales;
- el test se integra en `npm test` y los nuevos archivos se añaden al lint de GitHub Actions.

## Fuera de los pasos completados

- edición y persistencia de overrides desde la interfaz;
- generación y congelación de declaraciones;
- fichero de declaración;
- simulador AEAT del Modelo 190;
- certificados de retenciones.