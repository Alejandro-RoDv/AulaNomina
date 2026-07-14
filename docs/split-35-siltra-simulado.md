# Split 35 — SILTRA simulado

## Objetivo

Este split incorpora a AulaNomina una aplicación de escritorio simulada para practicar el intercambio de ficheros de cotización. No existe conexión con SILTRA real, Sistema RED, TGSS ni otros servicios públicos.

El diseño toma como referencia la organización clásica de SILTRA y su configuración por pestañas: Autorizado, Aplicación, Comunicaciones, Localización de ficheros e Impresora.

## Acceso

SILTRA no funciona como una página del menú lateral. El acceso se muestra en la cabecera principal de AulaNomina mediante el icono rojo de SILTRA.

Al pulsarlo se abre una subventana global con:

- barra de título `SILTRA Versión 2.2.0 - AulaNomina`;
- controles de ventana;
- menú superior de Cotización, Afiliación/INSS, Comunicaciones, Utilidades, Configuración y Acerca de;
- pantalla inicial organizada en bloques verticales;
- barra inferior de estado y botón de salida;
- cierre mediante el botón de la ventana o la tecla Escape.

Los antiguos accesos integrados en el menú lateral y en el dashboard se ocultan visualmente.

## Recorrido disponible

1. preparar y confirmar una liquidación en AulaNomina;
2. generar el fichero `SOCIAL_SECURITY_SETTLEMENT`;
3. abrir SILTRA desde la cabecera;
4. entrar en **Procesar remesas Cotización**;
5. seleccionar un fichero generado en AulaNomina o incorporar uno desde el equipo;
6. validar y adaptar el fichero;
7. transmitirlo a la TGSS simulada;
8. consultar la respuesta en el buzón de entrada o salida;
9. corregir los datos y realizar nuevos intentos sin borrar el historial anterior.

## Interfaz reproducida

### Pantalla inicial

La ventana conserva la distribución visual de la aplicación de referencia:

- Cotización:
  - Procesar remesas Cotización;
  - Documentos RNT;
  - Documentos RLC;
  - Documentos DCL.
- Afiliación/INSS:
  - Procesar remesas Afiliación;
  - Procesar remesas INSS.
- Comunicaciones:
  - Envío/Recepción;
  - Consulta de envíos de Cotización;
  - Consulta de envíos de Afiliación/INSS;
  - Seguimiento de liquidaciones;
  - Buzón de entrada y salida.
- Utilidades:
  - Reconstrucción de seguimiento;
  - Copias de seguridad;
  - Procesamiento de mensajes descargados.

Los espacios de iconos internos quedan preparados para incorporar recursos gráficos definitivos en un split posterior.

### Configuración

La configuración educativa se guarda en `localStorage` y reproduce las pestañas principales de SILTRA:

- **Autorizado**: número y fecha de autorización, despacho y usuarios.
- **Aplicación**: reglas de validación, entorno de prácticas, copias de seguridad y nivel de log.
- **Comunicaciones**: conexión directa o proxy y parámetros SSL simulados.
- **Localización de ficheros**: estructura virtual XECR, XDCR, RED y SVA.
- **Impresora**: selección de una impresora simulada.

Los parámetros no producen conexiones reales ni cambios en el sistema operativo.

## Incorporación de ficheros

La pantalla de Cotización permite dos orígenes:

### Ficheros generados en AulaNomina

Se consultan directamente mediante la API común de comunicaciones. La tabla muestra:

- nombre del fichero;
- CCC;
- periodo;
- estado;
- último resultado de envío.

### Fichero seleccionado desde el equipo

Se pueden seleccionar archivos JSON, XML o TXT. El flujo interno es:

1. crear la comunicación como borrador;
2. validar empresa, CCC y periodo;
3. adaptar y marcar el fichero como generado;
4. conservar su contenido y metadatos en AulaNomina;
5. permitir su transmisión mediante el simulador.

El formato generado actualmente por las liquidaciones de AulaNomina es JSON. Los ficheros XML o TXT pueden incorporarse para prácticas, pero el motor de procesamiento puede rechazarlos si no cumplen la estructura educativa esperada.

## Arquitectura backend

### Entidad `CommunicationSubmission`

Cada intento de transmisión es un registro independiente. Un fichero puede tener varios intentos y nunca se sobrescribe el historial anterior.

Campos principales:

- `communication_file_id` y `company_id`;
- `submission_number`, con formato `SILTRA-SIM-AAAA-000001`;
- `attempt_number` incremental por fichero;
- estados `PENDING`, `SENT`, `PROCESSING`, `ACCEPTED`, `ACCEPTED_WITH_WARNINGS`, `REJECTED` y `CANCELLED`;
- fechas de envío, inicio de procesamiento y finalización;
- código, mensaje y fichero de respuesta;
- mensajes serializados y usuario creador.

