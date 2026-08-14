# Migración formativa A36-A41 · IRPF y fiscalidad laboral

Este bloque convierte las prácticas fiscales del Temario Maestro 2026 en ejercicios ejecutables sobre los módulos reales de AulaNomina. No se crea un motor fiscal paralelo para formación.

## Secuencia

| Actividad | Práctica | Evidencia ERP |
| --- | --- | --- |
| A36 | Modelo 145 y perfil fiscal | `Document` + `TaxProfile` |
| A37 | Cálculo IRPF 2026 | `TaxProfile` + motor `calculate_irpf_2026` |
| A38 | Regularización de retención | cambio de perfil + nuevo tipo aplicado |
| A39 | Profesional sujeto a retención | `Professional` + `ProfessionalInvoice` |
| A40 | Modelo 111 | vista previa + declaración + presentación simulada |
| A41 | Modelo 190 | declaración anual + conciliación 111/190 |

## A36 · Modelo 145

Laura Martín Ruiz parte con el Modelo 145 pendiente. El alumno debe registrar su recepción y después trasladar al perfil fiscal únicamente los datos comunicados en el supuesto.

La comprobación exige que el documento conste recibido y que los campos fiscales coincidan con el caso. No se completan automáticamente circunstancias personales no aportadas.

## A37 · Cálculo IRPF 2026

El validador vuelve a ejecutar el motor IRPF 2026 a partir del `TaxProfile` guardado. La actividad solo se supera cuando el porcentaje persistido en `voluntary_irpf` coincide con el tipo sugerido por el cálculo dentro de una tolerancia de 0,01 puntos porcentuales.

Esto hace reproducible la práctica: no basta con introducir un porcentaje aproximado.

## A38 · Regularización

Se comunica un descendiente con efectos 01/07/2026. El alumno debe:

1. actualizar la circunstancia familiar;
2. recalcular la retención;
3. aplicar el nuevo tipo sugerido;
4. dejar activa la regularización manual para los periodos posteriores.

La actividad diferencia el cambio del dato origen del efecto posterior sobre la retención.

## A39 · Profesionales

El perceptor profesional no se modela como trabajador. Se usan las entidades fiscales existentes:

- Marta León Pérez · NIF `30456789R`;
- actividad profesional;
- retención del 15 %;
- factura `PRO-2026-001`;
- base 1.200,00 €;
- retención 180,00 €;
- pago 30/04/2026.

La factura pagada pasa a ser fuente real de los Modelos 111 y 190.

## A40 · Modelo 111

Se trabaja con el segundo trimestre de 2026. La práctica tiene tres subpasos:

1. preparar y cuadrar fuentes;
2. generar y revisar la declaración;
3. presentar en la simulación AEAT.

La vista previa real del Modelo 111 bloquea la generación si existen nóminas del periodo todavía sin revisar/cerrar. El alumno debe corregir el dato origen, no forzar la declaración.

Tras generar el modelo se vuelven a sumar las líneas de rendimientos del trabajo y actividades económicas y se comparan con las cajas almacenadas. La presentación exige estado `presented`, bloqueo, justificante y CSV.

## A41 · Modelo 190

El resumen anual se genera con los perceptores y operaciones reales de 2026. La primera comprobación valida que la declaración quede congelada y sin errores bloqueantes e incluya al profesional del caso.

La segunda comprobación compara los totales congelados con la vista previa anual actual y exige que el Modelo 111 del 2T presentado esté conciliado. La ausencia de otros trimestres puede producir avisos didácticos, pero no invalida por sí sola esta práctica acotada.

## Reset demo

`seed_demo.py` elimina antes de reconstruir la empresa demo:

- perfiles fiscales;
- documentos del expediente;
- profesionales y facturas;
- ajustes de retenciones;
- Modelos 111 y sus líneas;
- Modelos 190, perceptores, líneas y overrides.

El orden evita referencias huérfanas entre Modelo 190, Modelo 111, profesionales y trabajadores.

## Smoke test recomendado

1. Ejecutar `/demo/reset`.
2. Abrir A36 y comprobar que el Modelo 145 de Laura está pendiente.
3. Marcarlo recibido con fecha 01/06/2026 y configurar el perfil indicado.
4. En A37 recalcular y aplicar el tipo sugerido.
5. En A38 añadir un descendiente, recalcular y aplicar el nuevo tipo.
6. Crear el profesional y la factura de A39.
7. En A40 revisar/cerrar las nóminas del 2T que bloquee la vista previa, generar el 111 y presentarlo.
8. Generar el Modelo 190 de 2026 y comprobar la conciliación del 2T en A41.
9. Repetir `/demo/reset` y verificar que no quedan declaraciones, profesionales, perfiles ni progreso empresarial residual que falsee las comprobaciones.
