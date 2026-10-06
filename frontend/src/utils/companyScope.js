// UI scope only. API authorization remains enforced by the backend workspace.
export function scopeCompanyData(data, companyId) {
  if (!companyId) return data;
  const matches = (id) => String(id ?? "") === String(companyId);
  const contracts = data.contracts || [];
  const employees = data.employees || [];
  const contractMap = new Map(contracts.map((item) => [String(item.id), item]));
  const employeeMap = new Map(employees.map((item) => [String(item.id), item]));
  const belongs = (item) => matches(item.company_id
    ?? contractMap.get(String(item.contract_id))?.company_id
    ?? employeeMap.get(String(item.employee_id))?.company_id);
  return Object.fromEntries(Object.entries(data).map(([key, items]) => [key,
    !Array.isArray(items) ? items : key === "companies" ? items.filter((item) => matches(item.id))
      : ["contracts", "employees", "workCenters", "incidents", "payrolls", "documents"].includes(key) ? items.filter(belongs) : items,
  ]));
}
