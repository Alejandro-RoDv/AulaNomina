# Componentes UI de AulaNomina

Biblioteca visual compartida por los módulos del frontend.

## Importación

```jsx
import {
  Button,
  ContentCard,
  Field,
  Input,
  StatCard,
  StatusCard,
} from "./components/ui/index.js";
```

## Patrones de tarjetas

- `StatCard`: indicador numérico o KPI. No debe contener formularios ni acciones complejas.
- `ContentCard`: superficie principal para secciones de contenido.
- `ActionCard`: acceso directo a una tarea concreta, con una única acción dominante.
- `StatusCard`: estado operativo, validación o comprobación con tono semántico.

Los cuatro patrones comparten borde, radio, sombra, tipografía y espaciado. No se deben crear variantes visuales específicas dentro de cada módulo.

## Criterios

- Los componentes usan clases con prefijo `an-` para evitar colisiones.
- Todos los valores visuales proceden de `design-system/tokens.css`.
- Las variantes expresan una función, no una preferencia estética puntual.
- No se deben duplicar estos componentes dentro de módulos concretos.
- Las excepciones quedan limitadas a documentos oficiales y simuladores externos.
