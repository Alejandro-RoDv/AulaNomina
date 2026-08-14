# Fase B · Matriz de implementación del curso AulaNomina 2026

**Base:** `AN-GL-2026` · Fase A  
**Fecha de planificación:** 14/08/2026  
**Objetivo:** convertir el Temario Maestro en actividades ejecutables sin perder trazabilidad pedagógica ni normativa.

## 1. Regla de implementación

Cada actividad ejecutable deberá construirse a partir de dos contratos de contenido:

- `backend/app/training/course_blueprint_2026.py`: posición en curso, nivel, módulos ERP, tipo de validación, encaje funcional y fuentes oficiales.
- `backend/app/training/activity_specs_2026.py`: objetivo, prerrequisitos, situación profesional, datos entregados, acciones esperadas, criterios de evaluación, teoría y feedback.

La Fase B no debe duplicar estos datos dentro de seeds ad hoc. El motor de actividades deberá consumir o transformar este catálogo versionado.

## 2. Prioridades

### P0 · Migración inmediata sobre funcionalidad existente

Objetivo: sustituir progresivamente los casos demo actuales por actividades del temario maestro sin desarrollar módulos nuevos.

Actividades prioritarias:

- A04 Crear expediente laboral.
- A07 Contrato indefinido.
- A09 Contrato de sustitución.
- A14 Estructura salarial.
- A16 Nómina ordinaria.
- A18 Base de contingencias comunes.
- A20 Deducciones de Seguridad Social.
- A21 Retención IRPF en nómina.
- A23 IT por enfermedad común.
- A27 Cambio de jornada con efecto económico.
- A28 Revisión previa de afiliación.
- A29 Alta de afiliación.
- A31 Lectura de FIE.
- A32 Conciliación FIE.
- A33 CRA.
- A34 RNT/RLC.
- A35 SILTRA simulado.
- A37 Retención IRPF 2026.
- A40 Modelo 111.
- A41 Modelo 190.
- A42 Corrección salarial.
- A43 Antigüedad retroactiva.
- A45 Trazabilidad de regularización.
- A51 Checklist documental.
- A52 Gestión de estados documentales.
- A53 Respuesta profesional por correo.
- C01 Incorporación completa.
- C02 IT con sustitución.
- C03 Reclamación por antigüedad.
- C05 Cierre de cotización con error.

Estas prácticas deben convertirse primero porque permiten demostrar profundidad de curso utilizando módulos ya disponibles.

## 3. P1 · Ampliaciones pequeñas o validadores pedagógicos

No requieren un dominio funcional nuevo, pero sí enriquecer datos, eventos o reglas de comprobación.

| Actividad | Necesidad |
|---|---|
| A03 | Validador de asignación de convenio y variables aplicables. |
| A05 | Comparación estructurada entre expediente y datos objetivo del caso. |
| A08 | Campos y validaciones de causa/duración de temporalidad. |
| A12 | Evidencia explícita de modificación de jornada e histórico. |
| A13 | Acciones diferenciadas de prórroga y transformación. |
| A15 | Validador de pagas extraordinarias y prorrata. |
| A17 | Escenarios deterministas de alta/baja dentro del mes. |
| A19 | Desglose pedagógico específico de base AT/EP. |
| A24 | Escenario de IT por contingencia profesional. |
| A25 | Integración consistente de vacaciones con incidencias/calendario. |
| A26 | Catálogo didáctico de ausencias con impacto configurable. |
| A30 | Bajas y variaciones como movimientos de afiliación normalizados. |
| A36 | Evidencia documental Modelo 145 enlazada al perfil fiscal. |
| A38 | Caso de regularización de retención con antes/después. |
| A39 | Integración completa de profesionales con 111/190. |
| A44 | Atrasos derivados de revisión de convenio. |
| A54 | Evidencia transversal de proceso documental. |
| C04 | Cierre fiscal conjunto trabajadores/profesionales. |

## 4. P2 · Nuevos flujos funcionales

### Contratos formativos

- A10 Formación en alternancia.
- A11 Práctica profesional.

Datos mínimos a añadir al dominio de contrato:

- finalidad formativa;
- entidad/centro formativo;
- titulación o programa;
- tutoría;
- plan formativo;
- distribución de actividad laboral/formativa;
- fechas y documentación asociada.

No es imprescindible para lanzar la primera versión comercial si el tiempo compromete el bloque de extinción.

### Extinción, finiquito e indemnización

Prioridad funcional más alta entre los nuevos desarrollos:

