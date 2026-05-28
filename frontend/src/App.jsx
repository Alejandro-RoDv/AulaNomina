import { useCallback, useState } from "react";

import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import AlertsRoute from "./components/alerts/AlertsRoute";
import CaseStudiesRoute from "./components/case-studies/CaseStudiesRoute";
import DocumentsRoute from "./components/documents/DocumentsRoute";
import EmployeesRoute from "./components/employees/EmployeesRoute";
import ReportsRoute from "./components/reports/ReportsRoute";

import Dashboard from "./pages/Dashboard";
import CollectiveAgreementsPage from "./pages/CollectiveAgreementsPage";
import CompaniesPage from "./pages/CompaniesPage";
import ContractsPage from "./pages/ContractsPage";
import EmployeesPage from "./pages/EmployeesPage";
import IncidentsPage from "./pages/IncidentsPage";
import PayrollsPage from "./pages/PayrollsPage";

import { useAppData } from "./hooks/useAppData";
import { useCompaniesModule } from "./hooks/useCompaniesModule";
import { useContractsModule } from "./hooks/useContractsModule";
import { useEmployeesModule } from "./hooks/useEmployeesModule";
import { useIncidentsModule } from "./hooks/useIncidentsModule";
import { usePayrollsModule } from "./hooks/usePayrollsModule";

