# Split 36 — Remesas de afiliación conectadas con SILTRA

## Objetivo

El split conecta los movimientos laborales de AulaNomina con un flujo educativo de afiliación inspirado en SILTRA/Sistema RED. La plataforma permite localizar altas, modificaciones y bajas, incorporarlas progresivamente a un borrador AFI, generar el fichero, transmitirlo y recibir una respuesta simulada.

No existe conexión con TGSS, Sistema RED ni SILTRA real.

## Alcance funcional

### Selección de movimientos

El submódulo obtiene candidatos desde la información laboral ya registrada:

- **Alta**: fecha de inicio del contrato.
- **Baja**: fecha de fin del contrato.
- **Modificación**: fecha de actualización de los datos de Seguridad Social asociados al contrato.

La búsqueda admite:

- rango de fechas;
- todas las empresas o una empresa concreta;
- todos los convenios o un convenio concreto;
- todos los trabajadores o un trabajador concreto;
- altas, modificaciones, bajas o todos los movimientos.

### Borrador progresivo

El usuario puede:

1. seleccionar uno o varios resultados;
2. crear un borrador nuevo;
3. realizar otra búsqueda con filtros diferentes;
4. añadir la nueva selección al mismo borrador;
5. retirar movimientos individualmente;
6. combinar empresas y CCC en una única remesa educativa;
7. generar el fichero únicamente cuando la selección esté terminada.

El borrador conserva:

- tipo y fecha del movimiento;
- contrato, trabajador y empresa;
- centro y convenio;
- DNI/NIE y NAF;
- CCC;
- grupo de cotización y código de contrato;
- estado de afiliación que conoce el simulador.

## Estado externo de afiliación

Se incorpora `AffiliationWorkerState`, una entidad separada de contratos y trabajadores. Representa lo que el SILTRA/TGSS simulado conoce para cada combinación trabajador–CCC.

Esta separación es deliberada. El simulador no acepta automáticamente un movimiento solo porque AulaNomina lo haya registrado. Aplica reglas propias:

- un alta aceptada deja al trabajador `ACTIVE` en el CCC;
- una baja aceptada lo deja `INACTIVE`;
- una modificación mantiene el estado activo;
- solo un trabajador `ACTIVE` puede causar baja;
- no puede darse de alta a quien ya consta `ACTIVE` en el mismo CCC;
- no puede modificarse una relación que no consta activa;
- un estado ya registrado por SILTRA prevalece sobre cambios posteriores en la ficha laboral.

Antes del primer movimiento procesado, el servicio inicializa de forma educativa el estado a partir de las fechas del contrato. Desde la primera respuesta aceptada, la entidad externa es la fuente de verdad del simulador.

## Validaciones de respuesta

La decisión se realiza siempre en backend. React únicamente representa el proceso y los mensajes recibidos.

### Aceptación

- `A0001`: fichero aceptado y movimientos registrados.

### Rechazos iniciales

- `R9701`: DNI o NIE no válido.
- `R9702`: NAF distinto de 12 dígitos.
- `R9703`: CCC inválido o ajeno a la empresa.
- `R9704`: alta duplicada en el mismo CCC.
- `R9705`: baja de un trabajador que no consta de alta.
- `R9706`: modificación sin relación activa.
- `R9707`: datos esenciales incompletos.
- `R9708`: fichero sin movimientos.
- `R9709`: movimiento duplicado o ya procesado.
- `R9710`: incoherencia entre clave, tipo, fecha y contrato.

La estructura permite añadir nuevos códigos y escenarios didácticos sin modificar el frontend.

## Flujo de envío y respuesta

1. El borrador se genera como `CommunicationFile` de tipo `AFFILIATION`.
2. El envío crea un `CommunicationSubmission` independiente.
3. El fichero pasa a `SENT`.
4. La interfaz mantiene un retardo aproximado de 1,6 segundos.
5. La recepción inicia el estado `PROCESSING`.
6. El backend valida cada movimiento contra datos y estado externo.
7. Se genera un fichero `AULANOMINA_SILTRA_AFFILIATION_RESPONSE_V1`.
8. El origen y el intento quedan en `ACCEPTED` o `REJECTED`.
9. Solo si toda la remesa es aceptada se actualiza el estado externo.

