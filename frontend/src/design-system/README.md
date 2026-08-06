# Design System de AulaNomina

Esta carpeta contiene las fundaciones visuales compartidas por todo el frontend.
El objetivo es evitar que cada módulo defina sus propios colores, espaciados,
radios, sombras o tamaños de control.

## Archivos

- `tokens.css`: fuente visual principal. Declara variables CSS con el prefijo
  `--an-` para color, tipografía, espaciado, radios, sombras, layout y movimiento.
- `foundations.css`: aplica los tokens a los elementos HTML globales sin
  rediseñar todavía los módulos existentes.
- `tokens.js`: referencias reutilizables para componentes React que todavía
  necesiten estilos inline.

## Reglas de uso

1. Usar tokens semánticos, por ejemplo `--an-color-text-secondary`, en lugar de
   un tono neutro concreto cuando el valor expresa una función.
2. No introducir colores hexadecimales nuevos dentro de componentes salvo que
   representen un documento oficial o una simulación externa.
3. Usar la escala `--an-space-*` para márgenes, padding y gaps.
4. Reservar el azul primario para la acción dominante y el foco.
5. Reservar el amarillo para identidad de marca, resaltados didácticos muy
   concretos y elementos propios de AulaNomina.
6. Mantener como máximo una acción primaria visible por bloque de contenido.

## Ejemplo CSS

```css
.employee-card {
  padding: var(--an-space-6);
  border: 1px solid var(--an-color-border);
  border-radius: var(--an-radius-lg);
  background: var(--an-color-surface);
  box-shadow: var(--an-shadow-xs);
}
```

## Ejemplo React con estilo inline

```jsx
import { designTokens } from "../design-system/tokens.js";

const style = {
  padding: designTokens.space[6],
  color: designTokens.color.textPrimary,
  background: designTokens.color.surface,
};
```

Los alias antiguos (`--text`, `--accent`, `--border`, etc.) se mantienen de
forma temporal para que la migración pueda hacerse módulo a módulo sin romper
la interfaz actual.
