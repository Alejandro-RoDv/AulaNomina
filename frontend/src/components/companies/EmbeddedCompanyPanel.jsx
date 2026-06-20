import { useEffect, useRef } from "react";

import "./companyDetailUx.css";

export default function EmbeddedCompanyPanel({
  children,
  className = "",
  onDirtyChange,
  successTexts = [],
  dirtyButtonTexts = [],
}) {
  const rootRef = useRef(null);
  const dirtyRef = useRef(false);

  const setDirty = (value) => {
    if (dirtyRef.current === value) return;
    dirtyRef.current = value;
    onDirtyChange?.(value);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !successTexts.length) return undefined;

    const observer = new MutationObserver(() => {
      const text = root.textContent || "";
      if (successTexts.some((successText) => text.includes(successText))) {
        setDirty(false);
      }
    });

    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [successTexts.join("|")]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const handleClickCapture = (event) => {
    const label = event.target?.textContent?.trim() || "";
    if (dirtyButtonTexts.some((text) => label.includes(text))) setDirty(true);
  };

  return (
    <div
      ref={rootRef}
      className={className}
      onChangeCapture={() => setDirty(true)}
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
  );
}
