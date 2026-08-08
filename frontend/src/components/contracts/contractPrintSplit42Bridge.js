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

function refinePrintWorkspace() {
  document.querySelectorAll(".cp-module").forEach((module) => {
    const eyebrow = module.querySelector(".cp-toolbar p");
    if (eyebrow && eyebrow.textContent?.includes("Split 27")) {
      eyebrow.textContent = "DOCUMENTACIÓN CONTRACTUAL";
    }

    const previewEyebrow = module.querySelector(".cp-preview header p");
    if (previewEyebrow?.textContent?.trim() === "Previsualización HTML") {
      previewEyebrow.textContent = "PREVISUALIZACIÓN";
    }

    const previewTitle = module.querySelector(".cp-preview header h2");
    if (previewTitle?.textContent?.trim() === "Modelo reducido de contrato") {
      previewTitle.textContent = "Vista previa del contrato";
    }

    module.querySelectorAll(".cp-family").forEach((family) => {
      const countNode = family.querySelector(":scope > div span");
      if (countNode) {
        countNode.textContent = pluralizeContracts(countNode.textContent);
        const isEmpty = /^0\s+contratos?$/i.test(countNode.textContent.trim());
        family.classList.toggle("cp-family--empty", isEmpty);
      }

      family.querySelectorAll("tbody tr").forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 7) return;
        const statusCell = cells[cells.length - 1];
        const rawStatus = statusCell.textContent?.trim().toLowerCase();
        if (!STATUS_LABELS[rawStatus]) return;

        statusCell.textContent = STATUS_LABELS[rawStatus];
        statusCell.classList.add("cp-status", `cp-status--${rawStatus}`);
      });
    });

    module.querySelectorAll(".cp-preview header span").forEach((node) => {
      node.textContent = pluralizeContracts(node.textContent);
    });
  });
}

refinePrintWorkspace();

const observer = new MutationObserver(refinePrintWorkspace);
observer.observe(document.body, { childList: true, subtree: true });
