# Split 37 — FIE / INSS Empresas

## Objetivo

Incorporar una bandeja educativa de comunicaciones FIE recibidas desde el INSS y cerrar el circuito entre SILTRA simulado, incidencias laborales y nómina.

El módulo no genera un fichero para enviar. Simula una comunicación entrante que debe compararse con la información registrada en AulaNomina antes de aplicarse.

## Ubicación funcional

El módulo pertenece a **Gestión de personal → Gestión laboral**, junto a incidencias, altas y bajas y ficheros AFI.

No forma parte de **Nómina → Seguros sociales**, porque su función principal es recibir y conciliar comunicaciones médicas y administrativas del INSS con las incidencias laborales del trabajador.

Se mantiene un acceso adicional desde el SILTRA simulado para reproducir la recepción operativa de estas comunicaciones.

## Alcance de la primera versión

Tipos admitidos:

- baja médica;
- confirmación;
- alta médica;
- modificación;
- anulación;
- recaída.

Quedan expresamente fuera de este split:

- conexión real con INSS, SILTRA o RED Online;
- implementación completa de todos los segmentos del diseño oficial FIE;
- certificados electrónicos;
- ACRASS y alegaciones;
- cálculo jurídico completo de prestaciones;
- nacimiento y cuidado, riesgo durante embarazo y riesgo durante lactancia.

El contenido técnico se identifica como `AULANOMINA_FIE_V1`, es una simulación y usa la referencia educativa `FIE_5_0_EDUCATIONAL`.

## División del trabajo

### Paso 1. Dominio y trazabilidad

Se crean dos entidades independientes de la incidencia interna:

- `FieCommunication`: comunicación recibida, datos del proceso, estado de conciliación, impacto en nómina y contenido técnico.
- `FieProcessingEvent`: recepción, comparación, aplicación, rechazo, reapertura y usuario que realiza cada acción.

La separación conserva las dos realidades necesarias para la práctica:

1. información registrada en AulaNomina;
2. información recibida desde el INSS simulado.

### Paso 2. Bandeja y simulación

La ruta `#fie-inss` carga el espacio de trabajo **FIE / INSS Empresas**. Puede abrirse desde **Gestión de personal → Gestión laboral** y desde la pantalla **Procesar remesas INSS** del SILTRA simulado.

Incluye:

- filtros por empresa, estado y tipo de comunicación;
- bandeja con fecha de recepción, trabajador, NAF, comunicación, fecha, estado e impacto;
- detección automática de IT y recaídas internas que todavía no tienen comunicación FIE;
- generación idempotente: consultar la bandeja repetidamente no duplica mensajes del mismo proceso;
- formulario de administración para generar comunicaciones de prueba y discrepancias deliberadas;
- visor funcional y visor técnico JSON;
- histórico completo del procesamiento.

La detección automática crea una baja o recaída para procesos abiertos y un alta para procesos internos ya cerrados. Este mecanismo representa la llegada del mensaje desde el INSS simulado; no realiza ninguna consulta externa.

### Paso 3. Conciliación con incidencias

El backend compara cada comunicación con las incidencias `IT` y `RECAIDA` del trabajador.

Reglas principales:

- **Baja sin IT interna:** propone crear una incidencia.
- **Baja coincidente:** vincula el FIE sin duplicar la incidencia.
- **Baja con fecha distinta:** marca discrepancia.
- **Confirmación con IT abierta:** incorpora un parte de confirmación.
- **Confirmación sin proceso:** marca error.
- **Alta con IT abierta:** informa fecha final y cierra la incidencia.
- **Alta ya registrada:** la comunicación queda como coincidente.
- **Anulación sin nómina afectada:** cancela la incidencia.
- **Anulación con nómina afectada:** conserva el histórico y exige regularización.
- **Recaída con proceso anterior:** crea una incidencia `RECAIDA` vinculada.
- **Recaída sin proceso anterior:** solicita revisión manual.

Las incidencias aplicadas desde FIE guardan en `IncidentDetail.details`:

- origen `FIE`;
- identificador de la comunicación;
- referencia externa del proceso;
- fecha de la última actualización externa;
- estado de conciliación;
- contingencia;
- proceso previo cuando exista.

### Paso 4. Impacto en nómina

Una comunicación nunca recalcula automáticamente una nómina.

Estados de impacto:

- `NO_IMPACT`;
- `PENDING_RECALCULATION`;
- `REGULARIZATION_REQUIRED`;
- `RECALCULATED`, reservado para el flujo posterior de recálculo.

Criterio inicial:

- sin nómina en el mes afectado: sin impacto;
- nómina existente pero no finalizada: pendiente de recálculo;
- nómina pagada, cerrada, procesada o liquidada: regularización necesaria.

El detalle de la incidencia se marca con `requires_recalculation` o `requires_regularization`; no se altera la nómina sin confirmación del usuario.

## API

### Bandeja

- `GET /fie/communications`
- `GET /fie/communications/{communication_id}`
- `GET /fie/communications/{communication_id}/events`
- `GET /fie/employees/{employee_id}/history`

Filtros disponibles:

- `company_id`;
- `employee_id`;
- `status`;
- `communication_type`;
- `received_from`;
- `received_to`.

### Simulación y procesamiento

- `POST /fie/simulate`
- `POST /fie/generate-pending`
- `POST /fie/communications/{communication_id}/compare`
- `POST /fie/communications/{communication_id}/apply`
- `POST /fie/communications/{communication_id}/ignore`
- `POST /fie/communications/{communication_id}/reopen`

## Recorrido didáctico de validación

1. Crear una incidencia IT manual para un trabajador.
2. Calcular su nómina mensual.
3. Abrir **FIE / INSS Empresas** desde Gestión laboral o desde SILTRA.
4. Comprobar que aparece automáticamente la comunicación asociada a la IT.
5. Comparar la comunicación con el ERP y verificar que no duplica la incidencia.
6. Generar manualmente una confirmación con la misma referencia o fecha de baja.
7. Aplicarla y comprobar el parte de confirmación en la incidencia.
8. Generar posteriormente un alta médica.
9. Comparar y aplicar el alta.
10. Comprobar que la incidencia queda cerrada.
11. Revisar si la nómina aparece como pendiente de recálculo o regularización.
12. Consultar el histórico y el contenido técnico de las comunicaciones.

## Criterio de cierre

El split se considera funcional cuando el usuario puede recibir una comunicación automática o manual, compararla con el dato interno, aplicar una decisión controlada, actualizar la incidencia y detectar el impacto sobre la nómina conservando toda la trazabilidad.
