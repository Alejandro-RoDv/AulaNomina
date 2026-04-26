import { useEffect, useState } from "react";
import CompanyForm from "./components/CompanyForm";
import CompanyTable from "./components/CompanyTable";
import ContractForm from "./components/ContractForm";
import ContractTable from "./components/ContractTable";
import { createContract, fetchContracts, fetchEmployees } from "./services/api";
import { createCompany, fetchCompanies } from "./services/companyApi";
import logo from "./assets/aulanomina-logo.svg";

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

  return (
    <div style={styles.layout}>
      <aside style={styles.sidebar}>
        <img src={logo} alt="AulaNomina" style={styles.logo} />
        <nav style={styles.nav}>
          <a style={styles.navItem} href="#empresas">Empresas</a>
          <a style={styles.navItem} href="#contratos">Contratos</a>
          <a style={styles.navItemMuted} href="#empleados">Empleados</a>
          <a style={styles.navItemMuted} href="#nominas">Nóminas</a>
        </nav>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>AulaNomina</h1>
            <p style={styles.subtitle}>Simulación educativa de gestión laboral</p>
          </div>
        </header>

        <section id="empresas" style={styles.card}>
          <h2 style={styles.sectionTitle}>Empresas / Centros</h2>
          <CompanyForm
            form={companyForm}
            onChange={handleCompanyChange}
            onSubmit={handleCompanySubmit}
            error={companyError}
            success={companySuccess}
            submitting={companySubmitting}
          />
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Listado de empresas</h2>
          <CompanyTable loading={loading} companies={companies} />
        </section>

        <section id="contratos" style={styles.card}>
          <h2 style={styles.sectionTitle}>Nuevo contrato</h2>
          <ContractForm
            form={contractForm}
            employees={employees}
            onChange={handleContractChange}
            onSubmit={handleContractSubmit}
            error={contractError}
            success={contractSuccess}
            submitting={contractSubmitting}
          />
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Listado de contratos</h2>
          <ContractTable loading={loading} contracts={contracts} employees={employees} />
        </section>
      </main>
    </div>
  );
}

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#f6f7fb",
    fontFamily: "Arial, sans-serif",
  },
  sidebar: {
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
    width: "250px",
    backgroundColor: "#f3c43b",
    color: "#141414",
    padding: "22px 18px",
    boxSizing: "border-box",
    boxShadow: "4px 0 18px rgba(0,0,0,0.12)",
  },
  logo: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "8px",
    boxSizing: "border-box",
    marginBottom: "28px",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  navItem: {
    color: "#141414",
    textDecoration: "none",
    fontWeight: 700,
    backgroundColor: "rgba(255,255,255,0.65)",
    padding: "12px 14px",
    borderRadius: "10px",
  },
  navItemMuted: {
    color: "#3b3b3b",
    textDecoration: "none",
    fontWeight: 600,
    padding: "12px 14px",
    borderRadius: "10px",
    opacity: 0.75,
  },
  main: {
    marginLeft: "250px",
    width: "calc(100% - 250px)",
    padding: "34px",
    boxSizing: "border-box",
  },
  header: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "24px 28px",
    marginBottom: "24px",
    boxShadow: "0 2px 14px rgba(0,0,0,0.06)",
    borderLeft: "8px solid #f3c43b",
  },
  title: {
    margin: 0,
    fontSize: "42px",
    color: "#111827",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#5f6470",
  },
  card: {
    backgroundColor: "#ffffff",
    padding: "24px",
    borderRadius: "16px",
    boxShadow: "0 2px 14px rgba(0,0,0,0.06)",
    marginBottom: "24px",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: "20px",
    fontSize: "24px",
    color: "#111827",
  },
};
