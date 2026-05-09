export function getEmployeeVisibleCode(employee, fallbackCompanyId = null) {
  if (!employee) return "-";

  if (employee.employee_code && String(employee.employee_code).includes(".")) {
    return employee.employee_code;
  }

  const companyId = employee.company_id || fallbackCompanyId || "?";
  const employeePart = employee.employee_code || employee.id || "?";

  return `${companyId}.${employeePart}`;
}

export function getContractVisibleCode(contract, employees = []) {
  if (!contract) return "-";

  if (contract.contract_code) {
    return contract.contract_code;
  }

  const employee = employees.find(
    (item) => String(item.id) === String(contract.employee_id)
  );

  const employeeCode = employee
    ? getEmployeeVisibleCode(employee, contract.company_id)
    : `${contract.company_id || "?"}.${contract.employee_id || "?"}`;

  return `${employeeCode}.${contract.id}`;
}

export function getIncidentContractVisibleCode(incident, contracts = [], employees = []) {
  if (!incident) return "-";

  const contract = contracts.find(
    (item) => String(item.id) === String(incident.contract_id)
  );

  if (contract) {
    return getContractVisibleCode(contract, employees);
  }

  const companyId = incident.company_id || "?";
  const employeeId = incident.employee_id || "?";
  const contractId = incident.contract_id || "?";

  return `${companyId}.${employeeId}.${contractId}`;
}

export function getPayrollVisibleCode(payroll, contracts = [], employees = []) {
  if (!payroll) return "-";

  if (payroll.payroll_code) {
    return payroll.payroll_code;
  }

  const contract = contracts.find(
    (item) => String(item.id) === String(payroll.contract_id)
  );

  const contractCode = contract
    ? getContractVisibleCode(contract, employees)
    : `${payroll.company_id || "?"}.${payroll.employee_id || "?"}.${payroll.contract_id || "?"}`;

  const month = String(payroll.period_month || "").padStart(2, "0");
  const year = payroll.period_year || "";

  return `${contractCode}-${year}-${month}`;
}
