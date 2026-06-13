const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function isConveniosPage() {
  return Array.from(document.querySelectorAll("h2")).some((node) => node.textContent?.trim() === "Convenios colectivos");
}

function getSelectedAgreementId() {
  const select = Array.from(document.querySelectorAll("select")).find((node) => {
    const option = node.selectedOptions?.[0];
    return option?.textContent?.includes("·") && node.value;
  });
  return select?.value || null;
}

function ensureButton() {
  if (!isConveniosPage() || document.querySelector("[data-agreement-parameterization-button='true']")) return;
  const toolbar = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Nuevo convenio")?.parentElement;
  if (!toolbar) return;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Parametrización";
  button.dataset.agreementParameterizationButton = "true";
  button.style.height = "34px";
  button.style.backgroundColor = "#111827";
  button.style.color = "#fff";
  button.style.border = "1px solid #111827";
  button.style.borderRadius = "6px";
  button.style.padding = "0 12px";
  button.style.fontWeight = "800";
  button.style.fontSize = "12px";
  button.style.cursor = "pointer";
  button.addEventListener("click", openParameterizationModal);
  toolbar.appendChild(button);
}

function createModal() {
  const existing = document.querySelector("[data-agreement-parameterization-modal='true']");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.dataset.agreementParameterizationModal = "true";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "9999";
  overlay.style.background = "rgba(17,24,39,.42)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "28px";

  const modal = document.createElement("section");
  modal.style.width = "min(1180px, 96vw)";
  modal.style.maxHeight = "88vh";
  modal.style.overflow = "auto";
  modal.style.background = "#fff";
  modal.style.border = "1px solid #d1d5db";
  modal.style.boxShadow = "0 20px 45px rgba(15,23,42,.22)";

  overlay.appendChild(modal);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return modal;
}

