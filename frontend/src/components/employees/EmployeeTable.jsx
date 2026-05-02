export default function EmployeeTable({ loading, employees, onDeleteEmployee }) {
  if (loading) return <p>Cargando...</p>;

  if (!employees.length) {
    return <p style={styles.empty}>Todavía no hay trabajadores registrados.</p>;
  }

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Código</th>
            <th style={styles.th}>DNI</th>
            <th style={styles.th}>Nombre completo</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Teléfono</th>
            <th style={styles.th}>Ciudad / Provincia</th>
            <th style={styles.th}>Estado</th>
            <th style={styles.th}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td style={styles.td}>{employee.employee_code}</td>
              <td style={styles.td}>{employee.dni}</td>
              <td style={styles.td}>{employee.first_name} {employee.last_name}</td>
              <td style={styles.td}>{employee.email || "-"}</td>
              <td style={styles.td}>{employee.phone || "-"}</td>
              <td style={styles.td}>
                {[employee.city, employee.province].filter(Boolean).join(" / ") || "-"}
              </td>
              <td style={styles.td}>
                <span style={employee.is_active ? styles.activeBadge : styles.inactiveBadge}>
                  {employee.is_active ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td style={styles.td}>
                {employee.is_active ? (
                  <button
                    type="button"
                    style={styles.deleteButton}
                    onClick={() => onDeleteEmployee(employee.id)}
                  >
                    Desactivar
                  </button>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  empty: { margin: 0, color: "#6b7280", fontSize: "14px" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "12px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  td: { padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  activeBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  inactiveBadge: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
};
