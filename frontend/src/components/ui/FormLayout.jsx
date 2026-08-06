import "./forms.css";

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

const GRID_COLUMNS = new Set([1, 2, 3, 4]);
const ACTION_ALIGNMENTS = new Set(["between", "start", "center", "end"]);

export function Form({ children, className = "", ...props }) {
  return (
    <form className={joinClassNames("an-form", className)} {...props}>
      {children}
    </form>
  );
}

export function FormSection({
  as: Component = "section",
  title,
  description = "",
  eyebrow = "",
  actions = null,
  children,
  className = "",
  ...props
}) {
  return (
    <Component className={joinClassNames("an-form-section", className)} {...props}>
      {(title || description || eyebrow || actions) && (
        <header className="an-form-section__header">
          <div className="an-form-section__heading">
            {eyebrow && <p className="an-form-section__eyebrow">{eyebrow}</p>}
            {title && <h3 className="an-form-section__title">{title}</h3>}
            {description && <p className="an-form-section__description">{description}</p>}
          </div>
          {actions && <div className="an-form-section__actions">{actions}</div>}
        </header>
      )}
      <div className="an-form-section__content">{children}</div>
    </Component>
  );
}

export function FormGrid({
  children,
  columns = null,
  minItemWidth = "14rem",
  className = "",
  ...props
}) {
  const resolvedColumns = GRID_COLUMNS.has(columns) ? columns : null;
  const style = resolvedColumns
    ? { "--an-form-grid-columns": resolvedColumns }
    : { "--an-form-grid-min": minItemWidth };

  return (
    <div
      className={joinClassNames(
        "an-form-grid",
        resolvedColumns && "an-form-grid--fixed",
        className,
      )}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function FormOptions({ children, className = "", ...props }) {
  return (
    <div className={joinClassNames("an-form-options", className)} {...props}>
      {children}
    </div>
  );
}

export function FormOption({
  label,
  description = "",
  className = "",
  ...inputProps
}) {
  return (
    <label className={joinClassNames("an-form-option", className)}>
      <input type="checkbox" className="an-form-option__control" {...inputProps} />
      <span className="an-form-option__copy">
        <span className="an-form-option__label">{label}</span>
        {description && <span className="an-form-option__description">{description}</span>}
      </span>
    </label>
  );
}

export function FormPresetBar({
  children,
  label = "Cargar datos de ejemplo",
  className = "",
  ...props
}) {
  return (
    <div className={joinClassNames("an-form-presets", className)} {...props}>
      <span className="an-form-presets__label">{label}</span>
      <div className="an-form-presets__actions">{children}</div>
    </div>
  );
}

export function FormActions({
  children,
  note = "",
  align = "between",
  sticky = false,
  className = "",
  ...props
}) {
  const resolvedAlign = ACTION_ALIGNMENTS.has(align) ? align : "between";

  return (
    <footer
      className={joinClassNames(
        "an-form-actions",
        `an-form-actions--${resolvedAlign}`,
        sticky && "an-form-actions--sticky",
        className,
      )}
      {...props}
    >
      {note && <p className="an-form-actions__note">{note}</p>}
      <div className="an-form-actions__buttons">{children}</div>
    </footer>
  );
}
