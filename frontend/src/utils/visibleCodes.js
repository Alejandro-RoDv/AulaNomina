function sameId(a, b) {
  return String(a) === String(b);
}

function sortByIdAsc(a, b) {
  return Number(a.id || 0) - Number(b.id || 0);
}

function inferEmployeeCompanyId(employee, contracts = [], fallbackCompanyId = null) {
  if (!employee) return fallbackCompanyId || null;

  if (employee.company_id) return employee.company_id;

  const relatedContract = contracts.find(
    (contract) => sameId(contract.employee_id, employee.id) && contract.company_id
  );

  return relatedContract?.company_id || fallbackCompanyId || null;
}

export function getEmployeeVisibleCode(employee, employees = [], contracts = [], fallbackCompanyId = null) {
  if (!employee) return "-";

  const companyId = inferEmployeeCompanyId(employee, contracts, fallbackCompanyId);

  if (!companyId) {
    return `?.${employee.id || employee.employee_code || "?"}`;
  }

  const employeesInCompany = employees
    .filter((item) => sameId(inferEmployeeCompanyId(item, contracts), companyId))
    .sort(sortByIdAsc);

  const employeeIndex = employeesInCompany.findIndex((item) => sameId(item.id, employee.id));
  const employeeSequence = employeeIndex >= 0 ? employeeIndex + 1 : employee.employee_code || employee.id || "?";

  return `${companyId}.${employeeSequence}`;
}

export function getContractVisibleCode(contract, employees = [], contracts = []) {
  if (!contract) return "-";

  const employee = employees.find(
    (item) => sameId(item.id, contract.employee_id)
  );

  const employeeCode = employee
    ? getEmployeeVisibleCode(employee, employees, contracts, contract.company_id)
    : `${contract.company_id || "?"}.${contract.employee_id || "?"}`;

  const employeeContracts = contracts
    .filter((item) => sameId(item.employee_id, contract.employee_id))
    .sort(sortByIdAsc);

  const contractIndex = employeeContracts.findIndex((item) => sameId(item.id, contract.id));
  const contractSequence = contractIndex >= 0 ? contractIndex + 1 : contract.id || "?";

  return `${employeeCode}.${contractSequence}`;
}

export function getIncidentContractVisibleCode(incident, contracts = [], employees = []) {
  if (!incident) return "-";

  const contract = contracts.find(
    (item) => sameId(item.id, incident.contract_id)
  );

  if (contract) {
    return getContractVisibleCode(contract, employees, contracts);
  }

  const companyId = incident.company_id || "?";
  const employeeId = incident.employee_id || "?";
  const contractId = incident.contract_id || "?";

  return `${companyId}.${employeeId}.${contractId}`;
}

export function getPayrollVisibleCode(payroll, contracts = [], employees = []) {
  if (!payroll) return "-";

  const contract = contracts.find(
    (item) => sameId(item.id, payroll.contract_id)
  );

  const contractCode = contract
    ? getContractVisibleCode(contract, employees, contracts)
    : `${payroll.company_id || "?"}.${payroll.employee_id || "?"}.${payroll.contract_id || "?"}`;

  const month = String(payroll.period_month || "").padStart(2, "0");
  const year = payroll.period_year || "";

  return `${contractCode}-${year}-${month}`;
}
