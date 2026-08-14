# Migración piloto Fase B · A04 → A07 → A29

**Curso:** AN-GL-2026  
**Secuencia runtime:** `onboarding-core-2026`  
**Caso demo reutilizado:** `TRAIN-2026-001 · Alta completa de trabajador`

## Objetivo

Demostrar que el Temario Maestro 2026 puede alimentar el motor real de actividades sin duplicar el contenido pedagógico en los casos demo.

La primera secuencia ejecutable es:

1. **A04 · Crear un expediente laboral completo y coherente a partir de documentación de incorporación.**
2. **A07 · Registrar un contrato indefinido.**
3. **A29 · Preparar el alta de una persona trabajadora.**

Los prerrequisitos completos del catálogo permanecen intactos. Para este piloto se utilizan dependencias runtime reducidas `A04 -> A07 -> A29`, considerando preparada la estructura de empresa y guiada la elección de modalidad/revisión previa de afiliación.

## Implementación

- `backend/app/training/runtime_bindings_2026.py` traduce cada código del catálogo a `module`, `expected_action`, `trigger_type` y `validation_rules` del motor actual.
- `backend/app/services/training_activity_runtime_service.py` enriquece las tareas ejecutables con objetivo, situación, teoría, feedback y metadatos del Temario Maestro.
- `backend/app/crud/case_study.py` reutiliza el caso demo existente, le asigna `scenario_code=TRAIN-2026-001` y sustituye sus cuatro pasos antiguos por las tres actividades migradas.
- `backend/app/case_scenario_routes.py` sirve el Centro de Actividades a través del adaptador híbrido.

## Validación automática utilizada

| Código | Acción runtime | Regla |
|---|---|---|
| A04 | `create_employee` | `employee_profile_matches` |
| A07 | `create_contract` | `active_contract` + familia `indefinite` |
| A29 | `prepare_affiliation` | `affiliation_prepared` + fecha `2026-09-01` |

El estado de progreso continúa almacenándose en `CaseTaskProgress`; no se introduce un segundo motor de progreso.

## Compatibilidad con bases demo existentes

Al ejecutar el seed, el caso anterior `Alta completa de trabajador` se localiza por título si aún no tiene el nuevo `scenario_code`. Sus tareas se actualizan por orden, se elimina el cuarto paso obsoleto y se resetea únicamente el progreso de esa asignación cuando se detecta por primera vez el cambio a códigos del Temario Maestro.

## Estado de transición

El Centro de Actividades queda temporalmente en modo **híbrido**:

- A04/A07/A29: contenido del Temario Maestro + ejecución/validación reales.
- Resto de actividades: casos demo heredados.

La siguiente migración debe ampliar este patrón a las actividades P0 sin crear una segunda fuente de contenido.
