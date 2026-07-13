import { useCallback, useEffect, useState } from "react";

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
import IrpfPage from "./pages/IrpfPage";
import ModuleDashboardPage from "./pages/ModuleDashboardPage";
import PayrollConceptsPage from "./pages/PayrollConceptsPage";
import PayrollHistoryPage from "./pages/PayrollHistoryPage";
import PayrollIndividualPage from "./pages/PayrollIndividualPage";
import PayrollMonthlyPreparationPage from "./pages/PayrollMonthlyPreparationPage";
import PayrollsPage from "./pages/PayrollsPage";
import PayrollSimulationPage from "./pages/PayrollSimulationPage";
import PermanentPayrollConceptsPage from "./pages/PermanentPayrollConceptsPage";
import SocialSecurityDashboardPage from "./pages/SocialSecurityDashboardPage";
import SocialSecuritySettlementsPage from "./pages/SocialSecuritySettlementsPage";

import { useAppData } from "./hooks/useAppData";
import { useCompaniesModule } from "./hooks/useCompaniesModule";
import { useContractsModule } from "./hooks/useContractsModule";
import { useEmployeesModule } from "./hooks/useEmployeesModule";
import { useIncidentsModule } from "./hooks/useIncidentsModule";
import { usePayrollsModule } from "./hooks/usePayrollsModule";

