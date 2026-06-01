import { useState } from "react";

function toEditForm(center) {
  return {
    company_id: center.company_id || "",
    center_code: center.center_code || "",
    name: center.name || "",
    general_ccc: center.general_ccc || "",
    main_ccc: center.main_ccc || "",
    address: center.address || "",
    city: center.city || "",
    province: center.province || "",
    collective_agreement: center.collective_agreement || "",
    phone: center.phone || "",
    fax: center.fax || "",
    mobile: center.mobile || "",
    email: center.email || "",
    website: center.website || "",
  };
}

export default function WorkCenterTable({
  loading,
  workCenters,
  companies,
  onUpdateWorkCenter,
  onDeleteWorkCenter,
  submitting,
}) {
  const [editingCenter, setEditingCenter] = useState(null);
  const [centerToDelete, setCenterToDelete] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  if (loading) return <p>Cargando...</p>;

  const getCompanyName = (companyId) => {
    const company = companies.find((item) => String(item.id) === String(companyId));
    return company?.name || "-";
  };

  const openEditModal = (center) => {
    setEditingCenter(center);
    setEditForm(toEditForm(center));
    setEditError("");
    setDeleteError("");
  };

  const closeEditModal = () => {
    setEditingCenter(null);
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
      await onUpdateWorkCenter(editingCenter.id, editForm);
      closeEditModal();
    } catch (err) {
      setEditError(err.message || "Error al actualizar centro");
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");

    try {
      await onDeleteWorkCenter(centerToDelete.id);
      setCenterToDelete(null);
      closeEditModal();
    } catch (err) {
      setDeleteError(err.message || "Error al eliminar centro");
    }
  };

  return (
    <>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Centro</th>
              <th style={styles.th}>Empresa madre</th>
              <th style={styles.th}>Convenio centro</th>
              <th style={styles.th}>CCC general</th>
              <th style={styles.th}>CCC principal</th>
              <th style={styles.th}>Teléfono</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Ciudad</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {workCenters.map((center) => (
              <tr key={center.id}>
                <td style={styles.td}>{center.name}</td>
                <td style={styles.td}>{center.company_name || getCompanyName(center.company_id)}</td>
                <td style={styles.td}>{center.collective_agreement || "-"}</td>
                <td style={styles.td}>{center.general_ccc || "-"}</td>
                <td style={styles.td}>{center.main_ccc || "-"}</td>
                <td style={styles.td}>{center.phone || center.mobile || "-"}</td>
                <td style={styles.td}>{center.email || "-"}</td>
                <td style={styles.td}>{center.city || "-"}</td>
                <td style={styles.td}>
                  <button type="button" onClick={() => openEditModal(center)} style={styles.editButton}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}

            {workCenters.length === 0 && (
              <tr>
                <td colSpan="9" style={styles.emptyCell}>
                  Selecciona una empresa o crea el primer centro asociado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingCenter && editForm && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Editar centro</h3>
                <p style={styles.modalSubtitle}>{editingCenter.name}</p>
              </div>
              <button type="button" onClick={closeEditModal} style={styles.closeButton}>×</button>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Empresa madre</label>
                  <select name="company_id" value={editForm.company_id} onChange={handleEditChange} required style={styles.input}>
                    <option value="">Seleccionar empresa</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label>Nombre</label>
                  <input name="name" value={editForm.name} onChange={handleEditChange} required style={styles.input} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Convenio del centro</label>
                  <input name="collective_agreement" value={editForm.collective_agreement} onChange={handleEditChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>CCC general</label>
                  <input name="general_ccc" value={editForm.general_ccc} onChange={handleEditChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>CCC principal del centro</label>
                  <input name="main_ccc" value={editForm.main_ccc} onChange={handleEditChange} style={styles.input} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroupWide}>
                  <label>Domicilio del centro</label>
                  <input name="address" value={editForm.address} onChange={handleEditChange} style={styles.input} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}><label>Ciudad</label><input name="city" value={editForm.city} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Provincia</label><input name="province" value={editForm.province} onChange={handleEditChange} style={styles.input} /></div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}><label>Teléfono</label><input name="phone" value={editForm.phone} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Fax</label><input name="fax" value={editForm.fax} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Móvil</label><input name="mobile" value={editForm.mobile} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Email</label><input name="email" value={editForm.email} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Web</label><input name="website" value={editForm.website} onChange={handleEditChange} style={styles.input} /></div>
              </div>

              {editError && <div style={styles.error}>{editError}</div>}

              <div style={styles.modalActionsSplit}>
                <button type="button" onClick={() => setCenterToDelete(editingCenter)} style={styles.deleteButton}>
                  Desactivar centro
                </button>
                <div style={styles.modalActionsRight}>
                  <button type="button" onClick={closeEditModal} style={styles.cancelButton}>Cancelar</button>
                  <button type="submit" disabled={submitting} style={styles.saveButton}>
                    {submitting ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {centerToDelete && (
        <div style={styles.modalBackdrop}>
          <div style={styles.confirmModal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Desactivar centro</h3>
                <p style={styles.modalSubtitle}>El centro no se borrará físicamente.</p>
              </div>
              <button type="button" onClick={() => setCenterToDelete(null)} style={styles.closeButton}>×</button>
            </div>

            <p style={styles.confirmText}>¿Seguro que quieres desactivar {centerToDelete.name}?</p>
            {deleteError && <div style={styles.error}>{deleteError}</div>}

            <div style={styles.modalActions}>
              <button type="button" onClick={() => setCenterToDelete(null)} style={styles.cancelButton}>Cancelar</button>
              <button type="button" onClick={handleConfirmDelete} disabled={submitting} style={styles.dangerButton}>
                {submitting ? "Desactivando..." : "Confirmar"}
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
  emptyCell: { padding: "18px", color: "#6b7280", textAlign: "center", borderBottom: "1px solid #eee" },
  editButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(980px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "1px solid #d1d5db", borderRadius: "12px", boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)", padding: "22px" },
  confirmModal: { width: "min(560px, 100%)", backgroundColor: "#ffffff", border: "1px solid #d1d5db", borderRadius: "12px", boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  confirmText: { margin: "0 0 16px", color: "#374151", lineHeight: 1.5 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
};
