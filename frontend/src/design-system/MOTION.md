# Movimiento en AulaNomina

El movimiento debe comunicar que una acción ha producido un cambio. No se usa como decoración ni para retrasar la interacción.

## Duraciones

- `--an-duration-fast` (120 ms): hover, presión, iconos y cambios de color.
- `--an-duration-normal` (180 ms): desplegables, acordeones y menús.
- `--an-duration-slow` (240 ms): entrada de página, diálogos y paneles laterales.

## Patrones

### Cambio de página

`MotionBridge` reinicia una transición breve al navegar entre módulos. La entrada combina opacidad y un desplazamiento vertical de 6 px.

### Controles interactivos

Los botones y acciones elevan como máximo 1 px en dispositivos con ratón. Al pulsarlos se reduce ligeramente la escala para confirmar la interacción.

### Acordeones y menús

Los grupos de la barra lateral y los menús contextuales aparecen con una transición corta. No se anima la altura completa para evitar saltos y cálculos costosos de layout.

### Tarjetas

Solo las tarjetas interactivas (`StatCard` y `ActionCard`) reaccionan al hover. Las tarjetas de contenido y estado permanecen estables.

### Diálogos y paneles

Los contenedores mantienen la transición definida por el sistema de diálogos. Su contenido se asienta con una variación mínima de opacidad y posición.

## Reglas

1. No crear animaciones superiores a 300 ms para operaciones habituales.
2. No animar elementos informativos que no sean interactivos.
3. No usar rebotes, giros completos ni desplazamientos grandes.
4. No depender de una animación para comunicar información imprescindible.
5. Respetar siempre `prefers-reduced-motion`.
6. Usar las clases y keyframes globales antes de crear una animación específica de módulo.

## Reducción de movimiento

Cuando el sistema operativo solicita reducir movimiento:

- se eliminan las entradas de página, acordeones, menús y contenido de diálogos;
- se desactivan las transformaciones de hover y pulsación;
- se conservan los cambios instantáneos de color y estado necesarios para entender la interfaz.