function renderShell(modal, title, body) {
  modal.innerHTML = `
    <header style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid #e5e7eb;background:#f9fafb;">
      <div>
        <h3 style="margin:0;font-size:18px;font-weight:850;color:#111827;">${title}</h3>
        <p style="margin:3px 0 0;color:#6b7280;font-size:13px;font-weight:600;">Reglas Cabecera → Detalle leídas desde la API de convenios.</p>
      </div>
      <button type="button" data-close-parameterization style="width:32px;height:32px;border:1px solid #d1d5db;background:#fff;font-size:20px;cursor:pointer;">×</button>
    </header>
    <div style="padding:16px;">${body}</div>
  `;
  modal.querySelector("[data-close-parameterization]")?.addEventListener("click", () => modal.parentElement?.remove());
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function renderTable(columns, rows, emptyText) {
  if (!rows.length) return `<div style="padding:16px;border:1px solid #e5e7eb;background:#f9fafb;color:#6b7280;font-weight:700;">${emptyText}</div>`;
  return `
    <div style="overflow:auto;border:1px solid #e5e7eb;background:#fff;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr>${columns.map((column) => `<th style="text-align:left;padding:9px 10px;border-bottom:1px solid #e5e7eb;background:#f9fafb;color:#374151;white-space:nowrap;">${column}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td style="padding:9px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top;">${cell}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderParameterization(data) {
  const rules = data.rule_headers || [];
  const catalog = data.concept_catalog || [];
  const salaryConcepts = data.salary_concepts || [];
  const stats = [
    ["Reglas", rules.length],
    ["Detalles", rules.reduce((sum, rule) => sum + (rule.details?.length || 0), 0)],
    ["Catálogo", catalog.length],
    ["Conceptos salariales", salaryConcepts.length],
  ];

  const statCards = stats.map(([label, value]) => `<div style="border:1px solid #e5e7eb;padding:12px;background:#fff;"><strong style="display:block;font-size:22px;color:#111827;">${value}</strong><span style="color:#6b7280;font-weight:700;font-size:12px;">${label}</span></div>`).join("");
  const ruleRows = rules.map((rule) => [escapeHtml(rule.rule_type), escapeHtml(rule.code || "—"), `<strong>${escapeHtml(rule.name)}</strong>`, escapeHtml(rule.scope), String(rule.details?.length || 0), `<code style="white-space:pre-wrap;">${escapeHtml(JSON.stringify(rule.options || {}, null, 2))}</code>`]);
  const catalogRows = catalog.map((item) => [escapeHtml(item.catalog_type), escapeHtml(item.code || "—"), `<strong>${escapeHtml(item.name)}</strong>`, escapeHtml(item.default_nature || "—"), escapeHtml(item.default_cra_code || "—"), item.is_active ? "Activo" : "Inactivo"]);
  const conceptRows = salaryConcepts.map((item) => [escapeHtml(item.character), escapeHtml(item.name), escapeHtml(item.scope), escapeHtml(item.payment_type || "—"), escapeHtml(item.calculation_type), item.contributes ? "Sí" : "No", item.taxable ? "Sí" : "No", escapeHtml(item.cra_code || "—")]);

  return `
    <div data-parameterization-forms-host="true"></div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px;">${statCards}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
      <h4 style="margin:0;font-size:15px;font-weight:850;color:#111827;">Reglas parametrizadas</h4>
      <button type="button" data-seed-parameterization style="height:32px;border:1px solid #eab308;background:#facc15;color:#111827;font-weight:850;padding:0 12px;cursor:pointer;">Cargar base</button>
    </div>
    ${renderTable(["Tipo", "Código", "Nombre", "Ámbito", "Detalles", "Opciones"], ruleRows, "Sin reglas parametrizadas.")}
    <h4 style="margin:18px 0 10px;font-size:15px;font-weight:850;color:#111827;">Catálogo de conceptos</h4>
    ${renderTable(["Catálogo", "Código", "Nombre", "Naturaleza", "CRA", "Estado"], catalogRows, "Sin conceptos en catálogo.")}
    <h4 style="margin:18px 0 10px;font-size:15px;font-weight:850;color:#111827;">Conceptos salariales asociados</h4>
    ${renderTable(["Carácter", "Denominación", "Ámbito", "Pago", "Cálculo", "Cotiza", "IRPF", "CRA"], conceptRows, "Sin conceptos salariales asociados a categorías.")}
  `;
}

function notifyParameterizationRendered(modal, agreementId, data) {
  window.dispatchEvent(
    new CustomEvent("agreement-parameterization:rendered", {
      detail: { modal, agreementId, data },
    }),
  );
}

async function openParameterizationModal() {
  const agreementId = getSelectedAgreementId();
  const modal = createModal();
  if (!agreementId) {
    renderShell(modal, "Parametrización del convenio", "<div style='color:#92400e;font-weight:800;'>Selecciona primero un convenio.</div>");
    return;
  }

  renderShell(modal, "Parametrización del convenio", "<div style='color:#6b7280;font-weight:700;'>Cargando parametrización...</div>");
  try {
    const response = await fetch(`${API_BASE_URL}/collective-agreements/${agreementId}/parameterization`);
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const data = await response.json();
    renderShell(modal, "Parametrización del convenio", renderParameterization(data));
    notifyParameterizationRendered(modal, agreementId, data);
    modal.querySelector("[data-seed-parameterization]")?.addEventListener("click", async () => {
      const seedResponse = await fetch(`${API_BASE_URL}/collective-agreements/${agreementId}/parameterization/seed`, { method: "POST" });
      if (!seedResponse.ok) throw new Error(`Error ${seedResponse.status}`);
      await openParameterizationModal();
    });
  } catch (error) {
    renderShell(modal, "Parametrización del convenio", `<div style="color:#b91c1c;font-weight:800;">${escapeHtml(error.message || "Error al cargar parametrización")}</div>`);
  }
}

const observer = new MutationObserver(() => window.requestAnimationFrame(ensureButton));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("load", ensureButton);
setTimeout(ensureButton, 250);
