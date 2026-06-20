# Split 30 — Preferencias por empresa

## Objetivo

Crear un submódulo de configuración asociado a cada empresa sin duplicar los datos maestros que ya existen en la ficha empresarial.

La ficha de empresa conserva identificación, domicilio social, CIF, CCC, CNAE, representante, mutuas, convenio y calendario. Preferencias contiene únicamente reglas de funcionamiento, cálculo, presentación e impresión.

## Paso 30.1 — Base de preferencias

- Crear la entidad `company_preferences` con relación única a `companies`.
- Guardar bloques de configuración independientes y versionados.
- Mantener fecha de efecto, empresa de la que se hereda y usuario de modificación.
- Crear automáticamente la configuración vacía al consultar por primera vez una empresa.

Estado: implementado.

## Paso 30.2 — API

Endpoints:

- `GET /companies/{company_id}/preferences`
- `PUT /companies/{company_id}/preferences`

Validaciones:

- La empresa debe existir.
- La empresa de la que se hereda debe existir.
- Una empresa no puede heredar su propia configuración.

Estado: implementado.

## Paso 30.3 — Acceso y navegación

- Añadir `Preferencias` al módulo Empresas.
- Añadir acceso rápido desde el listado de empresas.
- Permitir seleccionar la empresa sin abandonar la pantalla.
- Mantener la ruta mediante `#company-preferences`.

Estado: implementado.

## Paso 30.4 — Preferencias generales, herencia e idioma

- Configuración propia.
- Herencia completa.
- Herencia con excepciones.
- Fecha de efecto.
- Código pagador y modalidad de cobro predeterminados.
- Idioma de documentos y pantallas configurables.

Estado: implementado.

## Paso 30.5 — Cotización y retenciones

- Simulación SILTRA.
- Modalidad de pago.
- Autorización y fecha.
- Exclusiones y particularidades.
- Bonificaciones sectoriales.
- Configuración predeterminada de modelos 111 y 190.
- Agrupaciones por NIF y domiciliación simulada.

Estado: implementado como configuración educativa. No existen envíos reales a organismos externos.

## Paso 30.6 — Nóminas

- Confección general o individual.
- Prioridad convenio/empresa para antigüedad, vacaciones, pagas, indemnizaciones y complementos IT.
- Prorrata en nuevas contrataciones.
- Día de cierre de incidencias.
- Redondeos, retroactivos, recálculo y bloqueo.

Estado: implementado como persistencia de preferencias. La conexión efectiva con el motor de nómina se realizará al aplicar cada regla en sus procesos correspondientes.

## Paso 30.7 — Recibos, documentos e imagen corporativa

- Domicilio y denominación mostrados.
- Orden y agrupaciones de impresión.
- Campos visibles en el recibo.
- Marca de agua de simulación.
- Anagrama y firma con previsualización.

Estado: implementado.

## Orden de prioridad previsto

1. Configuración general del sistema.
2. Convenio colectivo.
3. Preferencias de empresa.
4. Configuración particular del trabajador o contrato.
5. Modificación manual del proceso o nómina.

## Decisiones técnicas

- Los bloques se almacenan como JSON serializado en columnas `Text` para mantener compatibilidad con PostgreSQL y los entornos locales actuales.
- `schema_version` permitirá migrar los bloques cuando cambie su estructura.
- La imagen corporativa se guarda temporalmente como `data URL` dentro de la configuración. Antes de producción comercial debe trasladarse a almacenamiento de archivos y persistir únicamente la referencia.
- La tabla se crea mediante `Base.metadata.create_all`, siguiendo el mecanismo provisional del proyecto hasta introducir Alembic.

## Pruebas manuales

1. Abrir Empresas > Preferencias.
2. Seleccionar una empresa.
3. Comprobar la carga automática de valores predeterminados.
4. Modificar opciones en las siete pestañas y guardar.
5. Recargar la página y confirmar que se conservan.
6. Configurar herencia desde otra empresa y comprobar la validación de autoherencia.
7. Cargar un anagrama y una firma y revisar la previsualización.
8. Confirmar que editar la ficha de empresa no muestra campos duplicados nuevos.
