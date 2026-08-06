const ALERT_TONES = new Set(["info", "success", "warning", "danger"]);

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

export default function Alert({
  children,
  title = "",
  tone = "info",
  icon = null,
  actions = null,
  className = "",
  ...props
}) {
  const resolvedTone = ALERT_TONES.has(tone) ? tone : "info";

  return (
    <div
      className={joinClassNames("an-alert", `an-alert--${resolvedTone}`, className)}
      role={resolvedTone === "danger" ? "alert" : "status"}
      {...props}
    >
      {icon && (
        <span className="an-alert__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="an-alert__body">
        {title && <p className="an-alert__title">{title}</p>}
        <div className="an-alert__content">{children}</div>
      </div>
      {actions && <div className="an-alert__actions">{actions}</div>}
    </div>
  );
}
