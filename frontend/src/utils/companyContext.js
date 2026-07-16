const STORAGE_KEY = "aulanomina:selectedCompanyId";
const CHANGE_EVENT = "aulanomina-company-context-change";

export function getSelectedCompanyId() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(STORAGE_KEY) || "";
}

export function setSelectedCompanyId(companyId) {
  if (typeof window === "undefined") return;
  const normalized = companyId ? String(companyId) : "";
  if (normalized) window.sessionStorage.setItem(STORAGE_KEY, normalized);
  else window.sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { companyId: normalized } }));
}

export function subscribeSelectedCompany(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = (event) => callback(event.detail?.companyId || getSelectedCompanyId());
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
