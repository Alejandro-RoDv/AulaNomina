# Split 39 — Modelo 190

## Objetivo

Construir una simulación educativa completa del Modelo 190 que permita:

- obtener el resumen anual por perceptor;
- clasificar trabajadores y profesionales;
- conciliar el cierre anual con los Modelos 111 trimestrales;
- revisar errores y advertencias;
- congelar declaraciones;
- generar ficheros educativos;
- importar y presentar el fichero en una AEAT simulada;
- conservar justificantes, documentos y certificados de retenciones.

Todos los documentos, ficheros, firmas y presentaciones se identifican expresamente como simulaciones educativas sin validez fiscal.

## Paso 39.1 — Dominio anual y catálogo fiscal

### Entidades

- `Model190Declaration`: cabecera anual, tipo, estado, totales, payload congelado y referencias de presentación.
- `Model190Recipient`: fotografía anual nominativa agrupada por NIF, clave, subclave y ejercicio de devengo.
- `Model190RecipientLine`: trazabilidad hasta nóminas, facturas, atrasos, regularizaciones, ajustes y Modelo 111 trimestral.
- `Model190RecipientOverride`: clasificación fiscal revisable sin modificar nóminas ni facturas.
- `Tax190Key` y `Tax190Subkey`: catálogo fiscal versionado por ejercicio.

### Reutilización del Modelo 111

No se duplican profesionales, facturas ni ajustes. `TaxWithholdingAdjustment` se amplía con:

- `model190_key`;
- `model190_subkey`;
- `accrual_year`;
- `deductible_expense_amount`.

### Catálogo educativo inicial

- clave `A`: rendimientos ordinarios del trabajo, sin subclave;
- clave `G`, subclave `01`: actividad profesional con tipo general;
- clave `G`, subclave `03`: inicio de actividad profesional con tipo reducido.

El catálogo está inspirado en el diseño AEAT del ejercicio 2025, pero no es exhaustivo ni garantiza compatibilidad con campañas posteriores.

### Migración ligera

`model190_schema_patch.py`:

- crea las tablas nuevas mediante SQLAlchemy;
- añade los campos anuales a ajustes existentes;
- crea índices auxiliares;
- siembra el catálogo soportado de forma idempotente.

## Paso 39.2 — Motor anual de perceptores

`backend/app/services/model190_calculator.py` extrae, normaliza y acumula:

- nóminas `reviewed` o `closed`;
- facturas profesionales `paid` con fecha de pago en el ejercicio;
- ajustes, atrasos y regularizaciones confirmados.

Las pagas extraordinarias 13, 14 y 15 se asignan a julio, diciembre y diciembre para su distribución trimestral.

### Agrupación

```text
NIF + clave + subclave + ejercicio de devengo
```

Esto permite:

- acumular varios contratos del mismo trabajador;
- separar atrasos de ejercicios anteriores;
- admitir varias clasificaciones para un mismo NIF cuando proceda.

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

El preview declara como capacidades pendientes:

- percepciones en especie separadas;
- reducciones;
- rentas exentas y dietas diferenciadas.

## Paso 39.3 — Conciliación trimestral 111/190

`backend/app/services/model190_reconciliation.py` compara el acumulado anual vivo con las declaraciones congeladas del Modelo 111.

### Declaración efectiva

Para cada trimestre se utiliza la última declaración presentada. Una complementaria presentada posteriormente sustituye al snapshot anterior.

Las declaraciones generadas pero no presentadas:

- se muestran como pendientes;
- no computan como declaradas;
- generan un aviso.

### Comparaciones

Por trimestre y bloque fiscal:

- percepciones;
- retenciones;
- documentos;
- perceptores.

También se generan totales y diferencias anuales.

### Conciliación documental

Las líneas se vinculan por tipo de origen e identificador. Se detectan:

- documentos solo en el 190;
- documentos solo en el 111;
- documentos presentes en ambos con importes distintos;
- totales iguales construidos con documentos diferentes.

### Drill-down

Cada trimestre incluye detalle por perceptor, NIF, bloque fiscal, origen y documento.

### API

```text
GET /model-190/preview
GET /model-190/reconciliation
```

## Paso 39.4 — Pantalla ERP

`frontend/src/pages/Model190Page.jsx` está disponible en:

```text
Fiscalidad → Modelo 190
#model-190
```

### Pestañas

- Resumen anual.
- Perceptores.
- Conciliación 111/190.
- Validaciones.

La pantalla incluye métricas anuales, composición por origen, filtros nominativos, panel lateral por perceptor, selector trimestral y avisos de conciliación.

`frontend/src/utils/model190View.js` centraliza los controles estructurales y los avisos de interfaz.

## Paso 39.5 — Generación, congelación y fichero

Servicios:

- `model190_validation.py`;
- `model190_declaration_service.py`;
- `model190_file_service.py`.

### Validación de backend

Errores bloqueantes:

- declaración sin perceptores;
- NIF o nombre ausente;
- clave inexistente, no vigente o incompatible;
- subclave ausente o incompatible;
- devengo ausente;
- importes fuera de rango;
- descuadres de totales;
- ordinaria duplicada;
- complementaria o sustitutiva sin original.

También se generan avisos por diferencias con los Modelos 111, trimestres no presentados, NIF dudosos, gastos deducibles ausentes, retención cero, atrasos, clasificaciones automáticas y múltiples documentos de origen.

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

Se generan:

- TXT legible delimitado por `|`;
- registro fijo educativo de 250 posiciones;
- registro tipo 1;
- registros tipo 2;
- importes en céntimos con signo;
- versión `AULANOMINA-M190-EDU-1`;
- hash SHA-256;
- errores asociados a registros.

