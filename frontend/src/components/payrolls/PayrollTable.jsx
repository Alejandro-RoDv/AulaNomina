import { useState } from "react";
import { PAYROLL_STATUS_OPTIONS, formatCurrency } from "./PayrollForm";

function formatPeriod(payroll) {
  if (payroll.period_label) return payroll.period_label;
  const month = String(payroll.period_month || "").padStart(2, "0");
  return `${month}/${payroll.period_year || ""}`;
}

function getStatusLabel(value) {
  return PAYROLL_STATUS_OPTIONS.find((status) => status.value === value)?.label || value || "-";
}

function getStatusStyle(value) {
  if (value === "closed") return styles.closedBadge;
  if (value === "calculated") return styles.calculatedBadge;
  return styles.draftBadge;
}

function toEditForm(payroll) {
  return {
    period_month: String(payroll.period_month || ""),
    period_year: String(payroll.period_year || ""),
    base_salary: String(payroll.base_salary ?? ""),
    salary_supplements: String(payroll.salary_supplements ?? "0"),
    extra_pay_proration: String(payroll.extra_pay_proration ?? "0"),
    irpf_percentage: "10",
    status: payroll.status || "draft",
  };
}

export default function PayrollTable({ loading, payrolls, onUpdatePayroll, onDeletePayroll, submitting }) {
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [payrollToDelete, setPayrollToDelete] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const openDetailsModal = (payroll) => {
    setSelectedPayroll(payroll);
    setEditForm(toEditForm(payroll));
    setIsEditing(false);
    setEditError("");
    setDeleteError("");
  };

  const closeDetailsModal = () => {
    setSelectedPayroll(null);
    setEditForm(null);
    setIsEditing(false);
    setEditError("");
  };

  const enableEditing = () => {
    setIsEditing(true);
    setEditForm(toEditForm(selectedPayroll));
    setEditError("");
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(toEditForm(selectedPayroll));
    setEditError("");
  };

  const openDeleteModal = (payroll) => {
    setPayrollToDelete(payroll);
    setDeleteError("");
  };

  const closeDeleteModal = () => {
    setPayrollToDelete(null);
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
      await onUpdatePayroll(selectedPayroll.id, editForm);
      closeDetailsModal();
    } catch (err) {
      setEditError(err.message || "Error al actualizar nómina");
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");

    try {
      await onDeletePayroll(payrollToDelete.id);
      closeDeleteModal();
      closeDetailsModal();
    } catch (err) {
      setDeleteError(err.message || "Error al eliminar nómina");
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
              <th style={styles.th}>Trabajador</th>
              <th style={styles.th}>Empresa</th>
              <th style={styles.thPeriod}>Periodo</th>
              <th style={styles.thAmount}>Bruto</th>
              <th style={styles.thAmount}>Deducciones</th>
              <th style={styles.thAmount}>Neto</th>
              <th style={styles.thStatus}>Estado</th>
              <th style={styles.thActions}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {payrolls.map((payroll) => (
              <tr key={payroll.id}>
                <td style={styles.td}>{payroll.employee_name || payroll.employee_id}</td>
                <td style={styles.td}>{payroll.company_name || payroll.company_id}</td>
                <td style={styles.td}>{formatPeriod(payroll)}</td>
                <td style={styles.tdAmount}>{formatCurrency(payroll.gross_salary)}</td>
                <td style={styles.tdAmount}>{formatCurrency(payroll.total_deductions)}</td>
                <td style={styles.tdAmountStrong}>{formatCurrency(payroll.net_salary)}</td>
                <td style={styles.td}>
                  <span style={getStatusStyle(payroll.status)}>{getStatusLabel(payroll.status)}</span>
                </td>
                <td style={styles.td}>
                  <button type="button" onClick={() => openDetailsModal(payroll)} style={styles.detailsButton}>
                    Detalles
                  </button>
                </td>
              </tr>
            ))}
            {payrolls.length === 0 && (
              <tr>
                <td style={styles.td} colSpan="8">No hay nóminas generadas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedPayroll && editForm && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Detalle de nómina</h3>
                <p style={styles.modalSubtitle}>Nómina #{selectedPayroll.id} · {selectedPayroll.employee_name || selectedPayroll.employee_id} · {formatPeriod(selectedPayroll)}</p>
              </div>
              <button type="button" onClick={closeDetailsModal} style={styles.closeButton}>×</button>
            </div>

            <div style={styles.summaryGrid}>
              <div style={styles.summaryBox}><span>Trabajador</span><strong>{selectedPayroll.employee_name || selectedPayroll.employee_id}</strong></div>
              <div style={styles.summaryBox}><span>Empresa</span><strong>{selectedPayroll.company_name || selectedPayroll.company_id}</strong></div>
              <div style={styles.summaryBox}><span>Contrato</span><strong>#{selectedPayroll.contract_id}</strong></div>
              <div style={styles.summaryBox}><span>Periodo</span><strong>{formatPeriod(selectedPayroll)}</strong></div>
            </div>

            <div style={styles.payrollDetailGrid}>
              <section style={styles.detailSection}>
                <h4 style={styles.sectionTitle}>Devengos</h4>
                <div style={styles.line}><span>Salario base</span><strong>{formatCurrency(selectedPayroll.base_salary)}</strong></div>
                <div style={styles.line}><span>Complementos</span><strong>{formatCurrency(selectedPayroll.salary_supplements)}</strong></div>
                <div style={styles.line}><span>Prorrata extra</span><strong>{formatCurrency(selectedPayroll.extra_pay_proration)}</strong></div>
                <div style={styles.totalLine}><span>Total bruto</span><strong>{formatCurrency(selectedPayroll.gross_salary)}</strong></div>
              </section>

              <section style={styles.detailSection}>
                <h4 style={styles.sectionTitle}>Deducciones</h4>
                <div style={styles.line}><span>Seguridad Social trabajador</span><strong>{formatCurrency(selectedPayroll.employee_social_security)}</strong></div>
                <div style={styles.line}><span>IRPF</span><strong>{formatCurrency(selectedPayroll.irpf)}</strong></div>
                <div style={styles.totalLine}><span>Total deducciones</span><strong>{formatCurrency(selectedPayroll.total_deductions)}</strong></div>
                <div style={styles.netLine}><span>Neto</span><strong>{formatCurrency(selectedPayroll.net_salary)}</strong></div>
              </section>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroupSmall}>
                  <label>Mes</label>
                  <input
                    type="number"
                    name="period_month"
                    min="1"
                    max="12"
                    value={editForm.period_month}
                    onChange={handleEditChange}
                    disabled={!isEditing}
                    style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }}
                  />
                </div>

                <div style={styles.formGroupSmall}>
                  <label>Año</label>
                  <input
                    type="number"
                    name="period_year"
                    min="2000"
                    max="2100"
                    value={editForm.period_year}
                    onChange={handleEditChange}
                    disabled={!isEditing}
                    style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }}
                  />
                </div>

                <div style={styles.formGroupSmall}>
                  <label>Estado</label>
                  <select
                    name="status"
                    value={editForm.status}
                    onChange={handleEditChange}
                    disabled={!isEditing}
                    style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }}
                  >
                    {PAYROLL_STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Salario base</label>
                  <input type="number" step="0.01" name="base_salary" value={editForm.base_salary} onChange={handleEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
                </div>
                <div style={styles.formGroup}>
                  <label>Complementos</label>
                  <input type="number" step="0.01" name="salary_supplements" value={editForm.salary_supplements} onChange={handleEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
                </div>
                <div style={styles.formGroup}>
                  <label>Prorrata extra</label>
                  <input type="number" step="0.01" name="extra_pay_proration" value={editForm.extra_pay_proration} onChange={handleEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
                </div>
                <div style={styles.formGroupSmall}>
                  <label>IRPF %</label>
                  <input type="number" step="0.01" name="irpf_percentage" value={editForm.irpf_percentage} onChange={handleEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
                </div>
              </div>

              {editError && <div style={styles.error}>{editError}</div>}

              <div style={styles.modalActionsSplit}>
                <button type="button" onClick={() => openDeleteModal(selectedPayroll)} style={styles.deleteButton}>
                  Eliminar nómina
                </button>
                <div style={styles.modalActionsRight}>
                  {isEditing && <button type="button" onClick={cancelEditing} style={styles.cancelButton}>Cancelar</button>}
                  <button type="submit" disabled={submitting} style={styles.saveButton}>
                    {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Editar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {payrollToDelete && (
        <div style={styles.modalBackdrop}>
          <div style={styles.confirmModal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Eliminar nómina</h3>
                <p style={styles.modalSubtitle}>Esta acción eliminará definitivamente la nómina.</p>
              </div>
              <button type="button" onClick={closeDeleteModal} style={styles.closeButton}>×</button>
            </div>

            <p style={styles.confirmText}>
              ¿Seguro que quieres eliminar la nómina de {payrollToDelete.employee_name || payrollToDelete.employee_id} del periodo {formatPeriod(payrollToDelete)}?
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
  thPeriod: { width: "96px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb" },
  thAmount: { width: "118px", textAlign: "right", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb" },
  thStatus: { width: "96px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb" },
  thActions: { width: "96px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb" },
  td: { padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  tdAmount: { padding: "12px 10px", borderBottom: "1px solid #eee", textAlign: "right", whiteSpace: "nowrap" },
  tdAmountStrong: { padding: "12px 10px", borderBottom: "1px solid #eee", textAlign: "right", whiteSpace: "nowrap", fontWeight: 900 },
  draftBadge: { backgroundColor: "#e5e7eb", color: "#374151", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  calculatedBadge: { backgroundColor: "#dbeafe", color: "#1e40af", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  closedBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  detailsButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(940px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  confirmModal: { width: "min(560px, 100%)", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "18px" },
  summaryBox: { border: "1px solid #e5e7eb", borderRadius: "10px", backgroundColor: "#f9fafb", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" },
  payrollDetailGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "18px" },
  detailSection: { border: "2px solid #111827", borderRadius: "12px", padding: "14px", backgroundColor: "#ffffff" },
  sectionTitle: { margin: "0 0 10px", fontSize: "16px", fontWeight: 900 },
  line: { display: "flex", justifyContent: "space-between", gap: "12px", padding: "8px 0", borderBottom: "1px solid #e5e7eb" },
  totalLine: { display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px 0", fontWeight: 900 },
  netLine: { display: "flex", justifyContent: "space-between", gap: "12px", padding: "10px", fontWeight: 900, backgroundColor: "#fef3c7", borderRadius: "8px", marginTop: "8px" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "180px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupSmall: { width: "140px", minWidth: "120px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
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
