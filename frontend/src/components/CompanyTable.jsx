export default function CompanyTable({ loading, companies }) {
  if (loading) return <p>Cargando...</p>;

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>ID</th>
            <th style={styles.th}>Nombre</th>
            <th style={styles.th}>CIF</th>
            <th style={styles.th}>Ciudad</th>
            <th style={styles.th}>Provincia</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id}>
              <td style={styles.td}>{c.id}</td>
              <td style={styles.td}>{c.name}</td>
              <td style={styles.td}>{c.cif}</td>
              <td style={styles.td}>{c.city}</td>
              <td style={styles.td}>{c.province}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "12px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb" },
  td: { padding: "12px", borderBottom: "1px solid #eee" },
};
