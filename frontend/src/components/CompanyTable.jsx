import { useState } from "react";

function toEditForm(company) {
  return {
    name: company.name || "",
    cif: company.cif || "",
    ccc: company.ccc || "",
    address: company.address || "",
    city: company.city || "",
    province: company.province || "",
  };
}

export default function CompanyTable({ loading, companies, onUpdateCompany, onDeleteCompany, submitting }) {
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  if (loading) return <p>Cargando...</p>;

  const openEditModal = (company) => {
    setEditingCompany(company);
    setEditForm(toEditForm(company));
    setEditError("");
    setDeleteError("");
  };

  const closeEditModal = () => {
    setEditingCompany(null);
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
      await onUpdateCompany(editingCompany.id, editForm);
      closeEditModal();
    } catch (err) {
      setEditError(err.message || "Error al actualizar empresa");
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");

    try {
      await onDeleteCompany(companyToDelete.id);
      setCompanyToDelete(null);
      closeEditModal();
    } catch (err) {
      setDeleteError(err.message || "Error al eliminar empresa");
    }
  };

  return (
    <>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Nombre</th>
              <th style={styles.th}>CIF</th>
              <th style={styles.th}>CCC</th>
              <th style={styles.th}>Ciudad</th>
              <th style={styles.th}>Provincia</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td style={styles.td}>{c.id}</td>
                <td style={styles.td}>{c.name}</td>
                <td style={styles.td}>{c.cif}</td>
                <td style={styles.td}>{c.ccc || "-"}</td>
                <td style={styles.td}>{c.city || "-"}</td>
                <td style={styles.td}>{c.province || "-"}</td>
                <td style={styles.td}>
                  <button type="button" onClick={() => openEditModal(c)} style={styles.editButton}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingCompany && editForm && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Editar empresa / centro</h3>
                <p style={styles.modalSubtitle}>ID {editingCompany.id} · {editingCompany.name}</p>
              </div>
              <button type="button" onClick={closeEditModal} style={styles.closeButton}>×</button>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Nombre</label>
                  <input name="name" value={editForm.name} onChange={handleEditChange} required style={styles.input} />
                </div>
                <div style={styles.formGroupSmall}>
                  <label>CIF</label>
                  <input name="cif" value={editForm.cif} onChange={handleEditChange} required style={styles.input} />
                </div>
                <div style={styles.formGroupSmall}>
                  <label>CCC</label>
                  <input name="ccc" value={editForm.ccc} onChange={handleEditChange} required style={styles.input} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroupWide}>
                  <label>Dirección</label>
                  <input name="address" value={editForm.address} onChange={handleEditChange} style={styles.input} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Ciudad</label>
                  <input name="city" value={editForm.city} onChange={handleEditChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Provincia</label>
                  <input name="province" value={editForm.province} onChange={handleEditChange} style={styles.input} />
                </div>
              </div>

              <div style={styles.dangerZone}>
                <div>
                  <strong>Zona de eliminación</strong>
                  <p style={styles.dangerText}>Eliminar una empresa/centro la desactivará del listado operativo.</p>
                </div>
                <button type="button" onClick={() => setCompanyToDelete(editingCompany)} style={styles.deleteButton}>
                  Eliminar empresa
                </button>
              </div>

              {editError && <div style={styles.error}>{editError}</div>}

              <div style={styles.modalActions}>
                <button type="button" onClick={closeEditModal} style={styles.cancelButton}>Cancelar</button>
                <button type="submit" disabled={submitting} style={styles.saveButton}>
                  {submitting ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {companyToDelete && (
        <div style={styles.modalBackdrop}>
          <div style={styles.confirmModal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Eliminar empresa / centro</h3>
                <p style={styles.modalSubtitle}>Esta acción desactivará la empresa o centro.</p>
              </div>
              <button type="button" onClick={() => setCompanyToDelete(null)} style={styles.closeButton}>×</button>
            </div>

            <p style={styles.confirmText}>
              ¿Seguro que quieres eliminar/desactivar {companyToDelete.name}?
            </p>

            {deleteError && <div style={styles.error}>{deleteError}</div>}

            <div style={styles.modalActions}>
              <button type="button" onClick={() => setCompanyToDelete(null)} style={styles.cancelButton}>Cancelar</button>
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
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "12px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  td: { padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  editButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(920px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  confirmModal: { width: "min(560px, 100%)", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupSmall: { width: "190px", flex: "0 0 190px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  dangerZone: { border: "1px solid #fecaca", backgroundColor: "#fef2f2", borderRadius: "10px", padding: "12px", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" },
  dangerText: { margin: "4px 0 0", color: "#7f1d1d", fontSize: "13px" },
  confirmText: { margin: "0 0 16px", color: "#374151", lineHeight: 1.5 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
};
