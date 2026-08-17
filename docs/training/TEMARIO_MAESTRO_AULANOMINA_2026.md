# Temario Maestro AulaNomina 2026

**Estado:** Fase A · especificación pedagógica  
**Versión:** 2026.1-phase-a  
**Fuentes revisadas:** 14/08/2026  
**Ámbito:** España · Régimen General · nivel inicial/intermedio

## 1. Objetivo

AulaNomina no pretende reproducir un manual de Derecho del Trabajo. El curso debe convertir los resultados de aprendizaje reglados y los procesos profesionales de gestión laboral en prácticas dentro de un ERP educativo.

Patrón didáctico objetivo:

1. teoría mínima necesaria para interpretar la situación;
2. datos de un expediente o comunicación profesional;
3. operación dentro de AulaNomina;
4. comprobación del resultado;
5. feedback sin revelar automáticamente la solución;
6. casos integrales con instrucciones progresivamente menos guiadas.

El RETA, el derecho colectivo avanzado y las integraciones reales con organismos quedan fuera de la primera versión comercial.

## 2. Referencia reglada

La referencia formativa principal es el **Real Decreto 1584/2011**, título de Técnico Superior en Administración y Finanzas, especialmente el módulo profesional **0652 · Gestión de recursos humanos**.

El blueprint se alinea con cuatro resultados de aprendizaje especialmente útiles para AulaNomina:

- **RA1:** documentación y proceso de contratación;
- **RA2:** modificación, suspensión y extinción del contrato;
- **RA3:** obligaciones administrativas frente a la Seguridad Social;
- **RA4:** retribución, nómina y obligaciones de pago.

El propio currículo contempla la utilización de aplicaciones informáticas de gestión de recursos humanos, nóminas y seguros sociales, por lo que la simulación ERP encaja directamente con su enfoque práctico.

## 3. Fuentes oficiales

Jerarquía de fuentes del curso:

1. **Currículo oficial:** BOE / Formación Profesional.
2. **Normativa laboral:** Estatuto de los Trabajadores y LGSS.
3. **Parámetros anuales:** normativa de cotización del ejercicio.
4. **Procedimiento profesional:** SEPE, TGSS/Sistema RED y AEAT.
5. **AulaNomina:** traducción didáctica del proceso a un entorno simulado.

Fuentes base registradas en código:

- RD 1584/2011: https://www.boe.es/eli/es/rd/2011/11/04/1584
- Estatuto de los Trabajadores: https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430
- LGSS: https://www.boe.es/buscar/act.php?id=BOE-A-2015-11724
- Orden PJC/297/2026: https://www.boe.es/eli/es/o/2026/03/30/pjc297
- Contratos formativos, RD 1065/2025: https://www.boe.es/eli/es/rd/2025/11/26/1065
- Modalidades contractuales SEPE: https://www.sepe.es/HomeSepe/empresas/Contratos-de-trabajo/modelos-contrato.htm
- Sistema RED: https://www.seg-social.es/wps/portal/wss/internet/InformacionUtil/5300/
- FIE 5.0: https://www.seg-social.es/wps/portal/wss/internet/InformacionUtil/5300/3827/e8dafb74-f2f2-43fe-a8e1-9be3c10c6486
- CRA: https://www.seg-social.es/wps/portal/wss/internet/InformacionUtil/5300/2867
- Retenciones IRPF 2026: https://sede.agenciatributaria.gob.es/Sede/Retenciones.shtml
- Modelo 145: https://sede.agenciatributaria.gob.es/Sede/procedimientos/G603.shtml
- Modelo 111: https://sede.agenciatributaria.gob.es/Sede/irpf/retenciones-ingresos-cuenta-pagos-fraccionados/retenciones-ingresos-cuenta/obligaciones-retenedor/modelo-111.html
- Modelo 190: https://sede.agenciatributaria.gob.es/Sede/irpf/retenciones-ingresos-cuenta-pagos-fraccionados/retenciones-ingresos-cuenta/obligaciones-retenedor/modelo-190.html

> La fuente normativa se versiona. Los datos dependientes del ejercicio —cotización e IRPF, entre otros— deben revisarse antes de publicar un nuevo curso anual.

## 4. Dimensión prevista del curso

