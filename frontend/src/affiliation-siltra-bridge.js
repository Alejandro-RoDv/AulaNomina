const AFFILIATION_EVENT = "aulanomina-open-siltra-affiliation";

function isAffiliationAction(button) {
  const label = String(button?.textContent || "").replace(/\s+/g, " ").trim();
  return label.startsWith("Procesar remesas Afiliación");
}

function openAffiliationWorkspace(event) {
  const button = event.target instanceof Element ? event.target.closest("button") : null;
  if (!button || !isAffiliationAction(button)) return;

  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(AFFILIATION_EVENT, { detail: { draftId: null } }));
  }, 0);
}

document.addEventListener("click", openAffiliationWorkspace, true);
