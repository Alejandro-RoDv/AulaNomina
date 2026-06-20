import { useEffect, useRef } from "react";

import "./companyDetailUx.css";

export default function EmbeddedCompanyPanel({
  children,
  className = "",
  onDirtyChange,
  successTexts = [],
  dirtyButtonTexts = [],
  ignoreChangeSelector = "",
}) {
  const rootRef = useRef(null);
  const dirtyRef = useRef(false);
  const isBankingPanel = className.includes("company-embedded-banking");
  const resetTexts = isBankingPanel
    ? successTexts.filter((text) => text.includes("Cuenta bancaria añadida"))
    : successTexts;

  const setDirty = (value) => {
    if (dirtyRef.current === value) return;
    dirtyRef.current = value;
    onDirtyChange?.(value);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !resetTexts.length) return undefined;

    const observer = new MutationObserver(() => {
      const text = root.textContent || "";
      if (resetTexts.some((successText) => text.includes(successText))) {
        setDirty(false);
      }
    });

    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [resetTexts.join("|")]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const handleChangeCapture = (event) => {
    const selector = ignoreChangeSelector || (isBankingPanel ? ".banking-table" : "");
    if (selector && event.target?.closest?.(selector)) return;
    setDirty(true);
  };

  const handleClickCapture = (event) => {
    const label = event.target?.textContent?.trim() || "";
    if (dirtyButtonTexts.some((text) => label.includes(text))) setDirty(true);
  };

  return (
    <div
      ref={rootRef}
      className={className}
      onChangeCapture={handleChangeCapture}
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
  );
}
