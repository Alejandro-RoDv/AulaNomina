import { useEffect, useState } from "react";

import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";

import Dashboard from "./pages/Dashboard";
import CompaniesPage from "./pages/CompaniesPage";
import ContractsPage from "./pages/ContractsPage";
import EmployeesPage from "./pages/EmployeesPage";
import IncidentsPage from "./pages/IncidentsPage";
import PayrollsPage from "./pages/PayrollsPage";

import { useCompaniesModule } from "./hooks/useCompaniesModule";
import { useContractsModule } from "./hooks/useContractsModule";
import { fetchContracts, resetDemo } from "./services/api";
import { createEmployee, deleteEmployee, fetchAllEmployees, fetchNextEmployeeCode, updateEmployee } from "./services/employeeApi";
import { createIncident, deleteIncident, fetchIncidents, updateIncident } from "./services/incidentApi";
import { createPayroll, deletePayroll, fetchPayrolls, updatePayroll } from "./services/payrollApi";
import { fetchCompanies } from "./services/companyApi";
import { fetchWorkCenters } from "./services/workCenterApi";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const initialEmployeeForm = { employee_code: "", company_id: "", center_id: "", dni: "", naf: "", first_name: "", last_name: "", email: "", phone: "", birth_date: "", address: "", city: "", province: "", postal_code: "" };
const initialIncidentForm = { employee_id: "", contract_id: "", company_id: "", center_id: "", incident_type: "", start_date: "", end_date: "", description: "", status: "open" };
const initialPayrollForm = { employee_id: "", contract_id: "", company_id: "", center_id: "", period_month: String(currentMonth), period_year: String(currentYear), salary_supplement_1: "0", salary_supplement_2: "0", salary_supplement_3: "0", irpf_percentage: "10", status: "pending" };

function buildEmployeePayload(form) {
  return { ...form, company_id: form.company_id ? Number(form.company_id) : null, center_id: form.center_id ? Number(form.center_id) : null, naf: form.naf || null, email: form.email || null, phone: form.phone || null, birth_date: form.birth_date || null, address: form.address || null, city: form.city || null, province: form.province || null, postal_code: form.postal_code || null, is_active: form.is_active ?? true };
}

function buildIncidentPayload(form) {
  return { employee_id: Number(form.employee_id), contract_id: Number(form.contract_id), company_id: Number(form.company_id), center_id: form.center_id ? Number(form.center_id) : null, incident_type: form.incident_type, start_date: form.start_date, end_date: form.end_date || null, description: form.description || null, status: form.status };
}

function buildIncidentUpdatePayload(form) {
  return { center_id: form.center_id ? Number(form.center_id) : null, incident_type: form.incident_type, start_date: form.start_date, end_date: form.end_date || null, description: form.description || null, status: form.status };
}

function getSalarySupplementsTotal(form) {
  return Number(form.salary_supplement_1 || 0) + Number(form.salary_supplement_2 || 0) + Number(form.salary_supplement_3 || 0);
}

function buildPayrollPayload(form) {
  return { employee_id: Number(form.employee_id), contract_id: Number(form.contract_id), company_id: form.company_id ? Number(form.company_id) : null, center_id: form.center_id ? Number(form.center_id) : null, period_month: Number(form.period_month), period_year: Number(form.period_year), salary_supplements: getSalarySupplementsTotal(form), irpf_percentage: form.irpf_percentage ? Number(form.irpf_percentage) : 10, status: form.status };
}

