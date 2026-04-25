import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

export default function App() {
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    employee_id: "",
    contract_type: "",
    start_date: "",
    end_date: "",
    salary_base: "",
    status: "active",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [contractsRes, employeesRes] = await Promise.all([
        fetch(`${API}/contracts`),
        fetch(`${API}/employees/all`),
      ]);

      const contractsData = await contractsRes.json();
      const employeesData = await employeesRes.json();

      setContracts(contractsData);
      setEmployees(employeesData);
    } catch (err) {
      setError("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getEmployeeName = (id) => {
    const emp = employees.find((e) => e.id === id);
    if (!emp) return id;
    return `${emp.first_name} ${emp.last_name}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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

      const res = await fetch(`${API}/contracts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Error al crear contrato");
      }

      setSuccess("Contrato creado correctamente");
      setForm({
        employee_id: "",
        contract_type: "",
        start_date: "",
        end_date: "",
        salary_base: "",
        status: "active",
      });

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

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label>Empleado</label>
                <select
                  name="employee_id"
                  value={form.employee_id}
                  onChange={handleChange}
                  required
                  style={styles.input}
                >
                  <option value="">Selecciona un empleado</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label>Tipo de contrato</label>
                <select
                  name="contract_type"
                  value={form.contract_type}
                  onChange={handleChange}
                  required
                  style={styles.input}
                >
                  <option value="">Selecciona tipo</option>
                  <option value="indefinido">Indefinido</option>
                  <option value="temporal">Temporal</option>
                  <option value="practicas">Prácticas</option>
                  <option value="formacion">Formación</option>
                </select>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label>Fecha inicio</label>
                <input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={handleChange}
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Fecha fin</label>
                <input
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label>Salario base</label>
                <input
                  type="number"
                  name="salary_base"
                  value={form.salary_base}
                  onChange={handleChange}
                  placeholder="Ej. 18000"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Estado</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  style={styles.input}
                >
                  <option value="active">Activo</option>
                  <option value="ended">Finalizado</option>
                </select>
              </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {success && <div style={styles.success}>{success}</div>}

            <button type="submit" disabled={submitting} style={styles.button}>
              {submitting ? "Guardando..." : "Crear contrato"}
            </button>
          </form>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Listado de contratos</h2>

          {loading ? (
            <p>Cargando...</p>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Empleado</th>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Inicio</th>
                    <th style={styles.th}>Fin</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Salario</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id}>
                      <td style={styles.td}>{c.id}</td>
                      <td style={styles.td}>{getEmployeeName(c.employee_id)}</td>
                      <td style={styles.td}>{c.contract_type}</td>
                      <td style={styles.td}>{c.start_date}</td>
                      <td style={styles.td}>{c.end_date || "-"}</td>
                      <td style={styles.td}>{c.status}</td>
                      <td style={styles.td}>{c.salary_base || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  formRow: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
  },
  formGroup: {
    flex: 1,
    minWidth: "220px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "14px",
  },
  button: {
    backgroundColor: "#111827",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "12px 18px",
    fontSize: "14px",
    cursor: "pointer",
    width: "fit-content",
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    padding: "10px 12px",
    borderRadius: "8px",
  },
  success: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    padding: "10px 12px",
    borderRadius: "8px",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    borderBottom: "1px solid #ddd",
    backgroundColor: "#f9fafb",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #eee",
  },
};