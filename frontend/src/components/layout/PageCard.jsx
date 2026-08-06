import "./page.css";

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

export default function PageCard({
  as: Component = "section",
  title,
  subtitle,
  actions = null,
  children,
  variant = "default",
  padding = "default",
  className = "",
  ...props
}) {
  return (
    <Component
      className={joinClassNames(
        "an-page-card",
        variant !== "default" && `an-page-card--${variant}`,
        padding !== "default" && `an-page-card--${padding}`,
        className,
      )}
      {...props}
    >
      {(title || subtitle || actions) && (
        <header className="an-page-card__header">
          <div className="an-page-card__heading">
            {title && <h2 className="an-page-card__title">{title}</h2>}
            {subtitle && <p className="an-page-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="an-page-card__actions">{actions}</div>}
        </header>
      )}

      {children}
    </Component>
  );
}
