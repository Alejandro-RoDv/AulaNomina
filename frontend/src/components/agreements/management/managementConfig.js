export const MANAGEMENT_TABS = [
  { id: "overview", label: "Resumen" },
  { id: "classification", label: "Clasificación" },
  { id: "salary", label: "Tablas salariales" },
  { id: "rules", label: "Jornada y permisos" },
  { id: "seniority", label: "Antigüedad" },
];

export const initialAgreementForm = { name: "", agreement_code: "", sector: "", territorial_scope: "", effective_from: "", effective_to: "", status: "draft", notes: "" };
export const initialGroupForm = { id: null, code: "", name: "", description: "", display_order: 1 };
export const initialCategoryForm = { id: null, professional_group_id: "", code: "", name: "", level: "", functional_description: "", display_order: 1 };
export const initialSalaryTableForm = { id: null, name: "Tabla salarial 2026", year: "2026", number_of_payments: 14, amount_type: "monthly", status: "active", notes: "" };
export const initialSalaryRowForm = { id: null, salary_table_id: "", professional_category_id: "", base_salary: "", seniority_amount: "", agreement_plus: "", total_amount: "", amount_unit: "monthly", notes: "" };
export const initialWorkTimeRuleForm = { id: null, name: "Jornada ordinaria general", annual_hours: "", weekly_hours: "", daily_max_hours: "", distribution_type: "regular", notes: "" };
export const initialVacationRuleForm = { id: null, name: "Vacaciones anuales ordinarias", natural_days: "30", working_days: "", accrual_period: "Año natural", notes: "" };
export const initialLeaveRuleForm = { id: null, name: "", leave_type: "paid", cause: "", duration: "", duration_unit: "working_days", paid: true, requires_notice: false, requires_justification: true, salary_treatment: "", notes: "" };

export function cleanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => !["id", "table_id", "table_name", "table_year"].includes(key))
      .map(([key, value]) => [key, value === "" ? null : value])
  );
}

export function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function getGroupName(groups, groupId) {
  return groups.find((group) => Number(group.id) === Number(groupId))?.name || "—";
}

export function formatLeaveType(value) {
  return value === "paid" ? "Retribuido" : value === "unpaid" ? "No retribuido" : value || "—";
}

export function getAgreementStatus(agreement) {
  if (!agreement) return { label: "Sin convenio", tone: "neutral" };
  if (agreement.status === "draft") return { label: "Borrador", tone: "draft" };
  if (agreement.status === "archived") return { label: "Caducado", tone: "expired" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = agreement.effective_from ? new Date(agreement.effective_from) : null;
  const to = agreement.effective_to ? new Date(agreement.effective_to) : null;
  if (from && from > today) return { label: "Futuro", tone: "future" };
  if (to && to < today) return { label: "Caducado", tone: "expired" };
  if (agreement.status === "active") return { label: "Activo", tone: "active" };
  return { label: agreement.status || "Sin estado", tone: "neutral" };
}
