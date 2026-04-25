# AulaNomina - Instrucciones para Codex

AulaNomina es una plataforma web educativa para simular procesos reales de gestión laboral, RRHH y administración.

## Objetivo del MVP

Construir una demo funcional y profesional para centros educativos.

Prioridades:
1. Gestión de trabajadores
2. Gestión de contratos
3. Incidencias laborales
4. Nómina simulada
5. Panel docente
6. Casos prácticos

## Stack técnico

- Backend: FastAPI
- Base de datos: PostgreSQL
- ORM: SQLAlchemy
- Frontend: React
- Estilos: Tailwind CSS
- Arquitectura: monolito modular
- Entorno: Fedora/Linux
- Contenedores futuros: Podman

## Reglas de trabajo

- No reestructurar todo el proyecto sin pedirlo.
- No introducir dependencias innecesarias.
- Mantener código simple, legible y didáctico.
- Priorizar funcionalidad demo sobre perfección técnica.
- Separar backend, frontend y documentación.
- No añadir integraciones reales con Seguridad Social, AEAT, SEPE o sistemas externos.
- Todo debe ser simulación educativa.

## Backend

- Mantener FastAPI.
- Usar routers por módulo cuando el proyecto crezca.
- Mantener schemas, crud y models separados.
- Validar datos con Pydantic.
- No meter lógica compleja directamente en main.py.

## Frontend

- Usar React + Tailwind.
- Mantener componentes separados.
- Usar servicios en src/services/ para llamadas API.
- Evitar diseños complejos si no aportan a la demo.
- Mantener apariencia tipo ERP profesional.

## Forma de trabajar

Cada tarea debe:
- tocar el menor número posible de archivos
- mantener el proyecto arrancable
- explicar qué archivos ha cambiado
- indicar cómo probarlo
