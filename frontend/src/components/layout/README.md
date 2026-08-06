# Layout global de AulaNomina

El shell global define la estructura compartida de la aplicación:

- sidebar fija en escritorio y panel deslizable en tablet/móvil;
- cabecera sticky con contexto, alertas, acceso a SILTRA y ajustes;
- área de trabajo sobre fondo neutro y con anchura máxima controlada;
- pie discreto;
- espaciado responsive basado en los tokens `--an-*`.

Los módulos internos todavía conservan sus componentes actuales. Su migración se realizará de forma progresiva sin volver a definir el shell.
