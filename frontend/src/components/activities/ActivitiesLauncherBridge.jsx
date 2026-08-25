import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import ActivitiesCenter from "./ActivitiesCenter";
import TrainingActivityAssist from "./TrainingActivityAssist";
import TrainingModuleCompletion from "./TrainingModuleCompletion";
import TrainingOnboarding from "./TrainingOnboarding";
import TrainingProgress from "./TrainingProgress";

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
  slot.style.gap = "8px";

  const mailSlot = parent.querySelector(".mail-launcher-slot");
  parent.insertBefore(slot, mailSlot || siltraLauncher);
  return slot;
}

function clarifyCourseLauncher() {
  const launcher = document.querySelector(".activities-global-launcher");
  if (!(launcher instanceof HTMLElement)) return;

  const label = launcher.querySelector(":scope > span");
  if (label && label.textContent !== "Continuar curso") {
    label.textContent = "Continuar curso";
  }
  launcher.setAttribute("aria-label", "Continuar curso y abrir la actividad actual");
  launcher.setAttribute("title", "Abre las actividades del curso para seguir trabajando");
}

export default function ActivitiesLauncherBridge() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const syncBridge = () => {
      const slot = createLauncherSlot();
      if (slot) setTarget(slot);
      clarifyCourseLauncher();
    };

    const resetActivityDetailScroll = () => {
      const detail = document.querySelector(".activity-center__detail");
      if (detail) detail.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    syncBridge();
    const observer = new MutationObserver(syncBridge);
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
      <TrainingActivityAssist />
      <TrainingModuleCompletion />
      {target ? createPortal(
        <>
          <ActivitiesCenter />
          <TrainingProgress />
        </>,
        target
      ) : null}
    </>
  );
}
