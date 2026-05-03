import { useEffect, useState } from "react";

import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";

import Dashboard from "./pages/Dashboard";
import CompaniesPage from "./pages/CompaniesPage";
import ContractsPage from "./pages/ContractsPage";
import EmployeesPage from "./pages/EmployeesPage";

import { createContract, fetchContracts } from "./services/api";
import { createCompany, fetchCompanies } from "./services/companyApi";
import { createEmployee, deleteEmployee, fetchAllEmployees, fetchNextEmployeeCode, updateEmployee } from "./services/employeeApi";

const initialContractForm = {
  employee_id: "",
  company_id: "",
  contract_type: "",
  start_date: "",
  end_date: "",
  salary_base: "",
  status: "active",
};

const initialCompanyForm = {
  name: "",
  cif: "",
  ccc: "",
  address: "",
  city: "",
  province: "",
};

const initialEmployeeForm = {
  employee_code: "",
  dni: "",
  naf: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  birth_date: "",
  address: "",
  city: "",
  province: "",
  postal_code: "",
};

function buildEmployeePayload(form) {
  return {
    ...form,
    naf: form.naf || null,
    email: form.email || null,
    phone: form.phone || null,
    birth_date: form.birth_date || null,
    address: form.address || null,
    city: form.city || null,
    province: form.province || null,
    postal_code: form.postal_code || null,
    is_active: form.is_active ?? true,
  };
}

