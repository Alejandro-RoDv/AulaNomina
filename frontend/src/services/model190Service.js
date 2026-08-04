import { apiRequest } from "./httpClient";

function queryString({ companyId, year }) {
  const params = new URLSearchParams({
    company_id: String(companyId),
    year: String(year),
  });
  return params.toString();
}

export function fetchModel190Preview({ companyId, year }) {
  return apiRequest(
    `/model-190/preview?${queryString({ companyId, year })}`,
    {},
    "No se ha podido calcular el Modelo 190"
  );
}

export function fetchModel190Reconciliation({ companyId, year }) {
  return apiRequest(
    `/model-190/reconciliation?${queryString({ companyId, year })}`,
    {},
    "No se ha podido conciliar el Modelo 190 con los Modelos 111"
  );
}
