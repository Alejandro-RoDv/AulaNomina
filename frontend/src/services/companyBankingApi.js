import { apiRequest } from "./httpClient";

export const fetchCompanyBanking = (companyId) => apiRequest(`/companies/${companyId}/banking`, {}, "Error al cargar la domiciliación de pagos");

export const createCompanyBankAccount = (companyId, payload) => apiRequest(`/companies/${companyId}/bank-accounts`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
}, "Error al crear la cuenta bancaria");

export const updateCompanyBankAccount = (companyId, accountId, payload) => apiRequest(`/companies/${companyId}/bank-accounts/${accountId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
}, "Error al actualizar la cuenta bancaria");

export const deleteCompanyBankAccount = (companyId, accountId) => apiRequest(`/companies/${companyId}/bank-accounts/${accountId}`, { method: "DELETE" }, "Error al eliminar la cuenta bancaria");

export const assignPaymentOperation = (companyId, operationCode, accountId) => apiRequest(`/companies/${companyId}/payment-operations/${operationCode}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ account_id: Number(accountId) }),
}, "Error al asignar la cuenta bancaria");

export const unassignPaymentOperation = (companyId, operationCode) => apiRequest(`/companies/${companyId}/payment-operations/${operationCode}`, { method: "DELETE" }, "Error al desvincular la cuenta bancaria");
