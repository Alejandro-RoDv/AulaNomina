# Split 39 — Modelo 190

## Objetivo

Construir una simulación educativa completa del Modelo 190 que permita:

- obtener el resumen anual nominativo de trabajadores y profesionales;
- clasificar perceptores mediante claves y subclaves fiscales;
- conciliar el cierre anual con los cuatro Modelos 111;
- revisar errores, advertencias y documentos no emparejados;
- generar y congelar declaraciones ordinarias, complementarias y sustitutivas;
- producir ficheros educativos de registros tipo 1 y tipo 2;
- importar, validar, firmar y presentar el fichero en una AEAT simulada;
- emitir justificantes, relaciones nominativas y certificados;
- practicar el proceso completo mediante un caso demostrativo reproducible.

Todo el módulo se identifica expresamente como **simulación educativa sin validez fiscal**. No genera un fichero oficialmente presentable ni realiza comunicaciones reales con la AEAT.

---

## Paso 39.1 — Dominio anual y catálogo fiscal

### Entidades

- `Model190Declaration`: cabecera anual, tipo, estado, totales, payload congelado y referencias de presentación.
- `Model190Recipient`: fotografía nominativa agrupada por NIF, clave, subclave y ejercicio de devengo.
- `Model190RecipientLine`: trazabilidad hasta nóminas, facturas, atrasos, regularizaciones, ajustes y Modelo 111.
- `Model190RecipientOverride`: clasificación fiscal revisable sin modificar los documentos originales.
- `Tax190Key` y `Tax190Subkey`: catálogo fiscal versionado por ejercicio.

### Reutilización del Modelo 111

No se duplican profesionales, facturas ni ajustes. `TaxWithholdingAdjustment` se amplía con:

- `model190_key`;
- `model190_subkey`;
- `accrual_year`;
- `deductible_expense_amount`.

### Catálogo educativo inicial

- clave `A`: rendimientos ordinarios del trabajo, sin subclave;
- clave `G-01`: actividad profesional con tipo general;
- clave `G-03`: inicio de actividad profesional con tipo reducido.

El catálogo está inspirado en el diseño AEAT del ejercicio 2025. No es exhaustivo ni garantiza compatibilidad con campañas posteriores.

### Migración ligera

`model190_schema_patch.py` crea las tablas, añade los campos anuales a ajustes existentes, genera índices y siembra el catálogo de forma idempotente.

---

## Paso 39.2 — Motor anual de perceptores

`backend/app/services/model190_calculator.py` extrae, normaliza y acumula:

- nóminas `reviewed` o `closed`;
- facturas profesionales `paid` con fecha de pago dentro del ejercicio;
- ajustes, atrasos y regularizaciones confirmados.

### Agrupación

```text
NIF + clave + subclave + ejercicio de devengo
```

Esto permite:

- acumular varios contratos del mismo trabajador;
- separar atrasos de ejercicios anteriores;
- admitir varias clasificaciones para un mismo NIF;
- conservar cada documento de origen.

### Clasificación automática

- trabajadores: `A`;
- profesionales al 7 %: `G-03`;
- demás profesionales soportados: `G-01`;
- ajustes de trabajo sin clasificación: `A`;
- ajustes profesionales sin clasificación: `G-01`.

Los overrides prevalecen sobre la clasificación automática.

### Importes

Trabajadores:

- salario bruto;
- IRPF;
- Seguridad Social del trabajador como gasto deducible.

Profesionales:

- base de la factura pagada;
- retención;
- fecha de pago como fecha fiscal.

El preview declara como capacidades pendientes las percepciones en especie complejas, reducciones avanzadas y rentas exentas diferenciadas.

---

## Paso 39.3 — Conciliación trimestral 111/190

`backend/app/services/model190_reconciliation.py` compara el acumulado anual vivo con las declaraciones congeladas del Modelo 111.

### Declaración efectiva

Para cada trimestre se utiliza la última declaración presentada. Una complementaria presentada posteriormente se considera el snapshot efectivo completo del periodo.

Las declaraciones generadas pero no presentadas se muestran como pendientes y no computan como declaradas.

### Comparaciones

Por trimestre y bloque fiscal:

- percepciones;
- retenciones;
- documentos;
- perceptores.

También se generan totales y diferencias anuales.

### Conciliación documental

Se detectan:

- documentos solo en el 190;
- documentos solo en el 111;
- documentos presentes en ambos con importes distintos;
- totales iguales construidos con documentos diferentes.

Cada trimestre incluye drill-down por NIF, perceptor, bloque, origen y documento.

