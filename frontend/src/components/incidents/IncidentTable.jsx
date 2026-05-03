import { useState } from "react";
import { INCIDENT_TYPES, STATUS_OPTIONS } from "./IncidentForm";

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function getTypeLabel(value) {
  return INCIDENT_TYPES.find((type) => type.value === value)?.label || value || "-";
}

function getStatusLabel(value) {
  return STATUS_OPTIONS.find((status) => status.value === value)?.label || value || "-";
}

function getEmployeeCode(incident) {
  return incident.employee_code || incident.employee_id || "-";
}

function toEditForm(incident) {
  return {
    incident_type: incident.incident_type || "",
    start_date: incident.start_date || "",
    end_date: incident.end_date || "",
    description: incident.description || "",
    status: incident.status || "open",
  };
}

export default function IncidentTable({
  loading,
  incidents,
  onUpdateIncident,
  onDeleteIncident,
  submitting,
}) {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [incidentToDelete, setIncidentToDelete] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const openDetailsModal = (incident) => {
    setSelectedIncident(incident);
    setEditForm(toEditForm(incident));
    setIsEditing(false);
    setEditError("");
    setDeleteError("");
  };

  const closeDetailsModal = () => {
    setSelectedIncident(null);
    setEditForm(null);
    setIsEditing(false);
    setEditError("");
  };

  const enableEditing = () => {
    setIsEditing(true);
    setEditForm(toEditForm(selectedIncident));
    setEditError("");
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(toEditForm(selectedIncident));
    setEditError("");
  };

  const openDeleteModal = (incident) => {
    setIncidentToDelete(incident);
    setDeleteError("");
  };

  const closeDeleteModal = () => {
    setIncidentToDelete(null);
    setDeleteError("");
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditError("");

    if (!isEditing) {
      enableEditing();
      return;
    }

    try {
      await onUpdateIncident(selectedIncident.id, editForm);
      closeDetailsModal();
    } catch (err) {
      setEditError(err.message || "Error al actualizar incidencia");
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");

    try {
      await onDeleteIncident(incidentToDelete.id);
      closeDeleteModal();
      closeDetailsModal();
    } catch (err) {
      setDeleteError(err.message || "Error al eliminar incidencia");
    }
  };

  if (loading) {
    return <p>Cargando...</p>;
  }

  return (
    <>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thEmployeeCode}>Código trab.</th>
              <th style={styles.th}>Trabajador</th>
              <th style={styles.th}>Empresa</th>
              <th style={styles.th}>Contrato</th>
              <th style={styles.th}>Tipo</th>
              <th style={styles.thDate}>Inicio</th>
              <th style={styles.thDate}>Fin</th>
              <th style={styles.thStatus}>Estado</th>
              <th style={styles.thActions}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.id}>
                <td style={styles.td}>{getEmployeeCode(incident)}</td>
                <td style={styles.td}>{incident.employee_name || incident.employee_id}</td>
                <td style={styles.td}>{incident.company_name || incident.company_id}</td>
                <td style={styles.td}>{incident.contract_type || "-"}</td>
                <td style={styles.td}>
                  <span style={styles.typeBadge}>{getTypeLabel(incident.incident_type)}</span>
                </td>
                <td style={styles.td}>{formatDate(incident.start_date)}</td>
                <td style={styles.td}>{formatDate(incident.end_date)}</td>
                <td style={styles.td}>
                  <span style={incident.status === "closed" ? styles.closedBadge : styles.openBadge}>
                    {getStatusLabel(incident.status)}
                  </span>
                </td>
                <td style={styles.td}>
                  <button type="button" onClick={() => openDetailsModal(incident)} style={styles.detailsButton}>
                    Detalles
                  </button>
                </td>
              </tr>
            ))}
            {incidents.length === 0 && (
              <tr>
                <td style={styles.td} colSpan="9">No hay incidencias registradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedIncident && editForm && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Detalle de incidencia</h3>
                <p style={styles.modalSubtitle}>Incidencia #{selectedIncident.id} · {getEmployeeCode(selectedIncident)} · {selectedIncident.employee_name || selectedIncident.employee_id}</p>
              </div>
              <button type="button" onClick={closeDetailsModal} style={styles.closeButton}>×</button>
            </div>

            <div style={styles.detailsGrid}>
              <div style={styles.detailBox}><span>Código trabajador</span><strong>{getEmployeeCode(selectedIncident)}</strong></div>
              <div style={styles.detailBox}><span>ID técnico trabajador</span><strong>{selectedIncident.employee_id || "-"}</strong></div>
              <div style={styles.detailBox}><span>Trabajador</span><strong>{selectedIncident.employee_name || selectedIncident.employee_id}</strong></div>
              <div style={styles.detailBox}><span>Empresa</span><strong>{selectedIncident.company_name || selectedIncident.company_id}</strong></div>
              <div style={styles.detailBox}><span>ID técnico contrato</span><strong>{selectedIncident.contract_id || "-"}</strong></div>
              <div style={styles.detailBox}><span>Contrato</span><strong>{selectedIncident.contract_type || "-"}</strong></div>
              <div style={styles.detailBox}><span>Fecha creación</span><strong>{formatDate(selectedIncident.created_at?.slice(0, 10))}</strong></div>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Tipo</label>
                  <select
                    name="incident_type"
                    value={editForm.incident_type}
                    onChange={handleEditChange}
                    required
                    disabled={!isEditing}
                    style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }}
                  >
                    {INCIDENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label>Estado</label>
                  <select
                    name="status"
                    value={editForm.status}
                    onChange={handleEditChange}
                    disabled={!isEditing}
                    style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Fecha inicio</label>
                  <input
                    type="date"
                    name="start_date"
                    value={editForm.start_date}
                    onChange={handleEditChange}
                    required
                    disabled={!isEditing}
                    style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label>Fecha fin</label>
                  <input
                    type="date"
                    name="end_date"
                    value={editForm.end_date}
                    onChange={handleEditChange}
                    disabled={!isEditing}
                    style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }}
                  />
                </div>
              </div>

              <div style={styles.formGroupFull}>
                <label>Descripción</label>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  rows="5"
                  disabled={!isEditing}
                  style={{ ...styles.textarea, ...(!isEditing ? styles.readOnlyInput : {}) }}
                />
              </div>

              {editError && <div style={styles.error}>{editError}</div>}

              <div style={styles.modalActionsSplit}>
                <button type="button" onClick={() => openDeleteModal(selectedIncident)} style={styles.deleteButton}>
                  Eliminar incidencia
                </button>
                <div style={styles.modalActionsRight}>
                  {isEditing && (
                    <button type="button" onClick={cancelEditing} style={styles.cancelButton}>
                      Cancelar
                    </button>
                  )}
                  <button type="submit" disabled={submitting} style={styles.saveButton}>
                    {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Editar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {incidentToDelete && (
        <div style={styles.modalBackdrop}>
          <div style={styles.confirmModal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Eliminar incidencia</h3>
                <p style={styles.modalSubtitle}>Esta acción eliminará definitivamente la incidencia.</p>
              </div>
              <button type="button" onClick={closeDeleteModal} style={styles.closeButton}>×</button>
            </div>

            <p style={styles.confirmText}>
              ¿Seguro que quieres eliminar la incidencia de {incidentToDelete.employee_name || incidentToDelete.employee_id}?
            </p>

            {deleteError && <div style={styles.error}>{deleteError}</div>}

            <div style={styles.modalActions}>
              <button type="button" onClick={closeDeleteModal} style={styles.cancelButton}>Cancelar</button>
              <button type="button" onClick={handleConfirmDelete} disabled={submitting} style={styles.dangerButton}>
                {submitting ? "Eliminando..." : "Confirmar eliminación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  tableWrapper: { overflowX: "hidden", width: "100%" },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  th: { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  thEmployeeCode: { width: "82px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb" },
  thDate: { width: "96px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb" },
  thStatus: { width: "88px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb" },
  thActions: { width: "92px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb" },
  td: { padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  typeBadge: { backgroundColor: "#fef3c7", color: "#92400e", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, whiteSpace: "nowrap" },
  openBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  closedBadge: { backgroundColor: "#e5e7eb", color: "#374151", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  detailsButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(900px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  confirmModal: { width: "min(560px, 100%)", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  detailsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "18px" },
  detailBox: { border: "1px solid #e5e7eb", borderRadius: "10px", backgroundColor: "#f9fafb", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupFull: { display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  textarea: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", resize: "vertical", fontFamily: "inherit" },
  readOnlyInput: { backgroundColor: "#f3f4f6", color: "#111827", cursor: "not-allowed", opacity: 1 },
  confirmText: { margin: "0 0 16px", color: "#374151", lineHeight: 1.5 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
};
