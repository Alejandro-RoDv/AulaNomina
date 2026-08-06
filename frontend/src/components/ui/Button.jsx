const BUTTON_VARIANTS = new Set(["primary", "secondary", "ghost", "danger"]);
const BUTTON_SIZES = new Set(["sm", "md", "lg"]);

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

export default function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  icon = null,
  iconPosition = "start",
  loading = false,
  fullWidth = false,
  disabled = false,
  type = "button",
  ...props
}) {
  const resolvedVariant = BUTTON_VARIANTS.has(variant) ? variant : "primary";
  const resolvedSize = BUTTON_SIZES.has(size) ? size : "md";
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={joinClassNames(
        "an-button",
        `an-button--${resolvedVariant}`,
        `an-button--${resolvedSize}`,
        fullWidth && "an-button--full-width",
        loading && "an-button--loading",
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="an-button__spinner" aria-hidden="true" />}
      {!loading && icon && iconPosition === "start" && (
        <span className="an-button__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="an-button__label">{children}</span>
      {!loading && icon && iconPosition === "end" && (
        <span className="an-button__icon" aria-hidden="true">
          {icon}
        </span>
      )}
    </button>
  );
}
