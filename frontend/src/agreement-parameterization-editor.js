import { API_BASE_URL } from "./services/httpClient";

function selectedAgreementId() {
  const select = Array.from(document.querySelectorAll("select")).find((node) => node.selectedOptions?.[0]?.textContent?.includes("·"));
  return select?.value || null;
}

function modalBody() {
  return document.querySelector("[data-agreement-parameterization-modal='true'] [data-parameterization-modal-body='true']")
    || document.querySelector("[data-agreement-parameterization-modal='true'] section > div");
}

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || `Error ${response.status}`);
  }
}

function reloadModal() {
  document.querySelector("[data-agreement-parameterization-modal='true']")?.remove();
  document.querySelector("[data-agreement-parameterization-button='true']")?.click();
}

async function createRule() {
  const agreementId = selectedAgreementId();
  if (!agreementId) return;
  const ruleType = window.prompt("Tipo de regla", "custom");
  if (!ruleType) return;
  const code = window.prompt("Código", "");
  const name = window.prompt("Nombre de la regla", "Nueva regla");
  if (!name) return;
  await postJson(`/collective-agreements/${agreementId}/rule-headers`, { rule_type: ruleType, code: code || null, name, scope: "global", is_active: true, is_default: false, options: {} });
  reloadModal();
}

async function createCatalogItem() {
  const agreementId = selectedAgreementId();
  if (!agreementId) return;
  const catalogType = window.prompt("Catálogo: salary, non_salary o deduction", "salary");
  if (!catalogType) return;
  const code = window.prompt("Código", "");
  const name = window.prompt("Nombre del concepto", "Nuevo concepto");
  if (!name) return;
  const craCode = window.prompt("Código CRA opcional", "");
  await postJson(`/collective-agreements/${agreementId}/concept-catalog`, { catalog_type: catalogType, code: code || null, name, default_cra_code: craCode || null, default_contributes: true, default_taxable: true, is_active: true });
  reloadModal();
}

function ensureEditor() {
  const body = modalBody();
  if (!body || body.querySelector("[data-parameterization-editor='true']")) return;

  const box = document.createElement("div");
  box.dataset.parameterizationEditor = "true";
  box.style.display = "flex";
  box.style.flexWrap = "wrap";
  box.style.gap = "8px";
  box.style.alignItems = "center";
  box.style.margin = "0 0 14px";
  box.style.padding = "10px";
  box.style.border = "1px solid #e5e7eb";
  box.style.background = "#f9fafb";
  box.style.minWidth = "0";
  box.style.boxSizing = "border-box";
  box.innerHTML = `<strong style="font-size:13px;color:#111827;margin-right:auto;min-width:160px;">Edición rápida</strong><button type="button" data-new-rule>+ Regla</button><button type="button" data-new-catalog>+ Concepto catálogo</button>`;
  box.querySelectorAll("button").forEach((button) => {
    button.style.minHeight = "30px";
    button.style.border = "1px solid #111827";
    button.style.background = "#111827";
    button.style.color = "#fff";
    button.style.fontWeight = "800";
    button.style.cursor = "pointer";
    button.style.padding = "5px 9px";
    button.style.whiteSpace = "normal";
  });
  box.querySelector("[data-new-rule]")?.addEventListener("click", () => createRule().catch((error) => window.alert(error.message)));
  box.querySelector("[data-new-catalog]")?.addEventListener("click", () => createCatalogItem().catch((error) => window.alert(error.message)));
  body.prepend(box);
}

const observer = new MutationObserver(() => window.requestAnimationFrame(ensureEditor));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("load", ensureEditor);
