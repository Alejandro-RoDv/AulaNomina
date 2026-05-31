function isConveniosPage() {
  return Array.from(document.querySelectorAll("h2")).some((node) => node.textContent?.trim() === "Convenios colectivos");
}

function findSectionByTitle(title) {
  const heading = Array.from(document.querySelectorAll("h3")).find((node) => node.textContent?.trim() === title);
  return heading?.closest("section") || null;
}

function readAlertsFromOverview() {
  const alertTitle = Array.from(document.querySelectorAll("h4")).find((node) => node.textContent?.trim() === "Alertas");
  const alertBlock = alertTitle?.parentElement || null;
  const items = alertBlock ? Array.from(alertBlock.querySelectorAll("li")).map((node) => node.textContent.trim()).filter(Boolean) : [];
  if (alertBlock) alertBlock.style.display = "none";
  return items;
}

function styleButtonAsTab(button, active = false) {
  button.style.border = "0";
  button.style.borderBottom = active ? "2px solid #facc15" : "2px solid transparent";
  button.style.backgroundColor = "#fff";
  button.style.padding = "10px 13px";
  button.style.color = active ? "#111827" : "#4b5563";
  button.style.fontSize = "14.5px";
  button.style.fontWeight = active ? "850" : "750";
  button.style.cursor = "pointer";
}

function applyModuleFontSize() {
  const title = Array.from(document.querySelectorAll("h2")).find((node) => node.textContent?.trim() === "Convenios colectivos");
  const root = title?.closest("main") || title?.parentElement?.parentElement;
  if (!root) return;
  root.style.fontSize = "14.5px";

  root.querySelectorAll("button, input, select, textarea, table, td, th, p, span, label").forEach((node) => {
    const current = Number.parseFloat(window.getComputedStyle(node).fontSize);
    if (Number.isFinite(current) && current < 13.5) node.style.fontSize = "13.5px";
  });
}

function applyRecordActionsBox() {
  const recordTitle = Array.from(document.querySelectorAll("span")).find((node) => node.textContent?.trim() === "CONVENIO SELECCIONADO");
  const record = recordTitle?.closest("section");
  if (!record) return;

  record.style.gridTemplateColumns = "minmax(240px, 1.15fr) repeat(3, minmax(130px, 0.55fr)) minmax(300px, auto)";
  record.style.alignItems = "center";
  record.style.minHeight = "92px";
  record.style.gap = "14px";

  const actions = Array.from(record.querySelectorAll("div")).find((div) => {
    const text = div.textContent || "";
    return text.includes("Nuevo") && text.includes("Duplicar") && text.includes("Activar") && text.includes("Caducar");
  });
  if (!actions) return;

  actions.style.display = "flex";
  actions.style.justifyContent = "center";
  actions.style.alignItems = "center";
  actions.style.gap = "8px";
  actions.style.flexWrap = "wrap";
  actions.style.alignSelf = "center";
  actions.style.justifySelf = "end";
  actions.style.minWidth = "300px";
  actions.style.padding = "10px 12px";
  actions.style.border = "1px solid #d1d5db";
  actions.style.background = "#f9fafb";
  actions.style.boxShadow = "inset 3px 0 0 #facc15";

  actions.querySelectorAll("button").forEach((button) => {
    button.style.height = "32px";
    button.style.padding = "0 11px";
    button.style.border = "1px solid #d1d5db";
    button.style.borderRadius = "5px";
    button.style.background = "#ffffff";
    button.style.color = "#111827";
    button.style.fontSize = "13.5px";
    button.style.fontWeight = "800";
    button.style.textDecoration = "none";
    button.style.cursor = "pointer";
  });
}

