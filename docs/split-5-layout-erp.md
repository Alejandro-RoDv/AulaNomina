# Split 5 - Layout ERP profesional y navegación por módulos

## Objetivo del split

El objetivo principal de este split ha sido transformar el frontend de AulaNomina desde una pantalla larga con formularios y tablas a una estructura más cercana a una aplicación ERP o SaaS profesional.

Hasta este punto, la aplicación ya contaba con backend funcional, gestión básica de empresas/centros y gestión básica de contratos. Sin embargo, el frontend estaba concentrado en un único archivo principal y visualmente funcionaba más como una prueba técnica que como una aplicación modular.

Con este split se ha buscado mejorar la estructura, la navegación y la presentación visual sin añadir todavía autenticación, roles, multiempresa avanzada ni módulos complejos.

## Estado anterior

Antes del Split 5, el frontend tenía una estructura más simple:

```text
src/
├── App.jsx
├── components/
└── services/
```

El archivo `App.jsx` contenía demasiada responsabilidad:

- Carga de datos.
- Estado de formularios.
- Gestión de errores y mensajes de éxito.
- Renderizado de formularios.
- Renderizado de tablas.
- Layout visual.
- Estilos inline generales.

Esto hacía que el frontend funcionase, pero no escalase bien conforme se añadieran nuevos módulos.

## Cambios principales realizados

### 1. Creación de layout principal tipo ERP

Se ha creado una estructura visual con:

- Menú lateral izquierdo.
- Cabecera superior.
- Área principal de trabajo.
- Pie de página discreto.

La idea es acercar la aplicación al croquis inicial definido para el frontend básico de AulaNomina.

El layout actual se apoya en estos componentes:

```text
frontend/src/components/layout/
├── Sidebar.jsx
├── Header.jsx
└── PageCard.jsx
```

### 2. Sidebar lateral

Se ha añadido un menú lateral izquierdo con estructura funcional dividida por grupos:

```text
Datos
- Panel
- Empresa
- Contratos
- Trabajador
- Documentos
- Informes

Acciones
- Cálculo nóminas
- IRPF
- Mod. 111/190
- Seguros sociales

Seg. Social
- Altas y bajas
- Variaciones
- Comunicados
```

Actualmente solo están activos:

- Panel
- Empresa
- Contratos

El resto de apartados quedan visibles pero deshabilitados, para mostrar la dirección funcional futura de la plataforma sin implementar todavía esos módulos.

### 3. Header superior

Se ha creado una cabecera superior con:

- Barra amarilla superior.
- Usuario demo.
- Nombre del módulo actual.
- Subtítulo descriptivo.

El objetivo es simular la estructura de una aplicación de gestión con contexto de usuario y módulo activo.

### 4. Dashboard inicial

Se ha añadido una pantalla inicial de panel con información resumida:

- Empresas activas.
- Contratos creados.
- Módulos activos.
- Módulos pendientes.
- Últimos procesos simulados.
- Estado del MVP.

Esta pantalla permite que la aplicación no abra directamente sobre formularios, sino sobre una vista de resumen más profesional.

### 5. Páginas separadas por módulo

Se han creado páginas independientes para separar responsabilidades:

```text
frontend/src/pages/
├── Dashboard.jsx
├── CompaniesPage.jsx
└── ContractsPage.jsx
```

Cada página agrupa los componentes correspondientes a su módulo.

### 6. Refactor de App.jsx

`App.jsx` queda ahora como contenedor principal de la aplicación.

Sus responsabilidades actuales son:

- Mantener el estado global básico.
- Cargar datos desde el backend.
- Controlar la página activa.
- Renderizar el layout general.
- Pasar props a las páginas.

No se ha introducido React Router todavía. La navegación se gestiona mediante estado interno:

```jsx
const [activePage, setActivePage] = useState("dashboard");
```

Esta decisión se ha tomado para mantener el desarrollo simple y rápido en esta fase del MVP.

## Estructura actual relevante del frontend

```text
frontend/src/
├── App.jsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.jsx
│   │   ├── Header.jsx
│   │   └── PageCard.jsx
│   ├── CompanyForm.jsx
│   ├── CompanyTable.jsx
│   ├── ContractForm.jsx
│   └── ContractTable.jsx
├── pages/
│   ├── Dashboard.jsx
│   ├── CompaniesPage.jsx
│   └── ContractsPage.jsx
└── services/
    ├── api.js
    └── companyApi.js
```

