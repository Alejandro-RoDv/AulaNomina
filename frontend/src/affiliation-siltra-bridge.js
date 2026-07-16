const AFFILIATION_EVENT = "aulanomina-open-affiliation-remittances";

function isAffiliationAction(button) {
  const label = String(button?.textContent || "").replace(/\s+/g, " ").trim();
  return label.startsWith("Procesar remesas Afiliación");
}

function openAffiliationWorkspace(event) {
  const button = event.target instanceof Element ? event.target.closest("button") : null;
  if (!button || !isAffiliationAction(button)) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  window.dispatchEvent(new Event(AFFILIATION_EVENT));
}

document.addEventListener("click", openAffiliationWorkspace, true);
