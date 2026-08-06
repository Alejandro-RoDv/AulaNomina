import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Plus,
  Save,
  TriangleAlert,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FormGrid,
  Input,
  LoadingState,
  NoResultsState,
  Select,
  SuccessState,
  Textarea,
} from "../components/ui/index.js";
import "./preview.css";

const SWATCHES = [
  { label: "Acción principal", className: "an-preview__swatch--primary" },
  { label: "Marca", className: "an-preview__swatch--brand" },
  { label: "Éxito", className: "an-preview__swatch--success" },
  { label: "Advertencia", className: "an-preview__swatch--warning" },
  { label: "Error", className: "an-preview__swatch--danger" },
  { label: "Superficie", className: "an-preview__swatch--surface" },
];

export default function DesignSystemPreview() {
  const returnPath = window.location.pathname || "/";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="an-preview">
      <header className="an-preview__topbar">
        <div className="an-preview__topbar-content">
          <a className="an-preview__back" href={returnPath}>
            <ArrowLeft aria-hidden="true" />
            Volver a AulaNomina
          </a>
          <Badge tone="brand">Paso 41.10</Badge>
        </div>
      </header>

      <main className="an-preview__main">
        <div className="an-preview__intro">
          <div>
            <p className="an-preview__eyebrow">AulaNomina Design System</p>
            <h1>Componentes base</h1>
            <p className="an-preview__lead">
              Biblioteca reutilizable para sustituir los estilos aislados de los módulos.
              Esta pantalla es técnica y no forma parte de la navegación comercial.
            </p>
          </div>
          <Button icon={<Plus />}>Nueva empresa</Button>
        </div>

        <section className="an-preview__section" aria-labelledby="preview-colors">
          <div className="an-preview__section-heading">
            <h2 id="preview-colors">Paleta funcional</h2>
            <p>El amarillo identifica la marca. El azul queda reservado para la acción dominante.</p>
          </div>
          <div className="an-preview__swatches">
            {SWATCHES.map((swatch) => (
              <div className="an-preview__swatch-item" key={swatch.label}>
                <span className={`an-preview__swatch ${swatch.className}`} />
                <span>{swatch.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="an-preview__section" aria-labelledby="preview-buttons">
          <div className="an-preview__section-heading">
            <h2 id="preview-buttons">Botones</h2>
            <p>Cuatro variantes, tres tamaños y estados consistentes.</p>
          </div>
          <Card>
            <div className="an-preview__component-row">
              <Button icon={<Save />}>Guardar cambios</Button>
              <Button variant="secondary">Vista previa</Button>
              <Button variant="ghost">Cancelar</Button>
              <Button variant="danger">Eliminar</Button>
              <Button loading>Procesando</Button>
              <Button disabled>Deshabilitado</Button>
            </div>
            <div className="an-preview__component-row an-preview__component-row--sizes">
              <Button size="sm" variant="secondary">Pequeño</Button>
              <Button size="md" variant="secondary">Mediano</Button>
              <Button size="lg" variant="secondary">Grande</Button>
            </div>
          </Card>
        </section>

        <section className="an-preview__section" aria-labelledby="preview-badges">
          <div className="an-preview__section-heading">
            <h2 id="preview-badges">Estados semánticos</h2>
            <p>El color comunica el estado sin convertir toda la pantalla en un semáforo.</p>
          </div>
          <Card>
            <div className="an-preview__component-row">
              <Badge dot>Sin iniciar</Badge>
              <Badge tone="brand" dot>Demo</Badge>
              <Badge tone="info" dot>En revisión</Badge>
              <Badge tone="success" dot>Validado</Badge>
              <Badge tone="warning" dot>Con avisos</Badge>
              <Badge tone="danger" dot>Rechazado</Badge>
            </div>
          </Card>
        </section>

        <section className="an-preview__section" aria-labelledby="preview-cards">
          <div className="an-preview__section-heading">
            <h2 id="preview-cards">Tarjetas</h2>
            <p>La misma estructura sirve para contenido, indicadores y acciones contextuales.</p>
          </div>
          <div className="an-preview__card-grid">
            <Card>
              <CardHeader actions={<Badge tone="success">Activo</Badge>}>
                <CardTitle>Trabajadores</CardTitle>
                <CardDescription>Personas disponibles en el entorno de simulación.</CardDescription>
              </CardHeader>
              <CardContent>
                <strong className="an-preview__metric">127</strong>
                <p className="an-preview__metric-detail">4 altas durante este periodo</p>
              </CardContent>
            </Card>

            <Card variant="subtle">
              <CardHeader>
                <CardTitle>Cierre de nómina</CardTitle>
                <CardDescription>Periodo diciembre de 2026.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="an-preview__body-copy">
                  Quedan tres incidencias pendientes antes de cerrar el proceso.
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="secondary">Revisar incidencias</Button>
                <Button>Continuar</Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        <section className="an-preview__section" aria-labelledby="preview-form">
          <div className="an-preview__section-heading">
            <h2 id="preview-form">Formulario</h2>
            <p>Controles de 44 px, etiquetas consistentes y errores asociados al campo.</p>
          </div>
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Datos de la empresa</CardTitle>
              <CardDescription>Ejemplo de agrupación para una ficha administrativa.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="an-preview__form-grid">
                <Field label="Razón social" required hint="Nombre legal que aparecerá en documentos.">
                  <Input placeholder="Empresa Ejemplo, S.L." />
                </Field>
                <Field label="CIF" required error="El CIF debe contener nueve caracteres.">
                  <Input defaultValue="B123" />
                </Field>
                <Field label="Tipo de entidad">
                  <Select defaultValue="private">
                    <option value="private">Empresa privada</option>
                    <option value="public">Entidad pública</option>
                    <option value="non-profit">Entidad sin ánimo de lucro</option>
                  </Select>
                </Field>
                <Field label="CCC principal">
                  <Input placeholder="01/1112345678" />
                </Field>
                <Field label="Observaciones" className="an-preview__form-wide">
                  <Textarea placeholder="Información relevante para el caso práctico..." />
                </Field>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="ghost">Cancelar</Button>
              <Button icon={<Save />}>Guardar empresa</Button>
            </CardFooter>
          </Card>
        </section>

        <section className="an-preview__section" aria-labelledby="preview-system-states">
          <div className="an-preview__section-heading">
            <h2 id="preview-system-states">Estados de pantalla</h2>
            <p>Carga, ausencia de datos, filtros sin coincidencias, error y confirmación comparten composición.</p>
          </div>
          <div className="an-preview__state-grid">
            <LoadingState size="compact" title="Cargando nóminas" />
            <EmptyState
              size="compact"
              title="Todavía no hay trabajadores"
              description="Crea el primer trabajador para comenzar el caso práctico."
              actions={<Button size="sm">Crear trabajador</Button>}
            />
            <NoResultsState
              size="compact"
              title="Sin coincidencias"
              actions={<Button size="sm" variant="secondary">Limpiar filtros</Button>}
            />
            <ErrorState
              size="compact"
              title="No se pudieron cargar los contratos"
              description="Comprueba la conexión con el backend y vuelve a intentarlo."
              actions={<Button size="sm" variant="secondary">Reintentar</Button>}
            />
            <SuccessState
              size="compact"
              title="Empresa creada"
              description="Ya puedes configurar sus centros y preferencias."
              actions={<Button size="sm" variant="secondary">Abrir ficha</Button>}
            />
          </div>
        </section>

        <section className="an-preview__section" aria-labelledby="preview-dialogs">
          <div className="an-preview__section-heading">
            <h2 id="preview-dialogs">Diálogos y paneles</h2>
            <p>Las tareas breves usan diálogo; las confirmaciones destructivas se aíslan y el contexto extenso se abre en un panel lateral.</p>
          </div>
          <Card>
            <div className="an-preview__component-row">
              <Button onClick={() => setDialogOpen(true)}>Abrir diálogo</Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>Abrir confirmación</Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>Abrir panel lateral</Button>
            </div>
          </Card>
        </section>

        <section className="an-preview__section" aria-labelledby="preview-alerts">
          <div className="an-preview__section-heading">
            <h2 id="preview-alerts">Mensajes del sistema</h2>
            <p>Los avisos breves se muestran dentro del flujo sin sustituir el contenido de la pantalla.</p>
          </div>
          <div className="an-preview__alert-stack">
            <Alert title="Información del entorno" tone="info" icon={<Info />}>
              Los datos pertenecen a una simulación educativa y no se enviarán a organismos reales.
            </Alert>
            <Alert title="Proceso completado" tone="success" icon={<CheckCircle2 />}>
              La declaración se ha generado correctamente.
            </Alert>
            <Alert title="Revisión necesaria" tone="warning" icon={<TriangleAlert />}>
              Existen dos trabajadores sin grupo de cotización informado.
            </Alert>
            <Alert title="No se pudo guardar" tone="danger" icon={<AlertCircle />}>
              Corrige los campos marcados antes de continuar.
            </Alert>
          </div>
        </section>
      </main>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Registrar incidencia"
        description="Añade la información mínima para incorporarla al flujo laboral."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => setDialogOpen(false)}>Guardar incidencia</Button>
          </>
        )}
      >
        <FormGrid columns={2}>
          <Field label="Trabajador" required>
            <Select defaultValue="">
              <option value="" disabled>Seleccionar trabajador</option>
              <option value="1">Ana Martín López</option>
            </Select>
          </Field>
          <Field label="Tipo" required>
            <Select defaultValue="vacation">
              <option value="vacation">Vacaciones</option>
              <option value="it">Incapacidad temporal</option>
              <option value="absence">Ausencia</option>
            </Select>
          </Field>
          <Field label="Observaciones" className="an-form-field--wide">
            <Textarea placeholder="Contexto de la incidencia..." />
          </Field>
        </FormGrid>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Eliminar trabajador"
        description="Vas a retirar este trabajador del entorno de simulación."
        confirmLabel="Eliminar trabajador"
      >
        <p>Los contratos y documentos asociados deberán revisarse después de la eliminación.</p>
      </ConfirmDialog>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Detalle de alerta"
        description="Información contextual sin abandonar la pantalla actual."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cerrar</Button>
            <Button onClick={() => setDrawerOpen(false)}>Revisar expediente</Button>
          </>
        )}
      >
        <Alert title="Contrato próximo a vencer" tone="warning" icon={<TriangleAlert />}>
          El contrato de Ana Martín López finaliza dentro de siete días.
        </Alert>
        <div className="an-preview__drawer-copy">
          <h3>Acción recomendada</h3>
          <p>Revisa la modalidad contractual, la fecha de baja prevista y la comunicación que debe recibir el alumno.</p>
          <h3>Contexto docente</h3>
          <p>La alerta puede vincularse a un caso práctico para que el alumno tramite la renovación o la extinción.</p>
        </div>
      </Drawer>
    </div>
  );
}