# Split 35 — SILTRA simulado

## Objetivo

Este split incorpora a AulaNomina un simulador educativo del flujo de envío y recepción de ficheros de liquidación de Seguridad Social. No existe ninguna conexión con SILTRA, Sistema RED, TGSS ni otros servicios públicos.

El recorrido disponible es:

1. preparar y confirmar una liquidación;
2. generar el fichero `SOCIAL_SECURITY_SETTLEMENT`;
3. abrir **Seguros sociales > SILTRA simulado**;
4. seleccionar el fichero en la bandeja de salida;
5. ejecutar el envío visual;
6. procesar el contenido en backend;
7. recibir una respuesta aceptada, aceptada con advertencias o rechazada;
8. descargar la respuesta educativa y consultar el historial de intentos.

## Arquitectura

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

La lógica de validación no se implementa en React.

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

- `POST /communication-submissions`
- `GET /communication-submissions`
- `GET /communication-submissions/{id}`
- `POST /communication-submissions/{id}/send`
- `POST /communication-submissions/{id}/process`
- `GET /communication-submissions/{id}/response`
- `POST /communication-submissions/{id}/cancel`
- `POST /communications/{communication_file_id}/submit`

La última operación ejecuta creación, envío y procesamiento dentro de una única transacción, pero se mantienen los endpoints detallados para prácticas paso a paso.

## Interfaz

La pantalla reproduce la organización visual del programa de referencia sin intentar presentarse como software oficial. Incluye:

- menú principal inspirado en Cotización, Afiliación/INSS, Comunicaciones y Utilidades;
- aviso permanente de entorno educativo;
- bandeja de salida;
- fases visuales de transmisión;
- resultado y detalle de mensajes;
- historial completo;
- descarga de respuestas;
- navegación a fichero y liquidación.

Las esperas entre fases son solo visuales. El resultado se decide en backend.

## Prueba manual

### Caso 1 — Aceptación

1. Prepare nóminas con CCC, NAF, grupo y bases válidas.
2. Prepare, confirme y genere la liquidación.
3. Abra SILTRA simulado.
4. Envíe el fichero.
5. Compruebe `ACCEPTED` y `A0000`.
6. Descargue la respuesta y abra el intento desde el historial.

### Caso 2 — Advertencia

1. Genere un fichero con cero días y bases positivas, o provoque una diferencia de redondeo educativa.
2. Envíelo.
3. Compruebe `ACCEPTED_WITH_WARNINGS` y el código `W9603` o `W9602`.
4. Revise la recomendación y descargue la respuesta.

### Caso 3 — Rechazo

1. Genere un fichero con un trabajador sin NAF.
2. Envíelo.
3. Compruebe `REJECTED` y `R9501`.
4. Corrija el dato, regenere la liquidación y vuelva a enviarla.
5. Verifique que el intento rechazado sigue en el historial.

### Caso 4 — Reenvío

1. Seleccione un fichero con un intento finalizado.
2. Pulse **Reenviar**.
3. Compruebe que `attempt_number` aumenta.
4. Verifique que ambos intentos y sus respuestas permanecen disponibles.

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
```

La suite cubre numeración, reenvíos, estados, códigos, prioridad de errores, creación de respuestas, conservación del historial, cancelación, prevención de doble envío y utilidades de presentación.
