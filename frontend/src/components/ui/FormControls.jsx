import { Children, cloneElement, forwardRef, isValidElement, useId } from "react";

import "./form-controls.css";

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

export function Field({
  children,
  label,
  hint = "",
  error = "",
  required = false,
  id,
  className = "",
}) {
  const generatedId = useId();
  const child = Children.only(children);
  const childId = isValidElement(child) ? child.props.id : undefined;
  const childDescribedBy = isValidElement(child) ? child.props["aria-describedby"] : undefined;
  const fieldId = id || childId || generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [childDescribedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(child)
    ? cloneElement(child, {
        id: fieldId,
        required: required || child.props.required,
        "aria-required": required || child.props["aria-required"] || undefined,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : child.props["aria-invalid"],
      })
    : child;

  return (
    <div className={joinClassNames("an-field", error && "an-field--error", className)}>
      <label className="an-field__label" htmlFor={fieldId}>
        <span className="an-field__label-row">
          <span>{label}</span>
          {required && <span className="an-field__required">Obligatorio</span>}
        </span>
        {control}
      </label>
      {hint && (
        <p className="an-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="an-field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { className = "", invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={joinClassNames("an-control", "an-input", className)}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select(
  { children, className = "", invalid = false, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={joinClassNames("an-control", "an-select", className)}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      {...props}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea(
  { className = "", invalid = false, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={joinClassNames("an-control", "an-textarea", className)}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      {...props}
    />
  );
});