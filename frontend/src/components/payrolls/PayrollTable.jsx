import { useState } from "react";
import { PAYROLL_STATUS_OPTIONS, formatCurrency } from "./PayrollForm";
import PayrollDetailsModal from "./PayrollDetailsModal";

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
  const [editForm, setEditForm] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const openDetailsModal = (payroll) => {
    setSelectedPayroll(payroll);
    setEditForm(toEditForm(payroll));
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setEditError("");
    setDeleteError("");
  };

  const closeDetailsModal = () => {
    setSelectedPayroll(null);
    setEditForm(null);
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setEditError("");
    setDeleteError("");
  };

  const enableEditing = () => {
    setIsEditing(true);
    setEditForm(toEditForm(selectedPayroll));
    setShowDeleteConfirm(false);
    setEditError("");
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(toEditForm(selectedPayroll));
    setEditError("");
  };

  const requestDelete = () => {
    setShowDeleteConfirm(true);
    setDeleteError("");
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
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
      await onUpdatePayroll(selectedPayroll.id, editForm);
      closeDetailsModal();
    } catch (err) {
      setEditError(err.message || "Error al actualizar nómina");
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");

    try {
      await onDeletePayroll(selectedPayroll.id);
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

      <PayrollDetailsModal
        payroll={selectedPayroll}
        editForm={editForm}
        isEditing={isEditing}
        submitting={submitting}
        editError={editError}
        deleteError={deleteError}
        showDeleteConfirm={showDeleteConfirm}
        onClose={closeDetailsModal}
        onEditChange={handleEditChange}
        onEditSubmit={handleEditSubmit}
        onEnableEditing={enableEditing}
        onCancelEditing={cancelEditing}
        onRequestDelete={requestDelete}
        onConfirmDelete={handleConfirmDelete}
        onCancelDelete={cancelDelete}
      />
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
};