const overlayPages = new Set([
  "employee-admissions",
  "employee-record",
  "documents",
  "alerts",
  "reports",
  "teacher-dashboard",
  "teaching-alerts",
  "case-studies",
  "assignments",
  "corrections",
  "student-demo",
  "students",
  "groups",
  "progress",
]);

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    employeeForm,
    employeeSubmitting,
    employeeError,
    employeeSuccess,
    handleEmployeeChange,
    handleEmployeeSubmit,
    handleUpdateEmployee,
    handleDeleteEmployee,
    setEmployeeError,
    setNextEmployeeCode,
  } = useEmployeesModule({ onDataChanged: () => loadData() });

  const handleGlobalLoadError = useCallback(() => {
    setContractError("Error cargando datos");
    setCompanyError("Error cargando datos");
    setWorkCenterError("Error cargando datos");
    setEmployeeError("Error cargando datos");
    setIncidentError("Error cargando datos");
    setPayrollError("Error cargando datos");
  }, []);

  const {
    contracts,
    employees,
    companies,
    workCenters,
    incidents,
    payrolls,
    collectiveAgreements,
    loading,
    loadData,
    resetDemoLoading,
    resetDemoMessage,
    resetDemoError,
    handleResetDemo,
    clearResetDemoMessages,
  } = useAppData({
    onLoadError: handleGlobalLoadError,
    onNextEmployeeCode: setNextEmployeeCode,
  });

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

  const {
    incidentForm,
    incidentSubmitting,
    incidentError,
    incidentSuccess,
    handleIncidentChange,
    handleIncidentSubmit,
    handleUpdateIncident,
    handleDeleteIncident,
    setIncidentError,
  } = useIncidentsModule({ contracts, onDataChanged: () => loadData() });

  const {
    payrollForm,
    payrollSubmitting,
    payrollError,
    payrollSuccess,
    handlePayrollChange,
    handlePayrollSubmit,
    handleUpdatePayroll,
    handleDeletePayroll,
    setPayrollError,
  } = usePayrollsModule({ contracts, onDataChanged: () => loadData() });

  function getTitle() {
    if (activePage === "dashboard") return "Dashboard";
    if (activePage === "companies") return "Empresas / Centros";
    if (activePage === "employees") return "Trabajadores";
    if (activePage === "contracts") return "Contratos";
    if (activePage === "collective-agreements") return "Convenios";
    if (activePage === "payrolls") return "Nóminas";
    if (activePage === "incidents") return "Incidencias laborales";
    if (activePage === "documents") return "Documentos";
    if (activePage === "alerts") return "Alertas laborales";
    if (activePage === "reports") return "Informes";
    if (overlayPages.has(activePage)) return "AulaNomina";
    return "AulaNomina";
  }

  function getSubtitle() {
    if (activePage === "dashboard") return "Resumen del entorno de simulación";
    if (activePage === "companies") return "Gestión de empresas madre y centros de trabajo";
    if (activePage === "employees") return "Gestión de trabajadores";
    if (activePage === "contracts") return "Gestión de contratos laborales";
    if (activePage === "collective-agreements") return "Parámetros de convenio para consulta didáctica y salario base mínimo";
    if (activePage === "payrolls") return "Generación y consulta de nóminas simuladas";
    if (activePage === "incidents") return "Gestión de IT, recaídas, vacaciones, ausencias y permisos";
    if (activePage === "documents") return "Gestión documental del expediente laboral";
    if (activePage === "alerts") return "Vencimientos, pendientes y revisiones laborales";
    if (activePage === "reports") return "Listados e informes del entorno de simulación";
    return "";
  }

  function renderPage() {
    if (overlayPages.has(activePage)) return null;

    if (activePage === "dashboard") {
      return (
        <Dashboard
          companies={companies}
          workCenters={workCenters}
          employees={employees}
          contracts={contracts}
          incidents={incidents}
          payrolls={payrolls}
        />
      );
    }

    if (activePage === "collective-agreements") {
      return (
        <CollectiveAgreementsPage
          loading={loading}
          collectiveAgreements={collectiveAgreements}
          onDataChanged={loadData}
        />
      );
    }

    if (activePage === "companies") {
      return (
        <CompaniesPage
          loading={loading}
          companies={companies}
          workCenters={workCenters}
          companyForm={companyForm}
          workCenterForm={workCenterForm}
          onCompanyChange={handleCompanyChange}
          onCompanySubmit={handleCompanySubmit}
          onUpdateCompany={handleUpdateCompany}
          onDeleteCompany={handleDeleteCompany}
          onWorkCenterChange={handleWorkCenterChange}
          onWorkCenterSubmit={handleWorkCenterSubmit}
          onUpdateWorkCenter={handleUpdateWorkCenter}
          onDeleteWorkCenter={handleDeleteWorkCenter}
          companyError={companyError}
          companySuccess={companySuccess}
          workCenterError={workCenterError}
          workCenterSuccess={workCenterSuccess}
          companySubmitting={companySubmitting}
          workCenterSubmitting={workCenterSubmitting}
        />
      );
    }

    if (activePage === "employees") {
      return (
        <EmployeesPage
          loading={loading}
          employees={employees}
          companies={companies.filter((company) => company.is_active)}
          workCenters={workCenters.filter((center) => center.is_active)}
          contracts={contracts}
          incidents={incidents}
          payrolls={payrolls}
          employeeForm={employeeForm}
          onEmployeeChange={handleEmployeeChange}
          onEmployeeSubmit={handleEmployeeSubmit}
          onUpdateEmployee={handleUpdateEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          employeeError={employeeError}
          employeeSuccess={employeeSuccess}
          employeeSubmitting={employeeSubmitting}
        />
      );
    }

    if (activePage === "contracts") {
      return (
        <ContractsPage
          loading={loading}
          contracts={contracts}
          employees={employees.filter((employee) => employee.is_active)}
          companies={companies.filter((company) => company.is_active)}
          workCenters={workCenters.filter((center) => center.is_active)}
          collectiveAgreements={collectiveAgreements}
          contractForm={contractForm}
          onContractChange={handleContractChange}
          onContractSubmit={handleContractSubmit}
          onUpdateContract={handleUpdateContract}
          onDeleteContract={handleDeleteContract}
          contractError={contractError}
          contractSuccess={contractSuccess}
          contractSubmitting={contractSubmitting}
        />
      );
    }

    if (activePage === "payrolls") {
      return (
        <PayrollsPage
          loading={loading}
          payrolls={payrolls}
          employees={employees.filter((employee) => employee.is_active)}
          contracts={contracts}
          companies={companies.filter((company) => company.is_active)}
          workCenters={workCenters.filter((center) => center.is_active)}
          payrollForm={payrollForm}
          onPayrollChange={handlePayrollChange}
          onPayrollSubmit={handlePayrollSubmit}
          onUpdatePayroll={handleUpdatePayroll}
          onDeletePayroll={handleDeletePayroll}
          payrollError={payrollError}
          payrollSuccess={payrollSuccess}
          payrollSubmitting={payrollSubmitting}
        />
      );
    }

    if (activePage === "incidents") {
      return (
        <IncidentsPage
          loading={loading}
          incidents={incidents}
          employees={employees.filter((employee) => employee.is_active)}
          contracts={contracts}
          companies={companies.filter((company) => company.is_active)}
          workCenters={workCenters.filter((center) => center.is_active)}
          incidentForm={incidentForm}
          onIncidentChange={handleIncidentChange}
          onIncidentSubmit={handleIncidentSubmit}
          onUpdateIncident={handleUpdateIncident}
          onDeleteIncident={handleDeleteIncident}
          incidentError={incidentError}
          incidentSuccess={incidentSuccess}
          incidentSubmitting={incidentSubmitting}
        />
      );
    }

    return <p>Módulo en preparación</p>;
  }

  return (
    <div style={styles.appFrame}>
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div style={styles.mainWrapper}>
        <Header
          title={getTitle()}
          subtitle={getSubtitle()}
          settingsOpen={settingsOpen}
          onOpenSettings={() => {
            clearResetDemoMessages();
            setSettingsOpen(true);
          }}
          onCloseSettings={() => setSettingsOpen(false)}
          onResetDemo={handleResetDemo}
          resetDemoLoading={resetDemoLoading}
          resetDemoMessage={resetDemoMessage}
          resetDemoError={resetDemoError}
        />
        <main style={styles.main}>{renderPage()}</main>
        <EmployeesRoute />
        <DocumentsRoute />
        <AlertsRoute />
        <ReportsRoute />
        <CaseStudiesRoute />
        <footer style={styles.footer}>AulaNomina · Entorno educativo de simulación laboral · Demo MVP</footer>
      </div>
    </div>
  );
}

const styles = {
  appFrame: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#ffffff",
    color: "#1f2937",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  mainWrapper: {
    marginLeft: "272px",
    width: "calc(100% - 272px)",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#ffffff",
  },
  main: {
    flex: 1,
    padding: "26px 42px 48px 32px",
    boxSizing: "border-box",
    maxWidth: "1320px",
    width: "100%",
  },
  footer: {
    borderTop: "1px solid #d1d5db",
    padding: "12px 34px",
    color: "#4b5563",
    fontSize: "12px",
    fontWeight: 600,
    backgroundColor: "#f3f4f6",
  },
};
