import { useMemo, useState } from "react";
import { getEmployeeVisibleCode } from "../../utils/visibleCodes";

const emptyEditForm = {
  employee_code: "",
  dni: "",
  naf: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  birth_date: "",
  address: "",
  city: "",
  province: "",
  postal_code: "",
  is_active: true,
};

function toEditForm(employee) {
  return {
    employee_code: employee.employee_code || "",
    dni: employee.dni || "",
    naf: employee.naf || "",
    first_name: employee.first_name || "",
    last_name: employee.last_name || "",
    email: employee.email || "",
    phone: employee.phone || "",
    birth_date: employee.birth_date || "",
    address: employee.address || "",
    city: employee.city || "",
    province: employee.province || "",
    postal_code: employee.postal_code || "",
    is_active: employee.is_active ?? true,
  };
}

export default function EmployeeTable({
  loading,
  employees,
  companies = [],
  workCenters = [],
  contracts = [],
  onUpdateEmployee,
  onDeleteEmployee,
  onOpenRecord,
  submitting,
}) {
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const companyMap = useMemo(() => companies.reduce((acc, company) => ({ ...acc, [company.id]: company }), {}), [companies]);
  const centerMap = useMemo(() => workCenters.reduce((acc, center) => ({ ...acc, [center.id]: center }), {}), [workCenters]);

  if (loading) return <p>Cargando...</p>;

  const getEmployeeCode = (employee) => getEmployeeVisibleCode(employee, employees, contracts);

  const getActiveContract = (employeeId) => contracts.find(
    (contract) => Number(contract.employee_id) === Number(employeeId) && contract.status === "active"
  ) || contracts.find((contract) => Number(contract.employee_id) === Number(employeeId));

  const getCompanyName = (employee) => {
    const activeContract = getActiveContract(employee.id);
    return activeContract?.company_name || companyMap[activeContract?.company_id]?.name || companyMap[employee.company_id]?.name || "-";
  };

  const getCenterName = (employee) => {
    const activeContract = getActiveContract(employee.id);
    return activeContract?.center_name || centerMap[activeContract?.center_id]?.name || centerMap[employee.center_id]?.name || "-";
  };

  const openEditModal = (employee) => {
    setEditingEmployee(employee);
    setEditForm(toEditForm(employee));
    setEditError("");
    setDeleteError("");
  };

  const closeEditModal = () => {
    setEditingEmployee(null);
    setEditForm(emptyEditForm);
    setEditError("");
  };

  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditError("");
    try {
      await onUpdateEmployee(editingEmployee.id, editForm);
      closeEditModal();
    } catch (err) {
      setEditError(err.message || "Error al actualizar trabajador");
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");
    try {
      await onDeleteEmployee(employeeToDelete.id);
      setEmployeeToDelete(null);
      closeEditModal();
    } catch (err) {
      setDeleteError(err.message || "Error al desactivar trabajador");
    }
  };

  const handleOpenRecord = (employee) => {
    if (onOpenRecord) {
      onOpenRecord(employee);
      return;
    }

    window.sessionStorage.setItem("aulanomina:selectedEmployeeId", String(employee.id));
    window.location.hash = "employee-record";
    window.dispatchEvent(new Event("aulanomina-route-change"));
  };

  return (
    <>
      {!employees.length ? (
        <p style={styles.empty}>No hay trabajadores que coincidan con los filtros aplicados.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Código</th>
                <th style={styles.th}>DNI</th>
                <th style={styles.th}>NAF</th>
                <th style={styles.th}>Nombre completo</th>
                <th style={styles.th}>Empresa</th>
                <th style={styles.th}>Centro</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td style={styles.tdStrong}>{getEmployeeCode(employee)}</td>
                  <td style={styles.td}>{employee.dni}</td>
                  <td style={styles.td}>{employee.naf || "-"}</td>
                  <td style={styles.td}>{employee.first_name} {employee.last_name}</td>
                  <td style={styles.td}>{getCompanyName(employee)}</td>
                  <td style={styles.td}>{getCenterName(employee)}</td>
                  <td style={styles.td}>{employee.email || "-"}</td>
                  <td style={styles.td}>
                    <span style={employee.is_active ? styles.activeBadge : styles.inactiveBadge}>
                      {employee.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionGroup}>
                      <button type="button" style={styles.recordButton} onClick={() => handleOpenRecord(employee)}>Expediente</button>
                      <button type="button" style={styles.editButton} onClick={() => openEditModal(employee)}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingEmployee && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Editar trabajador</h3>
                <p style={styles.modalSubtitle}>{editingEmployee.first_name} {editingEmployee.last_name}</p>
              </div>
              <button type="button" onClick={closeEditModal} style={styles.closeButton}>×</button>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroupCode}>
                  <label>Código trabajador</label>
                  <input name="employee_code" value={editForm.employee_code} readOnly disabled style={{ ...styles.input, ...styles.readOnlyInput }} />
                </div>
                <div style={styles.formGroupDni}>
                  <label>DNI</label>
                  <input name="dni" value={editForm.dni} onChange={handleEditChange} required style={styles.input} />
                </div>
                <div style={styles.formGroupNaf}>
                  <label>NAF</label>
                  <input name="naf" value={editForm.naf} onChange={handleEditChange} style={styles.input} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Nombre</label>
                  <input name="first_name" value={editForm.first_name} onChange={handleEditChange} required style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Apellidos</label>
                  <input name="last_name" value={editForm.last_name} onChange={handleEditChange} required style={styles.input} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Email</label>
                  <input name="email" type="email" value={editForm.email} onChange={handleEditChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Teléfono</label>
                  <input name="phone" value={editForm.phone} onChange={handleEditChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Fecha nacimiento</label>
                  <input name="birth_date" type="date" value={editForm.birth_date} onChange={handleEditChange} style={styles.input} />
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
                <div style={styles.formGroup}>
                  <label>Código postal</label>
                  <input name="postal_code" value={editForm.postal_code} onChange={handleEditChange} style={styles.input} />
                </div>
              </div>

              <label style={styles.checkboxLabel}>
                <input name="is_active" type="checkbox" checked={editForm.is_active} onChange={handleEditChange} />
                Trabajador activo
              </label>

              {editError && <div style={styles.error}>{editError}</div>}
              <div style={styles.modalActionsSplit}>
                <button type="button" onClick={() => setEmployeeToDelete(editingEmployee)} style={styles.deleteButton}>Eliminar trabajador</button>
                <div style={styles.modalActionsRight}>
                  <button type="button" onClick={closeEditModal} style={styles.cancelButton}>Cancelar</button>
                  <button type="submit" disabled={submitting} style={styles.saveButton}>{submitting ? "Guardando..." : "Guardar cambios"}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {employeeToDelete && (
        <div style={styles.modalBackdrop}>
          <div style={styles.confirmModal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Eliminar trabajador</h3>
                <p style={styles.modalSubtitle}>Esta acción desactivará al trabajador.</p>
              </div>
              <button type="button" onClick={() => setEmployeeToDelete(null)} style={styles.closeButton}>×</button>
            </div>
            <p style={styles.confirmText}>¿Seguro que quieres eliminar/desactivar a {employeeToDelete.first_name} {employeeToDelete.last_name}?</p>
            {deleteError && <div style={styles.error}>{deleteError}</div>}
            <div style={styles.modalActions}>
              <button type="button" onClick={() => setEmployeeToDelete(null)} style={styles.cancelButton}>Cancelar</button>
              <button type="button" onClick={handleConfirmDelete} disabled={submitting} style={styles.dangerButton}>{submitting ? "Eliminando..." : "Confirmar eliminación"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  empty: { margin: 0, color: "#6b7280", fontSize: "14px" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "12px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  td: { padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  tdStrong: { padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", fontWeight: 900 },
  actionGroup: { display: "flex", gap: "8px", alignItems: "center" },
  activeBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  inactiveBadge: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  recordButton: { backgroundColor: "#f8f3b5", color: "#111827", border: "1px solid #111827", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 800 },
  editButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(920px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  confirmModal: { width: "min(560px, 100%)", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "200px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupCode: { width: "150px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupDni: { width: "190px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupNaf: { width: "230px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  readOnlyInput: { backgroundColor: "#f3f4f6", color: "#6b7280", cursor: "not-allowed", fontWeight: 800 },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 },
  confirmText: { margin: "0 0 16px", color: "#374151", lineHeight: 1.5 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
};
