# Componentes UI de AulaNomina

Biblioteca visual compartida por los módulos del frontend.

## Importación

```jsx
import { Button, Card, Field, Input } from "./components/ui/index.js";
```

## Criterios

- Los componentes usan clases con prefijo `an-` para evitar colisiones.
- Todos los valores visuales proceden de `design-system/tokens.css`.
- Las variantes expresan una función, no una preferencia estética puntual.
- No se deben duplicar estos componentes dentro de módulos concretos.
- Las excepciones quedan limitadas a documentos oficiales y simuladores externos.
