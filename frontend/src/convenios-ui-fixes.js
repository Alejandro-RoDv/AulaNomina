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
  button.style.padding = "9px 12px";
  button.style.color = active ? "#111827" : "#4b5563";
  button.style.fontSize = "14px";
  button.style.fontWeight = active ? "850" : "750";
  button.style.cursor = "pointer";
}

function applyControlLayout() {
  const section = findSectionByTitle("Control del convenio");
  if (!section) return;
  const blocks = Array.from(section.children).filter((node) => node.tagName !== "HEADER");
  const stats = blocks[0];
  if (!stats) return;

  stats.style.display = "grid";
  stats.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  stats.style.gap = "0 28px";
  stats.style.padding = "10px 12px 14px";

  Array.from(stats.children).forEach((row) => {
    row.style.display = "flex";
    row.style.flexDirection = "row";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.minHeight = "38px";
    row.style.padding = "0";
    row.style.border = "0";
    row.style.borderBottom = "1px solid #f3f4f6";
    row.style.background = "#fff";
    row.style.fontSize = "14px";
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
      <header style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-bottom:1px solid #e5e7eb;padding:10px 12px;background:#f9fafb;">
        <h3 style="margin:0;font-size:16px;font-weight:850;color:#111827;">Alertas del convenio</h3>
        <p style="margin:0;color:#6b7280;font-size:13px;font-weight:600;">Revisiones útiles para docencia y validación.</p>
      </header>
      <div style="padding:14px 16px;">
        ${alerts.length ? `<ul style="margin:0;padding-left:18px;color:#92400e;font-size:14px;line-height:1.8;font-weight:750;">${alerts.map((item) => `<li>${item}</li>`).join("")}</ul>` : `<div style="color:#166534;font-size:14px;font-weight:750;">Sin alertas críticas.</div>`}
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
  applyControlLayout();
  readAlertsFromOverview();
  ensureAlertsTab();
}

const observer = new MutationObserver(() => window.requestAnimationFrame(applyConveniosEnhancements));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("load", applyConveniosEnhancements);
window.addEventListener("hashchange", applyConveniosEnhancements);
setTimeout(applyConveniosEnhancements, 250);
