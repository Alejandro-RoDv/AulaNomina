# Migración Fase B · Itinerario de nómina A14-A21

**Escenario runtime:** `TRAIN-2026-PAYROLL-001`  
**Trabajadora demo:** Laura Martín Ruiz  
**Periodo:** junio de 2026

## Secuencia ejecutable

1. `A14` · Configurar salario base y complementos de un contrato.
2. `A16` · Calcular una nómina mensual ordinaria.
3. `A18` · Comprobar la base de cotización por contingencias comunes.
4. `A20` · Revisar las deducciones de Seguridad Social del trabajador.
5. `A21` · Aplicar y comprobar la retención de IRPF en nómina.

A15 y A19 continúan en el Temario Maestro, pero no bloquean este primer itinerario runtime. A15 se resuelve mediante el supuesto de 14 pagas no prorrateadas; A19 se añadirá cuando se implemente la comparación pedagógica específica entre base CC y base profesional.

## Interacción

`A14` y `A16` son actividades operativas. El puente de casos detecta la asociación/actualización de conceptos permanentes y la generación de nómina y solicita validación automática.

`A18`, `A20` y `A21` son actividades de revisión. Seleccionarlas no las completa. El alumno revisa la nómina y después pulsa **Comprobar resultado**.

## Comprobaciones de revisión

### A18

- existe una nómina calculada para la trabajadora y periodo;
- la base de contingencias comunes es positiva;
- la base mensual cuadra con la base diaria por los días de cotización.

### A20

- existe una nómina calculada;
- se suman las aportaciones del trabajador por contingencias comunes, desempleo, formación y MEI;
- esa suma cuadra con el total de Seguridad Social descontado al trabajador.

### A21

- existe una nómina calculada;
- la cuota de IRPF cuadra con base × porcentaje;
- en modo automático, el porcentaje aplicado coincide con el porcentaje sugerido por el cálculo fiscal.

## Datos del ejercicio

- salario base: `1.680,00 €`;
- complemento convenio objetivo: `85,00 €`;
- pagas: 14, no prorrateadas;
- periodo objetivo: `2026-06`;
- sin incidencias en el periodo.

## Aplicación a una base demo existente

Tras actualizar la rama, ejecutar una vez `POST /demo/reset` para crear el escenario y su asignación demo. El seeder de asignaciones crea antes grupos y alumnos si la base está vacía, por lo que el itinerario también queda disponible en una instalación demo nueva.
