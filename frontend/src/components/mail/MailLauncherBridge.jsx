import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import MailGlobalLauncher from "./MailGlobalLauncher";

function createLauncherSlot() {
  const siltraLauncher = document.querySelector(".siltra-global-launcher");
  const parent = siltraLauncher?.parentElement;
  if (!siltraLauncher || !parent) return null;

  const existing = parent.querySelector(".mail-launcher-slot");
  if (existing) return existing;

  const slot = document.createElement("span");
  slot.className = "mail-launcher-slot";
  slot.style.display = "inline-flex";
  slot.style.alignItems = "center";
  parent.insertBefore(slot, siltraLauncher);
  return slot;
}

export default function MailLauncherBridge() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const mountLauncher = () => {
      const slot = createLauncherSlot();
      if (slot) setTarget(slot);
    };

    mountLauncher();
    const observer = new MutationObserver(mountLauncher);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      const slot = document.querySelector(".mail-launcher-slot");
      slot?.remove();
    };
  }, []);

  return target ? createPortal(<MailGlobalLauncher />, target) : null;
}