function buildCompanyPayload(form) {
  return {
    ...form,
    ccc: form.ccc || null,
    address: form.address || null,
    city: form.city || null,
    province: form.province || null,
  };
}

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");

  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [loading, setLoading] = useState(true);

  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [companySubmitting, setCompanySubmitting] = useState(false);
  const [employeeSubmitting, setEmployeeSubmitting] = useState(false);

  const [contractError, setContractError] = useState("");
  const [contractSuccess, setContractSuccess] = useState("");

  const [companyError, setCompanyError] = useState("");
  const [companySuccess, setCompanySuccess] = useState("");

  const [employeeError, setEmployeeError] = useState("");
  const [employeeSuccess, setEmployeeSuccess] = useState("");

  const [contractForm, setContractForm] = useState(initialContractForm);
  const [companyForm, setCompanyForm] = useState(initialCompanyForm);
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);

  const loadNextEmployeeCode = async () => {
    const data = await fetchNextEmployeeCode();
    setEmployeeForm((prev) => ({ ...prev, employee_code: data.employee_code }));
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const [contractsData, employeesData, companiesData, nextEmployeeCodeData] = await Promise.all([
        fetchContracts(),
        fetchAllEmployees(),
        fetchCompanies(),
        fetchNextEmployeeCode(),
      ]);

      setContracts(contractsData);
      setEmployees(employeesData);
      setCompanies(companiesData);
      setEmployeeForm((prev) => ({ ...prev, employee_code: nextEmployeeCodeData.employee_code }));
    } catch {
      setContractError("Error cargando datos");
      setCompanyError("Error cargando datos");
      setEmployeeError("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleContractChange = (event) => {
    const { name, value } = event.target;
    setContractForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCompanyChange = (event) => {
    const { name, value } = event.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmployeeChange = (event) => {
    const { name, value } = event.target;
    setEmployeeForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleContractSubmit = async (event) => {
    event.preventDefault();
    setContractError("");
    setContractSuccess("");

    const payload = {
      employee_id: Number(contractForm.employee_id),
      company_id: Number(contractForm.company_id),
      contract_type: contractForm.contract_type,
      start_date: contractForm.start_date,
      end_date: contractForm.end_date || null,
      salary_base: contractForm.salary_base ? Number(contractForm.salary_base) : null,
      status: contractForm.status,
    };

    try {
      setContractSubmitting(true);
      await createContract(payload);
      setContractSuccess("Contrato creado correctamente");
      setContractForm(initialContractForm);
      await loadData();
    } catch (err) {
      setContractError(err.message || "Error al crear contrato");
    } finally {
      setContractSubmitting(false);
    }
  };

  const handleCompanySubmit = async (event) => {
    event.preventDefault();
    setCompanyError("");
    setCompanySuccess("");

    try {
      setCompanySubmitting(true);
      await createCompany(buildCompanyPayload(companyForm));
      setCompanySuccess("Empresa creada correctamente");
      setCompanyForm(initialCompanyForm);
      await loadData();
    } catch (err) {
      setCompanyError(err.message || "Error al crear empresa");
    } finally {
      setCompanySubmitting(false);
    }
  };

  const handleEmployeeSubmit = async (event) => {
    event.preventDefault();
    setEmployeeError("");
    setEmployeeSuccess("");

    try {
      setEmployeeSubmitting(true);
      await createEmployee(buildEmployeePayload({ ...employeeForm, is_active: true }));
      setEmployeeSuccess("Trabajador creado correctamente");
      setEmployeeForm(initialEmployeeForm);
      await loadData();
    } catch (err) {
      setEmployeeError(err.message || "Error al crear trabajador");
      await loadNextEmployeeCode();
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (employeeId, form) => {
    setEmployeeError("");
    setEmployeeSuccess("");

    try {
      setEmployeeSubmitting(true);
      await updateEmployee(employeeId, buildEmployeePayload(form));
      setEmployeeSuccess("Trabajador actualizado correctamente");
      await loadData();
    } catch (err) {
      setEmployeeError(err.message || "Error al actualizar trabajador");
      throw err;
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    setEmployeeError("");
    setEmployeeSuccess("");

    try {
      await deleteEmployee(employeeId);
      setEmployeeSuccess("Trabajador desactivado correctamente");
      await loadData();
    } catch (err) {
      setEmployeeError(err.message || "Error al desactivar trabajador");
    }
  };

  function getTitle() {
    if (activePage === "dashboard") return "Dashboard";
    if (activePage === "companies") return "Empresas / Centros";
    if (activePage === "employees") return "Trabajadores";
    if (activePage === "contracts") return "Contratos";
    return "AulaNomina";
  }

  function getSubtitle() {
    if (activePage === "dashboard") return "Resumen del entorno de simulación";
    if (activePage === "companies") return "Gestión de empresas y centros";
    if (activePage === "employees") return "Gestión de trabajadores";
    if (activePage === "contracts") return "Gestión de contratos laborales";
    return "";
  }

  function renderPage() {
    if (activePage === "dashboard") {
      return <Dashboard companies={companies} employees={employees} contracts={contracts} />;
    }

    if (activePage === "companies") {
      return (
        <CompaniesPage
          loading={loading}
          companies={companies}
          companyForm={companyForm}
          onCompanyChange={handleCompanyChange}
          onCompanySubmit={handleCompanySubmit}
          companyError={companyError}
          companySuccess={companySuccess}
          companySubmitting={companySubmitting}
        />
      );
    }

    if (activePage === "employees") {
      return (
        <EmployeesPage
          loading={loading}
          employees={employees}
          companies={companies.filter((company) => company.is_active)}
          contracts={contracts}
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
          contractForm={contractForm}
          onContractChange={handleContractChange}
          onContractSubmit={handleContractSubmit}
          contractError={contractError}
          contractSuccess={contractSuccess}
          contractSubmitting={contractSubmitting}
        />
      );
    }

    return <p>Módulo en preparación</p>;
  }

  return (
    <div style={styles.appFrame}>
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <div style={styles.mainWrapper}>
        <Header title={getTitle()} subtitle={getSubtitle()} />

        <main style={styles.main}>{renderPage()}</main>

        <footer style={styles.footer}>
          AulaNomina · Entorno educativo de simulación laboral · Demo MVP
        </footer>
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
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
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
