export function getEmployeeVisibleCode(employee) {
  if (!employee) return "-";

  if (employee.employee_code && String(employee.employee_code).includes(".")) {
    return employee.employee_code;
  }

  const companyId = employee.company_id || "-";
  const employeePart = employee.employee_code || employee.id || "-";

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
    ? getEmployeeVisibleCode(employee)
    : contract.employee_code || contract.employee_id || "-";

  return `${employeeCode}.${contract.id}`;
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
    : payroll.contract_code || payroll.contract_id || "-";

  const month = String(payroll.period_month || "").padStart(2, "0");
  const year = payroll.period_year || "";

  return `${contractCode}-${year}-${month}`;
}
