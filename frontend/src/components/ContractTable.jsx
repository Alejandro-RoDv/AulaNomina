export default function ContractTable({ loading, contracts, employees }) {
  const getEmployeeName = (id) => {
    const emp = employees.find((employee) => employee.id === id);
    if (!emp) return id;
    return `${emp.first_name} ${emp.last_name}`;
  };

  if (loading) {
    return <p>Cargando...</p>;
  }

  return (
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
          {contracts.map((contract) => (
            <tr key={contract.id}>
              <td style={styles.td}>{contract.id}</td>
              <td style={styles.td}>{getEmployeeName(contract.employee_id)}</td>
              <td style={styles.td}>{contract.contract_type}</td>
              <td style={styles.td}>{contract.start_date}</td>
              <td style={styles.td}>{contract.end_date || "-"}</td>
              <td style={styles.td}>{contract.status}</td>
              <td style={styles.td}>{contract.salary_base || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
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
