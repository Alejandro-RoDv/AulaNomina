import { useState } from "react";
import { formatPaySchedule, PAY_SCHEDULE_OPTIONS } from "./ContractForm";

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatStatus(status) {
  const labels = {
    active: "Activo",
    ended: "Finalizado",
    deleted: "Eliminado",
  };
  return labels[status] || status || "-";
}

function formatSalary(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function getContractCode(contract) {
  return contract.contract_display_code || String(contract.id);
}

function toEditForm(contract) {
  return {
    employee_id: contract.employee_id ? String(contract.employee_id) : "",
    company_id: contract.company_id ? String(contract.company_id) : "",
    contract_type: contract.contract_type || "",
    start_date: contract.start_date || "",
    end_date: contract.end_date || "",
    salary_base: contract.salary_base || "",
    pay_schedule: contract.pay_schedule || "not_prorated_14",
    status: contract.status || "active",
  };
}

export default function ContractTable({
  loading,
  contracts,
  employees,
  companies,
  onUpdateContract,
  onDeleteContract,
  submitting,
}) {
  const [editingContract, setEditingContract] = useState(null);
  const [contractToDelete, setContractToDelete] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const getEmployeeName = (contract) => {
    if (contract.employee_name) return contract.employee_name;
    const emp = employees.find((employee) => employee.id === contract.employee_id);
    if (!emp) return contract.employee_id;
    return `${emp.first_name} ${emp.last_name}`;
  };

  const getCompany = (contract) => {
    return companies.find((item) => Number(item.id) === Number(contract.company_id));
  };

  const getCompanyName = (contract) => {
    if (contract.company_name) return contract.company_name;
    const company = getCompany(contract);
    if (!company) return contract.company_id || "-";
    return company.name;
  };

  const getCompanyCcc = (contract) => {
    const company = getCompany(contract);
    return company?.ccc || "-";
  };

  const openEditModal = (contract) => {
    setEditingContract(contract);
    setEditForm(toEditForm(contract));
    setEditError("");
    setDeleteError("");
  };

  const closeEditModal = () => {
    setEditingContract(null);
    setEditForm(null);
    setEditError("");
  };

  const openDeleteModal = (contract) => {
    setContractToDelete(contract);
    setDeleteError("");
  };

  const closeDeleteModal = () => {
    setContractToDelete(null);
    setDeleteError("");
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditError("");

    try {
      await onUpdateContract(editingContract.id, editForm);
      closeEditModal();
    } catch (err) {
      setEditError(err.message || "Error al actualizar contrato");
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");

    try {
      await onDeleteContract(contractToDelete.id);
      closeDeleteModal();
      closeEditModal();
    } catch (err) {
      setDeleteError(err.message || "Error al eliminar contrato");
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
              <th style={styles.thCode}>Cód.</th>
              <th style={styles.th}>Empleado</th>
              <th style={styles.th}>Empresa / centro</th>
              <th style={styles.thCcc}>CCC</th>
              <th style={styles.thType}>Tipo</th>
              <th style={styles.thDate}>Inicio</th>
              <th style={styles.thDate}>Fin</th>
              <th style={styles.thStatus}>Estado</th>
              <th style={styles.thSalary}>Salario</th>
              <th style={styles.thActions}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <tr key={contract.id}>
                <td style={styles.tdCode}>{getContractCode(contract)}</td>
                <td style={styles.td}>{getEmployeeName(contract)}</td>
                <td style={styles.td}>{getCompanyName(contract)}</td>
                <td style={styles.tdCcc}>{getCompanyCcc(contract)}</td>
                <td style={styles.tdType}>{contract.contract_type}</td>
                <td style={styles.tdDate}>{formatDate(contract.start_date)}</td>
                <td style={styles.tdDate}>{formatDate(contract.end_date)}</td>
                <td style={styles.tdStatus}>
                  <span style={contract.status === "active" ? styles.activeBadge : styles.inactiveBadge}>
                    {formatStatus(contract.status)}
                  </span>
                </td>
                <td style={styles.tdSalary}>{formatSalary(contract.salary_base)}</td>
                <td style={styles.tdActions}>
                  <button type="button" onClick={() => openEditModal(contract)} style={styles.editButton}>
                    Detalles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingContract && editForm && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Detalle y edición de contrato</h3>
                <p style={styles.modalSubtitle}>Contrato {getContractCode(editingContract)} · {formatPaySchedule(editingContract.pay_schedule)}</p>
              </div>
              <button type="button" onClick={closeEditModal} style={styles.closeButton}>×</button>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Empleado</label>
                  <input value={getEmployeeName(editingContract)} readOnly disabled style={{ ...styles.input, ...styles.readOnlyInput }} />
                  <small style={styles.helpText}>El trabajador no se puede modificar desde la edición del contrato.</small>
                </div>

                <div style={styles.formGroup}>
                  <label>Empresa / centro</label>
                  <select name="company_id" value={editForm.company_id} onChange={handleEditChange} required style={styles.input}>
                    <option value="">Selecciona una empresa o centro</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name} {company.ccc ? `· CCC ${company.ccc}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Tipo de contrato</label>
                  <select name="contract_type" value={editForm.contract_type} onChange={handleEditChange} required style={styles.input}>
                    <option value="">Selecciona tipo</option>
                    <option value="indefinido">Indefinido</option>
                    <option value="temporal">Temporal</option>
                    <option value="practicas">Prácticas</option>
                    <option value="formacion">Formación</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label>Sistema de pagas</label>
                  <select name="pay_schedule" value={editForm.pay_schedule} onChange={handleEditChange} required style={styles.input}>
                    {PAY_SCHEDULE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Fecha inicio</label>
                  <input type="date" name="start_date" value={editForm.start_date} onChange={handleEditChange} required style={styles.input} />
                </div>

                <div style={styles.formGroup}>
                  <label>Fecha fin</label>
                  <input type="date" name="end_date" value={editForm.end_date} onChange={handleEditChange} style={styles.input} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Salario anual de referencia</label>
                  <input type="number" name="salary_base" value={editForm.salary_base} onChange={handleEditChange} style={styles.input} />
                </div>

                <div style={styles.formGroup}>
                  <label>Estado</label>
                  <select name="status" value={editForm.status} onChange={handleEditChange} style={styles.input}>
                    <option value="active">Activo</option>
                    <option value="ended">Finalizado</option>
                  </select>
                </div>
              </div>

              {editError && <div style={styles.error}>{editError}</div>}

              <div style={styles.modalActionsSplit}>
                <button type="button" onClick={() => openDeleteModal(editingContract)} style={styles.deleteButton}>
                  Eliminar contrato
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

      {contractToDelete && (
        <div style={styles.modalBackdrop}>
          <div style={styles.confirmModal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Eliminar contrato</h3>
                <p style={styles.modalSubtitle}>Esta acción eliminará definitivamente el contrato.</p>
              </div>
              <button type="button" onClick={closeDeleteModal} style={styles.closeButton}>×</button>
            </div>

            <p style={styles.confirmText}>
              ¿Seguro que quieres eliminar el contrato {getContractCode(contractToDelete)} de {getEmployeeName(contractToDelete)}?
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
  th: { textAlign: "left", padding: "12px 8px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  thCode: { width: "66px", textAlign: "left", padding: "12px 8px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thCcc: { width: "98px", textAlign: "left", padding: "12px 8px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thType: { width: "90px", textAlign: "left", padding: "12px 8px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thDate: { width: "88px", textAlign: "left", padding: "12px 8px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thStatus: { width: "88px", textAlign: "left", padding: "12px 8px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thSalary: { width: "86px", textAlign: "right", padding: "12px 8px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thActions: { width: "80px", textAlign: "left", padding: "12px 8px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  td: { padding: "12px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  tdCode: { width: "66px", padding: "12px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  tdCcc: { width: "98px", padding: "12px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  tdType: { width: "90px", padding: "12px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  tdDate: { width: "88px", padding: "12px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  tdStatus: { width: "88px", padding: "12px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  tdSalary: { width: "86px", padding: "12px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", textAlign: "right" },
  tdActions: { width: "80px", padding: "12px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  activeBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  inactiveBadge: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  editButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "7px 9px", cursor: "pointer", fontWeight: 700, fontSize: "12px" },
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
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  readOnlyInput: { backgroundColor: "#f3f4f6", color: "#6b7280", cursor: "not-allowed", fontWeight: 800 },
  helpText: { color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  confirmText: { margin: "0 0 16px", color: "#374151", lineHeight: 1.5 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
};
