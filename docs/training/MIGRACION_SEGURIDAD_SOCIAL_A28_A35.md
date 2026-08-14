# Migración Fase B · Seguridad Social y Sistema RED A28-A35

## Cobertura ejecutable

El bloque B05 queda conectado al Temario Maestro mediante estas prácticas:

- `A28` · Revisión previa: DNI/NIE, NAF, empresa, CCC, contrato y fecha de referencia.
- `A29` · Alta de afiliación: mantiene el flujo operativo ya migrado en `TRAIN-2026-001`.
- `A30` · Baja de afiliación: Javier Romero Sánchez, baja con efectos `30/06/2026` y CCC `14000000011`.
- `A31` · Interpretación FIE: comunicación dedicada `FIE-TRAIN-2026-A31` / proceso `IT-TRAIN-A31-2026`.
- `A32` · Conciliación FIE: comparación y enlace con la IT del `01/12/2026` al `03/12/2026`.
- `A33` · CRA: generación y revisión de mayo de 2026 para el CCC `14000000011`.
- `A34` · RNT/RLC: preparación y cuadre de la liquidación de mayo de 2026 para el mismo CCC.
- `A35` · SILTRA: rechazo didáctico, correctora y segundo envío aceptado.

## Criterio de implementación

No se ha creado un simulador formativo paralelo. Cada práctica comprueba artefactos reales de los módulos existentes:

- A30 inspecciona el `CommunicationFile` de tipo `AFFILIATION` y sus movimientos.
- A31/A32 trabajan contra `FieCommunication` y la incidencia enlazada.
- A33 analiza el XML CRA generado (`TRB` y `CRE`).
- A34 comprueba `SocialSecuritySettlement` y sus líneas nominales.
- A35 utiliza `CommunicationSubmission`, respuestas SILTRA y la trazabilidad de `create_cra_substitute`.

Las revisiones son bajo demanda: el alumno ejecuta el proceso en el módulo profesional y después pulsa **Comprobar resultado**.

## A35 · ciclo completo

La práctica se representa como una única actividad maestra con tres pasos runtime:

1. seleccionar el CRA generado y enviarlo con el escenario didáctico `REJECTED`;
2. interpretar la respuesta y crear la comunicación correctora desde el fichero rechazado;
3. reenviar la correctora con validación automática y alcanzar `ACCEPTED` o `ACCEPTED_WITH_WARNINGS`.

El validador comprueba, además del estado final, los enlaces:

- fichero rechazado → respuesta SILTRA;
- correctora → `replacement_of_file_id`;
- fichero original → `superseded_by_file_id`;
- segundo envío → respuesta y estado aceptado.

## Datos demo y reset

El seeder de casos crea A28, A30-A35 y sus asignaciones. A31/A32 reciben una IT y una comunicación FIE dedicadas. También completa el grupo de cotización demo cuando falta, para que las liquidaciones puedan ser preparadas con datos coherentes.

El reset de demo elimina antes de borrar trabajadores/contratos:

- comunicaciones FIE y eventos;
- estados externos simulados de afiliación;
- envíos RED/SILTRA;
- ficheros CRA, afiliación y respuestas;
- eventos de ficheros;
- liquidaciones de Seguridad Social y líneas RNT.

Así se puede repetir `POST /demo/reset` después de completar A30-A35 sin conservar artefactos de un intento anterior ni dejar claves foráneas hacia datos que se recrean.

## Puesta en marcha

Después de actualizar la rama ejecutar una vez:

```text
POST /demo/reset
```

A partir de ahí el Bloque 5 muestra las prácticas maestras migradas junto con A29, que ya formaba parte del itinerario de incorporación.
