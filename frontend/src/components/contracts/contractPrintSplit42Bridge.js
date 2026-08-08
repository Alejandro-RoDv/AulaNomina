const STATUS_LABELS = {
  active: "Activo",
  ended: "Finalizado",
  deleted: "Baja administrativa",
};

function pluralizeContracts(text) {
  const match = String(text || "").trim().match(/^(\d+)\s+contrato\(s\)$/i);
  if (!match) return text;
  const count = Number(match[1]);
  return `${count} ${count === 1 ? "contrato" : "contratos"}`;
}

function setTextIfChanged(node, value) {
  if (!node || node.textContent === value) return;
  node.textContent = value;
}

function refinePrintWorkspace() {
  document.querySelectorAll(".cp-module").forEach((module) => {
    const eyebrow = module.querySelector(".cp-toolbar p");
    if (eyebrow?.textContent?.includes("Split 27")) {
      setTextIfChanged(eyebrow, "DOCUMENTACIÓN CONTRACTUAL");
    }

    const previewEyebrow = module.querySelector(".cp-preview header p");
    if (previewEyebrow?.textContent?.trim() === "Previsualización HTML") {
      setTextIfChanged(previewEyebrow, "PREVISUALIZACIÓN");
    }

    const previewTitle = module.querySelector(".cp-preview header h2");
    if (previewTitle?.textContent?.trim() === "Modelo reducido de contrato") {
      setTextIfChanged(previewTitle, "Vista previa del contrato");
    }

    module.querySelectorAll(".cp-family").forEach((family) => {
      const countNode = family.querySelector(":scope > div span");
      if (countNode) {
        const pluralized = pluralizeContracts(countNode.textContent);
        setTextIfChanged(countNode, pluralized);
        const isEmpty = /^0\s+contratos?$/i.test(pluralized.trim());
        family.classList.toggle("cp-family--empty", isEmpty);
      }

      family.querySelectorAll("tbody tr").forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 7) return;
        const statusCell = cells[cells.length - 1];
        const rawStatus = statusCell.dataset.rawStatus || statusCell.textContent?.trim().toLowerCase();
        if (!STATUS_LABELS[rawStatus]) return;

        statusCell.dataset.rawStatus = rawStatus;
        setTextIfChanged(statusCell, STATUS_LABELS[rawStatus]);
        statusCell.classList.add("cp-status", `cp-status--${rawStatus}`);
      });
    });

    module.querySelectorAll(".cp-preview header span").forEach((node) => {
      setTextIfChanged(node, pluralizeContracts(node.textContent));
    });
  });
}

let scheduled = false;
let observer;

function scheduleRefinement() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    observer?.disconnect();
    refinePrintWorkspace();
    observer?.observe(document.body, { childList: true, subtree: true });
  });
}

refinePrintWorkspace();
observer = new MutationObserver(scheduleRefinement);
observer.observe(document.body, { childList: true, subtree: true });
