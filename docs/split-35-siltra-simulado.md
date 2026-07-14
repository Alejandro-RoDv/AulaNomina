# Split 35 — SILTRA simulado

## Objetivo

Este split incorpora a AulaNomina una aplicación de escritorio simulada para practicar el intercambio de ficheros de cotización. No existe conexión con SILTRA real, Sistema RED, TGSS ni otros servicios públicos.

El diseño toma como referencia la organización clásica de SILTRA y su configuración por pestañas: Autorizado, Aplicación, Comunicaciones, Localización de ficheros e Impresora.

## Acceso

SILTRA no funciona como una página del menú lateral. El único acceso se integra directamente en la cabecera principal de AulaNomina mediante el icono rojo de SILTRA, junto a Alertas, Demo MVP y Ajustes.

Se han eliminado completamente:

- la entrada SILTRA del menú lateral;
- la ruta basada en `#social-security-siltra`;
- la tarjeta de acceso del dashboard de Seguros Sociales;
- la página `SiltraSimulatorPage.jsx`;
- el montaje independiente desde `main.jsx`.

Al pulsar el acceso de cabecera se abre una subventana global con:

- barra de título `SILTRA Versión 2.2.0 - AulaNomina`;
- controles funcionales de minimizar, maximizar/restaurar y cerrar;
- menú superior de Cotización, Afiliación/INSS, Comunicaciones, Utilidades, Configuración y Acerca de;
- pantalla inicial organizada en bloques verticales;
- aviso permanente de entorno educativo;
- barra inferior de estado y botón de salida;
- cierre mediante el botón de la ventana o la tecla Escape;
- bloqueo del desplazamiento de AulaNomina mientras la ventana está abierta;
- restauración de la última pantalla visitada y del fichero generado seleccionado.

Si existe un fichero local seleccionado que todavía no se ha validado, SILTRA solicita confirmación antes de cerrar.

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

La pantalla de Cotización separa claramente dos orígenes.

### Ficheros generados en AulaNomina

Se consultan directamente mediante la API común de comunicaciones. La tabla muestra:

- nombre del fichero;
- CCC;
- periodo;
- estado;
- último resultado de envío.

Al seleccionar un registro se muestra una ficha previa con:

- nombre;
- tipo;
- tamaño calculado;
- empresa;
- CCC;
- periodo.

Solo se habilita el envío cuando el fichero tiene contenido y se encuentra en un estado enviable: `GENERATED`, `ACCEPTED`, `ACCEPTED_WITH_WARNINGS` o `REJECTED`.

### Ficheros del equipo

Se pueden seleccionar archivos JSON, XML o TXT con un límite de 5 MB. Antes de crear una comunicación se comprueba:

- extensión admitida;
- tamaño máximo;
- existencia de un fichero con el mismo nombre y tamaño;
- empresa, CCC y periodo seleccionados.

La interfaz muestra una previsualización con nombre, tipo, tamaño, empresa, CCC y periodo.

Los duplicados requieren confirmación. Los XML y TXT muestran un aviso porque solo se procesarán si contienen una estructura compatible con AulaNomina. JSON es el formato plenamente funcional del MVP.

El flujo interno es:

1. crear la comunicación como borrador;
2. validar empresa, CCC y periodo;
3. adaptar y marcar el fichero como generado;
4. conservar contenido, tamaño, extensión y metadatos en AulaNomina;
5. permitir su transmisión mediante el simulador.

## Comportamiento de la subventana

- El estado de Cotización permanece al cambiar a Comunicaciones o Configuración.
- La empresa y el fichero generado seleccionado se guardan en `sessionStorage`.
- Minimizar conserva todo el estado y muestra una barra restaurable.
- Maximizar adapta la ventana al área disponible.
- En resoluciones de 1366×768 se reduce el espaciado y se mantiene scroll interno.
- En anchuras inferiores a 900 px los paneles pasan a una columna.
- Los detalles de mensajes se muestran en una capa interna con prioridad visual sobre el contenido principal.

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
6. Compruebe su ficha previa.
7. Pulse **Enviar fichero seleccionado**.
8. Compruebe `ACCEPTED` y `A0000`.
9. Abra Comunicaciones y revise ambos buzones.

### Caso 2 — Incorporación local

1. Descargue un fichero de liquidación generado en AulaNomina.
2. Abra Cotización en la subventana SILTRA.
3. Seleccione empresa, CCC y periodo.
4. Pulse **Examinar** y elija el fichero.
5. Revise tipo, tamaño y datos asociados.
6. Pulse **Validar y Adaptar**.
7. Compruebe que aparece en la tabla de ficheros generados.
8. Envíelo y revise la respuesta.

### Caso 3 — Validaciones de carga

1. Intente seleccionar una extensión no admitida.
2. Intente seleccionar un fichero superior a 5 MB.
3. Seleccione un fichero con el mismo nombre que otro existente.
4. Compruebe el rechazo o aviso correspondiente.
5. Seleccione XML o TXT y compruebe el aviso de compatibilidad.

### Caso 4 — Estado de ventana

1. Seleccione un fichero generado.
2. Cambie a Comunicaciones y vuelva a Cotización.
3. Compruebe que continúa seleccionado.
4. Minimice y restaure SILTRA.
5. Compruebe que el estado no cambia.
6. Seleccione un fichero local sin validarlo e intente cerrar.
7. Compruebe la solicitud de confirmación.

### Caso 5 — Rechazo y reenvío

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

La suite cubre numeración, reenvíos, estados, códigos, prioridad de errores, creación de respuestas, conservación del historial, cancelación, prevención de doble envío, validación de extensiones, límite de tamaño, duplicados, previsualización y utilidades de presentación.
