# Split 40 · Rediseño ERP del proceso CRA

## Referencia funcional

El flujo se ha reorganizado siguiendo el patrón habitual de un ERP laboral:

1. Parametrización maestra de cada concepto salarial con su clave CRA.
2. Nóminas previamente calculadas.
3. Asistente mensual con empresa, CCC, ejercicio/mes, tipo de liquidación y actuación.
4. Revisión de trabajadores, NAF, claves, indicadores e importes.
5. Generación del fichero.
6. Editor e historial de ficheros.
7. Envío mediante SILTRA y consulta de respuesta.

La separación entre configuración y proceso mensual evita mostrar la tabla completa de conceptos cada vez que se genera un fichero.

## Cambios de interfaz

- Cabecera operativa con estado de configuración y ficheros pendientes.
- Tres áreas diferenciadas:
  - Generar CRA.
  - Ficheros y envíos.
  - Configuración conceptos.
- Asistente de cuatro pasos: parámetros, revisión, fichero y SILTRA.
- Tabla plana de registros CRA por trabajador, en lugar de conceptos anidados dentro de una celda.
- Avisos visibles de conceptos sin parametrizar.
- Gestor de ficheros con estados, respuesta, descarga, editor XML y envío.
- Configuración con filtros, estados y asistente de asignación masiva.
- Diseño responsive y coherente con el estilo visual de AulaNomina.

## Alcance conservado

- Solo se genera el tipo de actuación de alta o primera comunicación.
- Atrasos, modificaciones, complementarias y bajas se muestran como futuras ampliaciones.
- El envío sigue siendo una simulación educativa y no conecta con TGSS.
