# Layout global de AulaNomina

El shell global define la estructura compartida de la aplicación:

- sidebar fija en escritorio y panel deslizable en tablet/móvil;
- cabecera sticky con contexto, alertas, acceso a SILTRA y ajustes;
- área de trabajo sobre fondo neutro y con anchura máxima controlada;
- pie discreto;
- espaciado responsive basado en los tokens `--an-*`.

## Navegación

La sidebar utiliza revelado progresivo para evitar mostrar toda la arquitectura del ERP al mismo tiempo:

- solo puede permanecer abierto un grupo principal;
- dentro del grupo, solo se despliega un submódulo con hijos;
- el grupo y el submódulo correspondientes a la página activa se abren automáticamente;
- el estado se conserva en `localStorage`;
- la etiqueta del submódulo navega a su panel y el chevrón controla únicamente el desplegable;
- los iconos se reservan para los grupos principales y no compiten con las opciones operativas.

Los módulos internos todavía conservan sus componentes actuales. Su migración se realizará de forma progresiva sin volver a definir el shell.
