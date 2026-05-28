# Checklist de regresión MVP

## Objetivo

Este checklist sirve para comprobar rápidamente que los módulos principales de AulaNomina siguen funcionando después de cada split importante.

Debe ejecutarse antes de cerrar un split que toque:

- navegación frontend
- carga global de datos
- modelos SQLAlchemy
- schemas Pydantic
- rutas FastAPI
- formularios principales
- datos demo

## 1. Arranque técnico

### Backend

```bash
cd backend
uvicorn app.main:app --reload
```

Comprobar:

- La API arranca sin traceback.
- Se ejecuta `init_database()` sin error.
- No aparecen errores de importación.
- No aparecen errores de columnas inexistentes.

Endpoints mínimos:

```text
GET http://127.0.0.1:8000/
GET http://127.0.0.1:8000/companies
GET http://127.0.0.1:8000/work-centers
GET http://127.0.0.1:8000/employees?include_inactive=true
GET http://127.0.0.1:8000/contracts
GET http://127.0.0.1:8000/incidents
GET http://127.0.0.1:8000/payrolls
GET http://127.0.0.1:8000/documents
GET http://127.0.0.1:8000/collective-agreements
```

Resultado esperado:

- Todos responden 200.
- Ninguno responde 500.
- Ninguno responde 422 por ruta mal formada.

### Frontend

```bash
cd frontend
npm run dev
```

Comprobar:

- Vite arranca sin errores.
- La pantalla principal carga.
- No aparece pantalla blanca.
- No hay error crítico en consola.

## 2. Reset demo

Ejecutar desde la interfaz o por API:

```text
POST http://127.0.0.1:8000/seed-demo
```

Comprobar que se cargan:

- empresas
- centros
- trabajadores
- contratos
- documentos demo
- casos docentes demo
- convenio demo

El convenio demo esperado es:

```text
Convenio Simulado de Servicios Administrativos
Código: SIM-ADM-2026
```

## 3. Navegación frontend

Comprobar que estos accesos no muestran `Módulo en preparación` si están marcados como activos:

### Datos

- Panel
- Empresas / Centros
- Empresas
- Centros
- Trabajadores
- Alta / baja
- Expediente
- Contratos
- Convenios
- Documentos
- Alertas laborales
- Informes

### Acciones

- Cálculo nóminas
- IRPF

### Seguridad Social

- Incidencias

### Docencia

- Panel profesor
- Alertas docentes
- Casos prácticos
- Asignar caso
- Correcciones
- Vista alumno
- Alumnos
- Grupos
- Progreso

## 4. Flujo funcional mínimo

### Empresa y centro

Comprobar:

- Crear empresa.
- Crear centro vinculado a empresa.
- Editar empresa.
- Editar centro.
- Desactivar empresa o centro solo si no rompe los listados.

### Trabajador

Comprobar:

- Crear trabajador con empresa y centro.
- Ver trabajador en listado.
- Editar trabajador.
- Consultar expediente si procede.

### Convenio

Comprobar:

- Abrir módulo Convenios.
- Pulsar `Cargar convenio demo`.
- Ver resumen del convenio.
- Ver grupos profesionales.
- Ver categorías profesionales.
- Ver tabla salarial.
- Ver filas salariales.
- Crear una categoría manual.
- Crear una fila salarial manual.

### Contrato con convenio

Comprobar:

- Crear contrato para trabajador activo.
- Seleccionar convenio.
- Seleccionar categoría de convenio.
- Seleccionar fila salarial.
- Confirmar que el salario base se propone si está vacío.
- Confirmar que el salario base puede modificarse manualmente.
- Crear contrato.
- Ver convenio y categoría en listado de contratos.
- Abrir detalle del contrato.
- Confirmar que conserva convenio, categoría y fila salarial.

### Nómina

Comprobar:

- Abrir Cálculo nóminas.
- Crear nómina manual o preparar nóminas si el flujo está disponible.
- Ver nómina en listado.
- Editar nómina.

### Incidencia

Comprobar:

- Crear incidencia asociada a contrato.
- Ver incidencia en listado.
- Editar incidencia.

### Documentos

Comprobar:

- Abrir Documentos.
- Seleccionar trabajador.
- Generar checklist documental.
- Cambiar estado de un documento.

### Alertas e informes

Comprobar:

- Abrir Alertas laborales.
- Abrir Informes.
- No debe haber errores de renderizado.

### Docencia

Comprobar:

- Abrir Panel profesor.
- Abrir Casos prácticos.
- Abrir Asignar caso.
- Abrir Correcciones.
- Abrir Vista alumno.
- Abrir Alumnos.
- Abrir Grupos.
- Abrir Progreso.

## 5. Reglas específicas del Split 20 Convenios

Comprobar que se mantiene el principio didáctico:

- Convenios no calcula nóminas.
- Convenios no calcula IT.
- Convenios no calcula vacaciones.
- Convenios no calcula pagas extra.
- Convenios solo informa y propone salario base mínimo si se selecciona fila salarial.
- El alumno puede modificar manualmente los importes.

## 6. Señales de fallo crítico

Corregir antes de continuar si aparece cualquiera de estos casos:

- La carga inicial de datos deja varios módulos vacíos.
- Un endpoint base responde 500.
- Un endpoint base responde 422 por ruta incorrecta.
- La navegación muestra `Módulo en preparación` en módulos activos.
- El frontend no compila.
- El backend no arranca.
- Un cambio en un módulo rompe documentos, alertas, informes o docencia.

## 7. Criterio de cierre de split

Un split puede cerrarse si:

- Backend arranca.
- Frontend arranca.
- Reset demo funciona.
- Panel carga datos.
- Navegación activa funciona.
- El flujo principal afectado por el split funciona.
- No se rompen módulos no relacionados.
