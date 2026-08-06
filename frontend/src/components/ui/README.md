# Componentes UI de AulaNomina

Biblioteca visual compartida por los módulos del frontend.

## Importación

```jsx
import {
  Button,
  ContentCard,
  DataTable,
  DataTableSearch,
  Field,
  Form,
  FormActions,
  FormGrid,
  FormSection,
  Input,
  StatCard,
  StatusCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
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

## Patrones de tablas

- `DataTable`: contenedor funcional de filtros, resumen, tabla y paginación.
- `DataTableToolbar`: agrupa búsqueda, filtros y acciones generales.
- `DataTableSearch` y `DataTableFilter`: controles homogéneos de consulta.
- `DataTableSummary`: comunica el número de resultados antes de la tabla.
- `TableHeaderCell`: soporta ordenación y estado accesible mediante `aria-sort`.
- `TablePrimaryCell`: muestra el dato principal y su metainformación.
- `TableActions` y `TableIconButton`: limitan y alinean las acciones por fila.
- `TableEmpty`: estado vacío común.
- `TablePagination`: navegación entre páginas cuando el volumen lo requiera.

Las tablas deben priorizar la lectura. La primera columna identifica el registro, los estados usan `Badge` y las acciones secundarias se agrupan en un menú. En móvil, las filas se convierten en tarjetas con etiquetas visibles.

## Criterios

- Los componentes usan clases con prefijo `an-` para evitar colisiones.
- Todos los valores visuales proceden de `design-system/tokens.css`.
- Las variantes expresan una función, no una preferencia estética puntual.
- No se deben duplicar estos componentes dentro de módulos concretos.
- Las excepciones quedan limitadas a documentos oficiales y simuladores externos.
