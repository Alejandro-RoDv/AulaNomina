const HEADER_EVENT = "aulanomina-header-context";

const PAYROLL_TITLES = new Set([
  "Preparar nóminas",
  "Nómina individual",
  "Histórico de nóminas",
  "Simulación de nóminas",
  "Conceptos permanentes",
  "Historial de conceptos",
  "Nóminas",
]);

let lastPayrollTitle = "";
let suppressUntil = 0;
let syncTimer = null;

function dispatchContext(detail) {
  window.dispatchEvent(new CustomEvent(HEADER_EVENT, { detail }));
}

function syncPayrollContext() {
  if (Date.now() < suppressUntil) return;
  const titleNode = document.querySelector(".an-header__title");
  const title = titleNode?.textContent?.trim();
  if (!PAYROLL_TITLES.has(title) || lastPayrollTitle === title) return;

  const subtitle = document.querySelector(".an-header__subtitle")?.textContent?.trim() || "";
  lastPayrollTitle = title;
  dispatchContext({ eyebrow: "Nómina", title, subtitle });
}

function resetContext() {
  suppressUntil = Date.now() + 120;
  lastPayrollTitle = "";
  dispatchContext(null);
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(syncPayrollContext, 150);
}

if (typeof window !== "undefined" && !window.__aulanominaPayrollHeaderContextBridge) {
  window.__aulanominaPayrollHeaderContextBridge = true;

  document.addEventListener("click", (event) => {
    if (event.target.closest(".an-sidebar button")) resetContext();
  }, true);

  window.addEventListener("aulanomina-open-page", resetContext);

  const observer = new MutationObserver(syncPayrollContext);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.setTimeout(syncPayrollContext, 0);
}
