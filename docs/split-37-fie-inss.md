# Split 37 — Comunicaciones INSS (FIE)

## Objetivo

Incorporar una bandeja educativa de comunicaciones FIE recibidas desde el INSS y cerrar el circuito entre recepción simulada, incidencias laborales y nómina.

El módulo no genera un fichero para enviar. Simula una comunicación entrante que debe identificarse, compararse y resolverse de forma controlada antes de modificar la información interna de AulaNomina.

## Ubicación funcional

El acceso principal pertenece a **Gestión de personal → Gestión laboral → Comunicaciones INSS (FIE)**.

No forma parte de **Nómina → Seguros sociales**, porque su finalidad es gestionar comunicaciones relacionadas con procesos de incapacidad temporal y conciliarlas con las incidencias laborales del trabajador.

Se mantiene un acceso adicional desde el SILTRA simulado para representar la recepción operativa de mensajes del INSS.

## Alcance

Tipos admitidos:

- baja médica;
- confirmación;
- alta médica;
- modificación;
- anulación;
- recaída.

Quedan fuera de este split:

- conexión real con INSS, SILTRA o RED Online;
- implementación completa de todos los segmentos del diseño oficial FIE;
- certificados electrónicos;
- ACRASS y alegaciones;
- cálculo jurídico completo de prestaciones;
- nacimiento y cuidado, riesgo durante embarazo y riesgo durante lactancia;
- procesamiento masivo y evaluación automática del alumnado.

El contenido técnico se identifica como `AULANOMINA_FIE_V1`, se marca expresamente como simulación y utiliza la referencia educativa `FIE_5_0_EDUCATIONAL`.

## Funcionalidad incorporada

### 1. Bandeja de entrada

La ruta `#fie-inss` carga el espacio de trabajo **Comunicaciones INSS (FIE)**.

La bandeja incluye:

- leída y no leída;
- prioridad normal, alta o urgente;
- empresa y trabajador;
- NAF recibido;
- tipo de comunicación;
- fecha del hecho y fecha de recepción;
- estado de conciliación;
- posible impacto en nómina.

Los indicadores superiores muestran:

- total de comunicaciones;
- no leídas;
- pendientes;
- discrepancias;
- trabajadores no identificados;
- comunicaciones que pueden exigir regularización.

### 2. Generador de casos prácticos

El profesor o administrador puede crear comunicaciones manuales y seleccionar un escenario:

- caso normal;
- fecha distinta a la incidencia;
- trabajador no identificado;
- trabajador sin contrato vigente;
- confirmación sin proceso abierto;
- alta sin baja previa;
- recaída sin proceso anterior;
- comunicación duplicada.

También continúa disponible la generación automática e idempotente a partir de incidencias `IT` y `RECAIDA` internas sin comunicación asociada.

### 3. Identificación del trabajador

La conciliación utiliza NAF y NIF para localizar el expediente interno.

Resultados posibles:

- trabajador identificado;
- ningún trabajador compatible;
- varios candidatos compatibles;
- trabajador identificado sin contrato vigente.

Una comunicación no localizada permanece en la bandeja y conserva los datos externos recibidos. No se crea una incidencia hasta que exista una identificación válida.

### 4. Comparación lado a lado

La pantalla muestra dos bloques independientes:

1. información recibida del INSS simulado;
2. información registrada en AulaNomina.

La comparación incluye:

- trabajador;
- NAF;
- contrato vigente;
- incidencia relacionada;
- fecha de baja;
- fecha de alta;
- estado interno;
- acción recomendada.

Cada diferencia se acompaña de una explicación funcional. Por ejemplo:

> La fecha de baja recibida no coincide con la fecha registrada en la incidencia interna.

### 5. Casos conflictivos

El backend detecta y clasifica:

- trabajador no localizado;
- identificación ambigua;
- ausencia de contrato vigente;
- baja sin IT interna;
- baja con fecha distinta;
- confirmación sin proceso;
- alta sin baja previa;
- recaída sin proceso anterior;
- comunicación duplicada;
- anulación con nómina ya calculada.

Estados adicionales:

