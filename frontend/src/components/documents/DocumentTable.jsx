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

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  statusMessage,
  statusError,
  onMarkReceived,
  onMarkPending,
  onMarkExpired,
  onMarkNotApplicable,
  onSaveDocument,
}) {
  const [editingDocument, setEditingDocument] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");
  const [deliveryDraft, setDeliveryDraft] = useState(null);
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");

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

  const closeDelivery = () => {
    if (deliverySaving) return;
    setDeliveryDraft(null);
    setDeliveryError("");
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

    try {
      if (action === "received") await onMarkReceived(document);
      if (action === "pending") await onMarkPending(document);
      if (action === "expired") await onMarkExpired(document);
      if (action === "not_applicable") await onMarkNotApplicable(document);
    } catch {
      // El mensaje de error se muestra desde el contenedor de documentos.
    }
  };

  const handleFileSelected = (event, document) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setDeliveryDraft({
      document,
      fileName: file.name,
      fileSize: file.size,
    });
    setDeliveryError("");
  };

  const handleSaveDelivery = async () => {
    if (!deliveryDraft?.fileName || deliverySaving) return;

    const document = deliveryDraft.document;
    const current = toEditForm(document);

    try {
      setDeliverySaving(true);
      setDeliveryError("");
      await onSaveDocument(document, {
        ...current,
        status: "received",
        issue_date: current.issue_date || null,
        expiry_date: current.expiry_date || null,
        notes: current.notes || null,
      });
      setDeliveryDraft(null);
    } catch (err) {
      setDeliveryError(err.message || "No se ha podido registrar la entrega.");
    } finally {
      setDeliverySaving(false);
    }
  };

  return (
    <section style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Listado documental</h2>
          <p style={styles.subtitle}>Documentos asociados a trabajadores, empresas y centros.</p>
        </div>
      </div>

      {statusMessage ? <p style={styles.success}>{statusMessage}</p> : null}
      {statusError ? <p style={styles.error}>{statusError}</p> : null}

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
              <th style={{ ...styles.th, minWidth: "360px" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan="8" style={styles.empty}>No hay documentos registrados.</td>
              </tr>
            ) : (
              documents.map((document) => (
                <tr key={document.id} style={styles.row}>
                  <td style={styles.td}>{document.employee_name || document.employee_id}</td>
                  <td style={styles.td}>{document.company_name || document.company_id}</td>
                  <td style={styles.td}>{document.center_name || "-"}</td>
                  <td style={styles.td}>{typeLabels[document.document_type] || document.document_name || document.document_type}</td>
                  <td style={styles.td}><span style={getStatusStyle(document.status)}>{statusLabels[document.status] || document.status}</span></td>
                  <td style={styles.td}>{formatDate(document.issue_date)}</td>
                  <td style={styles.td}>{formatDate(document.expiry_date)}</td>
                  <td style={styles.tdActions}>
                    <label style={styles.attachButton} title="Selecciona un archivo para simular su entrega">
                      <input
                        type="file"
                        style={styles.hiddenFileInput}
                        onChange={(event) => handleFileSelected(event, document)}
                      />
                      {document.status === "received" ? "Adjuntar otro archivo" : "Adjuntar archivo"}
                    </label>
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

      {deliveryDraft && (
        <div style={styles.modalBackdrop}>
          <div style={styles.deliveryModal}>
            <div style={styles.modalHeader}>
              <div>
                <span style={styles.modalKicker}>ENTREGA DOCUMENTAL SIMULADA</span>
                <h3 style={styles.modalTitle}>Adjuntar archivo</h3>
                <p style={styles.modalSubtitle}>
                  {typeLabels[deliveryDraft.document.document_type] || deliveryDraft.document.document_name || "Documento"}
                </p>
              </div>
              <button type="button" onClick={closeDelivery} style={styles.closeButton} aria-label="Cerrar">×</button>
            </div>

            <div style={styles.deliveryFileCard}>
              <div style={styles.fileIcon}>↥</div>
              <div style={styles.fileCopy}>
                <strong style={styles.fileName}>{deliveryDraft.fileName}</strong>
                <span style={styles.fileMeta}>{formatFileSize(deliveryDraft.fileSize) || "Archivo seleccionado"}</span>
              </div>
              <span style={styles.fileReady}>Listo</span>
            </div>

            <p style={styles.simulationNote}>
              El archivo se selecciona únicamente para simular el flujo de entrega. No se sube ni se almacena en AulaNómina.
            </p>

            {deliveryError ? <p style={styles.deliveryError}>{deliveryError}</p> : null}

            <div style={styles.deliveryActions}>
              <button type="button" onClick={closeDelivery} style={styles.cancelButton} disabled={deliverySaving}>Cancelar</button>
              <button
                type="button"
                onClick={handleSaveDelivery}
                style={styles.deliverySaveButton}
                disabled={!deliveryDraft.fileName || deliverySaving}
              >
                {deliverySaving ? "Guardando..." : "Guardar entrega"}
              </button>
            </div>
          </div>
        </div>
      )}

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
  const base = { display: "inline-block", border: "1px solid #dbe3ee", borderRadius: "999px", padding: "4px 8px", fontSize: "12px", fontWeight: 700 };
  if (status === "received") return { ...base, borderColor: "#cfe7d7", background: "#f8fcf9", color: "#166534" };
  if (status === "expired") return { ...base, borderColor: "#f2c9c9", background: "#fffafa", color: "#991b1b" };
  if (status === "not_applicable") return { ...base, background: "#f8fafc", color: "#64748b" };
  return { ...base, borderColor: "#e7d7b0", background: "#fffaf2", color: "#8a5a13" };
}

const styles = {
  card: { border: "1px solid #dbe3ee", borderRadius: "10px", background: "#fff", padding: "16px", boxShadow: "none" },
  headerRow: { display: "flex", justifyContent: "space-between", gap: "18px", marginBottom: "14px" },
  title: { margin: 0, fontSize: "20px", fontWeight: 750, color: "#172033" },
  subtitle: { margin: "4px 0 0", color: "#64748b", fontSize: "13px", fontWeight: 500 },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  row: { height: "58px" },
  th: { borderBottom: "1px solid #cbd5e1", textAlign: "left", padding: "9px 10px", fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "#475569", background: "#f8fafc" },
  td: { borderBottom: "1px solid #e2e8f0", padding: "8px 10px", height: "58px", boxSizing: "border-box", lineHeight: 1.25, fontWeight: 600, verticalAlign: "middle", color: "#334155" },
  tdActions: { borderBottom: "1px solid #e2e8f0", padding: "8px 10px", height: "58px", boxSizing: "border-box", display: "flex", flexWrap: "nowrap", gap: "7px", alignItems: "center", minWidth: "390px", whiteSpace: "nowrap" },
  attachButton: { display: "inline-flex", flexShrink: 0, width: "154px", height: "34px", boxSizing: "border-box", alignItems: "center", justifyContent: "center", border: "1px solid #8fb2f5", borderRadius: "6px", background: "#eef5ff", color: "#1d4ed8", padding: "0 10px", fontWeight: 700, fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" },
  hiddenFileInput: { display: "none" },
  smallButton: { flexShrink: 0, height: "34px", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", color: "#334155", padding: "0 10px", fontWeight: 700, cursor: "pointer" },
  actionSelect: { flexShrink: 0, height: "34px", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", color: "#334155", padding: "0 9px", fontWeight: 600, cursor: "pointer", minWidth: "140px" },
  empty: { padding: "18px", textAlign: "center", fontWeight: 600, color: "#64748b" },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.48)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(860px, 100%)", backgroundColor: "#fff", border: "1px solid #dbe3ee", borderRadius: "12px", boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)", padding: "22px" },
  deliveryModal: { width: "min(620px, 100%)", backgroundColor: "#fff", border: "1px solid #dbe3ee", borderRadius: "12px", boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e2e8f0", paddingBottom: "14px" },
  modalKicker: { display: "block", marginBottom: "5px", color: "#2563eb", fontSize: "10px", fontWeight: 800, letterSpacing: ".06em" },
  modalTitle: { margin: 0, fontSize: "21px", fontWeight: 750, color: "#172033" },
  modalSubtitle: { margin: "4px 0 0", color: "#64748b", fontSize: "13px", fontWeight: 600 },
  closeButton: { border: "none", backgroundColor: "transparent", color: "#475569", fontSize: "26px", lineHeight: 1, cursor: "pointer", fontWeight: 600 },
  deliveryFileCard: { display: "grid", gridTemplateColumns: "42px minmax(0, 1fr) auto", gap: "12px", alignItems: "center", border: "1px solid #dbe3ee", borderRadius: "8px", background: "#f8fafc", padding: "13px 14px" },
  fileIcon: { width: "38px", height: "38px", display: "grid", placeItems: "center", borderRadius: "8px", background: "#eef5ff", color: "#1d4ed8", fontSize: "20px", fontWeight: 800 },
  fileCopy: { display: "flex", minWidth: 0, flexDirection: "column", gap: "3px" },
  fileName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#172033", fontSize: "14px", fontWeight: 700 },
  fileMeta: { color: "#64748b", fontSize: "12px" },
  fileReady: { border: "1px solid #cfe7d7", borderRadius: "999px", background: "#f8fcf9", color: "#166534", padding: "4px 8px", fontSize: "11px", fontWeight: 700 },
  simulationNote: { margin: "14px 0 0", padding: "10px 12px", borderLeft: "3px solid #8fb2f5", background: "#f8fafc", color: "#64748b", fontSize: "12px", lineHeight: 1.5 },
  deliveryError: { margin: "12px 0 0", padding: "9px 10px", border: "1px solid #f2c9c9", borderRadius: "6px", background: "#fffafa", color: "#991b1b", fontSize: "12px", fontWeight: 600 },
  deliveryActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" },
  form: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" },
  label: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" },
  input: { border: "1px solid #cbd5e1", borderRadius: "6px", padding: "9px 10px", fontSize: "14px", fontWeight: 500, background: "#fff", color: "#172033" },
  modalActions: { gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelButton: { border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", color: "#334155", padding: "9px 12px", fontWeight: 700, cursor: "pointer" },
  saveButton: { border: "1px solid #2563eb", borderRadius: "6px", background: "#2563eb", color: "#fff", padding: "9px 14px", fontWeight: 700, cursor: "pointer" },
  deliverySaveButton: { border: "1px solid #2563eb", borderRadius: "6px", background: "#2563eb", color: "#fff", padding: "9px 14px", fontWeight: 700, cursor: "pointer" },
  error: { gridColumn: "1 / -1", background: "#fffafa", border: "1px solid #f2c9c9", borderRadius: "6px", color: "#991b1b", padding: "10px", fontWeight: 600, margin: "0 0 12px" },
  success: { background: "#f8fcf9", border: "1px solid #cfe7d7", borderRadius: "6px", color: "#166534", padding: "10px", fontWeight: 600, margin: "0 0 12px" },
};