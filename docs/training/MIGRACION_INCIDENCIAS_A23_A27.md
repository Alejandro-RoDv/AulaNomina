# Migración Fase B · Incidencias laborales A23-A27

## Prácticas ejecutables

- `A23` · IT por enfermedad común: alta de incidencia, conciliación FIE y comprobación de nómina.
- `A24` · IT por accidente de trabajo: alta de IT con `process_type=work_accident` y comprobación del tratamiento profesional.
- `A25` · Vacaciones: registro del intervalo y revisión de solapamientos incompatibles.
- `A26` · Ausencia no retribuida: registro y comprobación de reducción de salario/días cotizados.
- `A27` · Cambio de jornada: paso a 30 h semanales / 75 % de parcialidad y comprobación posterior en nómina.

Las prácticas se muestran como una única actividad maestra con varios subpasos cuando el proceso profesional requiere más de una operación ERP.

## Datos demo aislados

Los ejercicios usan a Laura Martín Ruiz, pero fechas distintas de las incidencias preexistentes del dataset para impedir que una práctica se complete por encontrar un registro antiguo.

A23 dispone además de una comunicación FIE exclusiva:

- mensaje: `FIE-TRAIN-2026-A23`;
- proceso: `IT-TRAIN-A23-2026`;
- estado inicial: `RECEIVED`;
- sin incidencia vinculada antes de que trabaje el alumno.

## Validación

Las operaciones de alta y conciliación continúan utilizando el motor general de casos. Las revisiones pedagógicas son explícitas: el alumno realiza la operación, revisa el resultado y pulsa **Comprobar resultado**.

La comprobación específica cubre:

- tipo de proceso médico guardado en `IncidentDetail.details`;
- fechas completas de la incidencia;
- días IT y tratamiento económico de la nómina;
- diferencia entre enfermedad común y accidente de trabajo;
- conflictos de vacaciones;
- días no cotizados en ausencia no retribuida;
- jornada semanal y coeficiente de parcialidad;
- salario base de nómina proporcional a la jornada.

## Corrección funcional asociada

El motor de nómina recibía antes todas las incidencias `IT` con el mismo tratamiento porque la contingencia médica real se guarda en `details.process_type`. El desglose de días expone ahora ese dato y el cálculo reconoce `work_accident` y `occupational_disease` como contingencias profesionales.

En la simulación educativa existente se mantiene la lógica simplificada del motor:

- IT común: 60 % prestación + 40 % complemento de empresa;
- IT profesional: 75 % prestación + 25 % complemento de empresa.

No se presenta esta simplificación como cálculo legal exhaustivo: forma parte del motor simulado actual y queda trazada en las pruebas.

## Reset demo

El seeder crea A23-A27, sus asignaciones y el FIE de A23. El reset elimina primero las comunicaciones FIE asociadas a la empresa demo para no dejar claves foráneas apuntando a trabajadores/contratos que van a recrearse.

Después de actualizar la rama, ejecutar una vez:

```text
POST /demo/reset
```