function applyControlLayout() {
  const section = findSectionByTitle("Control del convenio");
  if (!section) return;
  const blocks = Array.from(section.children).filter((node) => node.tagName !== "HEADER");
  const stats = blocks[0];
  if (!stats) return;

  stats.style.display = "grid";
  stats.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  stats.style.columnGap = "24px";
  stats.style.rowGap = "0";
  stats.style.padding = "8px 12px 14px";
  stats.style.alignItems = "start";

  Array.from(stats.children).forEach((row) => {
    row.style.display = "grid";
    row.style.gridTemplateColumns = "150px minmax(0, 1fr)";
    row.style.justifyContent = "start";
    row.style.alignItems = "center";
    row.style.minHeight = "38px";
    row.style.padding = "0";
    row.style.border = "0";
    row.style.borderBottom = "1px solid #f3f4f6";
    row.style.background = "#fff";
    row.style.fontSize = "14px";
    row.style.gap = "10px";
  });

  Array.from(stats.children).forEach((row) => {
    const strong = row.querySelector("strong");
    const span = row.querySelector("span");
    if (span) {
      span.style.order = "1";
      span.style.color = "#374151";
      span.style.fontSize = "14px";
      span.style.fontWeight = "500";
    }
    if (strong) {
      strong.style.order = "2";
      strong.style.textAlign = "left";
      strong.style.fontSize = "14px";
      strong.style.fontWeight = "850";
      strong.style.color = "#111827";
    }
  });
}

function ensureAlertsTab() {
  const nav = Array.from(document.querySelectorAll("nav")).find((node) => Array.from(node.querySelectorAll("button")).some((button) => button.textContent?.trim() === "Resumen"));
  if (!nav || nav.querySelector("[data-aulanomina-alerts-tab='true']")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Alertas";
  button.dataset.aulanominaAlertsTab = "true";
  styleButtonAsTab(button, false);
  nav.appendChild(button);

  const panel = document.createElement("section");
  panel.dataset.aulanominaAlertsPanel = "true";
  panel.style.display = "none";
  panel.style.border = "1px solid #e5e7eb";
  panel.style.backgroundColor = "#fff";
  panel.style.marginTop = "0";
  nav.insertAdjacentElement("afterend", panel);

  function renderAlertsPanel() {
    const alerts = readAlertsFromOverview();
    panel.innerHTML = `
      <header style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-bottom:1px solid #e5e7eb;padding:11px 13px;background:#f9fafb;">
        <h3 style="margin:0;font-size:17px;font-weight:850;color:#111827;">Alertas del convenio</h3>
        <p style="margin:0;color:#6b7280;font-size:13.5px;font-weight:600;">Revisiones útiles para docencia y validación.</p>
      </header>
      <div style="padding:16px 18px;">
        ${alerts.length ? `<ul style="margin:0;padding-left:18px;color:#92400e;font-size:14.5px;line-height:1.8;font-weight:750;">${alerts.map((item) => `<li>${item}</li>`).join("")}</ul>` : `<div style="color:#166534;font-size:14.5px;font-weight:750;">Sin alertas críticas.</div>`}
      </div>
    `;
  }

  button.addEventListener("click", () => {
    renderAlertsPanel();
    Array.from(nav.querySelectorAll("button")).forEach((tabButton) => styleButtonAsTab(tabButton, tabButton === button));
    Array.from(nav.parentElement.children).forEach((child) => {
      if (child === nav || child === panel) return;
      if (child.tagName === "SECTION" || child.tagName === "DIV") child.dataset.aulanominaHiddenByAlerts = "true";
    });
    document.querySelectorAll("[data-aulanomina-hidden-by-alerts='true']").forEach((node) => { node.style.display = "none"; });
    panel.style.display = "block";
  });

  Array.from(nav.querySelectorAll("button:not([data-aulanomina-alerts-tab='true'])")).forEach((tabButton) => {
    tabButton.addEventListener("click", () => {
      panel.style.display = "none";
      document.querySelectorAll("[data-aulanomina-hidden-by-alerts='true']").forEach((node) => {
        node.style.display = "";
        delete node.dataset.aulanominaHiddenByAlerts;
      });
      styleButtonAsTab(button, false);
    });
  });
}

function applyConveniosEnhancements() {
  document.body.classList.toggle("aulanomina-convenios-page", isConveniosPage());
  if (!isConveniosPage()) return;
  applyModuleFontSize();
  applyRecordActionsBox();
  applyControlLayout();
  readAlertsFromOverview();
  ensureAlertsTab();
}

const observer = new MutationObserver(() => window.requestAnimationFrame(applyConveniosEnhancements));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("load", applyConveniosEnhancements);
window.addEventListener("hashchange", applyConveniosEnhancements);
setTimeout(applyConveniosEnhancements, 250);