## Decisiones técnicas tomadas

### No usar React Router todavía

Se ha decidido no introducir React Router en este split.

Motivos:

- El MVP todavía tiene pocos módulos activos.
- La navegación interna con estado es suficiente por ahora.
- Se evita añadir complejidad prematura.
- Permite avanzar más rápido en validación visual y funcional.

React Router tendrá sentido más adelante cuando existan pantallas como:

- Detalle de trabajador.
- Detalle de contrato.
- Nóminas.
- Incidencias.
- Login.
- Panel docente/alumno.

### No tocar backend

Este split se ha centrado exclusivamente en frontend.

No se han modificado:

- Modelos SQLAlchemy.
- Schemas.
- CRUD.
- Endpoints FastAPI.
- Base de datos.

### No rehacer formularios desde cero

Los formularios y tablas existentes se han conservado para evitar romper funcionalidad.

Se ha priorizado:

- Reorganizar estructura.
- Mejorar layout.
- Mantener comportamiento funcional.

## Problemas detectados y corregidos

Durante el ajuste visual se detectó que `frontend/src/index.css` contenía estilos globales heredados que limitaban el ancho del `#root`:

```css
#root {
  width: 1126px;
  max-width: 100%;
  margin: 0 auto;
  text-align: center;
}
```

Esto provocaba que:

- La aplicación quedase cortada.
- La cabecera no ocupase todo el ancho disponible.
- El pie de página quedase limitado.
- El contenido se centrase de forma artificial.

Se corrigió para que la aplicación ocupe el 100% del ancho disponible:

```css
html,
body,
#root {
  width: 100%;
  min-width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#root {
  display: block;
  text-align: left;
}
```

## Estado visual actual

El diseño actual no se considera definitivo.

Se ha dejado una primera versión funcional inspirada en el croquis inicial:

- Fondo principal blanco.
- Lateral amarillo.
- Logo en recuadro superior izquierdo.
- Cabecera superior con barra amarilla.
- Contenido organizado en tarjetas.
- Pie de página gris discreto.

Queda pendiente una mejora visual posterior para:

- Refinar la paleta de amarillos.
- Mejorar formularios.
- Mejorar tablas.
- Ajustar espaciados.
- Unificar estilos en CSS compartido.
- Hacer diseño responsive.

## Archivos modificados o creados

### Creados

```text
frontend/src/components/layout/Sidebar.jsx
frontend/src/components/layout/Header.jsx
frontend/src/components/layout/PageCard.jsx
frontend/src/pages/Dashboard.jsx
frontend/src/pages/CompaniesPage.jsx
frontend/src/pages/ContractsPage.jsx
```

### Modificados

```text
frontend/src/App.jsx
frontend/src/index.css
```

## Resultado conseguido

Al finalizar el Split 5, AulaNomina dispone de:

- Navegación interna entre módulos.
- Dashboard inicial.
- Página de empresas separada.
- Página de contratos separada.
- Layout tipo ERP.
- Menú lateral con módulos futuros visibles.
- Código frontend más ordenado y preparado para crecer.

## Cómo probarlo

Levantar backend:

```bash
cd backend
uvicorn app.main:app --reload
```

Levantar frontend:

```bash
cd frontend
npm run dev
```

Abrir en navegador:

```text
http://localhost:5173
```

## Criterios de cierre del split

El Split 5 se considera cerrado si se cumple:

- La app carga correctamente.
- El menú lateral permite cambiar entre Panel, Empresa y Contratos.
- El dashboard muestra métricas básicas.
- La página de empresas permite ver y crear empresas.
- La página de contratos permite ver y crear contratos.
- La cabecera y el pie ocupan el ancho correcto.
- `App.jsx` ya no contiene todo el layout y contenido de forma monolítica.

## Próximos pasos recomendados

El siguiente paso funcional recomendado es el Split 6: Gestión de empleados.

Motivo:

Actualmente existen empresas y contratos, pero el flujo natural de un ERP laboral requiere reforzar el módulo de trabajadores para poder construir después:

- Contratos vinculados correctamente.
- Incidencias laborales.
- Nómina simulada.
- Casos prácticos docentes.

La mejora estética fina se aplaza para una fase posterior, cuando haya más módulos funcionales y sea más eficiente unificar estilos globales.
