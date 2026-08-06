const BADGE_TONES = new Set(["neutral", "brand", "info", "success", "warning", "danger"]);

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

export default function Badge({
  children,
  tone = "neutral",
  dot = false,
  className = "",
  ...props
}) {
  const resolvedTone = BADGE_TONES.has(tone) ? tone : "neutral";

  return (
    <span
      className={joinClassNames("an-badge", `an-badge--${resolvedTone}`, className)}
      {...props}
    >
      {dot && <span className="an-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
