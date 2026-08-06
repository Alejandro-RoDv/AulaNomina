import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

import Button from "./Button.jsx";
import "./dialog.css";

const DIALOG_SIZES = new Set(["sm", "md", "lg", "xl"]);
const DRAWER_SIZES = new Set(["sm", "md", "lg"]);
const DRAWER_SIDES = new Set(["left", "right"]);

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

function getFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(
    "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
  )].filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
}

function useOverlayLifecycle({
  open,
  onClose,
  closeOnEscape,
  panelRef,
  initialFocusRef,
}) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;

    const previousActiveElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const requestedElement = initialFocusRef?.current;
      const focusableElements = getFocusableElements(panelRef.current);
      const target = requestedElement || focusableElements[0] || panelRef.current;
      target?.focus?.();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;
      const focusableElements = getFocusableElements(panelRef.current);
      if (!focusableElements.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus?.();
    };
  }, [closeOnEscape, initialFocusRef, open, panelRef]);
}

function Overlay({
  children,
  className = "",
  onClose,
  closeOnBackdrop,
  labelledBy,
}) {
  const handleBackdropPointerDown = (event) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
  };

  return (
    <div
      className={joinClassNames("an-overlay", className)}
      onMouseDown={handleBackdropPointerDown}
      aria-labelledby={labelledBy}
    >
      {children}
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description = "",
  children,
  footer = null,
  size = "md",
  className = "",
  closeOnBackdrop = true,
  closeOnEscape = true,
  showClose = true,
  initialFocusRef = null,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const resolvedSize = DIALOG_SIZES.has(size) ? size : "md";

  useOverlayLifecycle({ open, onClose, closeOnEscape, panelRef, initialFocusRef });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <Overlay
      className="an-overlay--dialog"
      onClose={onClose}
      closeOnBackdrop={closeOnBackdrop}
      labelledBy={titleId}
    >
      <section
        ref={panelRef}
        className={joinClassNames("an-dialog", `an-dialog--${resolvedSize}`, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="an-dialog__header">
          <div className="an-dialog__heading">
            <h2 className="an-dialog__title" id={titleId}>{title}</h2>
            {description && (
              <p className="an-dialog__description" id={descriptionId}>{description}</p>
            )}
          </div>
          {showClose && (
            <button
              type="button"
              className="an-dialog__close"
              onClick={onClose}
              aria-label="Cerrar diálogo"
            >
              <X aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="an-dialog__body">{children}</div>
        {footer && <footer className="an-dialog__footer">{footer}</footer>}
      </section>
    </Overlay>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children = null,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  loading = false,
}) {
  const isDanger = tone === "danger";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      closeOnBackdrop={!loading}
      closeOnEscape={!loading}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button
            variant={isDanger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <div className={joinClassNames("an-confirm-dialog", `an-confirm-dialog--${tone}`)}>
        <span className="an-confirm-dialog__icon" aria-hidden="true">
          <AlertTriangle />
        </span>
        <div className="an-confirm-dialog__content">
          <strong>{isDanger ? "Esta acción no se puede deshacer" : "Revisa la operación antes de continuar"}</strong>
          {children && <div className="an-confirm-dialog__details">{children}</div>}
        </div>
      </div>
    </Dialog>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  description = "",
  children,
  footer = null,
  size = "md",
  side = "right",
  className = "",
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef = null,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const resolvedSize = DRAWER_SIZES.has(size) ? size : "md";
  const resolvedSide = DRAWER_SIDES.has(side) ? side : "right";

  useOverlayLifecycle({ open, onClose, closeOnEscape, panelRef, initialFocusRef });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <Overlay
      className={joinClassNames("an-overlay--drawer", `an-overlay--drawer-${resolvedSide}`)}
      onClose={onClose}
      closeOnBackdrop={closeOnBackdrop}
      labelledBy={titleId}
    >
      <aside
        ref={panelRef}
        className={joinClassNames(
          "an-drawer",
          `an-drawer--${resolvedSize}`,
          `an-drawer--${resolvedSide}`,
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="an-drawer__header">
          <div className="an-drawer__heading">
            <h2 className="an-drawer__title" id={titleId}>{title}</h2>
            {description && (
              <p className="an-drawer__description" id={descriptionId}>{description}</p>
            )}
          </div>
          <button
            type="button"
            className="an-dialog__close"
            onClick={onClose}
            aria-label="Cerrar panel"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="an-drawer__body">{children}</div>
        {footer && <footer className="an-drawer__footer">{footer}</footer>}
      </aside>
    </Overlay>,
    document.body,
  );
}