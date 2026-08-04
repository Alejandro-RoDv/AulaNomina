# Revisión visual del Modelo 190

## Objetivo

Reducir la densidad de la pantalla del Modelo 190 y presentar cada fase del cierre anual en un espacio diferenciado. La información deja de aparecer apilada en una única vista vertical.

## Navegación principal

El módulo se divide en tres espacios:

1. **Cálculo anual**
   - resumen;
   - perceptores;
   - conciliación;
   - validaciones.
2. **Declaraciones y documentos**
   - generación y congelación;
   - histórico;
   - ficheros;
   - presentación simulada;
   - justificante;
   - documentos y certificados.
3. **Caso guiado**
   - preparación del escenario;
   - diagnóstico;
   - corrección;
   - seguimiento de hitos.

## Cálculo anual

La portada anual queda limitada a cuatro indicadores:

- percepciones;
- retenciones;
- líneas de perceptor y NIF únicos;
- diferencia anual 111/190.

La composición por origen se muestra de forma compacta. La relación nominativa completa, la conciliación trimestral y las validaciones se consultan desde sus subpestañas.

Los controles informativos no se muestran desplegados de forma permanente. Se agrupan dentro de un bloque expandible, mientras que los errores y avisos siguen visibles.

## Justificante HTML

El justificante presentado se sustituye por una hoja-resumen HTML inspirada en el formulario del Modelo 190 aportado como referencia.

Se generan dos páginas A4:

- ejemplar para la Administración;
- ejemplar para el interesado.

Cada página incluye:

- escudo del Ministerio de Economía y Hacienda en la esquina superior izquierda;
- bloque visual de Agencia Tributaria;
- cabecera azul de retenciones e ingresos a cuenta del IRPF;
- identificación del Modelo 190;
- declarante;
- ejercicio;
- modalidad de presentación;
- persona de contacto;
- campos 01, 02 y 03 del resumen anual;
- carácter complementario o sustitutivo;
- identificación de la declaración anterior;
- fecha y firma electrónica simulada;
- espacio administrativo con justificante, CSV, referencia, registros y SHA-256.

El escudo se incorpora como recurso embebido en el propio HTML. El justificante no depende de una ruta estática externa y puede abrirse o imprimirse directamente.

## Seguridad didáctica

El documento mantiene de forma visible:

- la marca `SIMULACIÓN EDUCATIVA`;
- el texto `JUSTIFICANTE SIN VALIDEZ FISCAL`;
- una marca de agua;
- las referencias propias de AulaNomina.

No se genera un formulario presentable ante la Agencia Tributaria.
