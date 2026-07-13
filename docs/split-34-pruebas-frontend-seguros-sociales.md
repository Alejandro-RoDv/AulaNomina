# Split 34 — Guía de pruebas del frontend de Seguros Sociales

## Acceso al módulo

El módulo queda disponible desde:

- Menú lateral → **Nómina** → **Seguros sociales** → **Liquidaciones**.
- Menú lateral → **Nómina** → **Seguros sociales** → **Ficheros generados**.
- Pantalla **Preparación mensual** → botón **Abrir liquidaciones**.

## Arranque local

Desde la raíz del proyecto puede utilizarse `start-dev.sh` si el proyecto está en la ruta configurada por el script.

Arranque manual:

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La API se espera por defecto en `http://127.0.0.1:8000`. Puede cambiarse mediante `VITE_API_BASE_URL`.

## Pruebas automatizadas

Frontend específico:

```bash
cd frontend
npm run test:seguridad-social
```

Suite completa del frontend:

```bash
npm test
```

Backend del split:

```bash
cd backend
pytest -q \
  tests/test_communication_file_workflow.py \
  tests/test_social_security_settlement_service.py
```

## Preparación de datos

Antes de preparar una liquidación debe existir:

1. Una empresa activa con CCC.
2. Opcionalmente, centros con `main_ccc` o `general_ccc`.
3. Trabajadores activos con NAF.
4. Contratos con grupo de cotización.
5. Nóminas del mes y año seleccionados.

El CCC aplicado a cada nómina se resuelve por este orden:

1. CCC principal del centro.
2. CCC general del centro.
3. CCC de la empresa.

## Caso 1 — Liquidación correcta

1. Abrir **Liquidaciones**.
2. Seleccionar empresa, CCC, mes y año.
3. Pulsar **Preparar liquidación**.
4. Comprobar que aparecen los trabajadores correspondientes al CCC.
5. Revisar bases, días y cuotas.
6. La liquidación debe quedar en `READY` o **Preparada**.
7. Pulsar **Confirmar**.
8. Debe pasar a `CONFIRMED` o **Confirmada**.
9. Pulsar **Generar fichero**.
10. Debe descargarse un JSON y la liquidación debe pasar a `GENERATED`.
11. Abrir **Ficheros generados** y comprobar que figura el fichero.

## Caso 2 — Trabajador sin NAF

1. Eliminar temporalmente el NAF de un trabajador incluido.
2. Recalcular la liquidación.
3. Debe aparecer el error `NAF_REQUIRED`.
4. El botón **Confirmar** debe permanecer deshabilitado.

## Caso 3 — Contrato sin grupo de cotización

1. Dejar vacío el grupo de cotización de un contrato incluido.
2. Recalcular.
3. Debe aparecer `CONTRIBUTION_GROUP_REQUIRED`.
4. La liquidación debe quedar en `VALIDATION_ERROR`.

## Caso 4 — Empresa con varios CCC

1. Configurar al menos dos centros con CCC diferentes.
2. Generar nóminas de trabajadores asignados a ambos centros.
3. Preparar una liquidación para cada CCC.
4. Cada liquidación debe contener únicamente los trabajadores del CCC seleccionado.

## Caso 5 — Advertencias no bloqueantes

Una nómina en estado `draft` o `pending`, o sin marca `last_calculated_at`, debe producir una advertencia. La liquidación puede quedar `READY` siempre que no exista ningún error bloqueante.

## Caso 6 — Historial y fichero

1. Abrir una liquidación desde el historial.
2. Comprobar que conserva líneas, importes y validaciones.
3. Abrir el fichero asociado.
4. Revisar el contenido JSON en pantalla.
5. Descargarlo de nuevo.

## Resultado esperado del fichero

El JSON generado declara el formato:

```text
AULANOMINA_SOCIAL_SECURITY_SETTLEMENT_V1
```

Debe incluir empresa, CCC, periodo, totales y desglose por trabajador.