const overlayPages = new Set([
  "employee-admissions",
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

const employeePages = new Set(["employees", "employees-list", "employee-record"]);

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
    prefillEmployeeFromExisting,
    setEmployeeError,
    setNextEmployeeCode,
  } = useEmployeesModule({ onDataChanged: () => loadData() });

  useEffect(() => {
    const handleOpenPage = (event) => {
      const page = event.detail?.page;
      if (page) setActivePage(page);
    };

    window.addEventListener("aulanomina-open-page", handleOpenPage);
    return () => window.removeEventListener("aulanomina-open-page", handleOpenPage);
  }, []);

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
    documents,
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
    if (activePage === "companies-dashboard") return "Empresas / Centros";
    if (activePage === "workers-dashboard") return "Trabajador";
    if (activePage === "contracts-dashboard") return "Contratos";
    if (activePage === "companies") return "Empresas / Centros";
    if (activePage === "employees") return "Nuevo trabajador";
    if (activePage === "employees-list") return "Listado de trabajadores";
    if (activePage === "employee-record") return "Expediente del trabajador";
    if (activePage === "contracts") return "Contratos";
    if (activePage === "collective-agreements") return "Convenios";
    if (activePage === "payroll-concepts") return "Historial de conceptos";
    if (activePage === "permanent-payroll-concepts") return "Conceptos permanentes";
    if (activePage === "payroll-monthly-preparation") return "Preparar nóminas";
    if (activePage === "payroll-individual") return "Nómina individual";
    if (activePage === "payroll-simulation") return "Simulación de nóminas";
    if (activePage === "payroll-history") return "Histórico de nóminas";
    if (activePage === "irpf") return "IRPF";
    if (activePage === "payrolls") return "Nóminas";
    if (activePage === "social-security-dashboard") return "Seguros sociales";
    if (activePage === "social-security-settlements") return "Liquidaciones de Seguridad Social";
    if (activePage === "social-security-files") return "Ficheros de Seguridad Social";
    if (activePage === "incidents") return "Incidencias laborales";
    if (activePage === "documents") return "Documentos";
    if (activePage === "alerts") return "Alertas laborales";
    if (activePage === "reports") return "Informes";
    if (overlayPages.has(activePage)) return "AulaNomina";
    return "AulaNomina";
  }

  function getSubtitle() {
    if (activePage === "dashboard") return "Resumen del entorno de simulación";
    if (activePage === "companies-dashboard") return "Resumen visual del módulo de empresas, centros y estructura organizativa";
    if (activePage === "workers-dashboard") return "Resumen visual del módulo de trabajadores y expedientes";
    if (activePage === "contracts-dashboard") return "Resumen visual del módulo contractual";
    if (activePage === "companies") return "Gestión de empresas madre y centros de trabajo";
    if (activePage === "employees") return "Alta de datos personales y administrativos del trabajador";
    if (activePage === "employees-list") return "Consulta y mantenimiento operativo de trabajadores";
    if (activePage === "employee-record") return "Expediente personal, laboral y documental del trabajador";
    if (activePage === "contracts") return "Gestión de contratos laborales";
    if (activePage === "collective-agreements") return "Parámetros de convenio para consulta didáctica y salario base mínimo";
    if (activePage === "payroll-concepts") return "Catálogo general de conceptos de sistema, personalizados y de convenio";
    if (activePage === "permanent-payroll-concepts") return "Conceptos recurrentes asociados a contratos";
    if (activePage === "payroll-monthly-preparation") return "Preparación masiva mensual por empresa y centro";
    if (activePage === "payroll-individual") return "Creación manual de una nómina concreta";
    if (activePage === "payroll-simulation") return "Previsión y escenarios sin generar nóminas reales";
    if (activePage === "payroll-history") return "Consulta, revisión y desglose de nóminas generadas";
    if (activePage === "irpf") return "Cálculo anual del trabajador, previsión mensual, IRPF voluntario y recálculo";
    if (activePage === "payrolls") return "Generación y consulta de nóminas simuladas";
    if (activePage === "social-security-dashboard") return "Resumen de liquidaciones, estados y ficheros generados";
    if (activePage === "social-security-settlements") return "Preparación, validación, confirmación y generación por empresa, CCC y periodo";
    if (activePage === "social-security-files") return "Consulta y descarga de los ficheros generados";
    if (activePage === "incidents") return "Gestión de IT, recaídas, vacaciones, ausencias y permisos";
    if (activePage === "documents") return "Gestión documental del expediente laboral";
    if (activePage === "alerts") return "Vencimientos, pendientes y revisiones laborales";
    if (activePage === "reports") return "Listados e informes del entorno de simulación";
    return "";
  }

  const handleDuplicateEmployee = (employee) => {
    prefillEmployeeFromExisting(employee, "Datos copiados. Selecciona la nueva empresa/centro y guarda el alta duplicada.");
    setActivePage("employees");
  };

  const handleOpenEmployeeRecord = (employee) => {
    if (employee?.id) window.sessionStorage.setItem("aulanomina:selectedEmployeeId", String(employee.id));
    setActivePage("employee-record");
  };

  function renderEmployeesPage(mode) {
    return (
      <EmployeesPage
        mode={mode}
        loading={loading}
        employees={employees}
        companies={companies.filter((company) => company.is_active)}
        workCenters={workCenters.filter((center) => center.is_active)}
        contracts={contracts}
        incidents={incidents}
        payrolls={payrolls}
        documents={documents}
        employeeForm={employeeForm}
        onEmployeeChange={handleEmployeeChange}
        onEmployeeSubmit={handleEmployeeSubmit}
        onUpdateEmployee={handleUpdateEmployee}
        onDeleteEmployee={handleDeleteEmployee}
        onOpenRecord={handleOpenEmployeeRecord}
        onDuplicateEmployee={handleDuplicateEmployee}
        onPrefillEmployee={prefillEmployeeFromExisting}
        employeeError={employeeError}
        employeeSuccess={employeeSuccess}
        employeeSubmitting={employeeSubmitting}
      />
    );
  }

  function renderModuleDashboard(type) {
    return (
      <ModuleDashboardPage
        type={type}
        companies={companies}
        workCenters={workCenters}
        employees={employees}
        contracts={contracts}
      />
    );
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
          collectiveAgreements={collectiveAgreements}
        />
      );
    }

    if (activePage === "companies-dashboard") return renderModuleDashboard("companies");
    if (activePage === "workers-dashboard") return renderModuleDashboard("workers");
    if (activePage === "contracts-dashboard") return renderModuleDashboard("contracts");

    if (activePage === "social-security-dashboard") {
      return (
        <SocialSecurityDashboardPage
          companies={companies.filter((company) => company.is_active)}
          onNavigate={setActivePage}
        />
      );
    }

    if (activePage === "social-security-settlements") {
      return (
        <SocialSecuritySettlementsPage
          companies={companies.filter((company) => company.is_active)}
          initialSection="settlements"
        />
      );
    }

    if (activePage === "social-security-files") {
      return (
        <SocialSecuritySettlementsPage
          companies={companies.filter((company) => company.is_active)}
          initialSection="communications"
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

    if (activePage === "payroll-concepts") return <PayrollConceptsPage />;

    if (activePage === "permanent-payroll-concepts") {
      return (
        <PermanentPayrollConceptsPage
          contracts={contracts}
          employees={employees.filter((employee) => employee.is_active)}
          companies={companies.filter((company) => company.is_active)}
          workCenters={workCenters.filter((center) => center.is_active)}
        />
      );
    }

    if (activePage === "payroll-monthly-preparation") {
      return (
        <PayrollMonthlyPreparationPage
          companies={companies.filter((company) => company.is_active)}
          workCenters={workCenters.filter((center) => center.is_active)}
          onPrepared={loadData}
        />
      );
    }

    if (activePage === "payroll-individual") {
      return (
        <PayrollIndividualPage
          payrollForm={payrollForm}
          employees={employees.filter((employee) => employee.is_active)}
          contracts={contracts}
          companies={companies.filter((company) => company.is_active)}
          workCenters={workCenters.filter((center) => center.is_active)}
          onPayrollChange={handlePayrollChange}
          onPayrollSubmit={handlePayrollSubmit}
          payrollError={payrollError}
          payrollSuccess={payrollSuccess}
          payrollSubmitting={payrollSubmitting}
        />
      );
    }

    if (activePage === "payroll-simulation") {
      return (
        <PayrollSimulationPage
          employees={employees.filter((employee) => employee.is_active)}
          contracts={contracts}
        />
      );
    }

    if (activePage === "payroll-history") {
      return (
        <PayrollHistoryPage
          loading={loading}
          payrolls={payrolls}
          employees={employees}
          contracts={contracts}
          companies={companies}
          workCenters={workCenters}
          onUpdatePayroll={handleUpdatePayroll}
          onDeletePayroll={handleDeletePayroll}
          payrollSubmitting={payrollSubmitting}
        />
      );
    }

    if (activePage === "irpf") {
      return (
        <IrpfPage
          employees={employees.filter((employee) => employee.is_active)}
          contracts={contracts}
          onRefresh={loadData}
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

    if (employeePages.has(activePage)) {
      const mode = activePage === "employees-list" ? "list" : activePage === "employee-record" ? "record" : "new";
      return renderEmployeesPage(mode);
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
