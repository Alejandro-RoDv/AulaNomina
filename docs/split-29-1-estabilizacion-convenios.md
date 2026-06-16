# Split 29.1 — Estabilización y reestructuración del módulo Convenios

## Estado

- Paso 1: completado mediante auditoría estática.
- Funcionalidad: congelada durante el Split 29.1.
- Línea base auditada: `bb9b6b48cea88586c9329b94eabaea638342867a`.
- Alcance de este split: frontend, rendimiento, navegación, limpieza y regresión.
- Fuera de alcance: nuevas reglas laborales, nuevos cálculos, cambios de modelo y ampliaciones de API salvo correcciones imprescindibles.

## Objetivo

Dejar el módulo Convenios más rápido, mantenible y verificable sin alterar su comportamiento funcional actual.

Durante este split no se incorporarán nuevas capacidades laborales. Cualquier petición nueva deberá registrarse para un split posterior.

## Línea base funcional que debe conservarse

### Gestión del convenio

- Crear convenios.
- Seleccionar convenios.
- Consultar ficha, vigencia, estado y alertas.
- Activar o caducar convenios.
- Cargar el convenio demo.
- Crear, editar y eliminar grupos profesionales.
- Crear, editar y eliminar categorías profesionales.
- Crear, editar y eliminar tablas salariales.
- Crear, editar y eliminar filas salariales.
- Crear, editar y eliminar reglas de jornada.
- Crear, editar y eliminar reglas de vacaciones.
- Crear, editar y eliminar permisos.

### Criterios laborales

- SMI e IPREM.
- Criterios de pagas extraordinarias.
- Criterios de atrasos.
- Contratación.
- Período de prueba.
- Complementos de IT por tramos.
- Acceso a vacaciones y antigüedad.

### Estructura y procesos salariales

- Conceptos salariales y extrasalariales.
- Cotización, IRPF y CRA.
- Configuración de pagas extraordinarias.
- Simulación de pagas por contrato.
- Revisión de tablas salariales.
- Activación de tablas.
- Migración de contratos.
- Previsualización y generación de regularizaciones.
- Antigüedad, módulos y vencimientos.

### Integraciones que deben mantenerse

- Selección del convenio en contratos.
- Selección de categoría profesional.
- Selección de fila salarial.
- Propuesta de salario base.
- Conceptos de convenio disponibles en contratos.
- Aplicación de pagas y antigüedad en simulaciones y nóminas existentes.

## Inventario frontend actual

### Contenedores principales

| Archivo | Responsabilidad actual | Riesgo |
| --- | --- | --- |
| `frontend/src/pages/CollectiveAgreementsWorkspacePage.jsx` | Navegación superior, selección de convenio, carga del detalle y montaje de vistas | Duplica carga y coordina navegación mediante búsqueda de elementos del DOM |
| `frontend/src/pages/CollectiveAgreementsPage.jsx` | Gestión general, cinco pestañas internas, formularios y operaciones CRUD | Demasiadas responsabilidades y estados en un único componente |
| `frontend/src/hooks/useAppData.js` | Carga global de contratos, trabajadores, empresas, centros, incidencias, nóminas, documentos y convenios | Una modificación de Convenios puede provocar la recarga completa de la aplicación |

### Paneles principales

| Archivo | Tamaño aproximado | Comportamiento relevante |
| --- | ---: | --- |
| `AgreementCriteriaPanel.jsx` | 517 líneas | Carga parametrización al montar y mantiene varios formularios y secciones |
| `AgreementSalaryStructurePanel.jsx` | 480 líneas | Vuelve a cargar la parametrización completa y contiene selección, CRUD e importación |
| `AgreementSeniorityPanel.jsx` | 383 líneas | Carga reglas y vista previa de contratos simultáneamente al montar |
| `AgreementExtraPayPanelV2.jsx` | 330 líneas | La carga principal está condicionada a abrir el panel, pero mantiene múltiples efectos y recargas locales |
| `CollectiveAgreementsPage.jsx` | 340 líneas físicas, con JSX muy comprimido | Concentra gestión, formularios, tablas, alertas y estilos |
| `CollectiveAgreementsWorkspacePage.jsx` | 183 líneas | Monta varios paneles completos por cada vista superior |

## Flujo de carga detectado

### Entrada al módulo

1. `useAppData.loadData()` solicita en paralelo todos los conjuntos globales de la aplicación, incluido el listado de convenios.
2. `CollectiveAgreementsPage` solicita el detalle completo del convenio activo.
3. Al cambiar a una vista superior distinta de Gestión, `CollectiveAgreementsWorkspacePage` vuelve a solicitar el mismo detalle.
4. Los paneles montados realizan sus propias peticiones adicionales.

