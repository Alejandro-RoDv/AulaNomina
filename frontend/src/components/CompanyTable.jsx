import { useMemo, useState } from "react";
import { getSortLabel, nextSortConfig, sortRows } from "../utils/tableSorting";

function toEditForm(company) {
  return {
    name: company.name || "",
    cif: company.cif || "",
    ccc: company.ccc || "",
    ccc_regime: company.ccc_regime || "",
    ccc_code: company.ccc_code || "",
    address: company.address || "",
    city: company.city || "",
    province: company.province || "",
    status: company.status || "alta",
    registration_date: company.registration_date || "",
    deregistration_date: company.deregistration_date || "",
    main_collective_agreement: company.main_collective_agreement || "",
    company_type: company.company_type || "",
    bank_iban: company.bank_iban || "",
    model_111: company.model_111 || "",
    fiscal_regime: company.fiscal_regime || "",
    complement_computation: company.complement_computation || "",
    siltra_enabled: !!company.siltra_enabled,
  };
}

function formatStatus(status) {
  if (status === "baja_temporal") return "Baja temporal";
  if (status === "baja_definitiva") return "Baja definitiva";
  return "Alta";
}

export default function CompanyTable({ loading, companies, onUpdateCompany, onDeleteCompany, submitting }) {
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "asc" });

  const sortedCompanies = useMemo(() => sortRows(companies, sortConfig, {
    id: (company) => company.id,
    name: (company) => company.name,
    cif: (company) => company.cif,
    ccc: (company) => company.ccc,
    status: (company) => company.status,
    company_type: (company) => company.company_type,
    city: (company) => company.city,
    province: (company) => company.province,
  }), [companies, sortConfig]);

  if (loading) return <p>Cargando...</p>;

  const handleSort = (key) => {
    setSortConfig((current) => nextSortConfig(current, key));
  };

  const sortHeader = (key, label, style = styles.th) => (
    <th style={style}>
      <button type="button" onClick={() => handleSort(key)} style={styles.sortButton}>
        <span>{label}</span>
        <span style={styles.sortIcon}>{getSortLabel(sortConfig, key)}</span>
      </button>
    </th>
  );

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
    const { name, value, checked, type } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
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
              {sortHeader("id", "ID")}
              {sortHeader("name", "Nombre")}
              {sortHeader("cif", "CIF")}
              {sortHeader("status", "Estado")}
              {sortHeader("company_type", "Tipo")}
              {sortHeader("ccc", "CCC")}
              <th style={styles.th}>Convenio</th>
              <th style={styles.th}>Modelo 111</th>
              <th style={styles.th}>SILTRA</th>
              {sortHeader("city", "Ciudad")}
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sortedCompanies.map((c) => (
              <tr key={c.id}>
                <td style={styles.td}>{c.id}</td>
                <td style={styles.td}>{c.name}</td>
                <td style={styles.td}>{c.cif}</td>
                <td style={styles.td}>{formatStatus(c.status)}</td>
                <td style={styles.td}>{c.company_type || "-"}</td>
                <td style={styles.td}>{c.ccc || "-"}</td>
                <td style={styles.td}>{c.main_collective_agreement || "-"}</td>
                <td style={styles.td}>{c.model_111 || "-"}</td>
                <td style={styles.td}>{c.siltra_enabled ? "Sí" : "No"}</td>
                <td style={styles.td}>{c.city || "-"}</td>
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
                <h3 style={styles.modalTitle}>Editar empresa</h3>
                <p style={styles.modalSubtitle}>ID {editingCompany.id} · {editingCompany.name}</p>
              </div>
              <button type="button" onClick={closeEditModal} style={styles.closeButton}>×</button>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}><label>Nombre</label><input name="name" value={editForm.name} onChange={handleEditChange} required style={styles.input} /></div>
                <div style={styles.formGroupSmall}><label>CIF</label><input name="cif" value={editForm.cif} onChange={handleEditChange} required style={styles.input} /></div>
                <div style={styles.formGroupSmall}><label>Estado</label><select name="status" value={editForm.status} onChange={handleEditChange} style={styles.input}><option value="alta">Alta</option><option value="baja_temporal">Baja temporal</option><option value="baja_definitiva">Baja definitiva</option></select></div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}><label>CCC régimen</label><input name="ccc_regime" value={editForm.ccc_regime} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>CCC código</label><input name="ccc_code" value={editForm.ccc_code} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>CCC completo</label><input name="ccc" value={editForm.ccc} onChange={handleEditChange} style={styles.input} /></div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}><label>Fecha alta</label><input type="date" name="registration_date" value={editForm.registration_date || ""} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Fecha baja</label><input type="date" name="deregistration_date" value={editForm.deregistration_date || ""} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Tipo empresa</label><input name="company_type" value={editForm.company_type} onChange={handleEditChange} style={styles.input} /></div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroupWide}><label>Domicilio social</label><input name="address" value={editForm.address} onChange={handleEditChange} style={styles.input} /></div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}><label>Ciudad</label><input name="city" value={editForm.city} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Provincia</label><input name="province" value={editForm.province} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Convenio principal</label><input name="main_collective_agreement" value={editForm.main_collective_agreement} onChange={handleEditChange} style={styles.input} /></div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}><label>IBAN</label><input name="bank_iban" value={editForm.bank_iban} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Modelo 111</label><input name="model_111" value={editForm.model_111} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Régimen fiscal</label><input name="fiscal_regime" value={editForm.fiscal_regime} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Cómputo complementos</label><input name="complement_computation" value={editForm.complement_computation} onChange={handleEditChange} style={styles.input} /></div>
              </div>

              <label style={styles.inlineCheck}><input type="checkbox" name="siltra_enabled" checked={editForm.siltra_enabled} onChange={handleEditChange} /> Cotización SILTRA</label>

              {editError && <div style={styles.error}>{editError}</div>}

              <div style={styles.modalActionsSplit}>
                <button type="button" onClick={() => setCompanyToDelete(editingCompany)} style={styles.deleteButton}>
                  Eliminar empresa
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

      {companyToDelete && (
        <div style={styles.modalBackdrop}>
          <div style={styles.confirmModal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Eliminar empresa</h3>
                <p style={styles.modalSubtitle}>Esta acción desactivará la empresa o centro.</p>
              </div>
              <button type="button" onClick={() => setCompanyToDelete(null)} style={styles.closeButton}>×</button>
            </div>

            <p style={styles.confirmText}>¿Seguro que quieres eliminar/desactivar {companyToDelete.name}?</p>
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
  sortButton: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: 0, border: "none", backgroundColor: "transparent", color: "inherit", font: "inherit", fontWeight: 900, cursor: "pointer", textAlign: "left" },
  sortIcon: { color: "#6b7280", fontSize: "12px" },
  td: { padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
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
  formGroupSmall: { width: "190px", flex: "0 0 190px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px" },
  inlineCheck: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#111827" },
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
