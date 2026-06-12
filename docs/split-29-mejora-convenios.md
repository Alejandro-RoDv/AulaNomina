# Split 29 — Mejora Convenios: parametrización para motor de nómina

## Objetivo

Rediseñar el módulo de Convenios como un sistema de parametrización de reglas, no como una pantalla fija de datos. El convenio debe actuar como fuente de configuración para el futuro motor de nómina: vacaciones, pagas extra, antigüedad, complementos de IT, bases, tipos de cotización, conceptos y criterios generales.

## Principio de diseño

Patrón común:

```text
Cabecera del convenio
  ├─ Catálogos de conceptos
  ├─ Conceptos salariales por categoría
  └─ Reglas parametrizables
       └─ Detalles / tramos / conceptos / vencimientos / límites
```

Toda regla se guarda como dato. No debe quedar lógica de convenio fija en código.

---

## Paso 1 — Base técnica de parametrización

Estado: iniciado.

Crear tablas genéricas y reutilizables:

- `agreement_concept_catalog`
- `agreement_salary_concepts`
- `agreement_rule_headers`
- `agreement_rule_details`

Estas tablas permiten representar:

- Criterios generales.
- SMI/IPREM.
- Coeficientes reductores.
- Tipos de cotización.
- Bases de cotización por régimen.
- Vacaciones.
- Pagas extra.
- Antigüedad.
- Complementos IT.
- Contratación.
- Período de prueba.
- Observaciones.

## Paso 2 — API de parametrización

Estado: iniciado.

Endpoints previstos bajo `/collective-agreements`:

- `GET /{agreement_id}/parameterization`
- `POST /{agreement_id}/parameterization/seed`
- `POST /{agreement_id}/rule-headers`
- `PUT /rule-headers/{rule_id}`
- `DELETE /rule-headers/{rule_id}`
- `POST /rule-headers/{rule_id}/details`
- `PUT /rule-details/{detail_id}`
- `DELETE /rule-details/{detail_id}`
- `POST /{agreement_id}/concept-catalog`
- `PUT /concept-catalog/{item_id}`
- `DELETE /concept-catalog/{item_id}`
- `POST /{agreement_id}/salary-concepts`
- `PUT /salary-concepts/{concept_id}`
- `DELETE /salary-concepts/{concept_id}`

## Paso 3 — Cabecera ampliada del convenio

Campos a consolidar:

- Código.
- Ámbito.
- Denominación oficial.
- Denominación interna ERP.
- Vigencia.
- Fecha de entrada en vigor.
- Fecha fin.
- Convenio prorrogable.
- Estado.
- Preparación para alertas BOE.

Acción posterior: ampliar el modelo `CollectiveAgreement` con campos específicos que ahora no existen o están parcialmente cubiertos.

## Paso 4 — Ventana Criterios

Crear ventana/panel con accesos a:

- Antigüedad.
- Atrasos.
- Contratación.
- Incapacidad temporal.
- Pagas extra.
- Período de prueba.
- Vacaciones.

Cada bloque debe mapearse a `agreement_rule_headers.rule_type = 'criteria'` o a su tipo específico.

## Paso 5 — SMI / Cotización

Crear panel con pestañas:

1. SMI/IPREM.
2. Coeficientes reductores.
3. Tipos de cotización.
4. Bases de cotización.

Criterio: usar detalle 1:N para cada tabla.

Los importes o porcentajes que no estén cargados expresamente deben quedar como dato pendiente, no hardcodeados.

## Paso 6 — Tabla de salarios y conceptos

Replantear la pestaña de tablas salariales:

- Categorías a la izquierda.
- Devengos asociados a la derecha.
- Cada devengo debe permitir:
  - Carácter.
  - Denominación.
  - Ámbito.
  - Importe.
  - Tipo de pago.
  - Cálculo.
  - Cotiza.
  - IRPF.
  - CRA.

Los conceptos personalizados deben guardarse en `agreement_concept_catalog` y `agreement_salary_concepts`.

## Paso 7 — Catálogo de conceptos

Crear tres catálogos editables:

- Percepciones salariales.
- Percepciones no salariales.
- Deducciones.

Operaciones:

- Añadir.
- Editar.
- Eliminar o desactivar.
- Marcar como sistema o personalizado.

## Paso 8 — Opción global de pagas extra

Crear opción visible:

```text
Prorratear pagas extra: Sí / No
```

Debe guardarse como regla `global_option`, no como lógica fija en frontend.

## Paso 9 — Automatización de vacaciones

Modelo:

```text
Cabecera Vacaciones
  └─ Conceptos asociados
```

Debe permitir parametrizar:

- Prorrateo.
- Valoración.
- Fecha de devengo.
- Número de días.
- Tipo de días.
- Pago por día natural.
- Devenga IT.
- Situaciones IT.
- Conceptos salariales asociados.
- Medias.
- Cotización.
- Cómputo diario.

## Paso 10 — Automatización de paga extra

Modelo:

```text
Cabecera Paga Extra
  └─ Conceptos asociados
```

Debe permitir:

- Denominación.
- Prorrateo.
- Código CRA.
- Valoración.
- Fecha devengo.
- Fecha pago.
- Paga de beneficios.
- Devenga IT.
- Conceptos participantes.
- Número de días.
- Porcentajes.
- Cantidades.
- Medias.
- Cotización.
- Cómputo diario.

## Paso 11 — Antigüedad

Modelo:

```text
Cabecera Antigüedad
  └─ Vencimientos
```

Debe permitir:

- Denominación.
- Forma de pago.
- Fecha inicio.
- Fecha límite.
- Criterio de devengo.
- Salto en mes de baja.
- Cómputo diario.
- Vencimientos.

## Paso 12 — Complementos IT

Modelo:

```text
Complemento IT
  └─ Tramos
      ├─ Conceptos
      ├─ Diagnósticos
      └─ Límites
```

Debe soportar múltiples tramos y clases de IT.

El motor de nómina leerá esta parametrización para calcular mejoras de IT sin modificar código.

## Paso 13 — Otras pestañas

- Jornada laboral: integrar la jornada existente.
- Contratación: tipos específicos, duración máxima, prórrogas, contratos especiales.
- Período de prueba: tabla por categoría.
- Observaciones: texto libre interno.

## Paso 14 — Integración con motor de nómina

Orden recomendado:

1. Leer convenio del contrato.
2. Resolver categoría profesional.
3. Cargar conceptos salariales aplicables.
4. Aplicar opción global de pagas extra.
5. Aplicar reglas de vacaciones, pagas, antigüedad e IT.
6. Calcular bases y deducciones.
7. Generar desglose trazable.

## Paso 15 — QA de demo

Casos de prueba mínimos:

- Convenio sin parametrizar.
- Convenio parametrizado con pagas no prorrateadas.
- Convenio parametrizado con pagas prorrateadas.
- Categoría con salario base + complemento convenio.
- IT con varios tramos.
- Antigüedad con vencimiento.
- Vacaciones devengadas.

## Nota de implementación

La primera fase añade estructura persistente y API base. La semilla extensa de datos debe cargarse por bloques para evitar meter una tabla legal enorme en una sola modificación y mantener el repo controlable.