---

## Paso 39.4 — Pantalla ERP

Disponible en:

```text
Fiscalidad → Modelo 190
#model-190
```

### Pestañas

- Resumen anual.
- Perceptores.
- Conciliación 111/190.
- Validaciones.

La pantalla permite filtrar perceptores, abrir su trazabilidad, revisar diferencias trimestrales y consultar errores estructurales y avisos didácticos.

---

## Paso 39.5 — Generación, congelación y fichero

Servicios:

- `model190_validation.py`;
- `model190_declaration_service.py`;
- `model190_file_service.py`.

### Validación de backend

Errores bloqueantes principales:

- declaración sin perceptores;
- NIF o nombre ausente;
- clave inexistente, no vigente o incompatible;
- subclave ausente o incompatible;
- devengo ausente;
- importes fuera de rango;
- descuadres de totales;
- ordinaria duplicada;
- complementaria o sustitutiva sin original.

También se generan avisos sobre diferencias con los Modelos 111, gastos deducibles, retención cero, atrasos, nombres distintos, clasificaciones automáticas y múltiples contratos o facturas.

### Congelación

Al generar:

1. se recalculan operaciones;
2. se aplican overrides;
3. se concilia con los Modelos 111;
4. se validan los datos;
5. se crea `Model190Declaration`;
6. se copian perceptores y líneas;
7. se vinculan las líneas con el Modelo 111 efectivo;
8. se congela el payload;
9. se generan los ficheros y sus hashes.

Una modificación posterior de datos vivos no cambia una declaración congelada.

### Ficheros

Se conservan dos versiones:

- TXT legible delimitado por `|`;
- registro fijo simulado de 250 posiciones.

El registro fijo contiene una cabecera tipo 1, una línea tipo 2 por perceptor, importes en céntimos con signo, versión educativa y hash SHA-256.

---

## Paso 39.6 — Presentación AEAT simulada

Servicios:

- `model190_presentation_service.py`;
- `model190_receipt_service.py`;
- `Model190AeatModal.jsx`.

### Flujo

```text
Acceso
→ importación del fichero congelado
→ validación de registros
→ revisión de errores
→ firma y envío
→ justificante
```

La presentación importa el fichero conservado dentro del snapshot. No reconstruye datos desde nóminas o facturas vivas.

### Validación de importación

Se comprueban hash, longitud, tipos de registro, modelo, ejercicio, NIF, tipo de declaración, número de perceptores, totales, claves, subclaves, devengo, importes, duplicados y marca educativa.

### Firma y envío

Requiere:

- fichero sin errores;
- hash idéntico al validado;
- nombre del firmante;
- certificado educativo;
- confirmación expresa.

Al presentar se generan fecha, justificante, CSV, referencia AulaNomina, resultado de importación y firma simulada. La declaración queda bloqueada.

---

## Paso 39.7 — Documentos y certificados

Servicio:

```text
backend/app/services/model190_document_service.py
```

### Documentos anuales

- resumen anual HTML;
- relación nominativa completa apaisada.

Se construyen exclusivamente desde el snapshot congelado.

### Certificados

Solo están disponibles después de la presentación simulada. Cada certificado agrupa todas las líneas del mismo NIF, incluidas claves, subclaves o ejercicios de devengo distintos.

### Lote colectivo

El ZIP contiene:

- un certificado HTML por NIF único;
- `manifest-certificados.csv`;
- `LEEME.txt`;
- hash SHA-256;
- contador de certificados.

---

## Paso 39.8 — Caso demo y pruebas integrales

Servicios y componentes:

- `backend/app/services/model190_demo_service.py`;
- `backend/tests/test_model190_demo_flow.py`;
- `frontend/src/components/model190/Model190DemoPanel.jsx`;
- `frontend/src/utils/model190Demo.js`;
- `frontend/src/tests/model190Demo.test.js`.

### Empresa y ejercicio

Si no se selecciona una empresa, se crea o reutiliza una empresa formativa independiente:

```text
AulaNomina Demo Modelo 190 SL
B19000026
Ejercicio 2026
```

También es posible cargar expresamente el escenario sobre una empresa seleccionada, siempre que no exista un conflicto con una declaración anual previa.

### Datos del escenario

El caso crea de forma idempotente:

- tres trabajadores con nóminas revisadas;
- un trabajador con dos contratos durante el año;
- un profesional con una factura al 15 % y otra al 7 %;
- atrasos pagados en 2026 con devengo 2025;
- una regularización negativa;
- cuatro Modelos 111 ordinarios presentados;
- una diferencia deliberada en el 2T;
- una subclave profesional deliberadamente inválida (`G-99`).