### Después de una operación CRUD en Gestión

El flujo actual de `submitAction()` es:

1. Ejecutar la operación.
2. Llamar a `refreshAgreement()`.
3. Ejecutar `onDataChanged()`.
4. `onDataChanged()` termina llamando a `useAppData.loadData()`.
5. Se recargan contratos, trabajadores, empresas, centros, incidencias, nóminas, documentos, convenios y siguiente código de trabajador.
6. Después se vuelve a solicitar el detalle completo del convenio.

Este comportamiento es el principal candidato a explicar la lentitud percibida después de guardar o eliminar elementos.

## Hallazgos priorizados

### P0 — Recarga global tras cambios locales

Una operación de Convenios puede recargar prácticamente toda la aplicación. Esto aumenta latencia, tráfico, renders y riesgo de estados transitorios.

Acción posterior recomendada: separar la actualización del listado de convenios de la carga global y actualizar localmente solo la entidad afectada.

### P0 — Carga duplicada del detalle del convenio

`CollectiveAgreementsWorkspacePage` y `CollectiveAgreementsPage` gestionan de forma independiente la selección y carga del convenio. Al cambiar de vista se repite la consulta del detalle.

Acción posterior recomendada: unificar el convenio seleccionado y su detalle en un único contenedor.

### P1 — Paneles costosos montados simultáneamente

La vista Criterios monta `AgreementCriteriaPanel` y `AgreementSeniorityPanel`. La vista Estructura salarial monta revisión, activación, regularización, pagas, simulación y estructura salarial en el mismo árbol.

Acción posterior recomendada: subdividir estas vistas y montar únicamente el panel activo.

### P1 — Parametrización solicitada desde varios paneles

`AgreementCriteriaPanel` y `AgreementSalaryStructurePanel` solicitan por separado `/parameterization` para el mismo convenio.

Acción posterior recomendada: compartir caché o estado de parametrización, o dividir el endpoint por bloques si el volumen lo justifica.

### P1 — Vista previa de antigüedad cargada demasiado pronto

`AgreementSeniorityPanel` solicita reglas y vista previa de contratos en paralelo al montar. La vista previa debería cargarse solo al abrir el bloque correspondiente o al solicitarla.

### P1 — Navegación dependiente del DOM

`openManagementTab()` localiza botones y encabezados mediante `document.querySelectorAll()`, compara textos visibles y simula clics o desplazamientos.

Riesgos:

- cambios de texto rompen la navegación;
- depende del orden y contenido del DOM;
- dificulta pruebas;
- puede actuar sobre botones ajenos al módulo.

Acción posterior recomendada: navegación explícita mediante estado y propiedades.

### P1 — Componentes con demasiadas responsabilidades

Los principales paneles mezclan:

- carga de datos;
- normalización;
- formularios;
- validación;
- operaciones CRUD;
- tablas;
- simulaciones;
- estilos inline.

Acción posterior recomendada: separar contenedores, formularios, tablas y hooks de datos sin cambiar el resultado visible.

### P2 — Cobertura automática insuficiente en frontend

El frontend dispone de `build` y `lint`, pero no tiene script de pruebas. La protección frente a regresiones depende actualmente del build y del testeo manual.

### P2 — Checklist general desactualizado

El checklist global todavía describe Convenios como un módulo que solo informa y propone salario base. Esa descripción ya no representa la funcionalidad cerrada en el Split 29.

Acción posterior recomendada: sustituir esas reglas por una matriz de regresión específica de Convenios antes del cierre del Split 29.1.

## Regresiones y riesgos conocidos que deben vigilarse

- Cambio de convenio seleccionado al refrescar el listado global.
- Pérdida del formulario abierto después de guardar.
- Pestaña activa reiniciada tras una recarga.
- Mensajes de éxito sustituidos por estados de carga global.
- Peticiones repetidas al alternar entre Gestión, Estructura salarial y Criterios.
- Recarga de la vista previa de antigüedad sin intervención del usuario.
- Doble representación de antigüedad: pestaña histórica de filas salariales y panel funcional avanzado.
- Doble representación de pagas extra: criterios generales y configuración operativa por tabla.
- Navegación rota si cambia el texto de un botón o encabezado.
- Renderizado de paneles avanzados aunque el usuario no vaya a utilizarlos.
- Inconsistencias entre el convenio seleccionado en la vista superior y en Gestión.

## Congelación funcional

Durante el Split 29.1 no se realizarán las siguientes acciones:

