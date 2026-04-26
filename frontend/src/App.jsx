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
        <div style={styles.logoBox}>
          <img src={logo} alt="AulaNomina" style={styles.logo} />
        </div>
        <nav style={styles.nav}>
          <a style={styles.navItem} href="#empresas">Empresas</a>
          <a style={styles.navItem} href="#contratos">Contratos</a>
          <a style={styles.navItemMuted} href="#empleados">Empleados</a>
          <a style={styles.navItemMuted} href="#nominas">Nóminas</a>
        </nav>
      </aside>

      <main style={styles.main}>
        <header style={styles.hero}>
          <div style={styles.heroText}>
            <p style={styles.kicker}>Panel docente · Demo MVP</p>
            <h1 style={styles.title}>AulaNomina</h1>
            <p style={styles.subtitle}>Simulación educativa de gestión laboral para RRHH, FP y universidad</p>
          </div>
          <div style={styles.heroBadge}>Split 4 · Empresas / Centros</div>
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
    backgroundColor: "#f3f4f8",
    fontFamily: "Arial, sans-serif",
  },
  sidebar: {
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
    width: "260px",
    background: "linear-gradient(180deg, #f4c430 0%, #e9b526 100%)",
    color: "#171717",
    padding: "22px 18px",
    boxSizing: "border-box",
    boxShadow: "6px 0 22px rgba(0,0,0,0.14)",
  },
  logoBox: {
    backgroundColor: "#ffffff",
    borderRadius: "18px",
    padding: "14px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
    marginBottom: "30px",
  },
  logo: {
    width: "100%",
    display: "block",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  navItem: {
    color: "#111827",
    textDecoration: "none",
    fontWeight: 800,
    backgroundColor: "rgba(255,255,255,0.78)",
    padding: "13px 16px",
    borderRadius: "12px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
  },
  navItemMuted: {
    color: "#3f3f46",
    textDecoration: "none",
    fontWeight: 700,
    padding: "13px 16px",
    borderRadius: "12px",
    opacity: 0.75,
  },
  main: {
    marginLeft: "260px",
    width: "calc(100% - 260px)",
    padding: "34px 42px",
    boxSizing: "border-box",
  },
  hero: {
    minHeight: "150px",
    background: "linear-gradient(135deg, #f4c430 0%, #ffd966 44%, #ffffff 45%, #ffffff 100%)",
    borderRadius: "22px",
    padding: "28px 34px",
    marginBottom: "26px",
    boxShadow: "0 12px 28px rgba(0,0,0,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    border: "1px solid rgba(0,0,0,0.04)",
  },
  heroText: {
    maxWidth: "660px",
  },
  kicker: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#5c4100",
  },
  title: {
    margin: "8px 0 2px",
    fontSize: "46px",
    color: "#111827",
    fontWeight: 900,
  },
  subtitle: {
    margin: 0,
    color: "#4b5563",
    fontWeight: 600,
  },
  heroBadge: {
    backgroundColor: "#111827",
    color: "#ffffff",
    padding: "12px 16px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  card: {
    backgroundColor: "#ffffff",
    padding: "26px",
    borderRadius: "18px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
    marginBottom: "24px",
    border: "1px solid #edf0f5",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: "20px",
    fontSize: "24px",
    color: "#111827",
    fontWeight: 800,
  },
};
