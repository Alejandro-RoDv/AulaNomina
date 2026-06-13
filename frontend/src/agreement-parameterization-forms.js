import { API_BASE_URL } from "./services/httpClient";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function bool(value) {
  return value === true || value === "true" || value === "on";
}

function nullableNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new Error(data?.detail || `Error ${response.status}`);
  return data;
}

function findRule(data, code) {
  return (data.rule_headers || []).find((rule) => rule.code === code) || null;
}

function input(name, label, value = "") {
  return `<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:800;color:#374151;min-width:0;">${label}<input name="${name}" type="text" value="${escapeHtml(value ?? "")}" style="width:100%;height:30px;box-sizing:border-box;border:1px solid #d1d5db;padding:0 8px;font-size:12px;background:#fff;min-width:0;"></label>`;
}

function checkbox(name, label, checked = false) {
  return `<label style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:#374151;min-width:0;overflow-wrap:anywhere;"><input name="${name}" type="checkbox" ${checked ? "checked" : ""}>${label}</label>`;
}

function select(name, label, value, options) {
  return `<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:800;color:#374151;min-width:0;">${label}<select name="${name}" style="width:100%;height:32px;box-sizing:border-box;border:1px solid #d1d5db;padding:0 8px;font-size:12px;background:#fff;min-width:0;">${options.map(([optionValue, text]) => `<option value="${escapeHtml(optionValue)}" ${String(optionValue) === String(value ?? "") ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></label>`;
}

function card(title, rule, inner) {
  if (!rule) {
    return `<section style="border:1px solid #e5e7eb;background:#fff;padding:12px;min-width:0;box-sizing:border-box;"><h4 style="margin:0 0 8px;font-size:14px;font-weight:850;color:#111827;">${title}</h4><p style="margin:0;color:#92400e;font-size:12px;font-weight:700;">Regla no encontrada. Pulsa primero Cargar base.</p></section>`;
  }
  return `<form data-rule-code="${escapeHtml(rule.code)}" data-rule-id="${rule.id}" style="border:1px solid #e5e7eb;background:#fff;padding:12px;display:grid;gap:9px;min-width:0;box-sizing:border-box;"><h4 style="margin:0;font-size:14px;font-weight:850;color:#111827;">${title}</h4>${inner}<button type="submit" style="width:100%;min-height:30px;border:1px solid #111827;background:#111827;color:#fff;font-weight:850;cursor:pointer;padding:5px 8px;">Guardar</button></form>`;
}

function renderForms(data) {
  const global = findRule(data, "GLOBAL");
  const smi = findRule(data, "SMI_IPREM");
  const vacation = findRule(data, "VAC_AUTO");
  const extra = findRule(data, "PEXTRA");
  const seniority = findRule(data, "ANT");
  const it = findRule(data, "IT");
  const twoColumnFields = "display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;min-width:0;";

  return `
    <div data-parameterization-forms="true" style="margin:0 0 14px;border:1px solid #d1d5db;background:#f9fafb;padding:12px;box-sizing:border-box;min-width:0;">
      <div style="margin-bottom:10px;min-width:0;">
        <strong style="font-size:14px;color:#111827;">Bloques rápidos de parametrización</strong>
        <p style="margin:2px 0 0;color:#6b7280;font-size:12px;font-weight:650;overflow-wrap:anywhere;">Edita opciones principales guardadas como reglas del convenio. Aún no generan cálculo automático de nómina.</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;min-width:0;">
        ${card("Opciones globales", global, `${checkbox("prorratear_pagas_extra", "Prorratear pagas extra", global?.options?.prorratear_pagas_extra)}${checkbox("boe_alerts_prepared", "Preparado para alertas BOE", global?.options?.boe_alerts_prepared)}`)}
        ${card("SMI / IPREM", smi, `<div style="${twoColumnFields}">${input("smi_diario", "SMI diario", smi?.options?.smi_diario)}${input("smi_mensual", "SMI mensual", smi?.options?.smi_mensual)}${input("iprem_diario", "IPREM diario", smi?.options?.iprem_diario)}${input("iprem_mensual", "IPREM mensual", smi?.options?.iprem_mensual)}</div>`)}
        ${card("Vacaciones", vacation, `<div style="${twoColumnFields}">${input("numero_dias", "Número de días", vacation?.options?.numero_dias)}${select("tipo_dias", "Tipo de días", vacation?.options?.tipo_dias, [["naturales", "Naturales"], ["laborables", "Laborables"]])}</div>${checkbox("devenga_it", "Devenga durante IT", vacation?.options?.devenga_it)}${checkbox("cotizacion", "Cotiza", vacation?.options?.cotizacion)}${checkbox("computo_diario", "Cómputo diario", vacation?.options?.computo_diario)}`)}
        ${card("Pagas extra", extra, `<div style="${twoColumnFields}">${input("codigo_cra", "Código CRA", extra?.options?.codigo_cra)}${input("pagas", "Pagas", (extra?.options?.pagas || []).join(", "))}</div>${checkbox("prorrateo", "Prorrateo", extra?.options?.prorrateo)}${checkbox("cotizacion", "Cotiza", extra?.options?.cotizacion)}${checkbox("devenga_it", "Devenga IT", extra?.options?.devenga_it)}`)}
        ${card("Antigüedad", seniority, `${select("forma_pago", "Forma de pago", seniority?.options?.forma_pago, [["mensual", "Mensual"], ["paga_extra", "Paga extra"], ["anual", "Anual"]])}${select("criterio_devengo", "Criterio devengo", seniority?.options?.criterio_devengo, [["fecha_antiguedad", "Fecha antigüedad"], ["fecha_alta", "Fecha alta"], ["manual", "Manual"]])}${checkbox("computo_diario", "Cómputo diario", seniority?.options?.computo_diario)}${checkbox("salto_mes_baja", "Salto en mes de baja", seniority?.options?.salto_mes_baja)}`)}
        ${card("Complementos IT", it, `<div style="${twoColumnFields}">${input("tramos", "Número de tramos", it?.options?.tramos)}${input("limite_general", "Límite general", it?.options?.limites?.general || "")}</div><label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:800;color:#374151;min-width:0;">Diagnósticos<textarea name="diagnosticos" style="width:100%;min-height:54px;box-sizing:border-box;border:1px solid #d1d5db;padding:7px;font-size:12px;min-width:0;">${escapeHtml((it?.options?.diagnosticos || []).join(", "))}</textarea></label>`)}
      </div>
    </div>
  `;
}

function optionsFromForm(ruleCode, form) {
  const data = new FormData(form);
  if (ruleCode === "GLOBAL") {
    return { prorratear_pagas_extra: bool(data.get("prorratear_pagas_extra")), boe_alerts_prepared: bool(data.get("boe_alerts_prepared")) };
  }
  if (ruleCode === "SMI_IPREM") {
    return { smi_diario: nullableNumber(data.get("smi_diario")), smi_mensual: nullableNumber(data.get("smi_mensual")), iprem_diario: nullableNumber(data.get("iprem_diario")), iprem_mensual: nullableNumber(data.get("iprem_mensual")) };
  }
  if (ruleCode === "VAC_AUTO") {
    return { numero_dias: nullableNumber(data.get("numero_dias")), tipo_dias: data.get("tipo_dias"), devenga_it: bool(data.get("devenga_it")), cotizacion: bool(data.get("cotizacion")), computo_diario: bool(data.get("computo_diario")) };
  }
  if (ruleCode === "PEXTRA") {
    return { codigo_cra: data.get("codigo_cra") || null, pagas: String(data.get("pagas") || "").split(",").map((item) => item.trim()).filter(Boolean), prorrateo: bool(data.get("prorrateo")), cotizacion: bool(data.get("cotizacion")), devenga_it: bool(data.get("devenga_it")) };
  }
  if (ruleCode === "ANT") {
    return { forma_pago: data.get("forma_pago"), criterio_devengo: data.get("criterio_devengo"), computo_diario: bool(data.get("computo_diario")), salto_mes_baja: bool(data.get("salto_mes_baja")) };
  }
  if (ruleCode === "IT") {
    return { tramos: nullableNumber(data.get("tramos")), diagnosticos: String(data.get("diagnosticos") || "").split(",").map((item) => item.trim()).filter(Boolean), limites: { general: data.get("limite_general") || null } };
  }
  return {};
}

function reloadModal() {
  document.querySelector("[data-agreement-parameterization-modal='true']")?.remove();
  document.querySelector("[data-agreement-parameterization-button='true']")?.click();
}

function bindForms(container) {
  container.querySelectorAll("form[data-rule-code]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      if (button) {
        button.disabled = true;
        button.textContent = "Guardando...";
      }
      try {
        await requestJson(`/collective-agreements/rule-headers/${form.dataset.ruleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ options: optionsFromForm(form.dataset.ruleCode, form) }),
        });
        reloadModal();
      } catch (error) {
        if (button) {
          button.disabled = false;
          button.textContent = "Guardar";
        }
        window.alert(error.message || "Error al guardar parametrización");
      }
    });
  });
}

function mountParameterizationForms(event) {
  const { modal, data } = event.detail || {};
  const host = modal?.querySelector("[data-parameterization-forms-host='true']");
  if (!host || !data) return;
  host.innerHTML = renderForms(data);
  bindForms(host);
}

window.addEventListener("agreement-parameterization:rendered", mountParameterizationForms);