- Añadir campos laborales nuevos.
- Añadir nuevos tipos de reglas.
- Ampliar complementos de IT.
- Desarrollar vacaciones avanzadas.
- Incorporar bases o tipos de cotización.
- Incorporar AT/EP.
- Añadir nuevas reglas de antigüedad.
- Añadir trazabilidad o versionado jurídico.
- Importar convenios desde PDF.
- Cambiar el motor de nómina salvo corrección de regresiones.
- Rediseñar por completo la identidad visual.

Se permiten únicamente:

- correcciones de errores;
- reducción de peticiones;
- reorganización de componentes;
- carga bajo demanda;
- limpieza de código;
- mejoras de navegación equivalentes;
- pruebas y documentación.

## Checklist de regresión específico de Convenios

### Navegación

- [ ] Abrir Convenios sin pantalla blanca.
- [ ] Cambiar de convenio y conservar una selección coherente en todas las vistas.
- [ ] Abrir Gestión del convenio.
- [ ] Abrir Estructura salarial.
- [ ] Abrir Criterios laborales.
- [ ] Acceder a Jornada y permisos sin búsqueda textual del DOM.
- [ ] Acceder a Antigüedad y vencimientos sin búsqueda textual del DOM.

### Gestión

- [ ] Crear un convenio.
- [ ] Activar y caducar un convenio.
- [ ] Crear, editar y eliminar un grupo.
- [ ] Crear, editar y eliminar una categoría.
- [ ] Crear, editar y eliminar una tabla salarial.
- [ ] Crear, editar y eliminar una fila salarial.
- [ ] Crear, editar y eliminar jornada, vacaciones y permisos.

### Estructura salarial

- [ ] Crear y editar conceptos.
- [ ] Importar conceptos desde una fila salarial.
- [ ] Configurar una paga extraordinaria.
- [ ] Añadir y eliminar conceptos de una paga.
- [ ] Simular una paga para un contrato.
- [ ] Duplicar una tabla como revisión.
- [ ] Activar una tabla y revisar la migración de contratos.
- [ ] Previsualizar y generar atrasos.

### Criterios y antigüedad

- [ ] Guardar SMI e IPREM.
- [ ] Guardar criterios de pagas.
- [ ] Guardar criterios de atrasos.
- [ ] Crear y editar reglas de contratación.
- [ ] Crear y editar períodos de prueba.
- [ ] Crear y editar tramos de IT.
- [ ] Crear, editar y desactivar una regla de antigüedad.
- [ ] Calcular la vista previa de vencimientos solo bajo demanda.

### Integración

- [ ] Crear un contrato con convenio, categoría y fila salarial.
- [ ] Ver los conceptos del convenio en el contrato.
- [ ] Generar o simular una nómina con salario base, paga y antigüedad.
- [ ] Confirmar que contratos y nóminas no se vacían durante una actualización local de Convenios.

### Calidad técnica

- [ ] `npm run lint` sin errores nuevos.
- [ ] `npm run build` correcto.
- [ ] Backend arranca sin traceback.
- [ ] Pruebas backend correctas.
- [ ] Sin errores visibles en consola.
- [ ] Sin peticiones duplicadas evidentes al abrir una pestaña.

## Mediciones que deben tomarse antes y después de la reestructuración

Registrar desde las herramientas de desarrollo del navegador:

1. Número de peticiones al entrar en Convenios.
2. Número de peticiones al abrir cada vista superior.
3. Número de peticiones al guardar una categoría.
4. Número de peticiones al guardar un concepto salarial.
5. Tiempo desde el clic hasta que desaparece el estado de carga.
6. Componentes que se desmontan y vuelven a montar al guardar.

No se fija aún un umbral numérico porque la línea base debe medirse en ejecución local. El objetivo mínimo es eliminar la recarga global y las consultas duplicadas identificadas.

## Criterio de cierre del Paso 1

- [x] Funcionalidad congelada y delimitada.
- [x] Línea base registrada.
- [x] Componentes principales inventariados.
- [x] Flujo de carga documentado.
- [x] Riesgos priorizados.
- [x] Checklist específico preparado.
- [x] Cambios funcionales excluidos expresamente.

## Orden recomendado para continuar

1. Unificar selección y carga del convenio.
2. Sustituir la navegación por DOM por navegación mediante estado.
3. Separar las vistas principales en componentes de pestaña.
4. Aplicar carga bajo demanda.
5. Eliminar la recarga global después de operaciones locales.
6. Extraer hooks y componentes menores.
7. Ejecutar la matriz de regresión y medir resultados.
