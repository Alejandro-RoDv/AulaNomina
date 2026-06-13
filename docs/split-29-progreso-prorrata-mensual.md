# Split 29 - Progreso: prorrata mensual de pagas extraordinarias

## Estado

Implementación funcional terminada y pendiente de ejecución local de pruebas.

## Backend

- Resolución de pagas activas por convenio y tabla salarial.
- Prevalencia de configuración específica sobre configuración general.
- Aplicación exclusiva a contratos de doce pagas.
- Aplicación exclusiva en períodos mensuales 1-12.
- Cálculo por paga y concepto participante.
- Uso de salario base contractual y conceptos permanentes.
- Aplicación de parcialidad.
- Ajuste por alta, baja, IT, ausencia no retribuida e inactividad.
- Prevención de doble reducción en bases de cotización.
- Integración en bruto, bases, IRPF, cotizaciones y coste empresa.
- Fallback histórico para contratos sin parametrización suficiente.
- Líneas automáticas identificadas mediante `PRORRATA_EXTRA_`.
- Persistencia transaccional junto a la cabecera de nómina.
- Sustitución idempotente de líneas al recalcular.
- Separación entre líneas automáticas y conceptos manuales.
- Exposición del desglose en simulaciones futuras.

## Frontend

### Preparación mensual

- Columna individual de prorrata.
- Total de prorrata del lote.
- Bruto separado de la prorrata.

### Recibo individual

- Una línea por paga y concepto.
- Compatibilidad con recibos antiguos sin líneas automáticas.
- Compatibilidad con conceptos manuales.
- Impresión con el mismo desglose.

### Simulación futura

- KPI de prorrata prevista.
- Columna mensual de prorrata.
- Origen de cálculo: convenio, histórico o no aplicable.

## Pruebas

Añadido:

`backend/tests/test_monthly_extra_pay_proration.py`

Cubre:

- parcialidad,
- ausencia no retribuida,
- IT configurable,
- no duplicación de reducción,
- inclusión en bases,
- creación de líneas,
- recalculo idempotente,
- períodos especiales,
- fallback histórico.

## Validación pendiente

```bash
cd backend
python -m unittest discover -s tests -p "test_*.py"
```

```bash
cd frontend
npm run build
```

No se han ejecutado en el entorno de desarrollo asistido porque el contenedor no puede resolver `github.com` y el repositorio no dispone actualmente de un workflow de CI ejecutable desde el conector.
