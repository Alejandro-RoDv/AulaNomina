export function createInitialPayrollForm(date = new Date()) {
  return {
    employee_id: "",
    contract_id: "",
    company_id: "",
    center_id: "",
    period_month: String(date.getMonth() + 1),
    period_year: String(date.getFullYear()),
    salary_supplement_1: "0",
    salary_supplement_2: "0",
    salary_supplement_3: "0",
    irpf_percentage: "10",
    status: "pending",
  };
}

export const initialPayrollForm = createInitialPayrollForm();

export function getSalarySupplementsTotal(form) {
  return (
    Number(form.salary_supplement_1 || 0) +
    Number(form.salary_supplement_2 || 0) +
    Number(form.salary_supplement_3 || 0)
  );
}

export function buildPayrollPayload(form) {
  return {
    employee_id: Number(form.employee_id),
    contract_id: Number(form.contract_id),
    company_id: form.company_id ? Number(form.company_id) : null,
    center_id: form.center_id ? Number(form.center_id) : null,
    period_month: Number(form.period_month),
    period_year: Number(form.period_year),
    salary_supplements: getSalarySupplementsTotal(form),
    irpf_percentage: form.irpf_percentage ? Number(form.irpf_percentage) : 10,
    status: form.status,
  };
}

export function buildPayrollUpdatePayload(form) {
  return {
    center_id: form.center_id ? Number(form.center_id) : null,
    period_month: Number(form.period_month),
    period_year: Number(form.period_year),
    salary_supplements: getSalarySupplementsTotal(form),
    irpf_percentage: form.irpf_percentage ? Number(form.irpf_percentage) : 10,
    status: form.status,
  };
}
