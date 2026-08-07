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
  tableWrapper: { overflowX: "auto", borderTop: "1px solid #e2e8f0" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #cbd5e1", backgroundColor: "#f8fafc", color: "#475569", whiteSpace: "nowrap", fontSize: "12px", fontWeight: 700 },
  td: { padding: "11px 12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", color: "#334155", fontSize: "13px" },
  emptyCell: { padding: "20px", color: "#64748b", textAlign: "center", borderBottom: "1px solid #e2e8f0" },
  editButton: { backgroundColor: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "7px", padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
  deleteButton: { backgroundColor: "#fff", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "7px", padding: "9px 13px", cursor: "pointer", fontWeight: 700 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.52)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(980px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "10px", boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)", padding: "22px" },
  confirmModal: { width: "min(560px, 100%)", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "10px", boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e2e8f0", paddingBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a" },
  modalSubtitle: { margin: "4px 0 0", color: "#64748b", fontSize: "13px", fontWeight: 600 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#334155" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px", color: "#475569", fontSize: "12px", fontWeight: 700 },
  formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px", color: "#475569", fontSize: "12px", fontWeight: 700 },
  input: { padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "14px", color: "#0f172a" },
  confirmText: { margin: "0 0 16px", color: "#475569", lineHeight: 1.5 },
  error: { backgroundColor: "#fef2f2", color: "#991b1b", padding: "10px 12px", borderRadius: "7px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelButton: { backgroundColor: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "7px", padding: "9px 13px", cursor: "pointer", fontWeight: 700 },
  saveButton: { backgroundColor: "#2563eb", color: "#ffffff", border: "1px solid #2563eb", borderRadius: "7px", padding: "9px 13px", cursor: "pointer", fontWeight: 700 },
  dangerButton: { backgroundColor: "#b91c1c", color: "#ffffff", border: "1px solid #b91c1c", borderRadius: "7px", padding: "9px 13px", cursor: "pointer", fontWeight: 800 },
};
