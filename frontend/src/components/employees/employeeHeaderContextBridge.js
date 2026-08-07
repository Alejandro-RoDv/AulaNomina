const HEADER_EVENT = "aulanomina-header-context";

const EMPLOYEE_CONTEXTS = {
  "Listado de trabajadores": {
    eyebrow: "Personas",
    title: "Listado de trabajadores",
    subtitle: "Consulta y mantenimiento operativo de la plantilla",
  },
  "Expediente del trabajador": {
    eyebrow: "Personas",
    title: "Expediente del trabajador",
    subtitle: "Datos personales, relación laboral, nóminas y documentación",
  },
  "Nuevo trabajador": {
    eyebrow: "Personas",
    title: "Nuevo trabajador",
    subtitle: "Alta de datos personales y administrativos del trabajador",
  },
};

let lastEmployeeContext = "";
let suppressUntil = 0;
let syncTimer = null;

function dispatchContext(detail) {
  window.dispatchEvent(new CustomEvent(HEADER_EVENT, { detail }));
}

function syncEmployeeContext() {
  if (Date.now() < suppressUntil) return;
  const title = document.querySelector("main .an-page-card__title")?.textContent?.trim();
  const context = EMPLOYEE_CONTEXTS[title];
  if (!context || lastEmployeeContext === title) return;
  lastEmployeeContext = title;
  dispatchContext(context);
}

function resetContext() {
  suppressUntil = Date.now() + 120;
  lastEmployeeContext = "";
  dispatchContext(null);
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(syncEmployeeContext, 150);
}

if (typeof window !== "undefined" && !window.__aulanominaEmployeeHeaderContextBridge) {
  window.__aulanominaEmployeeHeaderContextBridge = true;

  document.addEventListener("click", (event) => {
    if (event.target.closest(".an-sidebar button")) resetContext();
  }, true);

  window.addEventListener("aulanomina-open-page", resetContext);

  const observer = new MutationObserver(syncEmployeeContext);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setTimeout(syncEmployeeContext, 0);
}