function buildPayrollUpdatePayload(form) {
  return { center_id: form.center_id ? Number(form.center_id) : null, period_month: Number(form.period_month), period_year: Number(form.period_year), salary_supplements: getSalarySupplementsTotal(form), irpf_percentage: form.irpf_percentage ? Number(form.irpf_percentage) : 10, status: form.status };
}

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetDemoLoading, setResetDemoLoading] = useState(false);
  const [resetDemoMessage, setResetDemoMessage] = useState("");
  const [resetDemoError, setResetDemoError] = useState("");
  const [employeeSubmitting, setEmployeeSubmitting] = useState(false);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [payrollSubmitting, setPayrollSubmitting] = useState(false);
  const [employeeError, setEmployeeError] = useState("");
  const [employeeSuccess, setEmployeeSuccess] = useState("");
  const [incidentError, setIncidentError] = useState("");
  const [incidentSuccess, setIncidentSuccess] = useState("");
  const [payrollError, setPayrollError] = useState("");
  const [payrollSuccess, setPayrollSuccess] = useState("");
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);
  const [incidentForm, setIncidentForm] = useState(initialIncidentForm);
  const [payrollForm, setPayrollForm] = useState(initialPayrollForm);

  const {
    contractForm,
    contractSubmitting,
    contractError,
    contractSuccess,
    handleContractChange,
    handleContractSubmit,
    handleUpdateContract,
    handleDeleteContract,
    setContractError,
  } = useContractsModule({ onDataChanged: () => loadData() });

  const {
    companyForm,
    workCenterForm,
    companySubmitting,
    workCenterSubmitting,
    companyError,
    companySuccess,
    workCenterError,
    workCenterSuccess,
    handleCompanyChange,
    handleCompanySubmit,
    handleUpdateCompany,
    handleDeleteCompany,
    handleWorkCenterChange,
    handleWorkCenterSubmit,
    handleUpdateWorkCenter,
    handleDeleteWorkCenter,
    setCompanyError,
    setWorkCenterError,
  } = useCompaniesModule({ companies, onDataChanged: () => loadData() });

  const loadNextEmployeeCode = async () => {
    const data = await fetchNextEmployeeCode();
    setEmployeeForm((prev) => ({ ...prev, employee_code: data.employee_code }));
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [contractsData, employeesData, companiesData, workCentersData, incidentsData, payrollsData, nextEmployeeCodeData] = await Promise.all([
        fetchContracts(), fetchAllEmployees(), fetchCompanies(), fetchWorkCenters(), fetchIncidents(), fetchPayrolls(), fetchNextEmployeeCode(),
      ]);
      setContracts(contractsData);
      setEmployees(employeesData);
      setCompanies(companiesData);
      setWorkCenters(workCentersData);
      setIncidents(incidentsData);
      setPayrolls(payrollsData);
      setEmployeeForm((prev) => ({ ...prev, employee_code: nextEmployeeCodeData.employee_code }));
    } catch {
      setContractError("Error cargando datos");
      setCompanyError("Error cargando datos");
      setWorkCenterError("Error cargando datos");
      setEmployeeError("Error cargando datos");
      setIncidentError("Error cargando datos");
      setPayrollError("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleResetDemo = async () => {
    const confirmed = window.confirm("Esto reiniciará únicamente los datos demo de Fundación AulaNomina. Los demás datos no deberían tocarse. ¿Continuar?");
    if (!confirmed) return;
    setResetDemoError("");
    setResetDemoMessage("");
    try {
      setResetDemoLoading(true);
      const data = await resetDemo();
      setResetDemoMessage(data.message || "Demo reiniciada correctamente");
      await loadData();
    } catch (err) {
      setResetDemoError(err.message || "Error al reiniciar la demo");
    } finally {
      setResetDemoLoading(false);
    }
  };

  const handleEmployeeChange = (event) => {
    const { name, value } = event.target;
    setEmployeeForm((prev) => name === "company_id" ? { ...prev, company_id: value, center_id: "" } : { ...prev, [name]: value });
  };

  const handleIncidentChange = (event) => {
    const { name, value } = event.target;
    setIncidentForm((prev) => {
      if (name === "employee_id") return { ...prev, employee_id: value, contract_id: "", company_id: "", center_id: "" };
      if (name === "contract_id") {
        const selectedContract = contracts.find((contract) => String(contract.id) === String(value));
        return { ...prev, contract_id: value, company_id: selectedContract?.company_id ? String(selectedContract.company_id) : "", center_id: selectedContract?.center_id ? String(selectedContract.center_id) : "" };
      }
      return { ...prev, [name]: value };
    });
  };

  const handlePayrollChange = (event) => {
    const { name, value } = event.target;
    setPayrollForm((prev) => {
      if (name === "employee_id") return { ...prev, employee_id: value, contract_id: "", company_id: "", center_id: "" };
      if (name === "contract_id") {
        const selectedContract = contracts.find((contract) => String(contract.id) === String(value));
        return { ...prev, contract_id: value, company_id: selectedContract?.company_id ? String(selectedContract.company_id) : "", center_id: selectedContract?.center_id ? String(selectedContract.center_id) : "" };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleEmployeeSubmit = async (event) => {
    event.preventDefault(); setEmployeeError(""); setEmployeeSuccess("");
    try { setEmployeeSubmitting(true); await createEmployee(buildEmployeePayload({ ...employeeForm, is_active: true })); setEmployeeSuccess("Trabajador creado correctamente"); setEmployeeForm(initialEmployeeForm); await loadData(); } catch (err) { setEmployeeError(err.message || "Error al crear trabajador"); await loadNextEmployeeCode(); } finally { setEmployeeSubmitting(false); }
  };

  const handleUpdateEmployee = async (employeeId, form) => {
    setEmployeeError(""); setEmployeeSuccess("");
    try { setEmployeeSubmitting(true); await updateEmployee(employeeId, buildEmployeePayload(form)); setEmployeeSuccess("Trabajador actualizado correctamente"); await loadData(); } catch (err) { setEmployeeError(err.message || "Error al actualizar trabajador"); throw err; } finally { setEmployeeSubmitting(false); }
  };

  const handleDeleteEmployee = async (employeeId) => {
    setEmployeeError(""); setEmployeeSuccess("");
    try { setEmployeeSubmitting(true); await deleteEmployee(employeeId); setEmployeeSuccess("Trabajador desactivado correctamente"); await loadData(); } catch (err) { setEmployeeError(err.message || "Error al desactivar trabajador"); throw err; } finally { setEmployeeSubmitting(false); }
  };

  const handleIncidentSubmit = async (event) => {
    event.preventDefault(); setIncidentError(""); setIncidentSuccess("");
    try { setIncidentSubmitting(true); await createIncident(buildIncidentPayload(incidentForm)); setIncidentSuccess("Incidencia creada correctamente"); setIncidentForm(initialIncidentForm); await loadData(); } catch (err) { setIncidentError(err.message || "Error al crear incidencia"); } finally { setIncidentSubmitting(false); }
  };

  const handleUpdateIncident = async (incidentId, form) => {
    setIncidentError(""); setIncidentSuccess("");
    try { setIncidentSubmitting(true); await updateIncident(incidentId, buildIncidentUpdatePayload(form)); setIncidentSuccess("Incidencia actualizada correctamente"); await loadData(); } catch (err) { setIncidentError(err.message || "Error al actualizar incidencia"); throw err; } finally { setIncidentSubmitting(false); }
  };

  const handleDeleteIncident = async (incidentId) => {
    setIncidentError(""); setIncidentSuccess("");
    try { setIncidentSubmitting(true); await deleteIncident(incidentId); setIncidentSuccess("Incidencia eliminada correctamente"); await loadData(); } catch (err) { setIncidentError(err.message || "Error al eliminar incidencia"); throw err; } finally { setIncidentSubmitting(false); }
  };

  const handlePayrollSubmit = async (event) => {
    event.preventDefault(); setPayrollError(""); setPayrollSuccess("");
    try { setPayrollSubmitting(true); await createPayroll(buildPayrollPayload(payrollForm)); setPayrollSuccess("Nómina generada correctamente"); setPayrollForm(initialPayrollForm); await loadData(); } catch (err) { setPayrollError(err.message || "Error al generar nómina"); } finally { setPayrollSubmitting(false); }
  };

  const handleUpdatePayroll = async (payrollId, form) => {
    setPayrollError(""); setPayrollSuccess("");
    try { setPayrollSubmitting(true); await updatePayroll(payrollId, buildPayrollUpdatePayload(form)); setPayrollSuccess("Nómina actualizada correctamente"); await loadData(); } catch (err) { setPayrollError(err.message || "Error al actualizar nómina"); throw err; } finally { setPayrollSubmitting(false); }
  };

  const handleDeletePayroll = async (payrollId) => {
    setPayrollError(""); setPayrollSuccess("");
    try { setPayrollSubmitting(true); await deletePayroll(payrollId); setPayrollSuccess("Nómina eliminada correctamente"); await loadData(); } catch (err) { setPayrollError(err.message || "Error al eliminar nómina"); throw err; } finally { setPayrollSubmitting(false); }
  };

  function getTitle() {
    if (activePage === "dashboard") return "Dashboard";
    if (activePage === "companies") return "Empresas / Centros";
    if (activePage === "employees") return "Trabajadores";
    if (activePage === "contracts") return "Contratos";
    if (activePage === "payrolls") return "Nóminas";
    if (activePage === "incidents") return "Incidencias laborales";
    return "AulaNomina";
  }

  function getSubtitle() {
    if (activePage === "dashboard") return "Resumen del entorno de simulación";
    if (activePage === "companies") return "Gestión de empresas madre y centros de trabajo";
    if (activePage === "employees") return "Gestión de trabajadores";
    if (activePage === "contracts") return "Gestión de contratos laborales";
    if (activePage === "payrolls") return "Generación y consulta de nóminas simuladas";
    if (activePage === "incidents") return "Gestión de IT, recaídas, vacaciones, ausencias y permisos";
    return "";
  }

  function renderPage() {
    if (activePage === "dashboard") return <Dashboard companies={companies} workCenters={workCenters} employees={employees} contracts={contracts} incidents={incidents} payrolls={payrolls} />;
    if (activePage === "companies") return <CompaniesPage loading={loading} companies={companies} workCenters={workCenters} companyForm={companyForm} workCenterForm={workCenterForm} onCompanyChange={handleCompanyChange} onCompanySubmit={handleCompanySubmit} onUpdateCompany={handleUpdateCompany} onDeleteCompany={handleDeleteCompany} onWorkCenterChange={handleWorkCenterChange} onWorkCenterSubmit={handleWorkCenterSubmit} onUpdateWorkCenter={handleUpdateWorkCenter} onDeleteWorkCenter={handleDeleteWorkCenter} companyError={companyError} companySuccess={companySuccess} workCenterError={workCenterError} workCenterSuccess={workCenterSuccess} companySubmitting={companySubmitting} workCenterSubmitting={workCenterSubmitting} />;
    if (activePage === "employees") return <EmployeesPage loading={loading} employees={employees} companies={companies.filter((company) => company.is_active)} workCenters={workCenters.filter((center) => center.is_active)} contracts={contracts} incidents={incidents} payrolls={payrolls} employeeForm={employeeForm} onEmployeeChange={handleEmployeeChange} onEmployeeSubmit={handleEmployeeSubmit} onUpdateEmployee={handleUpdateEmployee} onDeleteEmployee={handleDeleteEmployee} employeeError={employeeError} employeeSuccess={employeeSuccess} employeeSubmitting={employeeSubmitting} />;
    if (activePage === "contracts") return <ContractsPage loading={loading} contracts={contracts} employees={employees.filter((employee) => employee.is_active)} companies={companies.filter((company) => company.is_active)} workCenters={workCenters.filter((center) => center.is_active)} contractForm={contractForm} onContractChange={handleContractChange} onContractSubmit={handleContractSubmit} onUpdateContract={handleUpdateContract} onDeleteContract={handleDeleteContract} contractError={contractError} contractSuccess={contractSuccess} contractSubmitting={contractSubmitting} />;
    if (activePage === "payrolls") return <PayrollsPage loading={loading} payrolls={payrolls} employees={employees.filter((employee) => employee.is_active)} contracts={contracts} companies={companies.filter((company) => company.is_active)} workCenters={workCenters.filter((center) => center.is_active)} payrollForm={payrollForm} onPayrollChange={handlePayrollChange} onPayrollSubmit={handlePayrollSubmit} onUpdatePayroll={handleUpdatePayroll} onDeletePayroll={handleDeletePayroll} payrollError={payrollError} payrollSuccess={payrollSuccess} payrollSubmitting={payrollSubmitting} />;
    if (activePage === "incidents") return <IncidentsPage loading={loading} incidents={incidents} employees={employees.filter((employee) => employee.is_active)} contracts={contracts} companies={companies.filter((company) => company.is_active)} workCenters={workCenters.filter((center) => center.is_active)} incidentForm={incidentForm} onIncidentChange={handleIncidentChange} onIncidentSubmit={handleIncidentSubmit} onUpdateIncident={handleUpdateIncident} onDeleteIncident={handleDeleteIncident} incidentError={incidentError} incidentSuccess={incidentSuccess} incidentSubmitting={incidentSubmitting} />;
    return <p>Módulo en preparación</p>;
  }

  return (
    <div style={styles.appFrame}>
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div style={styles.mainWrapper}>
        <Header title={getTitle()} subtitle={getSubtitle()} settingsOpen={settingsOpen} onOpenSettings={() => { setResetDemoError(""); setResetDemoMessage(""); setSettingsOpen(true); }} onCloseSettings={() => setSettingsOpen(false)} onResetDemo={handleResetDemo} resetDemoLoading={resetDemoLoading} resetDemoMessage={resetDemoMessage} resetDemoError={resetDemoError} />
        <main style={styles.main}>{renderPage()}</main>
        <footer style={styles.footer}>AulaNomina · Entorno educativo de simulación laboral · Demo MVP</footer>
      </div>
    </div>
  );
}

const styles = {
  appFrame: { display: "flex", minHeight: "100vh", backgroundColor: "#ffffff", color: "#1f2937", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
  mainWrapper: { marginLeft: "272px", width: "calc(100% - 272px)", minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" },
  main: { flex: 1, padding: "26px 42px 48px 32px", boxSizing: "border-box", maxWidth: "1320px", width: "100%" },
  footer: { borderTop: "1px solid #d1d5db", padding: "12px 34px", color: "#4b5563", fontSize: "12px", fontWeight: 600, backgroundColor: "#f3f4f6" },
};
