import { PAYROLL_STATUS_OPTIONS, MONTH_OPTIONS, formatCurrency } from "./PayrollForm";

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

function calculatePercentage(amount, grossSalary) {
  const gross = Number(grossSalary || 0);
  if (!gross) return "0,00 %";

  const percentage = (Number(amount || 0) / gross) * 100;
  return `${percentage.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

function InfoBox({ label, value }) {
  return (
    <div style={styles.infoBox}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PayrollLine({ label, amount, percentage, strong }) {
  return (
    <div style={strong ? styles.totalLine : styles.line}>
      <span>{label}</span>
      <div style={styles.amountBlock}>
        {percentage && <small>{percentage}</small>}
        <strong>{formatCurrency(amount)}</strong>
      </div>
    </div>
  );
}

export default function PayrollDetailsModal({
  payroll,
  editForm,
  isEditing,
  submitting,
  editError,
  deleteError,
  onClose,
  onEditChange,
  onEditSubmit,
  onEnableEditing,
  onCancelEditing,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  showDeleteConfirm,
}) {
  if (!payroll || !editForm) return null;

  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitleRow}>
              <h3 style={styles.modalTitle}>Detalle de nómina simulada</h3>
              <span style={getStatusStyle(payroll.status)}>{getStatusLabel(payroll.status)}</span>
            </div>
            <p style={styles.modalSubtitle}>
              Nómina #{payroll.id} · {payroll.employee_name || payroll.employee_id} · {formatPeriod(payroll)}
            </p>
          </div>
          <button type="button" onClick={onClose} style={styles.closeButton}>×</button>
        </div>

        <section style={styles.receiptHeader}>
          <InfoBox label="Trabajador" value={payroll.employee_name || payroll.employee_id} />
          <InfoBox label="Empresa / centro" value={payroll.company_name || payroll.company_id} />
          <InfoBox label="Contrato" value={`#${payroll.contract_id}`} />
          <InfoBox label="Periodo" value={formatPeriod(payroll)} />
        </section>

        <section style={styles.receiptBody}>
          <div style={styles.detailSection}>
            <div style={styles.sectionHeader}>
              <h4 style={styles.sectionTitle}>Devengos</h4>
              <span style={styles.sectionHint}>Importes calculados desde el contrato</span>
            </div>
            <PayrollLine label="Salario base calculado" amount={payroll.base_salary} />
            <PayrollLine label="Complementos salariales" amount={payroll.salary_supplements} />
            <PayrollLine label="Prorrata de pagas extra calculada" amount={payroll.extra_pay_proration} />
            <PayrollLine label="Total devengado / bruto" amount={payroll.gross_salary} strong />
          </div>

          <div style={styles.detailSection}>
            <div style={styles.sectionHeader}>
              <h4 style={styles.sectionTitle}>Deducciones</h4>
              <span style={styles.sectionHint}>Importes que restan al bruto</span>
            </div>
            <PayrollLine label="Seguridad Social trabajador" amount={payroll.employee_social_security} percentage={calculatePercentage(payroll.employee_social_security, payroll.gross_salary)} />
            <PayrollLine label="IRPF" amount={payroll.irpf} percentage={calculatePercentage(payroll.irpf, payroll.gross_salary)} />
            <PayrollLine label="Total deducciones" amount={payroll.total_deductions} strong />
          </div>
        </section>

        <section style={styles.netPanel}>
          <span>Líquido a percibir</span>
          <strong>{formatCurrency(payroll.net_salary)}</strong>
        </section>

        <form onSubmit={onEditSubmit} style={styles.form}>
          <div style={styles.editHeader}>
            <div>
              <h4 style={styles.editTitle}>Edición básica</h4>
              <p style={styles.editSubtitle}>El salario base y la prorrata extra se recalculan automáticamente desde el contrato.</p>
            </div>
            {!isEditing && <button type="button" onClick={onEnableEditing} style={styles.secondaryButton}>Editar</button>}
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroupSmall}>
              <label>Periodo</label>
              <select name="period_month" value={editForm.period_month} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }}>
                {MONTH_OPTIONS.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>

            <div style={styles.formGroupSmall}>
              <label>Año</label>
              <input type="number" name="period_year" min="2000" max="2100" value={editForm.period_year} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
            </div>

            <div style={styles.formGroupSmall}>
              <label>Estado</label>
              <select name="status" value={editForm.status} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }}>
                {PAYROLL_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label>Complementos</label>
              <input type="number" step="0.01" name="salary_supplements" value={editForm.salary_supplements} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
            </div>
            <div style={styles.formGroupSmall}>
              <label>IRPF %</label>
              <input type="number" step="0.01" name="irpf_percentage" value={editForm.irpf_percentage} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
            </div>
          </div>

          {editError && <div style={styles.error}>{editError}</div>}

          <div style={styles.modalActionsSplit}>
            <button type="button" onClick={onRequestDelete} style={styles.deleteButton}>Eliminar nómina</button>
            <div style={styles.modalActionsRight}>
              {isEditing && <button type="button" onClick={onCancelEditing} style={styles.cancelButton}>Cancelar</button>}
              {isEditing && <button type="submit" disabled={submitting} style={styles.saveButton}>{submitting ? "Guardando..." : "Guardar cambios"}</button>}
            </div>
          </div>
        </form>

        {showDeleteConfirm && (
          <div style={styles.confirmBox}>
            <div>
              <h4 style={styles.confirmTitle}>Confirmar eliminación</h4>
              <p style={styles.confirmText}>¿Seguro que quieres eliminar la nómina de {payroll.employee_name || payroll.employee_id} del periodo {formatPeriod(payroll)}?</p>
              {deleteError && <div style={styles.error}>{deleteError}</div>}
            </div>
            <div style={styles.modalActionsRight}>
              <button type="button" onClick={onCancelDelete} style={styles.cancelButton}>Cancelar</button>
              <button type="button" onClick={onConfirmDelete} disabled={submitting} style={styles.dangerButton}>{submitting ? "Eliminando..." : "Confirmar eliminación"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(980px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  modalTitleRow: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  receiptHeader: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "18px" },
  infoBox: { border: "1px solid #e5e7eb", borderRadius: "10px", backgroundColor: "#f9fafb", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" },
  receiptBody: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "18px" },
  detailSection: { border: "2px solid #111827", borderRadius: "12px", padding: "14px", backgroundColor: "#ffffff" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", borderBottom: "1px solid #e5e7eb", paddingBottom: "8px", marginBottom: "4px" },
  sectionTitle: { margin: 0, fontSize: "16px", fontWeight: 900 },
  sectionHint: { color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  line: { display: "flex", justifyContent: "space-between", gap: "12px", padding: "9px 0", borderBottom: "1px solid #e5e7eb" },
  totalLine: { display: "flex", justifyContent: "space-between", gap: "12px", padding: "11px 0", fontWeight: 900 },
  amountBlock: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" },
  netPanel: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", backgroundColor: "#fef3c7", border: "3px solid #111827", borderRadius: "12px", padding: "16px", marginBottom: "18px", fontSize: "18px", fontWeight: 900 },
  form: { display: "flex", flexDirection: "column", gap: "16px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" },
  editHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  editTitle: { margin: 0, fontSize: "16px", fontWeight: 900 },
  editSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "180px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupSmall: { width: "180px", minWidth: "140px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  readOnlyInput: { backgroundColor: "#f3f4f6", color: "#111827", cursor: "not-allowed", opacity: 1 },
  draftBadge: { backgroundColor: "#e5e7eb", color: "#374151", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  calculatedBadge: { backgroundColor: "#dbeafe", color: "#1e40af", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  closedBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" },
  secondaryButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
  confirmBox: { marginTop: "16px", border: "2px solid #991b1b", backgroundColor: "#fff1f2", borderRadius: "12px", padding: "14px", display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap" },
  confirmTitle: { margin: "0 0 4px", color: "#991b1b", fontWeight: 900 },
  confirmText: { margin: 0, color: "#374151", lineHeight: 1.5 },
};
