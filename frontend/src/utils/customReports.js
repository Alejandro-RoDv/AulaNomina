export const CUSTOM_COLUMNS = [
  ['company', 'Empresa', 'Empresa'], ['cif', 'CIF', 'Empresa'], ['ccc', 'CCC', 'Empresa'],
  ['name', 'Trabajador', 'Trabajador'], ['dni', 'DNI', 'Trabajador'], ['naf', 'NAF', 'Trabajador'], ['email', 'Correo', 'Trabajador'], ['phone', 'Teléfono', 'Trabajador'],
  ['center', 'Centro', 'Contrato'], ['type', 'Tipo de contrato', 'Contrato'], ['start', 'Inicio contrato', 'Contrato'], ['end', 'Fin contrato', 'Contrato'], ['salary', 'Salario base', 'Contrato'],
  ['payrollCount', 'Número de nóminas', 'Nómina'], ['gross', 'Bruto total', 'Nómina'], ['deductions', 'Deducciones totales', 'Nómina'], ['net', 'Neto total', 'Nómina'],
  ['incidentCount', 'Número de incidencias', 'Incidencias'], ['incidentTypes', 'Tipos de incidencia', 'Incidencias'], ['pendingDocuments', 'Documentos pendientes', 'Documentación'],
].map(([key, label, group]) => ({ key, label, group }));
export function buildCustomRows({ employees, companies, workCenters, contracts, payrolls, incidents, documents }) {
  return employees.map(employee => {
    const ownContracts = contracts.filter(item => Number(item.employee_id) === Number(employee.id)).sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')));
    const contract = ownContracts.find(item => item.status === 'active') || ownContracts[0];
    const company = companies.find(item => Number(item.id) === Number(employee.company_id || contract?.company_id));
    const center = workCenters.find(item => Number(item.id) === Number(contract?.center_id || employee.center_id));
    const own = rows => rows.filter(item => Number(item.employee_id) === Number(employee.id) && (!item.company_id || Number(item.company_id) === Number(company?.id)));
    const pays = own(payrolls);
    const events = own(incidents);
    const total = key => pays.reduce((sum, item) => sum + Number(item[key] || 0), 0).toFixed(2);
    return { company: company?.name || '', cif: company?.cif || '', ccc: company?.ccc || '', name: `${employee.first_name || ''} ${employee.last_name || ''} ${employee.second_last_name || ''}`.trim(), dni: employee.dni || '', naf: employee.naf || '', email: employee.email || '', phone: employee.mobile_phone || employee.phone || '', center: center?.name || '', type: contract?.contract_type || '', start: contract?.start_date || '', end: contract?.end_date || '', salary: contract?.salary_base ?? '', payrollCount: pays.length, gross: total('gross_salary'), deductions: total('total_deductions'), net: total('net_salary'), incidentCount: events.length, incidentTypes: [...new Set(events.map(item => item.incident_type))].join(', '), pendingDocuments: own(documents).filter(item => ['pending', 'expired'].includes(item.status)).map(item => item.name || item.document_type || 'Documento').join(', ') };
  });
}
