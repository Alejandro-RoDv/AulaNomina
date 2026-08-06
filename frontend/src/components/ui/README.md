# Componentes UI de AulaNomina

Biblioteca visual compartida por los módulos del frontend.

## Importación

```jsx
import {
  Button,
  ContentCard,
  Field,
  Form,
  FormActions,
  FormGrid,
  FormSection,
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

## Patrones de formularios

- `Form`: contenedor vertical del formulario completo.
- `FormSection`: bloque lógico con título, descripción y acciones opcionales.
- `FormGrid`: distribución responsive de campos en una, dos, tres o cuatro columnas.
- `Field`: etiqueta, control, ayuda, obligatoriedad y error.
- `FormOptions` y `FormOption`: opciones booleanas con contexto suficiente.
- `FormPresetBar`: carga de ejemplos didácticos o configuraciones predefinidas.
- `FormActions`: zona común de guardado, cancelación y mensajes secundarios.

Los formularios deben agrupar la información por significado. No se deben mostrar listas extensas de campos sin secciones ni crear estilos inline para cada pantalla.

## Criterios

- Los componentes usan clases con prefijo `an-` para evitar colisiones.
- Todos los valores visuales proceden de `design-system/tokens.css`.
- Las variantes expresan una función, no una preferencia estética puntual.
- No se deben duplicar estos componentes dentro de módulos concretos.
- Las excepciones quedan limitadas a documentos oficiales y simuladores externos.
