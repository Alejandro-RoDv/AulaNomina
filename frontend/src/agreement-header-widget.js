import { API_BASE_URL } from "./services/httpClient";

let lastRenderedAgreementId = null;
let loadingAgreementId = null;

function isConveniosPage() {
  return Array.from(document.querySelectorAll("h2")).some((node) => node.textContent?.trim() === "Convenios colectivos");
}

function selectedAgreementId() {
  const select = Array.from(document.querySelectorAll("select")).find((node) => node.selectedOptions?.[0]?.textContent?.includes("·"));
  return select?.value || null;
}

function targetContainer() {
  const title = Array.from(document.querySelectorAll("strong")).find((node) => node.textContent?.trim() && node.parentElement?.textContent?.includes("Convenio seleccionado"));
  return title?.closest("section") || Array.from(document.querySelectorAll("section"))[0] || null;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new Error(data?.detail || `Error ${response.status}`);
  return data;
}

function renderBox(data) {
  const existing = document.querySelector("[data-agreement-header-widget='true']");
  const box = existing || document.createElement("section");
  box.dataset.agreementHeaderWidget = "true";
  box.dataset.agreementId = String(data.id);
  box.style.marginTop = "10px";
  box.style.border = "1px solid #e5e7eb";
  box.style.background = "#fff";
  box.style.padding = "12px 14px";
  box.style.display = "grid";
  box.style.gridTemplateColumns = "1.5fr 1.2fr .8fr .8fr auto";
  box.style.gap = "12px";
  box.style.alignItems = "center";

  box.innerHTML = `
    <div>
      <div style="font-size:11px;font-weight:850;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Cabecera ERP</div>
      <strong style="display:block;font-size:14px;color:#111827;">${escapeHtml(data.internal_name || data.name || "—")}</strong>
      <span style="font-size:12px;color:#6b7280;">Oficial: ${escapeHtml(data.official_name || "sin denominación oficial")}</span>
    </div>
    <div style="font-size:12px;color:#374151;"><strong>Código:</strong> ${escapeHtml(data.agreement_code || "—")}<br><strong>Ámbito:</strong> ${escapeHtml(data.territorial_scope || "—")}</div>
    <div style="font-size:12px;color:#374151;"><strong>Prorrogable</strong><br>${data.is_extendable ? "Sí" : "No"}</div>
    <div style="font-size:12px;color:#374151;"><strong>Alertas BOE</strong><br>${data.boe_alerts_enabled ? "Activas" : "No activas"}</div>
    <button type="button" data-edit-header style="height:32px;border:1px solid #111827;background:#111827;color:#fff;font-weight:850;padding:0 12px;cursor:pointer;">Editar</button>
  `;

  box.querySelector("[data-edit-header]")?.addEventListener("click", () => editHeader(data).catch((error) => window.alert(error.message)));
  return box;
}

async function editHeader(current) {
  const officialName = window.prompt("Denominación oficial", current.official_name || current.name || "");
  if (officialName === null) return;
  const internalName = window.prompt("Denominación interna ERP", current.internal_name || current.name || "");
  if (internalName === null) return;
  const isExtendable = window.confirm("¿Convenio prorrogable? Aceptar = Sí / Cancelar = No");
  const boeAlertsEnabled = window.confirm("¿Activar alertas BOE preparadas? Aceptar = Sí / Cancelar = No");
  const boeSearchTerms = window.prompt("Términos de búsqueda BOE", current.boe_search_terms || current.official_name || current.name || "");
  if (boeSearchTerms === null) return;
  const sourceUrl = window.prompt("URL fuente BOE/convenio", current.source_url || "");
  if (sourceUrl === null) return;

  await requestJson(`/collective-agreements/${current.id}/header`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      official_name: officialName || null,
      internal_name: internalName || null,
      is_extendable: isExtendable,
      boe_alerts_enabled: boeAlertsEnabled,
      boe_search_terms: boeSearchTerms || null,
      source_url: sourceUrl || null,
    }),
  });
  lastRenderedAgreementId = null;
  ensureAgreementHeader();
}

async function ensureAgreementHeader() {
  if (!isConveniosPage()) return;
  const agreementId = selectedAgreementId();
  if (!agreementId || agreementId === loadingAgreementId || agreementId === lastRenderedAgreementId) return;

  const container = targetContainer();
  if (!container) return;

  loadingAgreementId = agreementId;
  try {
    const data = await requestJson(`/collective-agreements/${agreementId}/header`);
    const box = renderBox(data);
    const existing = document.querySelector("[data-agreement-header-widget='true']");
    if (existing && existing !== box) existing.remove();
    if (!box.parentElement) container.insertAdjacentElement("afterend", box);
    lastRenderedAgreementId = agreementId;
  } catch (error) {
    console.warn("No se pudo cargar cabecera ERP", error);
  } finally {
    loadingAgreementId = null;
  }
}

function bindSelectChange() {
  const select = Array.from(document.querySelectorAll("select")).find((node) => node.selectedOptions?.[0]?.textContent?.includes("·"));
  if (!select || select.dataset.headerWidgetBound === "true") return;
  select.dataset.headerWidgetBound = "true";
  select.addEventListener("change", () => {
    lastRenderedAgreementId = null;
    document.querySelector("[data-agreement-header-widget='true']")?.remove();
    setTimeout(ensureAgreementHeader, 120);
  });
}

const observer = new MutationObserver(() => {
  window.requestAnimationFrame(() => {
    bindSelectChange();
    ensureAgreementHeader();
  });
});

observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("load", () => {
  bindSelectChange();
  ensureAgreementHeader();
});
setTimeout(() => {
  bindSelectChange();
  ensureAgreementHeader();
}, 350);
