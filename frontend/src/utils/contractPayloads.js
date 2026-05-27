const CONTRACT_NUMERIC_FIELDS = new Set([
  "weekly_hours",
  "full_time_weekly_hours",
  "partiality_coefficient",
  "gross_annual_salary",
]);

const SOCIAL_SECURITY_NUMERIC_FIELDS = new Set([
  "disability_degree",
  "working_time_reduction",
  "initial_ctp",
]);

export function normalizeContractExtras(extra = {}) {
  return Object.entries(extra).reduce((acc, [key, value]) => {
    if (value === "" || value === undefined) return acc;
    acc[key] = CONTRACT_NUMERIC_FIELDS.has(key) ? Number(value) : value;
    return acc;
  }, {});
}

export function normalizeSocialSecurityPayload(payload = null) {
  if (!payload) return null;

  const normalized = Object.entries(payload).reduce((acc, [key, value]) => {
    if (value === "" || value === undefined) return acc;

    if (key === "is_replacement") {
      acc[key] = Boolean(value);
      return acc;
    }

    acc[key] = SOCIAL_SECURITY_NUMERIC_FIELDS.has(key) ? Number(value) : value;
    return acc;
  }, {});

  return Object.keys(normalized).length ? normalized : null;
}

export function buildContractPayload(form, extra = {}) {
  return {
    employee_id: Number(form.employee_id),
    company_id: form.company_id ? Number(form.company_id) : null,
    center_id: form.center_id ? Number(form.center_id) : null,
    contract_type: form.contract_type,
    start_date: form.start_date,
    end_date: form.end_date || null,
    salary_base: form.salary_base ? Number(form.salary_base) : null,
    pay_schedule: form.pay_schedule || "not_prorated_14",
    status: form.status,
    ...normalizeContractExtras(extra),
  };
}
