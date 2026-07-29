# Split 38 · Modelo 111 · Iteración 2

## Objetivo

Cerrar la primera experiencia demostrable del Modelo 111 sobre la implementación base del split.

## Cambios

### Caso demostrativo 2T 2026

Se añade una carga idempotente para la empresa seleccionada:

- toma las nóminas disponibles como plantilla;
- prepara abril, mayo y junio de 2026 en estado revisado;
- crea tres profesionales didácticos;
- crea tres facturas pagadas;
- genera 4.800,00 € de base profesional y 720,00 € de retenciones profesionales.

La carga se ejecuta expresamente desde la pantalla del Modelo 111 y no se mezcla con datos reales externos.

### Ajustes, atrasos y regularizaciones

Nueva pestaña operativa para registrar:

- atrasos;
- ajustes manuales;
- regularizaciones;
- importes asociados a rendimientos del trabajo o actividades económicas.

Solo las regularizaciones permiten importes negativos.

### Justificante

Las declaraciones presentadas disponen de un justificante HTML específico con:

- datos de empresa y periodo;
- resultado y forma de ingreso;
- número de justificante y CSV simulados;
- casillas 01, 02, 03, 07, 08, 09, 28, 29 y 30;
- detalle congelado de nóminas, facturas y ajustes.

El navegador permite imprimirlo o guardarlo como PDF. Todo el documento se identifica como simulación educativa sin validez fiscal.

### Navegación

Se crea el grupo `Fiscalidad` en el menú lateral:

- Modelo 111 habilitado;
- Modelo 190 visible como siguiente módulo, todavía deshabilitado.

### Pruebas

Se incorporan pruebas de servicio para:

- cálculo conjunto de nóminas y profesionales;
- declaración negativa;
- generación, presentación y bloqueo;
- complementarias;
- carga del caso demo;
- justificante imprimible.

Los workflows incluyen expresamente los nuevos tests y archivos frontend.
