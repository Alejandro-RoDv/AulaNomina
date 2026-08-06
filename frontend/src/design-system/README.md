# Design System de AulaNomina

Esta carpeta contiene las fundaciones visuales compartidas por todo el frontend.
El objetivo es evitar que cada módulo defina sus propios colores, espaciados,
radios, sombras, tamaños de control, movimiento o criterios de accesibilidad.

## Archivos

- `tokens.css`: fuente visual principal. Declara variables CSS con el prefijo
  `--an-` para color, tipografía, espaciado, radios, sombras, layout y movimiento.
- `foundations.css`: aplica los tokens a los elementos HTML globales sin
  rediseñar todavía los módulos existentes.
- `tokens.js`: referencias reutilizables para componentes React que todavía
  necesiten estilos inline.
- `ACCESSIBILITY.md`: reglas de teclado, foco, semántica, formularios, estados y diálogos.
- `MOTION.md`: duraciones, patrones y límites del movimiento de interfaz.
- `MIGRATION.md`: estado actual, definición de pantalla migrada y orden de los próximos módulos.
- `DesignSystemPreview.jsx` y `preview.css`: catálogo técnico temporal para
  revisar visualmente los componentes antes de migrar módulos completos.
- `../components/ui/`: biblioteca de componentes React reutilizables.
- `../components/layout/`: shell, navegación y sistema común de páginas.
- `../components/accessibility/`: capa global de navegación accesible y anuncios de ruta.
- `../components/motion/`: transiciones globales y reinicio de entrada al cambiar de módulo.

## Componentes disponibles

```jsx
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Form,
  FormActions,
  FormGrid,
  FormSection,
  Input,
  LoadingState,
  NoResultsState,
  Select,
  StatCard,
  StatusCard,
  SuccessState,
  Table,
  Textarea,
} from "../components/ui/index.js";
```

La vista previa se abre durante el desarrollo añadiendo este parámetro a la URL:

```text
?design-system=1
```

Por ejemplo, con Vite en local:

```text
http://localhost:5173/?design-system=1
```

## Validación

```bash
npm run design-system:audit
npm run lint
npm run build
```

O todo seguido:

```bash
npm run validate
```

La auditoría comprueba la estructura obligatoria y muestra la deuda de migración ordenada por estilos inline, colores directos y usos de `!important`. Esas métricas sirven para priorizar módulos; solo la ausencia de una pieza estructural provoca un fallo.

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
7. Antes de crear una variante visual nueva, comprobar si el componente base
   ya resuelve el caso mediante sus propiedades.
8. Ningún componente interactivo puede depender exclusivamente del ratón o del color.
9. Los controles deben conservar un nombre accesible y un estado de foco visible.
10. Toda pantalla migrada debe superar la comprobación manual definida en `ACCESSIBILITY.md`.
11. Las transiciones habituales no deben superar 300 ms ni bloquear la interacción.
12. Toda animación debe respetar `prefers-reduced-motion` y las reglas de `MOTION.md`.
13. La migración de cada módulo debe seguir la definición de terminado de `MIGRATION.md`.

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

## Ejemplo React

```jsx
import { Button, Card, CardContent, CardHeader, CardTitle } from "../components/ui/index.js";

<Card>
  <CardHeader>
    <CardTitle>Trabajadores</CardTitle>
  </CardHeader>
  <CardContent>127 trabajadores activos</CardContent>
  <Button>Nuevo trabajador</Button>
</Card>;
```

Los alias antiguos (`--text`, `--accent`, `--border`, etc.) se mantienen de
forma temporal para que la migración pueda hacerse módulo a módulo sin romper
la interfaz actual. No deben volver a declararse fuera de `tokens.css`.
