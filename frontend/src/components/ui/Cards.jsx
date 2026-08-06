import { ArrowRight } from "lucide-react";

import "./cards.css";

const CARD_TONES = new Set(["neutral", "brand", "info", "success", "warning", "danger"]);

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

function resolveTone(tone) {
  return CARD_TONES.has(tone) ? tone : "neutral";
}

function CardIcon({ icon: Icon }) {
  if (!Icon) return null;
  return (
    <span className="an-pattern-card__icon" aria-hidden="true">
      <Icon />
    </span>
  );
}

export function StatCard({
  label,
  value,
  description = "",
  icon = null,
  tone = "neutral",
  meta = null,
  className = "",
  ...props
}) {
  const resolvedTone = resolveTone(tone);

  return (
    <article
      className={joinClassNames(
        "an-pattern-card",
        "an-stat-card",
        `an-pattern-card--${resolvedTone}`,
        className,
      )}
      {...props}
    >
      <div className="an-stat-card__top">
        <p className="an-stat-card__label">{label}</p>
        <CardIcon icon={icon} />
      </div>
      <p className="an-stat-card__value">{value}</p>
      {description && <p className="an-stat-card__description">{description}</p>}
      {meta && <div className="an-stat-card__meta">{meta}</div>}
    </article>
  );
}

export function ContentCard({
  as: Component = "section",
  title = "",
  description = "",
  actions = null,
  children,
  padding = "default",
  className = "",
  ...props
}) {
  return (
    <Component
      className={joinClassNames(
        "an-pattern-card",
        "an-content-card",
        padding === "compact" && "an-content-card--compact",
        className,
      )}
      {...props}
    >
      {(title || description || actions) && (
        <header className="an-content-card__header">
          <div className="an-content-card__heading">
            {title && <h2 className="an-content-card__title">{title}</h2>}
            {description && <p className="an-content-card__description">{description}</p>}
          </div>
          {actions && <div className="an-content-card__actions">{actions}</div>}
        </header>
      )}
      <div className="an-content-card__body">{children}</div>
    </Component>
  );
}

export function ActionCard({
  title,
  description = "",
  actionLabel = "Abrir",
  onAction,
  icon = null,
  tone = "neutral",
  disabled = false,
  className = "",
  ...props
}) {
  const resolvedTone = resolveTone(tone);

  return (
    <article
      className={joinClassNames(
        "an-pattern-card",
        "an-action-card",
        `an-pattern-card--${resolvedTone}`,
        disabled && "is-disabled",
        className,
      )}
      {...props}
    >
      <div className="an-action-card__copy">
        <CardIcon icon={icon} />
        <div>
          <h3 className="an-action-card__title">{title}</h3>
          {description && <p className="an-action-card__description">{description}</p>}
        </div>
      </div>
      <button
        type="button"
        className="an-action-card__button"
        onClick={onAction}
        disabled={disabled}
      >
        <span>{actionLabel}</span>
        <ArrowRight aria-hidden="true" />
      </button>
    </article>
  );
}

export function StatusCard({
  title,
  value = "",
  description = "",
  status = "",
  tone = "neutral",
  icon = null,
  compact = false,
  className = "",
  ...props
}) {
  const resolvedTone = resolveTone(tone);

  return (
    <article
      className={joinClassNames(
        "an-pattern-card",
        "an-status-card",
        `an-pattern-card--${resolvedTone}`,
        compact && "an-status-card--compact",
        className,
      )}
      {...props}
    >
      <div className="an-status-card__header">
        <div className="an-status-card__title-row">
          <CardIcon icon={icon} />
          <h3 className="an-status-card__title">{title}</h3>
        </div>
        {status && <span className="an-status-card__badge">{status}</span>}
      </div>
      {value && <strong className="an-status-card__value">{value}</strong>}
      {description && <p className="an-status-card__description">{description}</p>}
    </article>
  );
}
