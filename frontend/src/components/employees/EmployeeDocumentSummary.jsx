const typeLabels = {
  DNI_NIE: "DNI / NIE",
  NAF: "NAF",
  SIGNED_CONTRACT: "Contrato firmado",
  MODEL_145: "Modelo 145",
  SEXUAL_OFFENCES_CERTIFICATE: "Certificado delitos sexuales",
  CONFIDENTIALITY_COMMITMENT: "Compromiso confidencialidad",
  DATA_CONSENT: "Consentimiento datos",
  DEGREE_CERTIFICATE: "Titulación",
  OTHER: "Otros",
};

const statusLabels = {
  pending: "Pendiente",
  received: "Entregado",
  expired: "Caducado",
  not_applicable: "No aplica",
};

function getStatusStyle(status) {
  const base = {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 900,
  };
  if (status === "received") return { ...base, backgroundColor: "#dcfce7", color: "#166534" };
  if (status === "expired") return { ...base, backgroundColor: "#fee2e2", color: "#991b1b" };
  if (status === "not_applicable") return { ...base, backgroundColor: "#e5e7eb", color: "#374151" };
  return { ...base, backgroundColor: "#fef3c7", color: "#92400e" };
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export default function EmployeeDocumentSummary({ employees, documents }) {
  const activeEmployeesWithDocuments = employees
    .map((employee) => {
      const employeeDocuments = documents.filter((document) => Number(document.employee_id) === Number(employee.id));
      return { employee, documents: employeeDocuments };
    })
    .filter((item) => item.documents.length > 0);

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Documentación por trabajador</h3>
          <p style={styles.subtitle}>Resumen rápido del expediente documental asociado a cada trabajador.</p>
        </div>
      </div>

      {!activeEmployeesWithDocuments.length ? (
        <p style={styles.empty}>No hay documentos asociados a los trabajadores mostrados.</p>
      ) : (
        <div style={styles.employeeGrid}>
          {activeEmployeesWithDocuments.map(({ employee, documents: employeeDocuments }) => {
            const pending = employeeDocuments.filter((document) => document.status === "pending").length;
            const received = employeeDocuments.filter((document) => document.status === "received").length;
            const expired = employeeDocuments.filter((document) => document.status === "expired").length;

            return (
              <article key={employee.id} style={styles.employeeCard}>
                <div style={styles.employeeHeader}>
                  <div>
                    <h4 style={styles.employeeName}>{employee.first_name} {employee.last_name}</h4>
                    <p style={styles.employeeMeta}>{employee.employee_code || employee.id} · {employee.dni}</p>
                  </div>
                  <div style={styles.statsRow}>
                    <span style={styles.pendingBadge}>Pendientes: {pending}</span>
                    <span style={styles.receivedBadge}>Entregados: {received}</span>
                    <span style={styles.expiredBadge}>Caducados: {expired}</span>
                  </div>
                </div>

                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Tipo</th>
                        <th style={styles.th}>Estado</th>
                        <th style={styles.th}>Caducidad</th>
                        <th style={styles.th}>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeDocuments.map((document) => (
                        <tr key={document.id}>
                          <td style={styles.td}>{typeLabels[document.document_type] || document.document_name || document.document_type}</td>
                          <td style={styles.td}><span style={getStatusStyle(document.status)}>{statusLabels[document.status] || document.status}</span></td>
                          <td style={styles.td}>{formatDate(document.expiry_date)}</td>
                          <td style={styles.notesTd}>{document.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

const styles = {
  card: {
    border: "2px solid #111",
    borderRadius: "10px",
    backgroundColor: "#fff",
    padding: "18px",
    marginTop: "22px",
    boxShadow: "5px 5px 0 #e6d85c",
  },
  header: { display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "16px" },
  title: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  subtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  empty: { margin: 0, color: "#6b7280", fontWeight: 700 },
  employeeGrid: { display: "grid", gap: "16px" },
  employeeCard: { border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px", backgroundColor: "#f9fafb" },
  employeeHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "12px" },
  employeeName: { margin: 0, fontSize: "16px", fontWeight: 900, color: "#111827" },
  employeeMeta: { margin: "3px 0 0", color: "#6b7280", fontSize: "12px", fontWeight: 800 },
  statsRow: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" },
  pendingBadge: { backgroundColor: "#fef3c7", color: "#92400e", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 900 },
  receivedBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 900 },
  expiredBadge: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 900 },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { textAlign: "left", padding: "9px", borderBottom: "2px solid #111", fontSize: "11px", textTransform: "uppercase", color: "#111827" },
  td: { padding: "9px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, verticalAlign: "top" },
  notesTd: { padding: "9px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, verticalAlign: "top", whiteSpace: "normal", minWidth: "240px" },
};
