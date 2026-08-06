# Migración visual de AulaNomina

Este documento separa el Design System ya terminado de la migración progresiva de módulos. El sistema base no obliga a rehacer toda la aplicación en un único cambio.

## Estado al cerrar el Split 41

| Área | Estado | Observaciones |
| --- | --- | --- |
| Tokens y fundaciones | Completo | Colores, tipografía, espaciado, radios, sombras, layout y movimiento. |
| Shell global | Completo | Sidebar, cabecera, contenido, pie y navegación responsive. |
| Navegación | Completo | Jerarquía progresiva, estado activo y persistencia. |
| Páginas y secciones | Completo | `Page`, `PageSection`, `PageToolbar`, `PageGrid` y `PageCard`. |
| Tarjetas | Completo | `StatCard`, `ContentCard`, `ActionCard` y `StatusCard`. |
| Formularios | Completo | Controles, secciones, rejillas, opciones, errores y acciones. |
| Tablas | Completo | Filtros, búsqueda, ordenación, acciones, estados y vista móvil. |
| Estados | Completo | Carga, vacío, sin resultados, error y éxito. |
| Diálogos | Completo | Diálogo, confirmación destructiva y panel lateral. |
| Accesibilidad | Completo | Foco, teclado, landmarks, anuncios y reducción de movimiento. |
| Dashboard | Migrado | Pantalla de referencia del nuevo sistema. |
| Alta de empresa | Migrado | Formulario de referencia. |
| Listado de empresas | Migrado | Tabla, filtros, estados y diálogos de referencia. |
| Ficha y centros de empresa | Parcial | Debe completarse en la siguiente migración del módulo. |
| Gestión de personal | Pendiente | Trabajadores, expedientes, contratos e incidencias. |
| Nómina | Pendiente | Preparación, individual, simulación, histórico, conceptos e IRPF. |
| Seguridad Social y SILTRA | Pendiente | Mantener la estética oficial únicamente dentro del simulador. |
| Fiscalidad | Pendiente | Modelos 111 y 190 y simulación AEAT. |
| Documentación y docencia | Pendiente | Documentos, correo, casos, panel docente y seguimiento. |

## Definición de pantalla migrada

Una pantalla se considera migrada cuando:

1. Utiliza el shell global y los componentes compartidos.
2. No crea botones, tarjetas, inputs, modales o tablas alternativos sin justificación.
3. Usa tokens `--an-*` para color, espacio, radio, sombra y movimiento.
4. Mantiene una única acción visual dominante por bloque.
5. Distingue carga, vacío, ausencia de resultados, error y éxito.
6. Funciona con teclado y conserva foco visible.
7. Se adapta correctamente a escritorio, tablet y móvil.
8. Supera `npm run build`, `npm run lint` y `npm run design-system:audit`.

## Orden recomendado

### Split 42 — Gestión de personal

- Nuevo trabajador.
- Listado de trabajadores.
- Expediente.
- Contratos.
- Incidencias y embargos.
- Altas, bajas y variaciones.

### Split 43 — Nómina

- Preparación mensual.
- Nómina individual.
- Simulación.
- Histórico.
- Conceptos salariales.
- IRPF.

### Split 44 — Seguridad Social y fiscalidad

- Liquidaciones y ficheros.
- CRA, FIE y AFI.
- SILTRA simulado.
- Modelos 111 y 190.
- Presentación AEAT simulada.

### Split 45 — Documentación y docencia

- Documentos.
- Alertas.
- Correo interno.
- Casos prácticos.
- Panel docente, alumnos, grupos y progreso.

## Excepciones válidas

Los documentos oficiales, impresiones, nóminas, contratos y simuladores de organismos pueden usar estilos propios cuando necesiten reproducir una interfaz o documento externo. Esa estética debe quedar encapsulada y no extenderse al resto del ERP.
