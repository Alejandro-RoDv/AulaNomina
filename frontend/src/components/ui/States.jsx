import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  LoaderCircle,
  SearchX,
} from "lucide-react";

import "./states.css";

const STATE_TONES = new Set(["neutral", "info", "success", "warning", "danger"]);
const STATE_SIZES = new Set(["compact", "default", "spacious"]);

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

export function StatePanel({
  icon: Icon = null,
  title,
  description = "",
  actions = null,
  tone = "neutral",
  size = "default",
  loading = false,
  className = "",
  role,
  ...props
}) {
  const resolvedTone = STATE_TONES.has(tone) ? tone : "neutral";
  const resolvedSize = STATE_SIZES.has(size) ? size : "default";

  return (
    <section
      className={joinClassNames(
        "an-state",
        `an-state--${resolvedTone}`,
        `an-state--${resolvedSize}`,
        loading && "is-loading",
        className,
      )}
      role={role}
      aria-busy={loading || undefined}
      aria-live={loading ? "polite" : undefined}
      {...props}
    >
      {Icon && (
        <span className="an-state__icon" aria-hidden="true">
          <Icon />
        </span>
      )}

      <div className="an-state__copy">
        <h3 className="an-state__title">{title}</h3>
        {description && <p className="an-state__description">{description}</p>}
      </div>

      {actions && <div className="an-state__actions">{actions}</div>}
    </section>
  );
}

export function LoadingState({
  title = "Cargando información",
  description = "La información aparecerá en cuanto finalice la consulta.",
  ...props
}) {
  return (
    <StatePanel
      icon={LoaderCircle}
      title={title}
      description={description}
      tone="info"
      loading
      role="status"
      {...props}
    />
  );
}

export function EmptyState({
  title = "Todavía no hay datos",
  description = "Crea el primer registro para comenzar a trabajar.",
  ...props
}) {
  return (
    <StatePanel
      icon={Inbox}
      title={title}
      description={description}
      tone="neutral"
      role="status"
      {...props}
    />
  );
}

export function NoResultsState({
  title = "No hay resultados",
  description = "Modifica la búsqueda o elimina alguno de los filtros aplicados.",
  ...props
}) {
  return (
    <StatePanel
      icon={SearchX}
      title={title}
      description={description}
      tone="info"
      role="status"
      {...props}
    />
  );
}

export function ErrorState({
  title = "No se pudo completar la operación",
  description = "Revisa la información e inténtalo de nuevo.",
  ...props
}) {
  return (
    <StatePanel
      icon={AlertTriangle}
      title={title}
      description={description}
      tone="danger"
      role="alert"
      {...props}
    />
  );
}

export function SuccessState({
  title = "Operación completada",
  description = "Los cambios se han guardado correctamente.",
  ...props
}) {
  return (
    <StatePanel
      icon={CheckCircle2}
      title={title}
      description={description}
      tone="success"
      role="status"
      {...props}
    />
  );
}
