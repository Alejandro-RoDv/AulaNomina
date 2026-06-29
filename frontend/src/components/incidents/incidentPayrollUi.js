export const EMPTY_OVERRIDES = { common: "", professional: "", unemployment: "" };

export function money(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function payrollPeriod(payroll) {
  return `${String(payroll.period_month).padStart(2, "0")}/${payroll.period_year}`;
}

export function payrollEmployee(payroll, employeeMap) {
  const employee = employeeMap.get(String(payroll.employee_id));
  return payroll.employee_name
    || [employee?.first_name, employee?.last_name].filter(Boolean).join(" ")
    || `Trabajador ${payroll.employee_id}`;
}

export function sourceLabel(value) {
  return value === "manual_override"
    ? "Forzada manualmente"
    : "Calculada por el motor";
}
