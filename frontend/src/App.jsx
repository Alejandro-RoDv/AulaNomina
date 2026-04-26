import { useEffect, useState } from "react";

import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";

import Dashboard from "./pages/Dashboard";
import CompaniesPage from "./pages/CompaniesPage";
import ContractsPage from "./pages/ContractsPage";

import { createContract, fetchContracts, fetchEmployees } from "./services/api";
import { createCompany, fetchCompanies } from "./services/companyApi";

const initialContractForm = {
  employee_id: "",
  contract_type: "",
  start_date: "",
  end_date: "",
  salary_base: "",
  status: "active",
};

const initialCompanyForm = {
  name: "",
  cif: "",
  address: "",
  city: "",
  province: "",
};

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");

  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [loading, setLoading] = useState(true);

  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [companySubmitting, setCompanySubmitting] = useState(false);

  const [contractError, setContractError] = useState("");
  const [contractSuccess, setContractSuccess] = useState("");

  const [companyError, setCompanyError] = useState("");
  const [companySuccess, setCompanySuccess] = useState("");

  const [contractForm, setContractForm] = useState(initialContractForm);
  const [companyForm, setCompanyForm] = useState(initialCompanyForm);

  const loadData = async () => {
    try {
      setLoading(true);

      const [contractsData, employeesData, companiesData] = await Promise.all([
        fetchContracts(),
        fetchEmployees(),
        fetchCompanies(),
      ]);

      setContracts(contractsData);
      setEmployees(employeesData);
      setCompanies(companiesData);
    } catch {
      setContractError("Error cargando datos");
      setCompanyError("Error cargando datos");
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

  const handleContractSubmit = async (event) => {
    event.preventDefault();
    setContractError("");
    setContractSuccess("");

    const payload = {
      employee_id: Number(contractForm.employee_id),
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
      await createCompany(companyForm);
      setCompanySuccess("Empresa creada correctamente");
      setCompanyForm(initialCompanyForm);
      await loadData();
    } catch (err) {
      setCompanyError(err.message || "Error al crear empresa");
    } finally {
      setCompanySubmitting(false);
    }
  };

  function getTitle() {
    if (activePage === "dashboard") return "Dashboard";
    if (activePage === "companies") return "Empresas / Centros";
    if (activePage === "contracts") return "Contratos";
    return "AulaNomina";
  }

  function getSubtitle() {
    if (activePage === "dashboard") return "Vista general del sistema";
    if (activePage === "companies") return "Gestión de empresas";
    if (activePage === "contracts") return "Gestión de contratos";
    return "";
  }

  function renderPage() {
    if (activePage === "dashboard") {
      return <Dashboard companies={companies} contracts={contracts} />;
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

    if (activePage === "contracts") {
      return (
        <ContractsPage
          loading={loading}
          contracts={contracts}
          employees={employees}
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
    <div style={styles.layout}>
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <div style={styles.mainWrapper}>
        <Header title={getTitle()} subtitle={getSubtitle()} />

        <main style={styles.main}>{renderPage()}</main>
      </div>
    </div>
  );
}

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#f3f4f8",
  },
  mainWrapper: {
    marginLeft: "260px",
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
  main: {
    padding: "24px 32px",
  },
};
