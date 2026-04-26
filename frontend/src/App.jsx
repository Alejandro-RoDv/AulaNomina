import { useEffect, useState } from "react";
import ContractForm from "./components/ContractForm";
import ContractTable from "./components/ContractTable";
import { createContract, fetchContracts, fetchEmployees } from "./services/api";

const initialForm = {
  employee_id: "",
  contract_type: "",
  start_date: "",
  end_date: "",
  salary_base: "",
  status: "active",
};

export default function App() {
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(initialForm);

  const loadData = async () => {
    try {
      setLoading(true);
      const [contractsData, employeesData] = await Promise.all([
        fetchContracts(),
        fetchEmployees(),
      ]);

      setContracts(contractsData);
      setEmployees(employeesData);
    } catch {
      setError("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const payload = {
      employee_id: Number(form.employee_id),
      contract_type: form.contract_type,
      start_date: form.start_date,
      end_date: form.end_date || null,
      salary_base: form.salary_base ? Number(form.salary_base) : null,
      status: form.status,
    };

    try {
      setSubmitting(true);
      await createContract(payload);

      setSuccess("Contrato creado correctamente");
      setForm(initialForm);
      await loadData();
    } catch (err) {
      setError(err.message || "Error al crear contrato");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>AulaNomina - Contratos</h1>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Nuevo contrato</h2>
          <ContractForm
            form={form}
            employees={employees}
            onChange={handleChange}
            onSubmit={handleSubmit}
            error={error}
            success={success}
            submitting={submitting}
          />
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Listado de contratos</h2>
          <ContractTable
            loading={loading}
            contracts={contracts}
            employees={employees}
          />
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
