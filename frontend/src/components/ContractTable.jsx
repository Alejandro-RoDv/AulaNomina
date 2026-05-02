export default function ContractTable({ loading, contracts, employees, companies }) {
  const getEmployeeName = (contract) => {
    if (contract.employee_name) return contract.employee_name;
    const emp = employees.find((employee) => employee.id === contract.employee_id);
    if (!emp) return contract.employee_id;
    return `${emp.first_name} ${emp.last_name}`;
  };

  const getCompanyName = (contract) => {
    if (contract.company_name) return contract.company_name;
    const company = companies.find((item) => item.id === contract.company_id);
    if (!company) return contract.company_id || "-";
    return company.name;
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
            <th style={styles.th}>Empresa / centro</th>
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
              <td style={styles.td}>{getEmployeeName(contract)}</td>
              <td style={styles.td}>{getCompanyName(contract)}</td>
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
