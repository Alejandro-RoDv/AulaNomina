import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import ActivitiesCenter from "./ActivitiesCenter";
import TrainingOnboarding from "./TrainingOnboarding";

function createLauncherSlot() {
  const siltraLauncher = document.querySelector(".siltra-global-launcher");
  const parent = siltraLauncher?.parentElement;
  if (!siltraLauncher || !parent) return null;

  const existing = parent.querySelector(".activities-launcher-slot");
  if (existing) return existing;

  const slot = document.createElement("span");
  slot.className = "activities-launcher-slot";
  slot.style.display = "inline-flex";
  slot.style.alignItems = "center";

  const mailSlot = parent.querySelector(".mail-launcher-slot");
  parent.insertBefore(slot, mailSlot || siltraLauncher);
  return slot;
}

export default function ActivitiesLauncherBridge() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const mountLauncher = () => {
      const slot = createLauncherSlot();
      if (slot) setTarget(slot);
    };

    const resetActivityDetailScroll = () => {
      const detail = document.querySelector(".activity-center__detail");
      if (detail) detail.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    mountLauncher();
    const observer = new MutationObserver(mountLauncher);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("aulanomina-case-context", resetActivityDetailScroll);

    return () => {
      observer.disconnect();
      window.removeEventListener("aulanomina-case-context", resetActivityDetailScroll);
      document.querySelector(".activities-launcher-slot")?.remove();
    };
  }, []);

  return (
    <>
      <TrainingOnboarding />
      {target ? createPortal(<ActivitiesCenter />, target) : null}
    </>
  );
}
