import { useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import { exportRowsToCsv } from "../utils/exportCsv";

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount);
}

function getEmployeeName(employee) {
  if (!employee) return "-";
  return `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || `Trabajador ${employee.id}`;
}

function getCompany(companies, id) {
  return companies.find((company) => Number(company.id) === Number(id));
}

function getCenter(workCenters, id) {
  return workCenters.find((center) => Number(center.id) === Number(id));
}

function getActiveContract(contracts, employeeId) {
  return contracts.find((contract) => Number(contract.employee_id) === Number(employeeId) && contract.status === "active")
    || contracts.find((contract) => Number(contract.employee_id) === Number(employeeId));
}

function getEmployeeDocuments(employee) {
  const hasNaf = Boolean(employee?.naf);
  const hasEmail = Boolean(employee?.email);
  const hasPhone = Boolean(employee?.phone);

  return [
    { name: "DNI / NIE", status: employee?.dni ? "Recibido" : "Pendiente" },
    { name: "Número de afiliación", status: hasNaf ? "Recibido" : "Pendiente" },
    { name: "Modelo 145", status: hasEmail ? "Recibido" : "Pendiente" },
    { name: "Contrato firmado", status: "Pendiente" },
    { name: "Certificado delitos sexuales", status: hasPhone ? "Recibido" : "Pendiente" },
    { name: "Consentimiento protección de datos", status: "Pendiente" },
  ];
}

function getPayrollPeriod(payroll) {
  return `${String(payroll.period_month || "").padStart(2, "0")}/${payroll.period_year || ""}`;
}

function normalizeFilename(value) {
  return String(value || "todas").toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, "_").replace(/^_+|_+$/g, "");
}

function buildFilename(baseName, selectedCompanyId, companies) {
  const company = getCompany(companies, selectedCompanyId);
  return `${baseName}_${normalizeFilename(company?.name || "todas")}.csv`;
}

function matchesPeriod(item, year, month) {
  if (!year && !month) return true;

  const itemYear = item.period_year || String(item.start_date || "").slice(0, 4);
  const itemMonth = item.period_month || String(item.start_date || "").slice(5, 7);

  return (!year || String(itemYear) === String(year)) && (!month || String(itemMonth).padStart(2, "0") === String(month).padStart(2, "0"));
}

const reportCategories = [
  { id: "company", label: "Empresa" },
  { id: "employee", label: "Trabajador" },
  { id: "payroll", label: "Nómina" },
  { id: "incident", label: "Incidencias" },
  { id: "documents", label: "Documentación" },
];

const reportDefinitions = [
  { id: "companies-active", category: "company", label: "Empresas activas", description: "Empresas, CIF, CCC principal y número de centros." },
  { id: "centers-ccc", category: "company", label: "Centros y CCC", description: "Centros de trabajo con CCC asociados y empresa titular." },
  { id: "employees-active", category: "employee", label: "Trabajadores en alta", description: "Plantilla activa con empresa, centro y datos de contacto." },
  { id: "employees-all", category: "employee", label: "Todos los trabajadores", description: "Listado completo de trabajadores activos e inactivos." },
  { id: "contracts-active", category: "employee", label: "Contratos activos", description: "Contratos vigentes, tipo, fechas y salario base." },
  { id: "contracts-all", category: "employee", label: "Histórico de contratos", description: "Todos los contratos registrados en el entorno demo." },
  { id: "payrolls-detail", category: "payroll", label: "Nóminas detalladas", description: "Periodo, trabajador, bruto, deducciones, neto y estado." },
  { id: "payrolls-summary", category: "payroll", label: "Resumen de nóminas", description: "Totales por empresa y periodo." },
  { id: "incidents-open", category: "incident", label: "Incidencias abiertas", description: "IT, ausencias, vacaciones o permisos pendientes de cierre." },
  { id: "incidents-all", category: "incident", label: "Histórico de incidencias", description: "Todas las incidencias registradas por trabajador." },
  { id: "documents-pending", category: "documents", label: "Documentación pendiente", description: "Documentos pendientes o caducados por trabajador." },
  { id: "documents-all", category: "documents", label: "Estado documental completo", description: "Todos los documentos registrados y su estado." },
];

function DocumentShell({ title, subtitle, children }) {
  return (
    <article className="printable-report" style={documentStyles.sheet}>
      <header style={documentStyles.header}>
        <div>
          <p style={documentStyles.brand}>AulaNomina</p>
          <h1 style={documentStyles.title}>{title}</h1>
          <p style={documentStyles.subtitle}>{subtitle}</p>
        </div>
        <div style={documentStyles.metaBox}>
          <strong>Documento demo</strong>
          <span>Vista HTML imprimible</span>
          <span>{formatDate(new Date().toISOString().slice(0, 10))}</span>
        </div>
      </header>
      {children}
      <footer style={documentStyles.footer}>
        Documento generado en entorno educativo. No tiene validez jurídica ni sustituye documentación laboral real.
      </footer>
    </article>
  );
}

function EmployeeSummaryTemplate({ employee, company, center, contract, incidents, payrolls }) {
  const docs = getEmployeeDocuments(employee);
  const receivedDocs = docs.filter((doc) => doc.status === "Recibido").length;
  const lastPayroll = [...payrolls]
    .filter((payroll) => Number(payroll.employee_id) === Number(employee?.id))
    .sort((a, b) => Number(`${b.period_year}${String(b.period_month).padStart(2, "0")}`) - Number(`${a.period_year}${String(a.period_month).padStart(2, "0")}`))[0];
  const activeIncident = incidents.find((incident) => Number(incident.employee_id) === Number(employee?.id) && incident.status === "open");

  return (
    <DocumentShell title="Expediente laboral" subtitle="Resumen profesional del trabajador">
      <section style={documentStyles.highlightGrid}>
        <div><span>Trabajador</span><strong>{getEmployeeName(employee)}</strong></div>
        <div><span>DNI</span><strong>{employee?.dni || "-"}</strong></div>
        <div><span>Empresa</span><strong>{company?.name || "-"}</strong></div>
        <div><span>Centro</span><strong>{center?.name || "-"}</strong></div>
      </section>

      <section style={documentStyles.twoColumns}>
        <div style={documentStyles.block}>
          <h2>Situación laboral</h2>
          <p><strong>Contrato:</strong> {contract?.contract_type || "Sin contrato activo"}</p>
          <p><strong>Inicio:</strong> {formatDate(contract?.start_date)}</p>
          <p><strong>Estado:</strong> {contract?.status || "-"}</p>
          <p><strong>Salario base:</strong> {contract?.salary_base ? formatMoney(contract.salary_base) : "-"}</p>
        </div>
        <div style={documentStyles.block}>
          <h2>Control documental</h2>
          <p><strong>Estado documental:</strong> {receivedDocs}/{docs.length} recibidos</p>
          <p><strong>Última nómina:</strong> {lastPayroll ? getPayrollPeriod(lastPayroll) : "Sin nóminas"}</p>
          <p><strong>Incidencias:</strong> {activeIncident ? `${activeIncident.incident_type} activa` : "Sin incidencias activas"}</p>
        </div>
      </section>

      <section style={documentStyles.block}>
        <h2>Documentación</h2>
        <table style={documentStyles.table}>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.name}>
                <td>{doc.name}</td>
                <td style={doc.status === "Recibido" ? documentStyles.okStatus : documentStyles.pendingStatus}>{doc.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </DocumentShell>
  );
}

function ContractTemplate({ employee, company, center, contract }) {
  return (
    <DocumentShell title="Contrato laboral simulado" subtitle="Ficha resumen para docencia laboral">
      <section style={documentStyles.block}>
        <h2>Partes</h2>
        <p><strong>Empresa:</strong> {company?.name || "-"} · CIF: {company?.cif || "-"}</p>
        <p><strong>Centro:</strong> {center?.name || "-"}</p>
        <p><strong>Trabajador:</strong> {getEmployeeName(employee)} · DNI: {employee?.dni || "-"}</p>
      </section>
      <section style={documentStyles.block}>
        <h2>Condiciones simuladas</h2>
        <table style={documentStyles.table}>
          <tbody>
            <tr><td>Tipo de contrato</td><td>{contract?.contract_type || "-"}</td></tr>
            <tr><td>Fecha de inicio</td><td>{formatDate(contract?.start_date)}</td></tr>
            <tr><td>Fecha de fin</td><td>{formatDate(contract?.end_date)}</td></tr>
            <tr><td>Estado</td><td>{contract?.status || "-"}</td></tr>
            <tr><td>Salario base</td><td>{contract?.salary_base ? formatMoney(contract.salary_base) : "-"}</td></tr>
          </tbody>
        </table>
      </section>
      <section style={documentStyles.signatureGrid}>
        <div>Firma empresa</div>
        <div>Firma trabajador</div>
      </section>
    </DocumentShell>
  );
}

function ChecklistTemplate({ employee, company, center }) {
  const docs = getEmployeeDocuments(employee);

  return (
    <DocumentShell title="Checklist documental" subtitle="Control de documentación del expediente laboral">
      <section style={documentStyles.block}>
        <p><strong>Trabajador:</strong> {getEmployeeName(employee)} · <strong>DNI:</strong> {employee?.dni || "-"}</p>
        <p><strong>Empresa:</strong> {company?.name || "-"} · <strong>Centro:</strong> {center?.name || "-"}</p>
      </section>
      <section style={documentStyles.block}>
        <table style={documentStyles.table}>
          <thead>
            <tr><th>Documento</th><th>Estado</th><th>Observaciones</th></tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.name}>
                <td>{doc.name}</td>
                <td style={doc.status === "Recibido" ? documentStyles.okStatus : documentStyles.pendingStatus}>{doc.status}</td>
                <td>{doc.status === "Recibido" ? "Validado en simulación" : "Solicitar al trabajador"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </DocumentShell>
  );
}

function IncidentsTemplate({ employee, company, center, incidents }) {
  const employeeIncidents = incidents.filter((incident) => Number(incident.employee_id) === Number(employee?.id));

  return (
    <DocumentShell title="Informe mensual de incidencias" subtitle="Resumen de IT, vacaciones, ausencias y permisos">
      <section style={documentStyles.block}>
        <p><strong>Trabajador:</strong> {getEmployeeName(employee)} · <strong>Empresa:</strong> {company?.name || "-"} · <strong>Centro:</strong> {center?.name || "-"}</p>
      </section>
      <section style={documentStyles.block}>
        <table style={documentStyles.table}>
          <thead>
            <tr><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Estado</th><th>Descripción</th></tr>
          </thead>
          <tbody>
            {employeeIncidents.length === 0 && <tr><td colSpan="5">Sin incidencias registradas.</td></tr>}
            {employeeIncidents.map((incident) => (
              <tr key={incident.id}>
                <td>{incident.incident_type}</td>
                <td>{formatDate(incident.start_date)}</td>
                <td>{formatDate(incident.end_date)}</td>
                <td>{incident.status}</td>
                <td>{incident.description || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </DocumentShell>
  );
}

export default function ReportsPage({ loading, employees, companies, workCenters, contracts, incidents, payrolls, documents = [] }) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employees[0]?.id ? String(employees[0].id) : "");
  const [selectedTemplate, setSelectedTemplate] = useState("employee-summary");
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("employee");
  const [selectedReportId, setSelectedReportId] = useState("employees-active");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [previewReport, setPreviewReport] = useState(null);

  const selectedEmployee = employees.find((employee) => String(employee.id) === String(selectedEmployeeId)) || employees[0];
  const selectedContract = getActiveContract(contracts, selectedEmployee?.id);
  const selectedCompany = getCompany(companies, selectedContract?.company_id || selectedEmployee?.company_id);
  const selectedCenter = getCenter(workCenters, selectedContract?.center_id || selectedEmployee?.center_id);

  const companyScopedEmployees = useMemo(() => employees.filter((employee) => {
    if (selectedCompanyId === "all") return true;
    const contract = getActiveContract(contracts, employee.id);
    return Number(contract?.company_id || employee.company_id) === Number(selectedCompanyId);
  }), [employees, contracts, selectedCompanyId]);

  const companyScopedContracts = useMemo(() => contracts.filter((contract) => (
    selectedCompanyId === "all" || Number(contract.company_id) === Number(selectedCompanyId)
  )), [contracts, selectedCompanyId]);

  const companyScopedPayrolls = useMemo(() => payrolls.filter((payroll) => (
    (selectedCompanyId === "all" || Number(payroll.company_id) === Number(selectedCompanyId)) && matchesPeriod(payroll, selectedYear, selectedMonth)
  )), [payrolls, selectedCompanyId, selectedYear, selectedMonth]);

  const companyScopedIncidents = useMemo(() => incidents.filter((incident) => (
    (selectedCompanyId === "all" || Number(incident.company_id) === Number(selectedCompanyId)) && matchesPeriod(incident, selectedYear, selectedMonth)
  )), [incidents, selectedCompanyId, selectedYear, selectedMonth]);

  const companyScopedDocuments = useMemo(() => documents.filter((document) => (
    selectedCompanyId === "all" || Number(document.company_id) === Number(selectedCompanyId)
  )), [documents, selectedCompanyId]);

  const companyScopedCenters = useMemo(() => workCenters.filter((center) => (
    selectedCompanyId === "all" || Number(center.company_id) === Number(selectedCompanyId)
  )), [workCenters, selectedCompanyId]);

  const selectedCompanyLabel = selectedCompanyId === "all" ? "Todas las empresas" : getCompany(companies, selectedCompanyId)?.name || "Empresa seleccionada";
  const selectedReport = reportDefinitions.find((report) => report.id === selectedReportId);
  const categoryReports = reportDefinitions.filter((report) => report.category === selectedCategory);

  const summary = useMemo(() => {
    const activeEmployees = companyScopedEmployees.filter((employee) => employee.is_active).length;
    const activeContracts = companyScopedContracts.filter((contract) => contract.status === "active").length;
    const openIncidents = companyScopedIncidents.filter((incident) => incident.status === "open").length;
    const payrollTotal = companyScopedPayrolls.reduce((total, payroll) => total + Number(payroll.net_salary || payroll.gross_salary || 0), 0);

    return { activeEmployees, activeContracts, openIncidents, payrollTotal };
  }, [companyScopedEmployees, companyScopedContracts, companyScopedIncidents, companyScopedPayrolls]);

  const getReportData = (reportId) => {
    const employeeRows = (rows) => rows.map((employee) => {
      const contract = getActiveContract(contracts, employee.id);
      const company = getCompany(companies, contract?.company_id || employee.company_id);
      const center = getCenter(workCenters, contract?.center_id || employee.center_id);
      return {
        code: employee.employee_code,
        dni: employee.dni,
        name: getEmployeeName(employee),
        company: company?.name || "",
        center: center?.name || "",
        naf: employee.naf || "",
        email: employee.email || "",
        phone: employee.phone || "",
        city: employee.city || "",
        active: employee.is_active ? "Alta" : "Baja",
      };
    });

    const contractRows = (rows) => rows.map((contract) => {
      const employee = employees.find((item) => Number(item.id) === Number(contract.employee_id));
      const company = getCompany(companies, contract.company_id);
      const center = getCenter(workCenters, contract.center_id);
      return {
        id: contract.id,
        employee: getEmployeeName(employee),
        dni: employee?.dni || "",
        company: company?.name || contract.company_name || "",
        center: center?.name || contract.center_name || "",
        type: contract.contract_type || "",
        start: formatDate(contract.start_date),
        end: formatDate(contract.end_date),
        salary: contract.salary_base || "",
        status: contract.status || "",
      };
    });

    const incidentRows = (rows) => rows.map((incident) => {
      const employee = employees.find((item) => Number(item.id) === Number(incident.employee_id));
      const company = getCompany(companies, incident.company_id);
      const center = getCenter(workCenters, incident.center_id);
      return {
        id: incident.id,
        employee: getEmployeeName(employee),
        dni: employee?.dni || "",
        company: company?.name || incident.company_name || "",
        center: center?.name || incident.center_name || "",
        type: incident.incident_type || "",
        start: formatDate(incident.start_date),
        end: formatDate(incident.end_date),
        status: incident.status || "",
        description: incident.description || "",
      };
    });

    const documentRows = (rows) => rows.map((document) => {
      const employee = employees.find((item) => Number(item.id) === Number(document.employee_id));
      const company = getCompany(companies, document.company_id || employee?.company_id);
      const center = getCenter(workCenters, document.center_id || employee?.center_id);
      return {
        employee: getEmployeeName(employee),
        dni: employee?.dni || "",
        company: company?.name || "",
        center: center?.name || "",
        type: document.document_type || "",
        name: document.document_name || "",
        status: document.status || "",
        issue: formatDate(document.issue_date),
        expiry: formatDate(document.expiry_date),
        notes: document.notes || "",
      };
    });

    const reportMap = {
      "companies-active": {
        filename: "empresas_activas",
        columns: [
          { key: "name", label: "Empresa" }, { key: "cif", label: "CIF" }, { key: "ccc", label: "CCC principal" },
          { key: "city", label: "Localidad" }, { key: "province", label: "Provincia" }, { key: "centers", label: "Centros" },
        ],
        rows: (selectedCompanyId === "all" ? companies : companies.filter((company) => Number(company.id) === Number(selectedCompanyId)))
          .filter((company) => company.is_active)
          .map((company) => ({
            name: company.name,
            cif: company.cif,
            ccc: company.ccc || "",
            city: company.city || "",
            province: company.province || "",
            centers: workCenters.filter((center) => Number(center.company_id) === Number(company.id)).length,
          })),
      },
      "centers-ccc": {
        filename: "centros_ccc",
        columns: [
          { key: "company", label: "Empresa" }, { key: "cif", label: "CIF" }, { key: "centerCode", label: "Código centro" },
          { key: "center", label: "Centro" }, { key: "generalCcc", label: "CCC general" }, { key: "mainCcc", label: "CCC principal centro" },
          { key: "city", label: "Localidad" }, { key: "province", label: "Provincia" }, { key: "active", label: "Estado" },
        ],
        rows: companyScopedCenters.map((center) => {
          const company = getCompany(companies, center.company_id);
          return {
            company: company?.name || "",
            cif: company?.cif || "",
            centerCode: center.center_code || "",
            center: center.name || "",
            generalCcc: center.general_ccc || "",
            mainCcc: center.main_ccc || "",
            city: center.city || "",
            province: center.province || "",
            active: center.is_active ? "Activo" : "Inactivo",
          };
        }),
      },
      "employees-active": {
        filename: "trabajadores_alta",
        columns: [
          { key: "code", label: "Código" }, { key: "dni", label: "DNI" }, { key: "name", label: "Trabajador" },
          { key: "company", label: "Empresa" }, { key: "center", label: "Centro" }, { key: "naf", label: "NAF" },
          { key: "email", label: "Email" }, { key: "phone", label: "Teléfono" }, { key: "city", label: "Localidad" },
        ],
        rows: employeeRows(companyScopedEmployees.filter((employee) => employee.is_active)),
      },
      "employees-all": {
        filename: "trabajadores_todos",
        columns: [
          { key: "code", label: "Código" }, { key: "dni", label: "DNI" }, { key: "name", label: "Trabajador" },
          { key: "company", label: "Empresa" }, { key: "center", label: "Centro" }, { key: "naf", label: "NAF" },
          { key: "email", label: "Email" }, { key: "phone", label: "Teléfono" }, { key: "city", label: "Localidad" }, { key: "active", label: "Estado" },
        ],
        rows: employeeRows(companyScopedEmployees),
      },
      "contracts-active": {
        filename: "contratos_activos",
        columns: [
          { key: "id", label: "ID contrato" }, { key: "employee", label: "Trabajador" }, { key: "dni", label: "DNI" },
          { key: "company", label: "Empresa" }, { key: "center", label: "Centro" }, { key: "type", label: "Tipo contrato" },
          { key: "start", label: "Inicio" }, { key: "end", label: "Fin" }, { key: "salary", label: "Salario base" }, { key: "status", label: "Estado" },
        ],
        rows: contractRows(companyScopedContracts.filter((contract) => contract.status === "active")),
      },
      "contracts-all": {
        filename: "contratos_historico",
        columns: [
          { key: "id", label: "ID contrato" }, { key: "employee", label: "Trabajador" }, { key: "dni", label: "DNI" },
          { key: "company", label: "Empresa" }, { key: "center", label: "Centro" }, { key: "type", label: "Tipo contrato" },
          { key: "start", label: "Inicio" }, { key: "end", label: "Fin" }, { key: "salary", label: "Salario base" }, { key: "status", label: "Estado" },
        ],
        rows: contractRows(companyScopedContracts),
      },
      "payrolls-detail": {
        filename: "nominas_detalladas",
        columns: [
          { key: "period", label: "Periodo" }, { key: "employee", label: "Trabajador" }, { key: "company", label: "Empresa" },
          { key: "gross", label: "Bruto" }, { key: "deductions", label: "Deducciones" }, { key: "net", label: "Neto" }, { key: "status", label: "Estado" },
        ],
        rows: companyScopedPayrolls.map((payroll) => ({
          period: getPayrollPeriod(payroll),
          employee: payroll.employee_name || "",
          company: payroll.company_name || "",
          gross: payroll.gross_salary || "",
          deductions: payroll.total_deductions || "",
          net: payroll.net_salary || "",
          status: payroll.status || "",
        })),
      },
      "payrolls-summary": {
        filename: "resumen_nominas",
        columns: [
          { key: "period", label: "Periodo" }, { key: "company", label: "Empresa" }, { key: "payrolls", label: "Nóminas" },
          { key: "gross", label: "Bruto total" }, { key: "deductions", label: "Deducciones total" }, { key: "net", label: "Neto total" },
        ],
        rows: Object.values(companyScopedPayrolls.reduce((acc, payroll) => {
          const key = `${payroll.company_id || "sin_empresa"}-${payroll.period_year}-${payroll.period_month}`;
          const company = getCompany(companies, payroll.company_id);
          if (!acc[key]) {
            acc[key] = { period: getPayrollPeriod(payroll), company: company?.name || payroll.company_name || "", payrolls: 0, gross: 0, deductions: 0, net: 0 };
          }
          acc[key].payrolls += 1;
          acc[key].gross += Number(payroll.gross_salary || 0);
          acc[key].deductions += Number(payroll.total_deductions || 0);
          acc[key].net += Number(payroll.net_salary || 0);
          return acc;
        }, {})).map((item) => ({ ...item, gross: item.gross.toFixed(2), deductions: item.deductions.toFixed(2), net: item.net.toFixed(2) })),
      },
      "incidents-open": {
        filename: "incidencias_abiertas",
        columns: [
          { key: "id", label: "ID incidencia" }, { key: "employee", label: "Trabajador" }, { key: "dni", label: "DNI" },
          { key: "company", label: "Empresa" }, { key: "center", label: "Centro" }, { key: "type", label: "Tipo" },
          { key: "start", label: "Inicio" }, { key: "end", label: "Fin" }, { key: "status", label: "Estado" }, { key: "description", label: "Descripción" },
        ],
        rows: incidentRows(companyScopedIncidents.filter((incident) => incident.status === "open")),
      },
      "incidents-all": {
        filename: "incidencias_historico",
        columns: [
          { key: "id", label: "ID incidencia" }, { key: "employee", label: "Trabajador" }, { key: "dni", label: "DNI" },
          { key: "company", label: "Empresa" }, { key: "center", label: "Centro" }, { key: "type", label: "Tipo" },
          { key: "start", label: "Inicio" }, { key: "end", label: "Fin" }, { key: "status", label: "Estado" }, { key: "description", label: "Descripción" },
        ],
        rows: incidentRows(companyScopedIncidents),
      },
      "documents-pending": {
        filename: "documentacion_pendiente",
        columns: [
          { key: "employee", label: "Trabajador" }, { key: "dni", label: "DNI" }, { key: "company", label: "Empresa" },
          { key: "center", label: "Centro" }, { key: "type", label: "Tipo documento" }, { key: "name", label: "Documento" },
          { key: "status", label: "Estado" }, { key: "issue", label: "Fecha emisión" }, { key: "expiry", label: "Fecha caducidad" }, { key: "notes", label: "Notas" },
        ],
        rows: documentRows(companyScopedDocuments.filter((document) => ["pending", "expired"].includes(document.status))),
      },
      "documents-all": {
        filename: "documentacion_estado_completo",
        columns: [
          { key: "employee", label: "Trabajador" }, { key: "dni", label: "DNI" }, { key: "company", label: "Empresa" },
          { key: "center", label: "Centro" }, { key: "type", label: "Tipo documento" }, { key: "name", label: "Documento" },
          { key: "status", label: "Estado" }, { key: "issue", label: "Fecha emisión" }, { key: "expiry", label: "Fecha caducidad" }, { key: "notes", label: "Notas" },
        ],
        rows: documentRows(companyScopedDocuments),
      },
    };

    return reportMap[reportId];
  };

  const currentReportData = getReportData(selectedReportId);

  const handleCategoryChange = (event) => {
    const category = event.target.value;
    const firstReport = reportDefinitions.find((report) => report.category === category);
    setSelectedCategory(category);
    setSelectedReportId(firstReport?.id || "");
    setPreviewReport(null);
  };

  const handleReportChange = (event) => {
    setSelectedReportId(event.target.value);
    setPreviewReport(null);
  };

  const handleExportSelectedReport = () => {
    const reportData = getReportData(selectedReportId);
    if (!reportData) return;
    exportRowsToCsv(buildFilename(reportData.filename, selectedCompanyId, companies), reportData.columns, reportData.rows);
  };

  const handlePreviewReport = () => setPreviewReport(currentReportData);

  const printPreview = () => window.print();

  function renderTemplate() {
    if (!selectedEmployee) {
      return <div style={styles.emptyPreview}>Crea o carga trabajadores para generar documentación HTML.</div>;
    }

    if (selectedTemplate === "contract") {
      return <ContractTemplate employee={selectedEmployee} company={selectedCompany} center={selectedCenter} contract={selectedContract} />;
    }

    if (selectedTemplate === "checklist") {
      return <ChecklistTemplate employee={selectedEmployee} company={selectedCompany} center={selectedCenter} />;
    }

    if (selectedTemplate === "incidents") {
      return <IncidentsTemplate employee={selectedEmployee} company={selectedCompany} center={selectedCenter} incidents={incidents} />;
    }

    return (
      <EmployeeSummaryTemplate
        employee={selectedEmployee}
        company={selectedCompany}
        center={selectedCenter}
        contract={selectedContract}
        incidents={incidents}
        payrolls={payrolls}
      />
    );
  }

  return (
    <div className="reports-page" style={styles.wrapper}>
      <div className="reports-screen-only" style={styles.kpiGrid}>
        <div style={styles.kpi}><span>Trabajadores alta</span><strong>{summary.activeEmployees}</strong></div>
        <div style={styles.kpi}><span>Contratos activos</span><strong>{summary.activeContracts}</strong></div>
        <div style={styles.kpi}><span>Incidencias abiertas</span><strong>{summary.openIncidents}</strong></div>
        <div style={styles.kpi}><span>Volumen nóminas</span><strong>{formatMoney(summary.payrollTotal)}</strong></div>
      </div>

      <div className="reports-screen-only">
        <PageCard title="Informes exportables" subtitle="Generador de listados CSV para análisis en Excel o LibreOffice Calc.">
          <div style={styles.filterPanel}>
            <div style={styles.filterGrid}>
              <div style={styles.controlGroup}>
                <label style={styles.label}>Empresa</label>
                <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)} style={styles.input}>
                  <option value="all">Todas las empresas</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </div>

              <div style={styles.controlGroup}>
                <label style={styles.label}>Categoría</label>
                <select value={selectedCategory} onChange={handleCategoryChange} style={styles.input}>
                  {reportCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                </select>
              </div>

              <div style={styles.controlGroup}>
                <label style={styles.label}>Tipo de informe</label>
                <select value={selectedReportId} onChange={handleReportChange} style={styles.input}>
                  {categoryReports.map((report) => <option key={report.id} value={report.id}>{report.label}</option>)}
                </select>
              </div>

              <div style={styles.periodGrid}>
                <div style={styles.controlGroup}>
                  <label style={styles.label}>Mes</label>
                  <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} style={styles.input}>
                    <option value="">Todos</option>
                    {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((month) => <option key={month} value={month}>{month}</option>)}
                  </select>
                </div>
                <div style={styles.controlGroup}>
                  <label style={styles.label}>Año</label>
                  <input value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} placeholder="2026" style={styles.input} />
                </div>
              </div>
            </div>

            <div style={styles.reportSummaryBox}>
              <div>
                <span style={styles.summaryLabel}>Ámbito</span>
                <strong>{selectedCompanyLabel}</strong>
              </div>
              <div>
                <span style={styles.summaryLabel}>Informe seleccionado</span>
                <strong>{selectedReport?.label}</strong>
                <p style={styles.summaryDescription}>{selectedReport?.description}</p>
              </div>
              <div>
                <span style={styles.summaryLabel}>Registros estimados</span>
                <strong>{currentReportData?.rows.length || 0}</strong>
              </div>
            </div>

            <div style={styles.actionsRow}>
              <button type="button" onClick={handleExportSelectedReport} style={styles.primaryButton}>Generar Excel CSV</button>
              <button type="button" onClick={handlePreviewReport} style={styles.secondaryButton}>Vista previa</button>
            </div>
          </div>

          {previewReport && (
            <div style={styles.previewTableBox}>
              <div style={styles.previewHeader}>
                <div>
                  <h3 style={styles.previewTitle}>Vista previa</h3>
                  <p style={styles.previewSubtitle}>Primeros registros del informe seleccionado.</p>
                </div>
                <span style={styles.previewCount}>{previewReport.rows.length} registros</span>
              </div>
              <div style={styles.tableScroll}>
                <table style={styles.dataTable}>
                  <thead>
                    <tr>{previewReport.columns.slice(0, 7).map((column) => <th key={column.key} style={styles.dataTh}>{column.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {previewReport.rows.slice(0, 6).map((row, index) => (
                      <tr key={index}>{previewReport.columns.slice(0, 7).map((column) => <td key={column.key} style={styles.dataTd}>{row[column.key] || "-"}</td>)}</tr>
                    ))}
                    {!previewReport.rows.length && <tr><td style={styles.dataTd} colSpan={previewReport.columns.slice(0, 7).length}>No hay registros con los filtros actuales.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </PageCard>
      </div>

      <PageCard title="Documentos HTML" subtitle="Motor inicial de plantillas: datos ERP + plantilla = documento profesional imprimible.">
        <div className="reports-screen-only" style={styles.controls}>
          <div style={styles.controlGroup}>
            <label style={styles.label}>Trabajador</label>
            <select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} style={styles.input} disabled={loading || employees.length === 0}>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{getEmployeeName(employee)} · {employee.dni}</option>
              ))}
            </select>
          </div>

          <div style={styles.controlGroup}>
            <label style={styles.label}>Documento</label>
            <select value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)} style={styles.input}>
              <option value="employee-summary">Expediente laboral</option>
              <option value="contract">Contrato laboral simulado</option>
              <option value="checklist">Checklist documental</option>
              <option value="incidents">Informe de incidencias</option>
            </select>
          </div>

          <button type="button" onClick={printPreview} style={styles.printButton}>Imprimir / guardar PDF</button>
        </div>

        <div className="report-preview-frame" style={styles.previewFrame}>{renderTemplate()}</div>
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" },
  kpi: { border: "1px solid #d1d5db", backgroundColor: "#fff", borderLeft: "5px solid #e6d85c", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" },
  filterPanel: { border: "1px solid #d1d5db", backgroundColor: "#fafafa", padding: "18px", display: "flex", flexDirection: "column", gap: "18px" },
  filterGrid: { display: "grid", gridTemplateColumns: "1.1fr 0.8fr 1.2fr 0.9fr", gap: "14px", alignItems: "end" },
  periodGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  reportSummaryBox: { display: "grid", gridTemplateColumns: "1fr 1.6fr 0.7fr", gap: "14px", backgroundColor: "#fff", border: "1px solid #d1d5db", padding: "14px" },
  summaryLabel: { display: "block", fontSize: "11px", color: "#6b7280", textTransform: "uppercase", fontWeight: 900, marginBottom: "4px" },
  summaryDescription: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  actionsRow: { display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: "14px" },
  primaryButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", padding: "10px 16px", fontWeight: 900, cursor: "pointer", borderRadius: "6px" },
  secondaryButton: { backgroundColor: "#fff", color: "#111827", border: "1px solid #d1d5db", padding: "10px 16px", fontWeight: 900, cursor: "pointer", borderRadius: "6px" },
  previewTableBox: { border: "1px solid #d1d5db", backgroundColor: "#fff", marginTop: "18px" },
  previewHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", padding: "14px", borderBottom: "1px solid #e5e7eb" },
  previewTitle: { margin: 0, fontSize: "17px", fontWeight: 900 },
  previewSubtitle: { margin: "2px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  previewCount: { border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "5px 9px", fontSize: "12px", fontWeight: 900 },
  tableScroll: { overflowX: "auto" },
  dataTable: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  dataTh: { textAlign: "left", padding: "10px", backgroundColor: "#f8f3b5", borderBottom: "2px solid #111", whiteSpace: "nowrap", fontWeight: 900 },
  dataTd: { padding: "10px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" },
  printButton: { backgroundColor: "#f8f3b5", color: "#111", border: "2px solid #111", padding: "9px 14px", fontWeight: 900, cursor: "pointer", height: "39px" },
  controls: { display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr) auto", gap: "12px", alignItems: "end", marginBottom: "20px" },
  controlGroup: { display: "flex", flexDirection: "column", gap: "5px" },
  label: { fontSize: "13px", fontWeight: 800, color: "#374151" },
  input: { width: "100%", height: "39px", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "7px", fontSize: "13px", backgroundColor: "#fff" },
  previewFrame: { backgroundColor: "#f3f4f6", border: "1px solid #d1d5db", padding: "24px", overflowX: "auto" },
  emptyPreview: { backgroundColor: "#fff", border: "2px dashed #9ca3af", padding: "28px", color: "#6b7280", fontWeight: 800 },
};

const documentStyles = {
  sheet: { width: "794px", minHeight: "980px", margin: "0 auto", backgroundColor: "#fff", color: "#111", padding: "42px", boxSizing: "border-box", border: "1px solid #d1d5db", fontFamily: "Arial, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", gap: "24px", borderBottom: "4px solid #111", paddingBottom: "18px", marginBottom: "28px" },
  brand: { margin: "0 0 8px", fontWeight: 900, textTransform: "uppercase", color: "#a16207", letterSpacing: "0.06em" },
  title: { margin: 0, fontSize: "28px", textTransform: "uppercase" },
  subtitle: { margin: "6px 0 0", color: "#4b5563", fontWeight: 700 },
  metaBox: { border: "2px solid #111", padding: "10px", display: "flex", flexDirection: "column", gap: "4px", minWidth: "170px", fontSize: "12px" },
  highlightGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "22px" },
  twoColumns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" },
  block: { border: "1px solid #d1d5db", padding: "16px", marginBottom: "18px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  okStatus: { color: "#166534", fontWeight: 900 },
  pendingStatus: { color: "#92400e", fontWeight: 900 },
  signatureGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginTop: "70px" },
  footer: { borderTop: "1px solid #d1d5db", marginTop: "28px", paddingTop: "12px", fontSize: "11px", color: "#6b7280" },
};