Los intentos no se sobrescriben. Un mismo fichero puede enviarse varias veces y conserva el número de intento, eventos y respuestas anteriores.

## Interfaz

Se añade un lanzador global **AFI · Altas y bajas** que abre una ventana de trabajo asociada al SILTRA simulado. También queda disponible el evento global:

```javascript
window.dispatchEvent(new Event("aulanomina-open-affiliation-remittances"));
```

Esto permite enlazar posteriormente el mismo workspace directamente desde otros accesos visuales sin duplicar lógica.

La ventana incluye:

- filtros de búsqueda;
- tabla de candidatos seleccionables;
- carga progresiva al borrador actual;
- selector e historial de borradores;
- resumen de empresas, CCC y fechas;
- generación del fichero AFI;
- envío con respuesta diferida;
- detalle de códigos, trabajadores afectados y recomendaciones.

## API

### Candidatos y borradores

- `GET /affiliation-remittances/candidates`
- `GET /affiliation-remittances`
- `POST /affiliation-remittances`
- `GET /affiliation-remittances/{draft_id}`
- `POST /affiliation-remittances/{draft_id}/movements`
- `DELETE /affiliation-remittances/{draft_id}/movements/{movement_key}`
- `POST /affiliation-remittances/{draft_id}/generate`

### Envío y recepción

- `POST /affiliation-remittances/{draft_id}/send`
- `POST /affiliation-remittances/submissions/{submission_id}/receive`

El endpoint de envío no procesa la remesa inmediatamente. Devuelve el intento en `SENT` y el tiempo orientativo antes de consultar la respuesta. Esta separación permite representar el comportamiento asíncrono y ampliar más adelante colas o respuestas programadas.

## Prueba manual recomendada

### Caso 1 — Dos bajas del mismo día

1. Finalice dos contratos con fecha `10/07/2026`.
2. Busque del `10/07/2026` al `10/07/2026` y seleccione **Bajas**.
3. Marque ambos movimientos y cree el borrador.
4. Revise trabajador, empresa, NAF y CCC.
5. Genere y envíe el fichero.
6. Compruebe la respuesta recibida.

### Caso 2 — Remesa con varias empresas

1. Busque movimientos de una empresa y añádalos al borrador.
2. Cambie el filtro de empresa.
3. Busque y añada movimientos de otra empresa.
4. Añada, además, un trabajador concreto de una tercera empresa.
5. Compruebe los contadores de empresas y CCC antes de generar.

### Caso 3 — Alta duplicada

1. Envíe un alta válida y reciba `A0001`.
2. Reenvíe el mismo movimiento o prepare otra alta para el mismo trabajador y CCC.
3. Compruebe el rechazo por relación ya activa o movimiento duplicado.

### Caso 4 — Baja imposible

1. Deje al trabajador como `INACTIVE` en el estado externo simulado.
2. Prepare una baja en el mismo CCC.
3. Compruebe `R9705`.

### Caso 5 — Datos incorrectos

1. Use un NAF con menos de 12 dígitos o un DNI con letra incorrecta.
2. Genere y envíe el fichero.
3. Compruebe `R9701` o `R9702` y la recomendación de corrección.

## Pruebas automatizadas

Backend:

```bash
cd backend
pytest tests/test_affiliation_remittance_service.py
```

Frontend:

```bash
cd frontend
npm run build
```

La suite backend cubre candidatos, alta aceptada, persistencia del estado externo, alta duplicada, baja sin alta previa, secuencia alta–baja, validaciones de DNI/NAF y borradores progresivos con varias empresas.

## Decisiones y límites del split

- El contenido funcional admite varias empresas y CCC en un mismo fichero.
- `CommunicationFile.company_id` y `CommunicationSubmission.company_id` siguen siendo obligatorios por la infraestructura común; para remesas mixtas guardan la primera empresa y el desglose real permanece en `movements` y metadatos.
- El formato es JSON educativo, no AFI oficial.
- No se implementan plazos legales, claves RED completas, huellas, certificados ni transmisión real.
- El estado externo y los códigos quedan preparados para futuros casos prácticos con errores provocados, correcciones y reenvíos.
