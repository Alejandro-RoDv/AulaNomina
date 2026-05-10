import { useState } from "react";

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

const documentTypes = Object.entries(typeLabels);

const statusLabels = {
  pending: "Pendiente",
  received: "Entregado",
  expired: "Caducado",
  not_applicable: "No aplica",
};

const statuses = Object.entries(statusLabels);

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function toEditForm(document) {
  return {
    center_id: document.center_id || null,
    document_type: document.document_type || "OTHER",
    document_name: document.document_name || "",
    status: document.status || "pending",
    issue_date: document.issue_date || "",
    expiry_date: document.expiry_date || "",
    notes: document.notes || "",
  };
}

export default function DocumentTable({
  documents,
  loading,
  onMarkReceived,
  onMarkPending,
  onMarkExpired,
  onMarkNotApplicable,
  onSaveDocument,
}) {
  const [editingDocument, setEditingDocument] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");

  if (loading) {
    return <section style={styles.card}>Cargando documentos...</section>;
  }

  const openEdit = (document) => {
    setEditingDocument(document);
    setEditForm(toEditForm(document));
    setEditError("");
  };

  const closeEdit = () => {
    setEditingDocument(null);
    setEditForm(null);
    setEditError("");
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditError("");
    try {
      await onSaveDocument(editingDocument, {
        ...editForm,
        issue_date: editForm.issue_date || null,
        expiry_date: editForm.expiry_date || null,
        notes: editForm.notes || null,
      });
      closeEdit();
    } catch (err) {
      setEditError(err.message || "Error al editar documento");
    }
  };

  const handleStatusAction = async (event, document) => {
    const action = event.target.value;
    event.target.value = "";

    if (action === "received") await onMarkReceived(document);
    if (action === "pending") await onMarkPending(document);
    if (action === "expired") await onMarkExpired(document);
    if (action === "not_applicable") await onMarkNotApplicable(document);
  };

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
                  <td style={styles.td}>{typeLabels[document.document_type] || document.document_name || document.document_type}</td>
                  <td style={styles.td}><span style={getStatusStyle(document.status)}>{statusLabels[document.status] || document.status}</span></td>
                  <td style={styles.td}>{formatDate(document.issue_date)}</td>
                  <td style={styles.td}>{formatDate(document.expiry_date)}</td>
                  <td style={styles.tdActions}>
                    <button type="button" style={styles.smallButton} onClick={() => openEdit(document)}>Editar</button>
                    <select defaultValue="" style={styles.actionSelect} onChange={(event) => handleStatusAction(event, document)}>
                      <option value="" disabled>Cambiar estado</option>
                      <option value="received">Entregado</option>
                      <option value="pending">Pendiente</option>
                      <option value="expired">Caducado</option>
                      <option value="not_applicable">No aplica</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingDocument && editForm && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Editar documento</h3>
                <p style={styles.modalSubtitle}>{editingDocument.employee_name || editingDocument.employee_id}</p>
              </div>
              <button type="button" onClick={closeEdit} style={styles.closeButton}>×</button>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <label style={styles.label}>
                Tipo documental
                <select name="document_type" value={editForm.document_type} onChange={handleEditChange} style={styles.input}>
                  {documentTypes.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Nombre documento
                <input name="document_name" value={editForm.document_name} onChange={handleEditChange} required style={styles.input} />
              </label>

              <label style={styles.label}>
                Estado
                <select name="status" value={editForm.status} onChange={handleEditChange} style={styles.input}>
                  {statuses.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Fecha emisión
                <input type="date" name="issue_date" value={editForm.issue_date || ""} onChange={handleEditChange} style={styles.input} />
              </label>

              <label style={styles.label}>
                Caducidad
                <input type="date" name="expiry_date" value={editForm.expiry_date || ""} onChange={handleEditChange} style={styles.input} />
              </label>

              <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
                Notas
                <textarea name="notes" value={editForm.notes || ""} onChange={handleEditChange} style={{ ...styles.input, minHeight: "88px" }} />
              </label>

              {editError ? <p style={styles.error}>{editError}</p> : null}

              <div style={styles.modalActions}>
                <button type="button" onClick={closeEdit} style={styles.cancelButton}>Cancelar</button>
                <button type="submit" style={styles.saveButton}>Guardar cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  tdActions: { borderBottom: "1px solid #d1d5db", padding: "10px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" },
  smallButton: { border: "2px solid #111", background: "#fff", padding: "7px 10px", fontWeight: 900, cursor: "pointer" },
  actionSelect: { border: "2px solid #111", background: "#fff", padding: "7px 10px", fontWeight: 900, cursor: "pointer", minWidth: "150px" },
  empty: { padding: "18px", textAlign: "center", fontWeight: 800, color: "#6b7280" },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(860px, 100%)", backgroundColor: "#fff", border: "3px solid #111", boxShadow: "8px 8px 0 #f0df62", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "2px solid #111", paddingBottom: "12px" },
  modalTitle: { margin: 0, fontSize: "22px", fontWeight: 900, color: "#111" },
  modalSubtitle: { margin: "4px 0 0", color: "#4b5563", fontSize: "13px", fontWeight: 800 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", fontWeight: 900 },
  form: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" },
  label: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#111" },
  input: { border: "2px solid #111", padding: "9px 10px", fontSize: "14px", fontWeight: 700, background: "#fff", color: "#111" },
  modalActions: { gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelButton: { border: "2px solid #111", background: "#fff", padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  saveButton: { border: "3px solid #111", background: "#f0df62", padding: "9px 14px", fontWeight: 900, cursor: "pointer", boxShadow: "3px 3px 0 #111" },
  error: { gridColumn: "1 / -1", background: "#fee2e2", border: "2px solid #991b1b", color: "#991b1b", padding: "10px", fontWeight: 800 },
};
