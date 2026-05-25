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
  if (value === "reviewed") return styles.reviewedBadge;
  if (value === "cancelled") return styles.cancelledBadge;
  return styles.draftBadge;
}

function getEditSupplementsTotal(editForm) {
  return (
    Number(editForm.salary_supplement_1 || 0) +
    Number(editForm.salary_supplement_2 || 0) +
    Number(editForm.salary_supplement_3 || 0)
  );
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

function PrintStyles() {
  return (
    <style>{`
      @media print {
        body * { visibility: hidden !important; }
        #payroll-printable-receipt, #payroll-printable-receipt * { visibility: visible !important; }
        #payroll-printable-receipt {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        .no-print { display: none !important; }
        @page { size: A4; margin: 12mm; }
      }
    `}</style>
  );
}

export default function PayrollDetailsModal({
  payroll,
  payrollCode,
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

  const editSupplementsTotal = getEditSupplementsTotal(editForm);
  const isCancelled = payroll.status === "cancelled";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={styles.modalBackdrop}>
      <PrintStyles />
      <div style={styles.modal}>
        <div style={styles.modalHeader} className="no-print">
          <div>
            <div style={styles.modalTitleRow}>
              <h3 style={styles.modalTitle}>Detalle de nómina simulada</h3>
              <span style={getStatusStyle(payroll.status)}>{getStatusLabel(payroll.status)}</span>
            </div>
            <p style={styles.modalSubtitle}>
              Nómina {payrollCode || payroll.id} · {payroll.employee_name || payroll.employee_id} · {formatPeriod(payroll)}
            </p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" onClick={handlePrint} style={styles.printButton}>Imprimir recibo</button>
            <button type="button" onClick={onClose} style={styles.closeButton}>×</button>
          </div>
        </div>

        <section id="payroll-printable-receipt" style={styles.receiptDocument}>
          <div style={styles.receiptDocumentHeader}>
            <div>
              <p style={styles.receiptEyebrow}>RECIBO INDIVIDUAL DE SALARIOS</p>
              <h2 style={styles.receiptTitle}>{payroll.company_name || "Empresa simulada"}</h2>
              <p style={styles.receiptSubtitle}>Documento generado en AulaNomina · Simulación docente</p>
            </div>
            <div style={styles.receiptCodeBox}>
              <span>Código nómina</span>
              <strong>{payrollCode || payroll.id}</strong>
            </div>
          </div>

          <section style={styles.receiptHeader}>
            <InfoBox label="Empresa" value={payroll.company_name || payroll.company_id} />
            <InfoBox label="Trabajador" value={payroll.employee_name || payroll.employee_id} />
            <InfoBox label="Periodo" value={formatPeriod(payroll)} />
            <InfoBox label="Contrato" value={payroll.contract_id ? `Contrato ${payroll.contract_id}` : "No informado"} />
            <InfoBox label="Categoría" value="Categoría simulada" />
            <InfoBox label="Estado" value={getStatusLabel(payroll.status)} />
          </section>

          <section style={styles.receiptBody}>
            <div style={styles.detailSection}>
              <div style={styles.sectionHeader}>
                <h4 style={styles.sectionTitle}>Devengos</h4>
                <span style={styles.sectionHint}>Importes calculados desde el contrato</span>
              </div>
              <PayrollLine label="Salario base" amount={payroll.base_salary} />
              <PayrollLine label="Prorrata pagas extra" amount={payroll.extra_pay_proration} />
              <PayrollLine label="Complementos salariales" amount={payroll.salary_supplements} />
              <PayrollLine label="Variables / incentivos" amount={payroll.variable_incentives} />
              <PayrollLine label="Total devengado" amount={payroll.gross_salary} strong />
            </div>

            <div style={styles.detailSection}>
              <div style={styles.sectionHeader}>
                <h4 style={styles.sectionTitle}>Bases de cotización</h4>
                <span style={styles.sectionHint}>Bases simplificadas para simulación docente</span>
              </div>
              <PayrollLine label="Base contingencias comunes" amount={payroll.common_contingencies_base} />
              <PayrollLine label="Base contingencias profesionales" amount={payroll.professional_contingencies_base} />
              <PayrollLine label="Base desempleo / formación / FOGASA" amount={payroll.unemployment_training_fogasa_base} />
              <PayrollLine label="Base IRPF" amount={payroll.irpf_base} />
            </div>

            <div style={styles.detailSection}>
              <div style={styles.sectionHeader}>
                <h4 style={styles.sectionTitle}>Deducciones trabajador</h4>
                <span style={styles.sectionHint}>Seguridad Social e IRPF</span>
              </div>
              <PayrollLine label="Contingencias comunes trabajador" amount={payroll.employee_common_contingencies} percentage="4,70 %" />
              <PayrollLine label="Desempleo trabajador" amount={payroll.employee_unemployment} percentage="1,55 %" />
              <PayrollLine label="Formación profesional trabajador" amount={payroll.employee_training} percentage="0,10 %" />
              <PayrollLine label="MEI trabajador" amount={payroll.employee_mei} percentage="0,13 %" />
              <PayrollLine label="IRPF" amount={payroll.irpf} percentage={calculatePercentage(payroll.irpf, payroll.irpf_base || payroll.gross_salary)} />
              <PayrollLine label="Total deducciones" amount={payroll.total_deductions} strong />
            </div>

            <div style={styles.detailSection}>
              <div style={styles.sectionHeader}>
                <h4 style={styles.sectionTitle}>Coste empresa</h4>
                <span style={styles.sectionHint}>Coste laboral total para RRHH</span>
              </div>
              <PayrollLine label="Contingencias comunes empresa" amount={payroll.company_common_contingencies} percentage="23,60 %" />
              <PayrollLine label="Desempleo empresa" amount={payroll.company_unemployment} percentage="5,50 %" />
              <PayrollLine label="FOGASA" amount={payroll.company_fogasa} percentage="0,20 %" />
              <PayrollLine label="Formación profesional empresa" amount={payroll.company_training} percentage="0,60 %" />
              <PayrollLine label="AT/EP" amount={payroll.company_at_ep} percentage="1,50 %" />
              <PayrollLine label="MEI empresa" amount={payroll.company_mei} percentage="0,67 %" />
              <PayrollLine label="Total Seguridad Social empresa" amount={payroll.company_total_social_security} strong />
              <PayrollLine label="Coste empresa total" amount={payroll.company_total_cost} strong />
            </div>
          </section>

          <section style={styles.summaryPanels}>
            <div style={styles.netPanel}>
              <span>Líquido a percibir</span>
              <strong>{formatCurrency(payroll.net_salary)}</strong>
            </div>
            <div style={styles.companyCostPanel}>
              <span>Coste empresa total</span>
              <strong>{formatCurrency(payroll.company_total_cost)}</strong>
            </div>
          </section>

          <p style={styles.receiptFooter}>
            Recibo generado para fines formativos. No sustituye a una nómina oficial ni a documentación laboral real.
          </p>
        </section>

        <form onSubmit={onEditSubmit} style={styles.form} className="no-print">
          <div style={styles.editHeader}>
            <div>
              <h4 style={styles.editTitle}>Edición básica</h4>
              <p style={styles.editSubtitle}>El salario base, las bases, deducciones, coste empresa y prorrata extra se recalculan automáticamente desde el contrato.</p>
            </div>
            {!isEditing && !isCancelled && <button type="button" onClick={onEnableEditing} style={styles.secondaryButton}>Editar</button>}
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

          <div style={styles.supplementsGrid}>
            <div style={styles.formGroup}>
              <label>Complemento salarial 1</label>
              <input type="number" step="0.01" name="salary_supplement_1" value={editForm.salary_supplement_1} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
            </div>
            <div style={styles.formGroup}>
              <label>Complemento salarial 2</label>
              <input type="number" step="0.01" name="salary_supplement_2" value={editForm.salary_supplement_2} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
            </div>
            <div style={styles.formGroup}>
              <label>Complemento salarial 3</label>
              <input type="number" step="0.01" name="salary_supplement_3" value={editForm.salary_supplement_3} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroupSmall}>
              <label>Variables / incentivos</label>
              <input type="number" step="0.01" name="variable_incentives" value={editForm.variable_incentives ?? "0"} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
            </div>

            <div style={styles.formGroupSmall}>
              <label>IRPF %</label>
              <input type="number" step="0.01" name="irpf_percentage" value={editForm.irpf_percentage} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
            </div>
            <div style={styles.totalSupplementsBox}>
              <span>Total complementos</span>
              <strong>{formatCurrency(editSupplementsTotal)}</strong>
            </div>
          </div>

          {editError && <div style={styles.error}>{editError}</div>}

          <div style={styles.modalActionsSplit}>
            {!isCancelled ? (
              <button type="button" onClick={onRequestDelete} style={styles.deleteButton}>Anular nómina</button>
            ) : (
              <span style={styles.cancelledNotice}>Nómina anulada. Se conserva en el histórico.</span>
            )}
            <div style={styles.modalActionsRight}>
              {isEditing && <button type="button" onClick={onCancelEditing} style={styles.cancelButton}>Cancelar</button>}
              {isEditing && <button type="submit" disabled={submitting} style={styles.saveButton}>{submitting ? "Guardando..." : "Guardar cambios"}</button>}
            </div>
          </div>
        </form>

        {showDeleteConfirm && (
          <div style={styles.confirmBox} className="no-print">
            <div>
              <h4 style={styles.confirmTitle}>Confirmar anulación</h4>
              <p style={styles.confirmText}>La nómina {payrollCode || payroll.id} del periodo {formatPeriod(payroll)} quedará marcada como anulada y se conservará en el histórico.</p>
              {deleteError && <div style={styles.error}>{deleteError}</div>}
            </div>
            <div style={styles.modalActionsRight}>
              <button type="button" onClick={onCancelDelete} style={styles.cancelButton}>Cancelar</button>
              <button type="button" onClick={onConfirmDelete} disabled={submitting} style={styles.dangerButton}>{submitting ? "Anulando..." : "Confirmar anulación"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(1120px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  headerActions: { display: "flex", alignItems: "center", gap: "10px" },
  modalTitleRow: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  printButton: { backgroundColor: "#e6d85c", color: "#111827", border: "2px solid #111827", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  receiptDocument: { border: "1px solid #d1d5db", borderRadius: "12px", padding: "18px", backgroundColor: "#ffffff", marginBottom: "18px" },
  receiptDocumentHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "start", borderBottom: "3px solid #111827", paddingBottom: "14px", marginBottom: "14px" },
  receiptEyebrow: { margin: 0, fontSize: "12px", fontWeight: 900, letterSpacing: "0.08em", color: "#111827" },
  receiptTitle: { margin: "4px 0", fontSize: "24px", fontWeight: 900, color: "#111827" },
  receiptSubtitle: { margin: 0, color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  receiptCodeBox: { border: "2px solid #111827", borderRadius: "10px", padding: "10px 12px", minWidth: "160px", textAlign: "right", backgroundColor: "#fef3c7", display: "flex", flexDirection: "column", gap: "3px" },
  receiptHeader: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "18px" },
  infoBox: { border: "1px solid #e5e7eb", borderRadius: "10px", backgroundColor: "#f9fafb", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" },
  receiptBody: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "18px" },
  detailSection: { border: "2px solid #111827", borderRadius: "12px", padding: "14px", backgroundColor: "#ffffff", breakInside: "avoid" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", borderBottom: "1px solid #e5e7eb", paddingBottom: "8px", marginBottom: "4px" },
  sectionTitle: { margin: 0, fontSize: "16px", fontWeight: 900 },
  sectionHint: { color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  line: { display: "flex", justifyContent: "space-between", gap: "12px", padding: "9px 0", borderBottom: "1px solid #e5e7eb" },
  totalLine: { display: "flex", justifyContent: "space-between", gap: "12px", padding: "11px 0", fontWeight: 900 },
  amountBlock: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" },
  summaryPanels: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px", marginBottom: "18px" },
  netPanel: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", backgroundColor: "#fef3c7", border: "3px solid #111827", borderRadius: "12px", padding: "16px", fontSize: "18px", fontWeight: 900 },
  companyCostPanel: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", backgroundColor: "#ecfeff", border: "3px solid #111827", borderRadius: "12px", padding: "16px", fontSize: "18px", fontWeight: 900 },
  receiptFooter: { borderTop: "1px solid #e5e7eb", paddingTop: "10px", margin: 0, color: "#6b7280", fontSize: "11px", fontWeight: 700 },
  form: { display: "flex", flexDirection: "column", gap: "16px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" },
  editHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  editTitle: { margin: 0, fontSize: "16px", fontWeight: 900 },
  editSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  supplementsGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px", width: "100%" },
  formGroup: { flex: 1, minWidth: "180px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupSmall: { width: "180px", minWidth: "140px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  readOnlyInput: { backgroundColor: "#f3f4f6", color: "#111827", cursor: "not-allowed", opacity: 1 },
  totalSupplementsBox: { flex: 1, minWidth: "220px", border: "1px solid #e5e7eb", borderRadius: "10px", backgroundColor: "#f9fafb", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800 },
  draftBadge: { backgroundColor: "#e5e7eb", color: "#374151", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  calculatedBadge: { backgroundColor: "#dbeafe", color: "#1e40af", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  reviewedBadge: { backgroundColor: "#fef3c7", color: "#92400e", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  closedBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  cancelledBadge: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" },
  secondaryButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
  cancelledNotice: { color: "#991b1b", fontWeight: 900, fontSize: "13px" },
  confirmBox: { marginTop: "16px", border: "2px solid #991b1b", backgroundColor: "#fff1f2", borderRadius: "12px", padding: "14px", display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap" },
  confirmTitle: { margin: "0 0 4px", color: "#991b1b", fontWeight: 900 },
  confirmText: { margin: 0, color: "#374151", lineHeight: 1.5 },
};