Los ficheros contienen marcas visibles de simulación y no son presentables ante la AEAT.

### API

```text
GET  /model-190/validations
POST /model-190/declarations
GET  /model-190/declarations
GET  /model-190/declarations/{id}
GET  /model-190/declarations/{id}/file?format=readable
GET  /model-190/declarations/{id}/file?format=fixed_width
```

## Paso 39.6 — Presentación AEAT simulada

Servicios:

- `backend/app/services/model190_presentation_service.py`;
- `backend/app/services/model190_receipt_service.py`;
- `frontend/src/components/model190/Model190AeatModal.jsx`.

### Flujo

```text
Acceso
→ importación del fichero congelado
→ validación de registros
→ revisión de errores
→ firma y envío
→ justificante
```

La presentación importa el fichero fijo conservado dentro de la declaración. No reconstruye el fichero desde nóminas o facturas vivas.

### Validación de importación

Se comprueban hash, longitud, tipos de registro, modelo, ejercicio, NIF, tipo de declaración, número de perceptores, totales, claves, subclaves, devengo, importes, duplicados, marca educativa y número físico de registros.

El resultado devuelve registros leídos, correctos, erróneos, detalle por campo y posibilidad de presentación.

### Firma y envío

La presentación requiere:

- fichero sin errores;
- hash firmado idéntico al validado;
- nombre del firmante;
- certificado educativo;
- confirmación expresa.

Al presentar se congelan fecha, justificante, CSV, referencia AulaNomina, hash, resultado de importación y firma simulada. Una declaración presentada no puede volver a enviarse.

### API

```text
GET  /model-190/declarations/{id}/import-validation
GET  /model-190/declarations/{id}/errors
POST /model-190/declarations/{id}/present
GET  /model-190/declarations/{id}/receipt
```

## Paso 39.7 — Documentos y certificados

Se incorpora `backend/app/services/model190_document_service.py`.

Todos los documentos se generan desde `Model190Declaration`, `Model190Recipient`, `Model190RecipientLine` y el payload congelado. No consultan ni recalculan nóminas, facturas o ajustes vivos.

### Resumen anual HTML

Disponible desde el momento en que la declaración queda generada y congelada. Incluye:

- declarante, NIF, ejercicio, tipo y estado;
- fecha de generación y presentación;
- justificante y CSV cuando existen;
- perceptores, percepciones, retenciones y gastos deducibles;
- resultado de validaciones;
- diferencias anuales 111/190;
- composición por origen;
- relación abreviada de perceptores;
- referencia de presentación y fichero validado.

### Relación nominativa completa

Documento HTML apaisado con:

- todas las líneas de perceptor;
- NIF y nombre;
- tipo de perceptor;
- clave y subclave;
- ejercicio de devengo;
- provincia;
- percepciones;
- retenciones;
- gastos deducibles;
- número de documentos de origen;
- totales de la declaración.

Un mismo NIF puede aparecer en varias filas cuando cambian la clave, subclave o el ejercicio de devengo.

### Certificados individuales

Los certificados solo se habilitan cuando la declaración está `presented`.

Cada certificado agrupa todas las líneas del mismo NIF y muestra:

- pagador y NIF del pagador;
- perceptor y NIF del perceptor;
- declaración, ejercicio y presentación;
- justificante y CSV;
- percepciones dinerarias;
- retenciones;
- gastos deducibles;
- percepciones en especie;
- desglose por clave, subclave y devengo;
- firmante y certificado simulado;
- referencia y hash del fichero.

### Directorio y lote colectivo

El directorio HTML presenta un enlace individual por NIF.

El lote ZIP contiene:

- un certificado HTML por NIF único;
- `manifest-certificados.csv` con importes y nombres de fichero;
- `LEEME.txt` con el contexto educativo;
- hash SHA-256 del ZIP;
- número de certificados en las cabeceras de respuesta.

### API

```text
GET /model-190/declarations/{id}/annual-summary
GET /model-190/declarations/{id}/recipients-document
GET /model-190/declarations/{id}/certificates
GET /model-190/declarations/{id}/certificates/{recipient_id}
GET /model-190/declarations/{id}/certificates.zip
```

### Interfaz

`Model190DeclarationsPanel.jsx` añade una columna de documentos con:

- `Resumen anual`;
- `Perceptores`;
- `Certificados`;
- `Lote ZIP`.

El resumen y la relación nominativa están disponibles para declaraciones congeladas. Los certificados y el ZIP se activan tras la presentación simulada.

### Pruebas

`test_model190_document_service.py` cubre:

- documentos construidos desde el snapshot congelado;
- inmutabilidad después de modificar una nómina viva;
- bloqueo de certificados antes de presentar;
- agrupación de varias líneas del mismo NIF;
- datos de firma y justificante;
- un certificado por NIF único;
- manifiesto CSV y contenido del ZIP.

`model190Documents.test.js` cubre las reglas de disponibilidad documental en la interfaz.

## Paso pendiente

### Paso 39.8 — Caso demo y pruebas integrales

- varios trabajadores;
- trabajador con dos contratos;
- profesional;
- atrasos anteriores;
- regularización negativa;
- error deliberado;
- diferencia con un Modelo 111;
- corrección y presentación final.

## Alcance excluido del MVP

- fichero oficialmente presentable;
- firma real;
- envío real;
- validación censal real;
- catálogo completo de claves excepcionales;
- territorios forales;
- rendimientos en especie complejos;
- reducciones avanzadas;
- modificación real de declaraciones en AEAT.
