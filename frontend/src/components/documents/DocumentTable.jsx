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

export default function DocumentTable({ documents, loading, onMarkReceived, onMarkPending, onMarkNotApplicable }) {
  if (loading) {
    return <section style={styles.card}>Cargando documentos...</section>;
  }

  return (
    <section style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Listado documental</h2>
          <p style={styles.subtitle}>Documentos asociados a trabajadores, empresas y centros.</p>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Trabajador</th>
              <th style={styles.th}>Empresa</th>
              <th style={styles.th}>Centro</th>
              <th style={styles.th}>Tipo</th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>Emisión</th>
              <th style={styles.th}>Caducidad</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan="8" style={styles.empty}>No hay documentos registrados.</td>
              </tr>
            ) : (
              documents.map((document) => (
                <tr key={document.id}>
                  <td style={styles.td}>{document.employee_name || document.employee_id}</td>
                  <td style={styles.td}>{document.company_name || document.company_id}</td>
                  <td style={styles.td}>{document.center_name || "-"}</td>
                  <td style={styles.td}>{typeLabels[document.document_type] || document.document_type}</td>
                  <td style={styles.td}><span style={getStatusStyle(document.status)}>{statusLabels[document.status] || document.status}</span></td>
                  <td style={styles.td}>{document.issue_date || "-"}</td>
                  <td style={styles.td}>{document.expiry_date || "-"}</td>
                  <td style={styles.tdActions}>
                    <button type="button" style={styles.smallButton} onClick={() => onMarkReceived(document)}>Entregado</button>
                    <button type="button" style={styles.smallButton} onClick={() => onMarkPending(document)}>Pendiente</button>
                    <button type="button" style={styles.smallButton} onClick={() => onMarkNotApplicable(document)}>No aplica</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function getStatusStyle(status) {
  const base = { display: "inline-block", border: "2px solid #111", padding: "4px 8px", fontSize: "12px", fontWeight: 900 };
  if (status === "received") return { ...base, background: "#dcfce7" };
  if (status === "expired") return { ...base, background: "#fee2e2" };
  if (status === "not_applicable") return { ...base, background: "#e5e7eb" };
  return { ...base, background: "#fef3c7" };
}

const styles = {
  card: { border: "2px solid #111", background: "#fff", padding: "18px", boxShadow: "5px 5px 0 #f0df62" },
  headerRow: { display: "flex", justifyContent: "space-between", gap: "18px", marginBottom: "14px" },
  title: { margin: 0, fontSize: "22px", fontWeight: 900, color: "#111" },
  subtitle: { margin: "4px 0 0", color: "#4b5563", fontSize: "13px", fontWeight: 600 },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { borderBottom: "3px solid #111", textAlign: "left", padding: "10px", fontSize: "12px", textTransform: "uppercase", fontWeight: 900, color: "#111" },
  td: { borderBottom: "1px solid #d1d5db", padding: "10px", fontWeight: 700, verticalAlign: "top" },
  tdActions: { borderBottom: "1px solid #d1d5db", padding: "10px", display: "flex", flexWrap: "wrap", gap: "6px" },
  smallButton: { border: "2px solid #111", background: "#fff", padding: "6px 8px", fontWeight: 900, cursor: "pointer" },
  empty: { padding: "18px", textAlign: "center", fontWeight: 800, color: "#6b7280" },
};
