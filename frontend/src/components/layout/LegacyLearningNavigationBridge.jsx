import { useEffect } from "react";

const HIDDEN_GROUPS = new Set(["Formación", "Docencia"]);

function hideLegacyLearningGroups() {
  document.querySelectorAll(".an-sidebar__group").forEach((section) => {
    const label = section.querySelector(".an-sidebar__group-label span:last-child")?.textContent?.trim();
    if (HIDDEN_GROUPS.has(label)) section.hidden = true;
  });
}

export default function LegacyLearningNavigationBridge() {
  useEffect(() => {
    hideLegacyLearningGroups();
    const observer = new MutationObserver(hideLegacyLearningGroups);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