### Servicio de simulación

`app/services/siltra_simulation_service.py` concentra:

- validación previa del fichero;
- prevención de dos intentos activos simultáneos;
- numeración de envío e intento;
- análisis determinista del JSON generado por la liquidación;
- clasificación de errores y advertencias;
- transición del fichero original;
- creación de eventos de auditoría;
- generación del fichero `AULANOMINA_SILTRA_RESPONSE_V1`;
- enlace entre fichero, intento y respuesta.

La decisión del resultado se realiza en backend. React solo representa el flujo y la respuesta.

## Reglas iniciales

### Aceptación

- `A0000`: fichero procesado correctamente.
- `A0001`: fichero aceptado y registrado.

### Advertencias

- `W9601`: nómina pendiente de revisión.
- `W9602`: diferencia de redondeo.
- `W9603`: cero días con bases positivas.
- `W9604`: fichero presentado anteriormente.
- `W9605`: fecha de cálculo anterior al periodo de envío.
- `W9606`: metadatos no esenciales incompletos.

### Rechazos

- `R9501`: NAF obligatorio.
- `R9502`: CCC no válido.
- `R9503`: periodo incorrecto.
- `R9504`: base negativa.
- `R9505`: grupo de cotización obligatorio.
- `R9506`: total a ingresar negativo.
- `R9507`: fichero sin trabajadores.
- `R9508`: contenido no válido.
- `R9509`: tipo de fichero no admitido.
- `R9510`: empresa no válida.
- `R9511`: CCC ajeno a la empresa.
- `R9512`: estado del fichero no enviable.

Prioridad global: cualquier error produce `REJECTED`; advertencias sin errores producen `ACCEPTED_WITH_WARNINGS`; sin incidencias se obtiene `ACCEPTED`.

## API

### Comunicaciones

- `POST /communications`
- `POST /communications/{id}/validate`
- `POST /communications/{id}/generate`
- `GET /communications`
- `GET /communications/{id}`
- `POST /communications/{communication_file_id}/submit`

### Intentos SILTRA

- `POST /communication-submissions`
- `GET /communication-submissions`
- `GET /communication-submissions/{id}`
- `POST /communication-submissions/{id}/send`
- `POST /communication-submissions/{id}/process`
- `GET /communication-submissions/{id}/response`
- `POST /communication-submissions/{id}/cancel`

`POST /communications/{communication_file_id}/submit` ejecuta creación, envío y procesamiento dentro de una única transacción. Los endpoints separados se mantienen para prácticas paso a paso.

## Prueba manual

### Caso 1 — Fichero generado en AulaNomina

1. Prepare nóminas con CCC, NAF, grupo y bases válidas.
2. Prepare, confirme y genere la liquidación.
3. Pulse el icono SILTRA de la cabecera.
4. Abra **Procesar remesas Cotización**.
5. Seleccione el fichero generado.
6. Pulse **Enviar fichero seleccionado**.
7. Compruebe `ACCEPTED` y `A0000`.
8. Abra Comunicaciones y revise ambos buzones.

### Caso 2 — Incorporación local

1. Descargue un fichero de liquidación generado en AulaNomina.
2. Abra Cotización en la subventana SILTRA.
3. Seleccione empresa, CCC y periodo.
4. Pulse **Examinar** y elija el fichero.
5. Pulse **Validar y Adaptar**.
6. Compruebe que aparece en la tabla de ficheros generados.
7. Envíelo y revise la respuesta.

### Caso 3 — Advertencia

1. Genere un fichero con cero días y bases positivas, o provoque una diferencia de redondeo educativa.
2. Envíelo.
3. Compruebe `ACCEPTED_WITH_WARNINGS` y el código `W9603` o `W9602`.
4. Revise la recomendación en el mensaje recibido.

### Caso 4 — Rechazo y reenvío

1. Genere un fichero con un trabajador sin NAF.
2. Envíelo y compruebe `REJECTED` y `R9501`.
3. Corrija el dato y regenere la liquidación.
4. Vuelva a enviarla.
5. Verifique que ambos intentos permanecen en el historial.

## Pruebas automatizadas

Backend:

```bash
cd backend
pytest tests/test_siltra_simulation_service.py
```

Frontend:

```bash
cd frontend
npm run test:siltra
npm run build
```

La suite cubre numeración, reenvíos, estados, códigos, prioridad de errores, creación de respuestas, conservación del historial, cancelación, prevención de doble envío y utilidades de presentación.
