# Split 22.1 — Rediseño del módulo Contratos: filtros, métricas y edición avanzada

## Objetivo

Mejorar la experiencia visual y operativa del módulo de contratos para que se parezca más a un ERP HCM y menos a una tabla CRUD simple.

Este split se centra en frontend. No cambia el modelo de datos ni los endpoints principales.

## Cambios principales

### 1. Panel superior de métricas

Se añade un bloque de indicadores rápidos encima del listado de contratos:

```txt
Contratos activos
Contratos finalizados
Jornadas parciales
Parcialidad media
Retribución mensual estimada
```

La retribución mensual estimada se calcula en frontend con:

```txt
salary_base * partiality_coefficient / 100
```

Es una estimación visual, no una nómina oficial.

### 2. Filtros rápidos

Filtros visibles directamente en la cabecera del módulo:

```txt
Búsqueda general
Estado
Jornada
```

La búsqueda general cubre:

```txt
Código de contrato
Nombre del trabajador
Empresa
Centro
Convenio
Categoría
Puesto
Código contractual
Tipo de contrato
Estado
```

### 3. Filtros avanzados

Botón:

```txt
Más filtros
```

Filtros añadidos:

```txt
Tipo de contrato
Tipo de jornada
Empresa
Centro
Convenio contiene
Categoría contiene
Inicio desde
Inicio hasta
Parcialidad mínima
Parcialidad máxima
Salario mínimo
Salario máximo
```

También se añade:

```txt
Limpiar filtros
Vista compacta / Vista amplia
```

### 4. Tabla enriquecida

La tabla ahora muestra más información útil sin abrir el contrato:

```txt
Código
Trabajador + puesto
Empresa / centro
Convenio
Categoría
Código contrato + tipo
Jornada + horas semanales
Inicio
Fin
Estado
Salario base + salario aplicado estimado
Acción editar
```

### 5. Edición por pestañas

El modal de edición se reorganiza con una barra lateral y pestañas:

```txt
Resumen
Contrato
Jornada
Retribución
Seguridad Social
```

#### Resumen

Muestra:

```txt
Empresa / centro
Estado
Jornada
Salario base
Resumen retributivo
Simulación de jornada
```

Incluye el componente:

```txt
ContractSalarySummaryPanel
```

#### Contrato

Edita:

```txt
Código contrato
Tipo contrato
Sistema de pagas
Fecha inicio
Fecha fin
Estado
```

#### Jornada

Edita:

```txt
Tipo jornada
Horas semanales
Jornada completa de referencia
Coeficiente parcialidad
Jornada anual convenio
Horas mensuales
Horas anuales
```

Incluye presets rápidos:

```txt
100%
75%
50%
```

Estos presets recalculan:

```txt
working_day_type
partiality_coefficient
weekly_hours
monthly_hours
annual_hours
```

#### Retribución

Edita:

```txt
Convenio
Categoría profesional
Puesto
ID convenio
ID categoría convenio
ID fila salarial
Salario base
```

#### Seguridad Social

Agrupa:

```txt
Grupo cotización
Ocupación RED
Código reducción
Indicador cotización
Situación
Fecha alta
Discapacidad
Colectivo trabajador
Condición desempleado
Exclusión / víctimas
Tipo inactividad
CNO
Relación especial RED
Reducción jornada
C.T.P. inicial
Sustitución / relevo
```

## Archivo modificado

```txt
frontend/src/components/ContractTable.jsx
```

## Validación manual recomendada

### Arranque frontend

```bash
cd frontend
npm run dev
```

### Flujo de pruebas

1. Ir a módulo Contratos.
2. Comprobar que aparecen las métricas superiores.
3. Probar búsqueda por:

```txt
nombre trabajador
código contrato
empresa
convenio
categoría
```

4. Pulsar Más filtros y probar:

```txt
estado activo
jornada parcial
empresa concreta
rango de fechas
salario mínimo
parcialidad máxima 80
```

5. Cambiar entre vista compacta y vista amplia.
6. Abrir Editar.
7. Cambiar entre pestañas:

```txt
Resumen
Contrato
Jornada
Retribución
Seguridad Social
```

8. En Jornada, pulsar presets:

```txt
100%
75%
50%
```

9. Guardar y verificar que la tabla refleja el nuevo porcentaje.

## Limitación actual

Esto todavía no es maestro-detalle real. Sigue usando modal, pero con edición por pestañas y una experiencia mucho más cercana a ERP.

La evolución lógica sería:

```txt
Split 22.2 — Contratos en vista maestro-detalle real
```

En ese split se quitaría el modal como centro de trabajo y se usaría:

```txt
panel izquierdo: lista compacta de contratos
panel derecho: ficha editable del contrato seleccionado
```

## Próxima mejora recomendada

Añadir alertas inteligentes del contrato:

```txt
Contrato activo con fecha fin pasada
Contrato parcial sin horas semanales
Parcialidad incoherente con horas semanales
Salario base vacío
Sin grupo de cotización
Contrato 5xx no marcado como parcial
Contrato 4xx no marcado como completo
Sin convenio asignado
```

Esto aportaría mucha sensación de ERP profesional y valor docente.
