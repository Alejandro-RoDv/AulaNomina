import { useMemo, useState } from "react";

import { fetchEmployeeAssignmentHistory } from "../../services/employeeApi";

function formatDate(value) {
  if (!value) return "Actualidad";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export default function EmployeeAssignmentPanel({ employees, companies, workCenters, onUpdateEmployee }) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [centerId, setCenterId] = useState("");
  const [history, setHistory] = useState([]);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedEmployee = employees.find((employee) => String(employee.id) === String(selectedEmployeeId));

  const availableCenters = useMemo(() => {
    return workCenters.filter((center) => !companyId || String(center.company_id) === String(companyId));
  }, [workCenters, companyId]);

  const handleEmployeeChange = (event) => {
    const nextEmployeeId = event.target.value;
    const employee = employees.find((item) => String(item.id) === String(nextEmployeeId));

    setSelectedEmployeeId(nextEmployeeId);
    setCompanyId(employee?.company_id ? String(employee.company_id) : "");
    setCenterId(employee?.center_id ? String(employee.center_id) : "");
    setHistory([]);
    setHistoryVisible(false);
    setMessage("");
    setError("");
  };

  const handleCompanyChange = (event) => {
    setCompanyId(event.target.value);
    setCenterId("");
  };

  const handleSaveAssignment = async () => {
    setMessage("");
    setError("");

    if (!selectedEmployee) {
      setError("Selecciona un trabajador.");
      return;
    }

    if (!companyId) {
      setError("Selecciona una empresa.");
      return;
    }

    try {
      setSubmitting(true);
      await onUpdateEmployee(selectedEmployee.id, {
        ...selectedEmployee,
        company_id: Number(companyId),
        center_id: centerId ? Number(centerId) : null,
      });
      setMessage("Empresa/centro actualizado. El movimiento queda registrado en histórico.");
      if (historyVisible) {
        const data = await fetchEmployeeAssignmentHistory(selectedEmployee.id);
        setHistory(data);
      }
    } catch (err) {
      setError(err.message || "Error al actualizar empresa/centro.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadHistory = async () => {
    setMessage("");
    setError("");

    if (!selectedEmployee) {
      setError("Selecciona un trabajador para ver el histórico.");
      return;
    }

    try {
      setLoadingHistory(true);
      const data = await fetchEmployeeAssignmentHistory(selectedEmployee.id);
      setHistory(data);
      setHistoryVisible(true);
    } catch (err) {
      setError(err.message || "Error al cargar histórico.");
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Empresa / centro del trabajador</h3>
          <p style={styles.subtitle}>Asigna o cambia la empresa y el centro. Los cambios quedan registrados en histórico.</p>
        </div>
      </div>

      <div style={styles.formGrid}>
        <label style={styles.label}>
          Trabajador
          <select value={selectedEmployeeId} onChange={handleEmployeeChange} style={styles.input}>
            <option value="">Seleccionar trabajador</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name} · {employee.dni}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Empresa
          <select value={companyId} onChange={handleCompanyChange} style={styles.input} disabled={!selectedEmployee}>
            <option value="">Sin empresa</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Centro
          <select value={centerId} onChange={(event) => setCenterId(event.target.value)} style={styles.input} disabled={!selectedEmployee || !companyId}>
            <option value="">Sin centro</option>
            {availableCenters.map((center) => (
              <option key={center.id} value={center.id}>{center.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={styles.actions}>
        <button type="button" onClick={handleSaveAssignment} disabled={submitting || !selectedEmployee} style={styles.primaryButton}>
          {submitting ? "Guardando..." : "Guardar empresa/centro"}
        </button>
        <button type="button" onClick={handleLoadHistory} disabled={loadingHistory || !selectedEmployee} style={styles.secondaryButton}>
          {loadingHistory ? "Cargando..." : "Ver histórico"}
        </button>
      </div>

      {message ? <p style={styles.success}>{message}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}

      {historyVisible && (
        <div style={styles.historyBox}>
          <h4 style={styles.historyTitle}>Histórico de movimientos</h4>
          {!history.length ? (
            <p style={styles.empty}>No hay movimientos registrados todavía. Los cambios empezarán a registrarse desde esta versión.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Desde</th>
                  <th style={styles.th}>Hasta</th>
                  <th style={styles.th}>Empresa</th>
                  <th style={styles.th}>Centro</th>
                  <th style={styles.th}>Notas</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td style={styles.td}>{formatDate(item.start_date)}</td>
                    <td style={styles.td}>{formatDate(item.end_date)}</td>
                    <td style={styles.td}>{item.company_name || "-"}</td>
                    <td style={styles.td}>{item.center_name || "-"}</td>
                    <td style={styles.td}>{item.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

const styles = {
  card: { border: "2px solid #111", borderRadius: "10px", backgroundColor: "#fff", padding: "18px", marginTop: "22px", boxShadow: "5px 5px 0 #e6d85c" },
  header: { display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "16px" },
  title: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  subtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" },
  label: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#111" },
  input: { border: "2px solid #111", padding: "9px 10px", fontSize: "14px", fontWeight: 700, background: "#fff", color: "#111" },
  actions: { display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" },
  primaryButton: { border: "3px solid #111", background: "#f0df62", padding: "9px 14px", fontWeight: 900, cursor: "pointer", boxShadow: "3px 3px 0 #111" },
  secondaryButton: { border: "2px solid #111", background: "#fff", padding: "9px 14px", fontWeight: 900, cursor: "pointer" },
  success: { background: "#dcfce7", border: "2px solid #166534", color: "#166534", padding: "10px", fontWeight: 800, margin: "14px 0 0" },
  error: { background: "#fee2e2", border: "2px solid #991b1b", color: "#991b1b", padding: "10px", fontWeight: 800, margin: "14px 0 0" },
  historyBox: { marginTop: "16px", borderTop: "2px solid #111", paddingTop: "14px" },
  historyTitle: { margin: "0 0 10px", fontSize: "16px", fontWeight: 900 },
  empty: { margin: 0, color: "#6b7280", fontWeight: 700 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { textAlign: "left", padding: "9px", borderBottom: "2px solid #111", fontSize: "11px", textTransform: "uppercase", color: "#111827" },
  td: { padding: "9px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, verticalAlign: "top" },
};
