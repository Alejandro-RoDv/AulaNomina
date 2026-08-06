import "./page.css";

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

const WIDTHS = new Set(["full", "wide", "default", "narrow"]);
const SPACINGS = new Set(["compact", "default", "relaxed"]);
const COLUMNS = new Set([1, 2, 3, 4, 5, 6]);

export function Page({
  as: Component = "div",
  children,
  width = "wide",
  spacing = "default",
  className = "",
  ...props
}) {
  const resolvedWidth = WIDTHS.has(width) ? width : "wide";
  const resolvedSpacing = SPACINGS.has(spacing) ? spacing : "default";

  return (
    <Component
      className={joinClassNames(
        "an-page",
        `an-page--${resolvedWidth}`,
        `an-page--spacing-${resolvedSpacing}`,
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function PageSection({
  as: Component = "section",
  children,
  title = "",
  description = "",
  eyebrow = "",
  actions = null,
  surface = false,
  className = "",
  ...props
}) {
  return (
    <Component
      className={joinClassNames(
        "an-page-section",
        surface && "an-page-section--surface",
        className,
      )}
      {...props}
    >
      {(title || description || eyebrow || actions) && (
        <PageSectionHeader
          title={title}
          description={description}
          eyebrow={eyebrow}
          actions={actions}
        />
      )}
      {children}
    </Component>
  );
}

export function PageSectionHeader({
  title,
  description = "",
  eyebrow = "",
  actions = null,
  className = "",
  ...props
}) {
  return (
    <header className={joinClassNames("an-page-section__header", className)} {...props}>
      <div className="an-page-section__heading">
        {eyebrow && <p className="an-page-section__eyebrow">{eyebrow}</p>}
        {title && <h2 className="an-page-section__title">{title}</h2>}
        {description && <p className="an-page-section__description">{description}</p>}
      </div>
      {actions && <div className="an-page-section__actions">{actions}</div>}
    </header>
  );
}

export function PageToolbar({
  children,
  primaryAction = null,
  className = "",
  ...props
}) {
  return (
    <div className={joinClassNames("an-page-toolbar", className)} {...props}>
      <div className="an-page-toolbar__content">{children}</div>
      {primaryAction && <div className="an-page-toolbar__primary">{primaryAction}</div>}
    </div>
  );
}

export function PageGrid({
  children,
  columns = null,
  minItemWidth = "15rem",
  className = "",
  ...props
}) {
  const resolvedColumns = COLUMNS.has(columns) ? columns : null;
  const style = resolvedColumns
    ? { "--an-page-grid-columns": resolvedColumns }
    : { "--an-page-grid-min": minItemWidth };

  return (
    <div
      className={joinClassNames(
        "an-page-grid",
        resolvedColumns && "an-page-grid--fixed",
        className,
      )}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function PageDivider({ className = "", ...props }) {
  return <hr className={joinClassNames("an-page-divider", className)} {...props} />;
}
