# Componentes UI de AulaNomina

Biblioteca visual compartida por los módulos del frontend.

## Importación

```jsx
import {
  Button,
  ConfirmDialog,
  ContentCard,
  DataTable,
  DataTableSearch,
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
  StatCard,
  StatusCard,
  SuccessState,
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
- `TableEmpty`: estado vacío dentro de una tabla.
- `TablePagination`: navegación entre páginas cuando el volumen lo requiera.

Las tablas deben priorizar la lectura. La primera columna identifica el registro, los estados usan `Badge` y las acciones secundarias se agrupan en un menú. En móvil, las filas se convierten en tarjetas con etiquetas visibles.

## Estados de pantalla

- `LoadingState`: consulta o proceso que todavía no ha terminado.
- `EmptyState`: módulo sin registros creados; debe incluir la acción que permita comenzar cuando exista.
- `NoResultsState`: existen datos, pero la búsqueda o los filtros no devuelven coincidencias.
- `ErrorState`: fallo que impide continuar y requiere corrección o reintento.
- `SuccessState`: confirmación relevante que sustituye temporalmente al contenido anterior.
- `StatePanel`: base común para estados específicos no contemplados por los componentes anteriores.

Los estados de pantalla sustituyen al contenido principal y no deben confundirse con `Alert`, que comunica mensajes breves dentro de un flujo ya visible. Todos admiten tamaño `compact`, `default` o `spacious` y una única zona de acciones.

## Diálogos y paneles

- `Dialog`: tarea breve que requiere mantener el contexto de la pantalla original.
- `ConfirmDialog`: confirmación explícita para operaciones sensibles o destructivas.
- `Drawer`: consulta o edición contextual con más contenido del que cabe razonablemente en un diálogo.

Los tres componentes bloquean el scroll de fondo, restauran el foco al cerrar, permiten cerrar con `Escape`, mantienen el foco dentro del overlay y se adaptan a móvil. Las acciones se colocan siempre en el pie: cancelar primero y confirmar después. No deben utilizarse para sustituir una página completa.

## Criterios

- Los componentes usan clases con prefijo `an-` para evitar colisiones.
- Todos los valores visuales proceden de `design-system/tokens.css`.
- Las variantes expresan una función, no una preferencia estética puntual.
- No se deben duplicar estos componentes dentro de módulos concretos.
- Las excepciones quedan limitadas a documentos oficiales y simuladores externos.