| Elemento | Objetivo Fase A |
|---|---:|
| Bloques | 10 |
| Unidades | 36 |
| Actividades guiadas | 54 |
| Casos integrales | 6 |
| Total prácticas | 60 |

### Encaje con el producto actual

| Estado | Actividades | Interpretación |
|---|---:|---|
| `ready` | 33 | La base funcional actual permite construir la práctica y su validador. |
| `partial` | 17 | Existe módulo, pero requiere ampliar flujo, datos o validación pedagógica. |
| `new_flow` | 8 | Requiere una ampliación funcional relevante. |
| `content_assisted` | 2 | Contenido principalmente conceptual apoyado por el ERP. |

Esto significa que **50 de 60 prácticas (83 %) pueden apoyarse en funcionalidades que ya existen o en ampliaciones razonables de módulos actuales**. El principal hueco nuevo es Extinción/Finiquito.

Validación prevista: **41 automáticas**, **17 semiautomáticas** y **2 manuales**.

## 5. Temario

### Bloque 1 · Fundamentos y organización laboral

Objetivo: interpretar el contexto mínimo y preparar empresa, centro, convenio y expediente.

- **A01** Distinguir relación laboral ordinaria y situación excluida — `content_assisted`.
- **A02** Configurar empresa y centro — `ready`.
- **A03** Identificar y asignar convenio aplicable — `partial`.
- **A04** Crear expediente laboral — `ready`.
- **A05** Detectar y corregir un expediente incoherente — `ready`.

### Bloque 2 · Contratación laboral

Objetivo: seleccionar, formalizar y modificar contratos coherentes con el supuesto.

- **A06** Elegir modalidad contractual — `content_assisted`.
- **A07** Contrato indefinido — `ready`.
- **A08** Temporal por circunstancias justificadas — `partial`.
- **A09** Contrato de sustitución — `ready`.
- **A10** Formación en alternancia — `new_flow`.
- **A11** Práctica profesional — `new_flow`.
- **A12** Modificación de jornada — `partial`.
- **A13** Prórroga o transformación contractual — `partial`.

### Bloque 3 · Nómina y retribución

Objetivo: comprender la nómina desde la estructura salarial hasta líquido y coste empresa.

- **A14** Salario base y complementos — `ready`.
- **A15** Pagas extraordinarias y prorrata — `partial`.
- **A16** Nómina mensual ordinaria — `ready`.
- **A17** Nómina con alta/baja dentro del mes — `partial`.
- **A18** Base de contingencias comunes — `ready`.
- **A19** Base de contingencias profesionales — `partial`.
- **A20** Deducciones de Seguridad Social — `ready`.
- **A21** Retención IRPF en nómina — `ready`.
- **A22** Líquido y coste empresa — `ready`.

### Bloque 4 · Incidencias laborales

Objetivo: registrar situaciones que alteran la prestación y comprobar sus efectos.

- **A23** IT por enfermedad común — `ready`.
- **A24** IT por accidente de trabajo — `partial`.
- **A25** Vacaciones — `partial`.
- **A26** Ausencia con impacto económico — `partial`.
- **A27** Cambio de jornada y recálculo — `ready`.

### Bloque 5 · Seguridad Social y Sistema RED

Objetivo: practicar afiliación, comunicaciones INSS, cotización y transmisión simulada.

- **A28** Revisar NAF y datos previos de afiliación — `ready`.
- **A29** Preparar alta — `ready`.
- **A30** Preparar baja o variación — `partial`.
- **A31** Interpretar una comunicación FIE — `ready`.
- **A32** Conciliar FIE con incidencia — `ready`.
- **A33** Generar y validar CRA — `ready`.
- **A34** Revisar y cuadrar RNT/RLC — `ready`.
- **A35** SILTRA: enviar, interpretar error, corregir y reenviar — `ready`.

### Bloque 6 · IRPF y fiscalidad laboral

Objetivo: relacionar datos fiscales, nómina y obligaciones del retenedor.

- **A36** Modelo 145 y perfil fiscal — `partial`.
- **A37** Calcular retención IRPF 2026 — `ready`.
- **A38** Regularizar retención — `partial`.
- **A39** Profesional con retención — `partial`.
- **A40** Generar y presentar Modelo 111 simulado — `ready`.
- **A41** Generar y cuadrar Modelo 190 — `ready`.

### Bloque 7 · Regularizaciones y retroactivos

