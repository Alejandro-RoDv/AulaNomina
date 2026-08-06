# Accesibilidad de AulaNomina

AulaNomina debe poder utilizarse con ratón, teclado y tecnologías de asistencia sin crear una versión paralela de la interfaz.

## Reglas obligatorias

1. Cada pantalla debe tener un único título principal identificable.
2. La navegación activa debe exponer `aria-current="page"`.
3. Todo control debe ser alcanzable mediante teclado y mostrar foco visible.
4. Los iconos decorativos deben llevar `aria-hidden="true"`.
5. Los botones que solo contienen un icono necesitan un nombre accesible mediante `aria-label`.
6. Los campos deben estar vinculados a su etiqueta, ayuda y mensaje de error.
7. Los errores deben usar `aria-invalid` y una descripción asociada.
8. Los cambios de pantalla y resultados asíncronos relevantes deben anunciarse sin interrumpir al usuario.
9. Los diálogos deben retener el foco, cerrarse con `Escape` cuando sea seguro y devolver el foco al control de origen.
10. El color no puede ser el único medio para comunicar estados.

## Capa global

`components/accessibility/AccessibilityBridge.jsx` proporciona:

- enlace para saltar directamente al contenido principal;
- identificación automática del `main` y su título;
- actualización del título del documento;
- anuncio de cambios de pantalla mediante `aria-live`;
- traslado del foco al contenido cuando cambia la vista;
- sincronización de `aria-current` en sidebar y pestañas.

`components/accessibility/accessibility.css` proporciona:

- foco visible de alto contraste;
- compatibilidad con contraste reforzado y colores forzados;
- objetivos táctiles mayores en dispositivos de puntero grueso;
- clase visualmente oculta reutilizable;
- respeto a la reducción de movimiento.

## Comprobación manual mínima

Antes de considerar migrada una pantalla:

1. Pulsar `Tab` desde la parte superior y comprobar que aparece el enlace «Saltar al contenido principal».
2. Recorrer todos los controles sin usar el ratón.
3. Activar botones y pestañas con `Enter` y `Espacio`.
4. Abrir y cerrar diálogos con teclado.
5. Comprobar que el foco no queda detrás de un modal.
6. Ampliar la página al 200 % sin perder contenido ni acciones.
7. Probar la pantalla a 320 píxeles de ancho.
8. Verificar que estados como error, éxito o pendiente contienen texto además de color.

## Excepciones

Los simuladores de organismos externos pueden reproducir parcialmente su apariencia, pero no quedan exentos de navegación por teclado, foco visible, nombres accesibles y estructura semántica.