- A46 Baja voluntaria.
- A47 Expiración de temporal.
- A48 Despido disciplinario.
- A49 Extinción con indemnización.
- A50 Finiquito.
- C06 Caso integral de extinción.

Flujo propuesto:

`Contrato activo -> Extinción -> Motivo/fecha -> Baja de afiliación -> Liquidación final -> Documentación -> Cierre de expediente`

Datos de extinción mínimos:

- contrato/trabajador;
- motivo normalizado;
- fecha de efectos;
- fecha de comunicación;
- observaciones/evidencia;
- requiere indemnización;
- regla didáctica de indemnización;
- vacaciones pendientes;
- pagas extraordinarias pendientes;
- conceptos salariales pendientes;
- estado de baja de afiliación;
- estado de liquidación/finiquito.

La indemnización debe estar desacoplada del salario ordinario en el desglose pedagógico.

## 5. Actividades principalmente conceptuales

A01 y A06 se mantienen intencionadamente como `content_assisted`.

No deben convertirse en un cuestionario teórico tradicional. El patrón recomendado es:

1. situación profesional breve;
2. varias decisiones posibles;
3. elección razonada;
4. feedback contextual;
5. enlace inmediato con una práctica ERP posterior.

A06 debe desembocar directamente en A07/A08/A09/A10/A11 según el supuesto.

## 6. Contrato de datos para la Fase B

Cada actividad materializada deberá exponer al frontend, como mínimo:

```text
code
course/block/unit
level
learning_objective
professional_situation
student_inputs
expected_actions
evaluation_criteria
theory_topics
feedback_if_failed
sources
prerequisites
erp_modules
validation
product_fit
development_gap
```

Los casos ejecutables podrán añadir:

```text
scenario_data
mail_thread_ids
attachment_ids
expected_operation
validation_rules
completion_evidence
```

## 7. Criterio de feedback

El feedback de AulaNomina no debe revelar inmediatamente la solución.

Orden de ayuda:

1. indicar qué criterio no se cumple;
2. indicar qué dato o área debe revisarse;
3. ofrecer concepto relacionado;
4. ofrecer pista concreta solo bajo demanda.

Ejemplo:

- Malo: `La base correcta es 1.850,00 €.`
- Bueno: `La base calculada no coincide con el caso. Revisa qué conceptos computan y si has incluido la parte proporcional de pagas extraordinarias.`

## 8. Política de fuentes

Antes de publicar una versión anual del curso:

- revisar todas las fuentes `annual`;
- revisar las fuentes `frequent` de TGSS/Sistema RED;
- revisar las fuentes `verify_before_release` cuando haya cambios normativos;
- mantener el año de referencia visible en contenido que dependa de importes o algoritmos.

Para 2026 se han verificado expresamente:

- currículo del módulo 0652 Gestión de recursos humanos;
- Estatuto de los Trabajadores;
- LGSS;
- Orden PJC/297/2026;
- modalidades contractuales SEPE;
- RD 1065/2025 de contratos formativos;
- Sistema RED/SLD;
- SILTRA 4.0.0 y FIE 5.0;
- CRA;
- servicio y algoritmo AEAT de retenciones 2026;
- Modelos 145, 111 y 190.

## 9. Definition of Done de una actividad

Una actividad no se considera terminada porque aparezca en el menú. Debe cumplir:

- contexto y datos suficientes para resolverla;
- acción profesional inequívoca pero no instrucción de clic a clic;
- fuentes oficiales trazables;
- resultado verificable;
- validador automático cuando el ERP dispone del dato;
- feedback de fallo útil;
- prerrequisitos consistentes;
- escenario reseteable;
- prueba automatizada del criterio principal;
- integración con progreso del curso.

## 10. Orden recomendado de desarrollo

1. Crear adaptador entre catálogo de Fase A y motor de actividades actual.
2. Migrar A04, A07 y A29 para validar el patrón expediente -> contrato -> afiliación.
3. Migrar A16, A18, A20 y A21 para validar el patrón de nómina didáctica.
4. Migrar A23, A31 y A32 para validar FIE/IT.
5. Migrar A33, A34 y A35 para validar Seguridad Social/SILTRA.
6. Migrar A37, A40 y A41 para fiscalidad.
7. Migrar regularizaciones y documentación.
8. Construir los primeros casos integrales sobre esas actividades.
9. Desarrollar Extinción/Finiquito.
10. Incorporar contratos formativos si no compromete el calendario comercial.