Objetivo: corregir periodos calculados preservando trazabilidad.

- **A42** Corregir concepto salarial — `ready`.
- **A43** Antigüedad retroactiva — `ready`.
- **A44** Atrasos por revisión salarial/convenio — `partial`.
- **A45** Comparar cálculo original y regularizado — `ready`.

### Bloque 8 · Extinción, finiquito e indemnizaciones

Objetivo: gestionar administrativamente el final de la relación laboral.

- **A46** Baja voluntaria — `new_flow`.
- **A47** Expiración de contrato temporal — `new_flow`.
- **A48** Despido disciplinario — `new_flow`.
- **A49** Extinción con indemnización — `new_flow`.
- **A50** Finiquito con salario, pagas y vacaciones pendientes — `new_flow`.

Este bloque constituye el **principal gap funcional detectado** y debería originar un split propio tras completar la migración del contenido ya soportado.

### Bloque 9 · Gestión documental y comunicaciones

Objetivo: mantener un expediente verificable y comunicar actuaciones profesionalmente.

- **A51** Checklist documental de incorporación — `ready`.
- **A52** Pendientes, caducados y no aplicables — `ready`.
- **A53** Respuesta profesional por correo — `ready`.
- **A54** Localizar y justificar evidencia documental — `partial`.

### Bloque 10 · Casos integrales

Los casos integrales no deben comportarse como una lista de clics. El alumno recibe correo, documentos y estado inicial y debe decidir el recorrido adecuado.

- **C01** Nueva incorporación completa — `ready`.
- **C02** IT con sustitución — `ready`.
- **C03** Reclamación de nómina por antigüedad — `ready`.
- **C04** Cierre fiscal trimestral y Modelo 111 — `partial`.
- **C05** Liquidación SS con error y reenvío SILTRA — `ready`.
- **C06** Extinción completa y finiquito — `new_flow`.

## 6. Prioridad de desarrollo derivada del temario

### No requiere nuevo gran módulo

Debe resolverse principalmente en contenido, casos y validadores:

- expediente y empresa;
- contratación ordinaria y sustituciones;
- nómina;
- IT e incidencias;
- afiliación y FIE;
- CRA;
- RNT/RLC;
- SILTRA;
- IRPF;
- 111/190;
- regularizaciones;
- documentos y correo.

### Ampliaciones acotadas

- selección pedagógica y validación de convenio;
- temporales y modificaciones contractuales;
- contratos formativos;
- vacaciones/ausencias;
- baja y variaciones de afiliación;
- Modelo 145 enlazado a perfil fiscal;
- profesionales integrados con 111/190;
- atrasos por convenio;
- evidencia documental transversal.

### Nuevo flujo prioritario

**Extinción + liquidación + finiquito + indemnización.**

Debe coordinar contrato, trabajador, nómina, vacaciones, afiliación, documentos y comunicaciones sin convertirlo necesariamente en un módulo aislado del resto del ERP.

## 7. Reglas de diseño de contenido

Cada actividad ejecutable deberá declarar como mínimo:

- código estable;
- bloque/unidad;
- nivel;
- objetivo de aprendizaje;
- situación profesional;
- datos del caso;
- módulos ERP utilizados;
- fuente oficial;
- acción esperada;
- criterios de resultado;
- tipo de validación;
- prerrequisitos;
- feedback de error;
- estado funcional (`ready`, `partial`, `new_flow`, `content_assisted`).

Las fuentes jurídicas no deben convertirse en largas citas dentro del frontend. Se almacenan para trazabilidad y actualización. El alumno verá explicación aplicada y, cuando corresponda, una referencia normativa desplegable.

## 8. Siguiente paso: Fase B

La Fase B no debe crear otras 60 actividades manualmente en el seed actual. Debe:

1. adaptar el modelo de contenido para representar bloques y unidades de forma explícita;
2. migrar las actividades actuales al nuevo blueprint;
3. crear primero las actividades `ready`;
4. añadir validadores faltantes para las `partial`;
5. mantener los casos integrales separados de la secuencia guiada;
6. dejar los `new_flow` bloqueados hasta que exista funcionalidad ERP suficiente.

El archivo máquina que actúa como fuente de verdad inicial es:

`backend/app/training/course_blueprint_2026.py`

El registro de fuentes es:

`backend/app/training/official_sources_2026.py`
