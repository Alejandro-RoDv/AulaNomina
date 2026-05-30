import { useEffect, useMemo, useState } from "react";

import { fetchPayrollBreakdown } from "../../services/payrollApi";
import { PAYROLL_STATUS_OPTIONS, MONTH_OPTIONS, formatCurrency } from "./PayrollForm";

function formatPeriod(payroll) {
  if (payroll.period_label) return payroll.period_label;
  const month = String(payroll.period_month || "").padStart(2, "0");
  return `${month}/${payroll.period_year || ""}`;
}

function formatDays(value, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number.toLocaleString("es-ES", { maximumFractionDigits: 0 }) : "0";
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

function calculatePercentage(amount, base) {
  const numericBase = Number(base || 0);
  if (!numericBase) return "0,00 %";
  const percentage = (Number(amount || 0) / numericBase) * 100;
  return `${percentage.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

function formatPercentage(value) {
  return `${Number(value || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

function getItemDetail(item) {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unit_price || 0);
  if (unitPrice > 0 && quantity > 0) return `${quantity.toLocaleString("es-ES")} × ${formatCurrency(unitPrice)}`;
  return item.description || "Importe directo";
}

function AmountRow({ label, amount, detail, bold = false }) {
  return (
    <tr style={bold ? styles.totalRow : undefined}>
      <td style={styles.tableCell}>{label}</td>
      <td style={styles.tableCellMuted}>{detail || ""}</td>
      <td style={styles.tableAmount}>{formatCurrency(amount)}</td>
    </tr>
  );
}

function ConceptAmountRows({ items }) {
  return items.map((item) => (
    <AmountRow
      key={item.id}
      label={item.concept_name || "Concepto"}
      detail={getItemDetail(item)}
      amount={item.amount}
    />
  ));
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
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
          background: #ffffff !important;
          font-size: 10px !important;
        }
        .no-print { display: none !important; }
        @page { size: A4 portrait; margin: 9mm; }
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
  const [breakdown, setBreakdown] = useState(null);
  const [breakdownError, setBreakdownError] = useState("");
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  useEffect(() => {
    if (!payroll) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [payroll, onClose]);

  useEffect(() => {
    if (!payroll?.id) return undefined;
    let active = true;

    async function loadBreakdown() {
      setBreakdownLoading(true);
      setBreakdownError("");
      try {
        const data = await fetchPayrollBreakdown(payroll.id);
        if (active) setBreakdown(data);
      } catch (err) {
        if (active) setBreakdownError(err.message || "No se ha podido cargar el desglose manual.");
      } finally {
        if (active) setBreakdownLoading(false);
      }
    }

    loadBreakdown();
    return () => { active = false; };
  }, [payroll?.id]);

  const manualData = useMemo(() => {
    if (!breakdown) {
      return {
        hasManualItems: false,
        devengos: [],
        deducciones: [],
        bases: [],
        totalDevengos: 0,
        totalDeducciones: 0,
        baseIrpfManual: 0,
        irpfPercentage: 0,
        irpfManual: 0,
        netoManual: 0,
        netoManualConIrpf: 0,
      };
    }

    const devengos = [
      ...(breakdown.devengos_salariales || []),
      ...(breakdown.devengos_extrasalariales || []),
    ];
    const deducciones = breakdown.deducciones || [];
    const bases = breakdown.bases_informativas || [];
    const hasManualItems = devengos.length > 0 || deducciones.length > 0 || bases.length > 0;

    return {
      hasManualItems,
      devengos,
      deducciones,
      bases,
      totalDevengos: Number(breakdown.total_devengos || 0),
      totalDeducciones: Number(breakdown.total_deducciones || 0),
      baseIrpfManual: Number(breakdown.base_irpf_manual || 0),
      irpfPercentage: Number(breakdown.irpf_percentage || 0),
      irpfManual: Number(breakdown.irpf_manual || 0),
      netoManual: Number(breakdown.neto_manual || 0),
      netoManualConIrpf: Number(breakdown.neto_manual_con_irpf || 0),
    };
  }, [breakdown]);

  if (!payroll || !editForm) return null;

  const periodLabel = formatPeriod(payroll);
  const isCancelled = payroll.status === "cancelled";
  const editSupplementsTotal = getEditSupplementsTotal(editForm);
  const contributionDays = Number(payroll.contribution_days ?? 30);
  const workedDays = Number(payroll.worked_days ?? 30);
  const incidentDays = Number(payroll.incident_days ?? 0);
  const nonContributionDays = Number(payroll.non_contribution_days ?? 0);
  const irpfPercentage = calculatePercentage(payroll.irpf, payroll.irpf_base || payroll.gross_salary);
  const receiptGross = manualData.hasManualItems ? manualData.totalDevengos : Number(payroll.gross_salary || 0);
  const receiptDeductions = manualData.hasManualItems
    ? manualData.totalDeducciones + manualData.irpfManual
    : Number(payroll.total_deductions || 0);
  const receiptNet = manualData.hasManualItems ? manualData.netoManualConIrpf : Number(payroll.net_salary || 0);

  const handlePrint = () => window.print();
  const handleBackdropMouseDown = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div style={styles.modalBackdrop} onMouseDown={handleBackdropMouseDown}>
      <PrintStyles />
      <div style={styles.modal} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" onClick={onClose} style={styles.floatingCloseButton} className="no-print" aria-label="Cerrar detalle de nómina">
          ×
        </button>

        <div style={styles.modalHeader} className="no-print">
          <div>
            <div style={styles.modalTitleRow}>
              <h3 style={styles.modalTitle}>Detalle de nómina simulada</h3>
              <span style={getStatusStyle(payroll.status)}>{getStatusLabel(payroll.status)}</span>
            </div>
            <p style={styles.modalSubtitle}>
              Nómina {payrollCode || payroll.id} · {payroll.employee_name || payroll.employee_id} · {periodLabel}
            </p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" onClick={handlePrint} style={styles.printButton}>Imprimir recibo</button>
            <button type="button" onClick={onClose} style={styles.closeButton}>Cerrar</button>
          </div>
        </div>

        {breakdownError && <div style={styles.error} className="no-print">{breakdownError}</div>}

        <section id="payroll-printable-receipt" style={styles.receiptDocument}>
          <div style={styles.receiptTopBar}>
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

          <div style={styles.identityGrid}>
            <div style={styles.identityBlock}>
              <div style={styles.identityHeader}>Empresa</div>
              <p><strong>Nombre:</strong> {payroll.company_name || payroll.company_id || "-"}</p>
              <p><strong>CCC:</strong> CCC simulado</p>
              <p><strong>CIF:</strong> CIF simulado</p>
            </div>
            <div style={styles.identityBlock}>
              <div style={styles.identityHeader}>Trabajador/a</div>
              <p><strong>Nombre:</strong> {payroll.employee_name || payroll.employee_id || "-"}</p>
              <p><strong>DNI:</strong> Dato no informado</p>
              <p><strong>Grupo:</strong> Grupo simulado</p>
            </div>
          </div>

          <div style={styles.periodRow}>
            <span><strong>Periodo:</strong> {periodLabel}</span>
            <span><strong>Contrato:</strong> {payroll.contract_id ? `Contrato ${payroll.contract_id}` : "No informado"}</span>
            <span><strong>Días cotizados:</strong> {formatDays(contributionDays, 30)}</span>
            <span><strong>Estado:</strong> {getStatusLabel(payroll.status)}</span>
          </div>

          {manualData.hasManualItems && (
            <div style={styles.manualNotice}>
              Recibo basado en el desglose manual. La base IRPF se calcula solo con conceptos marcados como tributables; dietas y kilometraje quedan fuera si están configurados como no tributables.
            </div>
          )}

          <div style={styles.tablesGrid}>
            <section style={styles.tableBox}>
              <h4 style={styles.tableTitle}>Devengos</h4>
              <table style={styles.table}>
                <tbody>
                  {manualData.hasManualItems ? (
                    <>
                      <ConceptAmountRows items={manualData.devengos} />
                      {manualData.devengos.length === 0 && <AmountRow label="Sin devengos manuales" amount={0} />}
                      <AmountRow label="Total devengado según desglose" amount={receiptGross} bold />
                    </>
                  ) : (
                    <>
                      <AmountRow label="Salario base" detail={`${formatDays(workedDays || contributionDays, 30)} días`} amount={payroll.base_salary} />
                      <AmountRow label="Prorrata pagas extra" amount={payroll.extra_pay_proration} />
                      <AmountRow label="Complementos salariales" amount={payroll.salary_supplements} />
                      <AmountRow label="Variables / incentivos" amount={payroll.variable_incentives} />
                      <AmountRow label="Total devengado" amount={payroll.gross_salary} bold />
                    </>
                  )}
                </tbody>
              </table>
            </section>

            <section style={styles.tableBox}>
              <h4 style={styles.tableTitle}>Deducciones</h4>
              <table style={styles.table}>
                <tbody>
                  {manualData.hasManualItems ? (
                    <>
                      <ConceptAmountRows items={manualData.deducciones} />
                      {manualData.deducciones.length === 0 && <AmountRow label="Sin deducciones manuales" amount={0} />}
                      <AmountRow label="IRPF sobre desglose" detail={formatPercentage(manualData.irpfPercentage)} amount={manualData.irpfManual} />
                      <AmountRow label="Total deducciones + IRPF" amount={receiptDeductions} bold />
                    </>
                  ) : (
                    <>
                      <AmountRow label="Contingencias comunes" detail="4,70 %" amount={payroll.employee_common_contingencies} />
                      <AmountRow label="Desempleo" detail="1,55 %" amount={payroll.employee_unemployment} />
                      <AmountRow label="Formación profesional" detail="0,10 %" amount={payroll.employee_training} />
                      <AmountRow label="MEI trabajador" detail="0,13 %" amount={payroll.employee_mei} />
                      <AmountRow label="IRPF" detail={irpfPercentage} amount={payroll.irpf} />
                      <AmountRow label="Total deducciones" amount={payroll.total_deductions} bold />
                    </>
                  )}
                </tbody>
              </table>
              <div style={styles.netReceiptBox}>
                <span>Líquido a percibir</span>
                <strong>{formatCurrency(receiptNet)}</strong>
              </div>
            </section>
          </div>

          <div style={styles.tablesGrid}>
            <section style={styles.tableBox}>
              <h4 style={styles.tableTitle}>Bases y días</h4>
              <table style={styles.table}>
                <tbody>
                  <AmountRow label="Días periodo" detail="" amount={30} />
                  <AmountRow label="Días cotizados" detail="" amount={contributionDays} />
                  <AmountRow label="Días trabajados" detail="" amount={workedDays} />
                  <AmountRow label="Días incidencia" detail="" amount={incidentDays} />
                  <AmountRow label="Días no cotizados" detail="" amount={nonContributionDays} />
                  {manualData.hasManualItems ? (
                    <>
                      <AmountRow label="Base IRPF manual" detail="Conceptos tributables" amount={manualData.baseIrpfManual} />
                      {manualData.bases.length > 0 && <ConceptAmountRows items={manualData.bases} />}
                    </>
                  ) : (
                    <>
                      <AmountRow label="Base CC" amount={payroll.common_contingencies_base} />
                      <AmountRow label="Base CP" amount={payroll.professional_contingencies_base} />
                      <AmountRow label="Base IRPF" amount={payroll.irpf_base} />
                    </>
                  )}
                </tbody>
              </table>
            </section>

            <section style={styles.tableBox}>
              <h4 style={styles.tableTitle}>Coste empresa</h4>
              <table style={styles.table}>
                <tbody>
                  <AmountRow label="Contingencias comunes empresa" detail="23,60 %" amount={payroll.company_common_contingencies} />
                  <AmountRow label="Desempleo empresa" detail="5,50 %" amount={payroll.company_unemployment} />
                  <AmountRow label="FOGASA" detail="0,20 %" amount={payroll.company_fogasa} />
                  <AmountRow label="Formación empresa" detail="0,60 %" amount={payroll.company_training} />
                  <AmountRow label="AT/EP" detail="1,50 %" amount={payroll.company_at_ep} />
                  <AmountRow label="MEI empresa" detail="0,67 %" amount={payroll.company_mei} />
                  <AmountRow label="Total Seguridad Social empresa" amount={payroll.company_total_social_security} bold />
                  <AmountRow label="Coste empresa total" amount={payroll.company_total_cost} bold />
                </tbody>
              </table>
            </section>
          </div>

          {breakdownLoading && <p style={styles.receiptFooter}>Cargando desglose manual...</p>}
          <p style={styles.receiptFooter}>Recibo generado para fines formativos. No sustituye a una nómina oficial ni a documentación laboral real.</p>
        </section>

        <form onSubmit={onEditSubmit} style={styles.form} className="no-print">
          <div style={styles.editHeader}>
            <div>
              <h4 style={styles.editTitle}>Edición básica</h4>
              <p style={styles.editSubtitle}>El salario base, bases, deducciones, coste empresa y prorrata extra se recalculan automáticamente desde el contrato.</p>
            </div>
            {!isEditing && !isCancelled && <button type="button" onClick={onEnableEditing} style={styles.secondaryButton}>Editar</button>}
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroupSmall}>
              <label>Periodo</label>
              <select name="period_month" value={editForm.period_month} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }}>
                {MONTH_OPTIONS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
              </select>
            </div>
            <div style={styles.formGroupSmall}>
              <label>Año</label>
              <input type="number" name="period_year" min="2000" max="2100" value={editForm.period_year} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }} />
            </div>
            <div style={styles.formGroupSmall}>
              <label>Estado</label>
              <select name="status" value={editForm.status} onChange={onEditChange} disabled={!isEditing} style={{ ...styles.input, ...(!isEditing ? styles.readOnlyInput : {}) }}>
                {PAYROLL_STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
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
              <p style={styles.confirmText}>La nómina {payrollCode || payroll.id} del periodo {periodLabel} quedará marcada como anulada y se conservará en el histórico.</p>
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

const badge = { padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 };

const styles = {
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(17, 24, 39, 0.55)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    zIndex: 2000,
    padding: "88px 24px 32px",
    boxSizing: "border-box",
    overflowY: "auto",
  },
  modal: {
    position: "relative",
    width: "min(1180px, 100%)",
    maxHeight: "calc(100vh - 120px)",
    overflowY: "auto",
    backgroundColor: "#ffffff",
    border: "3px solid #111111",
    borderRadius: "12px",
    boxShadow: "8px 8px 0 #e6d85c",
    padding: "20px",
    boxSizing: "border-box",
  },
  floatingCloseButton: {
    position: "sticky",
    top: 0,
    float: "right",
    zIndex: 3,
    width: "38px",
    height: "38px",
    marginTop: "-6px",
    marginRight: "-6px",
    border: "2px solid #111827",
    borderRadius: "999px",
    backgroundColor: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontSize: "26px",
    lineHeight: 1,
    fontWeight: 900,
    boxShadow: "2px 2px 0 #e6d85c",
  },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "14px", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px", paddingRight: "44px" },
  headerActions: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  modalTitleRow: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { backgroundColor: "#ffffff", color: "#111827", border: "2px solid #111827", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  printButton: { backgroundColor: "#e6d85c", color: "#111827", border: "2px solid #111827", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  receiptDocument: { maxWidth: "1040px", margin: "0 auto 18px", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "22px", backgroundColor: "#f8fafc", color: "#1f2937" },
  receiptTopBar: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "start", border: "2px solid #111827", borderRadius: "14px", backgroundColor: "#ffffff", padding: "16px", marginBottom: "18px", boxShadow: "4px 4px 0 #fef3c7" },
  receiptEyebrow: { margin: 0, fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", color: "#111827" },
  receiptTitle: { margin: "3px 0", fontSize: "24px", fontWeight: 900, color: "#111827" },
  receiptSubtitle: { margin: 0, color: "#6b7280", fontSize: "11px", fontWeight: 700 },
  receiptCodeBox: { border: "2px solid #111827", borderRadius: "10px", padding: "10px 13px", minWidth: "138px", textAlign: "right", backgroundColor: "#fef3c7", display: "flex", flexDirection: "column", gap: "2px" },
  identityGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" },
  identityBlock: { padding: "14px", border: "2px solid #111827", borderRadius: "14px", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #e5e7eb" },
  identityHeader: { margin: "-14px -14px 10px", padding: "8px 12px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", borderRadius: "12px 12px 0 0", fontWeight: 900, color: "#111827" },
  periodRow: { display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", gap: "10px", border: "2px solid #111827", borderRadius: "14px", backgroundColor: "#fffdf0", padding: "12px 14px", marginBottom: "18px", boxShadow: "3px 3px 0 #e5e7eb" },
  manualNotice: { border: "1px solid #bbf7d0", borderRadius: "10px", backgroundColor: "#f0fdf4", color: "#166534", padding: "10px 12px", fontWeight: 900, marginBottom: "18px" },
  tablesGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "18px" },
  tableBox: { border: "2px solid #111827", borderRadius: "14px", overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #e5e7eb" },
  tableTitle: { margin: 0, padding: "9px 10px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", color: "#111827", fontWeight: 900 },
  table: { width: "100%", borderCollapse: "collapse" },
  tableCell: { padding: "8px 10px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
  tableCellMuted: { width: "130px", padding: "8px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: "#6b7280", verticalAlign: "top", fontSize: "12px" },
  tableAmount: { width: "115px", padding: "8px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", verticalAlign: "top", fontWeight: 800 },
  totalRow: { backgroundColor: "#fffdf0", fontWeight: 900 },
  netReceiptBox: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderTop: "2px solid #111827", backgroundColor: "#fef3c7", padding: "11px 12px", fontSize: "17px", fontWeight: 900 },
  receiptFooter: { borderTop: "1px solid #e5e7eb", paddingTop: "8px", margin: 0, color: "#6b7280", fontSize: "10px", fontWeight: 700 },
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
  draftBadge: { ...badge, backgroundColor: "#e5e7eb", color: "#374151" },
  calculatedBadge: { ...badge, backgroundColor: "#dbeafe", color: "#1e40af" },
  reviewedBadge: { ...badge, backgroundColor: "#fef3c7", color: "#92400e" },
  closedBadge: { ...badge, backgroundColor: "#dcfce7", color: "#166534" },
  cancelledBadge: { ...badge, backgroundColor: "#fee2e2", color: "#991b1b" },
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