### Primera fase: diagnóstico

Después de preparar el caso:

- la validación bloquea la generación por `RECIPIENT_SUBKEY_INVALID`;
- la conciliación detecta una diferencia en el 2T;
- el panel muestra los ocho hitos del ejercicio;
- el alumno debe identificar que existen dos problemas independientes: clasificación y conciliación.

### Segunda fase: corrección

La acción guiada:

1. elimina la clasificación `G-99` y recupera las clasificaciones automáticas `G-01` y `G-03`;
2. confirma la revisión fiscal del profesional;
3. genera una complementaria del Modelo 111 del 2T;
4. presenta la complementaria;
5. recalcula validaciones y conciliación.

El resultado debe quedar:

```text
Validación: correcta
Conciliación 1T: correcta
Conciliación 2T: correcta
Conciliación 3T: correcta
Conciliación 4T: correcta
Estado: listo para generar
```

### Tercera fase: cierre

El usuario continúa en el espacio anual existente:

1. genera y congela la ordinaria del Modelo 190;
2. descarga o revisa el fichero;
3. importa el registro fijo;
4. valida los registros;
5. firma y presenta;
6. abre el justificante;
7. consulta resumen, perceptores y certificados;
8. descarga el lote ZIP.

### Estados del panel

```text
not_prepared
needs_correction
ready_to_generate
generated
presented
```

### API del caso demo

```text
GET  /model-190/demo-status?company_id={id}
POST /model-190/demo-seed
POST /model-190/demo-seed?company_id={id}
POST /model-190/demo-correct?company_id={id}
```

### Idempotencia

Repetir la preparación no duplica:

- empresa;
- trabajadores;
- contratos;
- nóminas;
- profesional;
- facturas;
- ajustes;
- overrides;
- Modelos 111.

Repetir la corrección no crea una segunda complementaria del 2T.

### Prueba end-to-end

`test_model190_demo_flow.py` recorre:

```text
Preparación con errores
→ diagnóstico
→ corrección
→ conciliación completa
→ generación
→ validación del fichero
→ presentación
→ justificante
→ documentos
→ certificados ZIP
```

La prueba también comprueba que el lote contiene cuatro certificados, uno por cada NIF único, junto con el manifiesto CSV.

---

## API consolidada

### Cálculo y conciliación

```text
GET /model-190/preview
GET /model-190/reconciliation
GET /model-190/validations
```

### Declaraciones y ficheros

```text
POST /model-190/declarations
GET  /model-190/declarations
GET  /model-190/declarations/{id}
GET  /model-190/declarations/{id}/file?format=readable
GET  /model-190/declarations/{id}/file?format=fixed_width
```

### Presentación

```text
GET  /model-190/declarations/{id}/import-validation
GET  /model-190/declarations/{id}/errors
POST /model-190/declarations/{id}/present
GET  /model-190/declarations/{id}/receipt
```

### Documentos

```text
GET /model-190/declarations/{id}/annual-summary
GET /model-190/declarations/{id}/recipients-document
GET /model-190/declarations/{id}/certificates
GET /model-190/declarations/{id}/certificates/{recipient_id}
GET /model-190/declarations/{id}/certificates.zip
```

---

## Criterio de cierre del Split 39

- [x] Dominio anual y catálogo fiscal.
- [x] Motor nominativo por NIF, clave, subclave y devengo.
- [x] Trabajadores, profesionales, atrasos y regularizaciones.
- [x] Conciliación trimestral y documental con el Modelo 111.
- [x] Pantalla ERP con filtros, detalle y validaciones.
- [x] Declaraciones ordinarias, complementarias y sustitutivas.
- [x] Snapshot inmutable.
- [x] Fichero legible y registro fijo educativo.
- [x] Importación y validación registro a registro.
- [x] Firma y presentación AEAT simuladas.
- [x] Justificante y documentos anuales.
- [x] Certificados individuales y lote colectivo.
- [x] Caso práctico guiado e idempotente.
- [x] Prueba integral desde la preparación hasta los certificados.

**El Split 39 queda funcionalmente cerrado para el MVP educativo.**

---

## Alcance excluido del MVP

- fichero oficialmente presentable;
- firma real;
- envío real;
- validación censal real;
- catálogo completo de claves excepcionales;
- territorios forales;
- rendimientos en especie complejos;
- reducciones avanzadas;
- modificación real de declaraciones en la AEAT.
