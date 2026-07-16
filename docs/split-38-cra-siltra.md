# Split 38 - Ficheros CRA y envío SILTRA simulado

## Objetivo

Incorporar un flujo didáctico de Comunicación de Conceptos Retributivos Abonados (CRA) conectado con las nóminas de AulaNomina.

## Alcance

- Catálogo CRA 0001-0062 con los indicadores de inclusión o exclusión admitidos.
- Vinculación entre cada concepto de nómina y una clave CRA.
- Asignación inicial automática para conceptos habituales:
  - salario, antigüedad y complementos ordinarios: CRA 0001 I;
  - horas extraordinarias: CRA 0002/0003 I;
  - prorrata de pagas extraordinarias: CRA 0004 I;
  - mejora empresarial de IT: CRA 0055 E;
  - horas complementarias: CRA 0057/0058 I;
  - gastos de teletrabajo: CRA 0062 E.
- Preparación por empresa, CCC y periodo mensual.
- Agrupación por trabajador y clave CRA a partir de los devengos de nómina.
- Generación de XML educativo con segmentos DDE, TRB y CRE.
- Creación de fichero dentro del historial de comunicaciones.
- Envío mediante SILTRA simulado y generación de respuesta RCA aceptada.

## Simplificaciones deliberadas

- No se replica el formato oficial completo de la TGSS.
- No se valida contra SILTRA real ni se conecta con Sistema RED.
- No se implementan rectificaciones M/B/C en esta primera versión.
- Los conceptos sin vinculación CRA se omiten y se muestran como advertencia.
- La ausencia de NAF genera aviso, pero no bloquea la práctica educativa.

## Flujo de uso

1. Revisar la vinculación de conceptos salariales con claves CRA.
2. Seleccionar empresa, CCC y periodo.
3. Preparar la vista previa.
4. Corregir conceptos sin clave CRA cuando existan.
5. Generar el XML CRA.
6. Pulsar `Enviar por SILTRA`.
7. Consultar el estado aceptado y la respuesta RCA simulada.
