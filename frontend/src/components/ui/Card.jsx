function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

export function Card({
  as: Component = "section",
  children,
  className = "",
  variant = "default",
  padding = "md",
  ...props
}) {
  return (
    <Component
      className={joinClassNames(
        "an-card",
        `an-card--${variant}`,
        `an-card--padding-${padding}`,
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ children, actions = null, className = "", ...props }) {
  return (
    <header className={joinClassNames("an-card__header", className)} {...props}>
      <div className="an-card__heading">{children}</div>
      {actions && <div className="an-card__actions">{actions}</div>}
    </header>
  );
}

export function CardTitle({ as: Component = "h3", children, className = "", ...props }) {
  return (
    <Component className={joinClassNames("an-card__title", className)} {...props}>
      {children}
    </Component>
  );
}

export function CardDescription({ children, className = "", ...props }) {
  return (
    <p className={joinClassNames("an-card__description", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = "", ...props }) {
  return (
    <div className={joinClassNames("an-card__content", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = "", ...props }) {
  return (
    <footer className={joinClassNames("an-card__footer", className)} {...props}>
      {children}
    </footer>
  );
}
