import { apiRequest } from "./httpClient";

export async function fetchPayrollPreparationStatuses(periodMonth, periodYear) {
  const query = new URLSearchParams({
    period_month: String(periodMonth),
    period_year: String(periodYear),
  });
  return apiRequest(
    `/payroll-preparations?${query.toString()}`,
    {},
    "Error al cargar el estado de las preparaciones"
  );
}