- `UNMATCHED_WORKER`;
- `DUPLICATE`.

### 6. Resolución guiada

Después de comparar, el usuario selecciona una actuación explícita:

- `LINK_INCIDENT`: vincular una incidencia existente;
- `CREATE_INCIDENT`: crear una IT nueva;
- `UPDATE_INCIDENT`: sustituir fechas después de confirmación expresa;
- `ADD_CONFIRMATION`: añadir un parte de confirmación;
- `CLOSE_INCIDENT`: cerrar la IT por alta;
- `CANCEL_INCIDENT`: anular la incidencia;
- `CREATE_RELAPSE`: crear una recaída vinculada;
- `MARK_FOR_REVIEW`: mantener el caso pendiente;
- `IGNORE_DUPLICATE`: descartar una comunicación duplicada.

Las comunicaciones con discrepancias no se aplican mediante una acción genérica. Requieren seleccionar la resolución y, cuando proceda, la incidencia interna concreta.

### 7. Impacto en nómina

Una comunicación nunca recalcula automáticamente una nómina.

Estados:

- `NO_IMPACT`;
- `PENDING_RECALCULATION`;
- `REGULARIZATION_REQUIRED`;
- `RECALCULATED`, reservado para un flujo posterior.

Criterio inicial:

- sin nómina en el mes afectado: sin impacto;
- nómina existente pero modificable: pendiente de recálculo;
- nómina cerrada, pagada, procesada o liquidada: regularización necesaria.

La interfaz explica el motivo y el periodo afectado antes de aplicar la decisión.

### 8. Trazabilidad y visor técnico

Cada comunicación conserva una línea temporal con:

- recepción;
- lectura;
- comparación;
- conflicto detectado;
- resolución;
- descarte;
- reapertura;
- usuario que realizó cada acción.

El visor técnico permite:

- consultar el JSON simulado;
- copiarlo;
- descargarlo;
- interpretar los campos principales mediante ayuda contextual.

## API

### Consulta

- `GET /fie/communications`
- `GET /fie/communications/{communication_id}`
- `GET /fie/communications/{communication_id}/events`
- `GET /fie/employees/{employee_id}/history`

### Recepción y procesamiento

- `POST /fie/simulate`
- `POST /fie/generate-pending`
- `POST /fie/communications/{communication_id}/read`
- `POST /fie/communications/{communication_id}/compare`
- `POST /fie/communications/{communication_id}/resolve`
- `POST /fie/communications/{communication_id}/apply`
- `POST /fie/communications/{communication_id}/ignore`
- `POST /fie/communications/{communication_id}/reopen`

`/resolve` recibe la actuación elegida, la incidencia seleccionada cuando sea necesaria, las observaciones y la confirmación para sustituir fechas.

## Validación automatizada

La integración continua cubre:

- reglas base de conciliación e impacto en nómina;
- generación automática idempotente;
- trabajador no identificado;
- detección de comunicaciones duplicadas;
- discrepancia de fechas;
- aplicación de una resolución guiada sobre la incidencia;
- importación completa de la aplicación;
- estabilidad con PostgreSQL;
- lint, regresión y compilación del frontend.

## Recorrido didáctico recomendado

1. Crear una incidencia IT manual.
2. Calcular la nómina del periodo.
3. Abrir **Comunicaciones INSS (FIE)**.
4. Comparar una baja coincidente y vincularla sin duplicar la incidencia.
5. Generar una comunicación con fecha distinta.
6. Revisar la comparación lado a lado.
7. Seleccionar la incidencia correcta y confirmar la actualización de fechas.
8. Comprobar el estado de recálculo o regularización.
9. Generar un trabajador no identificado y dejarlo pendiente.
10. Generar una comunicación duplicada y descartarla justificadamente.
11. Revisar la línea temporal y descargar el contenido técnico.

## Criterio de cierre

El split se considera funcional cuando el usuario puede recibir comunicaciones automáticas o manuales, identificar al trabajador, detectar conflictos, comparar la información externa con la interna, seleccionar una resolución controlada, actualizar las incidencias y conocer el impacto en nómina conservando toda la trazabilidad.
