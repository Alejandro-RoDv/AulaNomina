# Layout global de AulaNomina

El shell global define la estructura compartida de la aplicación:

- sidebar fija en escritorio y panel deslizable en tablet/móvil;
- cabecera sticky con contexto, alertas, acceso a SILTRA y ajustes;
- área de trabajo sobre fondo neutro y con anchura máxima controlada;
- pie discreto;
- espaciado responsive basado en los tokens `--an-*`.

## Navegación progresiva

La navegación funciona como un acordeón de dos niveles:

- solo un grupo principal permanece abierto;
- dentro de cada grupo solo un submódulo mantiene visibles sus opciones;
- la ruta activa abre automáticamente su grupo y submódulo;
- el estado se conserva entre recargas;
- los iconos se reservan para categorías principales.

## Sistema común de páginas

Las páginas nuevas deben componerse con los elementos exportados por `layout/index.js`:

```jsx
import {
  Page,
  PageCard,
  PageGrid,
  PageSection,
  PageToolbar,
} from "../components/layout";
```

- `Page`: controla anchura máxima y ritmo vertical.
- `PageSection`: agrupa contenido relacionado y normaliza título, descripción y acciones.
- `PageToolbar`: contiene búsqueda, filtros y la acción principal del bloque.
- `PageGrid`: crea rejillas responsive sin anchuras arbitrarias.
- `PageCard`: superficie estándar para información, formularios y listados.

Los módulos internos todavía conservan parte de sus estilos históricos. Su migración se realizará progresivamente reutilizando estos componentes, sin volver a definir el shell ni los patrones de página.
