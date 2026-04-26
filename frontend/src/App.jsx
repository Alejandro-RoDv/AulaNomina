import { useEffect, useState } from "react";
import CompanyForm from "./components/CompanyForm";
import CompanyTable from "./components/CompanyTable";
import ContractForm from "./components/ContractForm";
import ContractTable from "./components/ContractTable";
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
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>AulaNomina</h1>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Empresas / Centros</h2>
          <CompanyForm
            form={companyForm}
            onChange={handleCompanyChange}
            onSubmit={handleCompanySubmit}
            error={companyError}
            success={companySuccess}
            submitting={companySubmitting}
          />
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Listado de empresas</h2>
          <CompanyTable loading={loading} companies={companies} />
        </div>

        <div style={styles.card}>
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
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Listado de contratos</h2>
          <ContractTable loading={loading} contracts={contracts} employees={employees} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    backgroundColor: "#f4f6f8",
    minHeight: "100vh",
    padding: "30px",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },
  title: {
    textAlign: "center",
    marginBottom: "30px",
    fontSize: "52px",
  },
  card: {
    backgroundColor: "#ffffff",
    padding: "24px",
    borderRadius: "12px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    marginBottom: "24px",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: "20px",
    fontSize: "24px",
  },
};
