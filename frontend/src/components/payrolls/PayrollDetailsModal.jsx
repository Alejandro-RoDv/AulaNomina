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

function ReceiptRow({ label, quantity = "", price = "", amount, bold = false }) {
  return (
    <tr style={bold ? styles.receiptTotalRow : undefined}>
      <td style={styles.receiptConceptCell}>{label}</td>
      <td style={styles.receiptQtyCell}>{quantity}</td>
      <td style={styles.receiptPriceCell}>{price}</td>
      <td style={styles.receiptAmountCell}>{formatCurrency(amount)}</td>
    </tr>
  );
}

function ReceiptDeductionRow({ label, percentage = "", amount, bold = false }) {
  return (
    <tr style={bold ? styles.receiptTotalRow : undefined}>
      <td style={styles.receiptConceptCell}>{label}</td>
      <td style={styles.receiptDeductionPercentCell}>{percentage}</td>
      <td style={styles.receiptAmountCell}>{formatCurrency(amount)}</td>
    </tr>
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
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
          background: #ffffff !important;
          font-size: 9.2px !important;
          line-height: 1.15 !important;
        }
        #payroll-printable-receipt .payroll-main-grid,
        #payroll-printable-receipt .payroll-lower-grid {
          grid-template-columns: 1fr 1fr !important;
          gap: 8px !important;
        }
        #payroll-printable-receipt .payroll-identity-grid {
          grid-template-columns: 1fr 1fr !important;
          gap: 0 !important;
          border: 2px solid #111827 !important;
          background: #ffffff !important;
          padding: 0 !important;
        }
        #payroll-printable-receipt .payroll-identity-block {
          border: none !important;
          border-right: 1px solid #111827 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          background: #ffffff !important;
          padding: 7px 9px !important;
        }
        #payroll-printable-receipt table { page-break-inside: avoid !important; }
        #payroll-printable-receipt section { break-inside: avoid !important; }
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
  if (!payroll || !editForm) return null;

  const editSupplementsTotal = getEditSupplementsTotal(editForm);
  const isCancelled = payroll.status === "cancelled";
  const periodLabel = formatPeriod(payroll);
  const irpfPercentage = calculatePercentage(payroll.irpf, payroll.irpf_base || payroll.gross_salary);
  const contributionDays = Number(payroll.contribution_days ?? 30);
  const workedDays = Number(payroll.worked_days ?? 30);
  const incidentDays = Number(payroll.incident_days ?? 0);
  const nonContributionDays = Number(payroll.non_contribution_days ?? 0);

  const handlePrint = () => window.print();

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
              Nómina {payrollCode || payroll.id} · {payroll.employee_name || payroll.employee_id} · {periodLabel}
            </p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" onClick={handlePrint} style={styles.printButton}>Imprimir recibo</button>
            <button type="button" onClick={onClose} style={styles.closeButton}>×</button>
          </div>
        </div>

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

          <section style={styles.identityGrid} className="payroll-identity-grid">
            <div style={styles.identityBlock} className="payroll-identity-block">
              <div style={styles.identityHeader}>EMPRESA</div>
              <p><strong>Nombre:</strong> {payroll.company_name || payroll.company_id || "-"}</p>
              <p><strong>Domicilio:</strong> Domicilio simulado</p>
              <p><strong>CIF:</strong> CIF simulado</p>
              <p><strong>Código cuenta cotización S.S.:</strong> CCC simulado</p>
            </div>
            <div style={styles.identityBlock} className="payroll-identity-block">
              <div style={styles.identityHeader}>TRABAJADOR/A</div>
              <p><strong>Nombre:</strong> {payroll.employee_name || payroll.employee_id || "-"}</p>
              <p><strong>DNI:</strong> Dato no informado</p>
              <p><strong>Número afiliación a la S.S.:</strong> NAF simulado</p>
              <p><strong>Categoría o grupo profesional:</strong> Categoría simulada</p>
              <p><strong>Grupo de cotización:</strong> Grupo simulado</p>
            </div>
          </section>

          <section style={styles.periodRow}>
            <span><strong>Periodo de liquidación:</strong> {periodLabel}</span>
            <span><strong>Contrato:</strong> {payroll.contract_id ? `Contrato ${payroll.contract_id}` : "No informado"}</span>
            <span><strong>Días cotizados:</strong> {formatDays(contributionDays, 30)}</span>
            <span><strong>Estado:</strong> {getStatusLabel(payroll.status)}</span>
          </section>

          <section style={styles.mainPayrollGrid} className="payroll-main-grid">
            <div style={styles.receiptTableBox}>
              <table style={styles.receiptTable}>
                <thead>
                  <tr>
                    <th style={styles.receiptHeaderConcept}>DEVENGOS</th>
                    <th style={styles.receiptHeaderSmall}>CANTIDAD</th>
                    <th style={styles.receiptHeaderSmall}>PRECIO</th>
                    <th style={styles.receiptHeaderAmount}>TOTALES</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan="4" style={styles.subsectionLabel}>Percepciones salariales:</td></tr>
                  <ReceiptRow label="Salario base" quantity={formatDays(workedDays || contributionDays, 30)} amount={payroll.base_salary} />
                  <ReceiptRow label="Prorrata pagas extraordinarias" amount={payroll.extra_pay_proration} />
                  <ReceiptRow label="Complementos salariales" amount={payroll.salary_supplements} />
                  <ReceiptRow label="Variables / incentivos" amount={payroll.variable_incentives} />
                  <tr><td colSpan="4" style={styles.subsectionLabel}>Percepciones no salariales:</td></tr>
                  <ReceiptRow label="Dietas" amount={0} />
                  <ReceiptRow label="Plus de transporte" amount={0} />
                  <ReceiptRow label="Pagos por incapacidad temporal" amount={0} />
                  <ReceiptRow label="TOTAL DEVENGADO" amount={payroll.gross_salary} bold />
                </tbody>
              </table>
            </div>

            <div style={styles.receiptTableBox}>
              <table style={styles.receiptTable}>
                <thead>
                  <tr>
                    <th style={styles.receiptHeaderConcept}>DEDUCCIONES</th>
                    <th style={styles.receiptHeaderSmall}>TIPO</th>
                    <th style={styles.receiptHeaderAmount}>TOTALES</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan="3" style={styles.subsectionLabel}>Aportación del trabajador a la Seguridad Social:</td></tr>
                  <ReceiptDeductionRow label="Contingencias comunes" percentage="4,70 %" amount={payroll.employee_common_contingencies} />
                  <ReceiptDeductionRow label="Desempleo" percentage="1,55 %" amount={payroll.employee_unemployment} />
                  <ReceiptDeductionRow label="Formación Profesional" percentage="0,10 %" amount={payroll.employee_training} />
                  <ReceiptDeductionRow label="MEI trabajador" percentage="0,13 %" amount={payroll.employee_mei} />
                  <ReceiptDeductionRow label="Retenciones a cuenta de IRPF" percentage={irpfPercentage} amount={payroll.irpf} />
                  <ReceiptDeductionRow label="TOTAL A DEDUCIR" amount={payroll.total_deductions} bold />
                </tbody>
              </table>

              <div style={styles.netReceiptBox}>
                <span>LÍQUIDO A PERCIBIR</span>
                <strong>{formatCurrency(payroll.net_salary)}</strong>
              </div>
            </div>
          </section>

          <section style={styles.lowerGrid} className="payroll-lower-grid">
            <div style={styles.receiptTableBox}>
              <table style={styles.receiptTable}>
                <thead>
                  <tr><th colSpan="2" style={styles.receiptHeaderConcept}>DATOS DE COTIZACIÓN</th></tr>
                </thead>
                <tbody>
                  <tr><td style={styles.receiptConceptCell}>Días periodo</td><td style={styles.receiptAmountCell}>30</td></tr>
                  <tr><td style={styles.receiptConceptCell}>Días cotizados</td><td style={styles.receiptAmountCell}>{formatDays(contributionDays, 30)}</td></tr>
                  <tr><td style={styles.receiptConceptCell}>Días trabajados</td><td style={styles.receiptAmountCell}>{formatDays(workedDays, 30)}</td></tr>
                  <tr><td style={styles.receiptConceptCell}>Días incidencia</td><td style={styles.receiptAmountCell}>{formatDays(incidentDays, 0)}</td></tr>
                  <tr><td style={styles.receiptConceptCell}>Días no cotizados</td><td style={styles.receiptAmountCell}>{formatDays(nonContributionDays, 0)}</td></tr>
                  <tr><td style={styles.receiptConceptCell}>Base diaria CC</td><td style={styles.receiptAmountCell}>{formatCurrency(payroll.daily_common_base)}</td></tr>
                  <tr><td style={styles.receiptConceptCell}>Base diaria CP</td><td style={styles.receiptAmountCell}>{formatCurrency(payroll.daily_professional_base)}</td></tr>
                </tbody>
              </table>
            </div>

            <div style={styles.receiptTableBox}>
              <table style={styles.receiptTable}>
                <thead>
                  <tr><th colSpan="2" style={styles.receiptHeaderConcept}>DETERMINACIÓN BASES COTIZACIÓN A LA SEGURIDAD SOCIAL</th></tr>
                </thead>
                <tbody>
                  <tr><td style={styles.receiptConceptCell}>Base contingencias comunes</td><td style={styles.receiptAmountCell}>{formatCurrency(payroll.common_contingencies_base)}</td></tr>
                  <tr><td style={styles.receiptConceptCell}>Base contingencias profesionales</td><td style={styles.receiptAmountCell}>{formatCurrency(payroll.professional_contingencies_base)}</td></tr>
                  <tr><td style={styles.receiptConceptCell}>Base desempleo / formación / FOGASA</td><td style={styles.receiptAmountCell}>{formatCurrency(payroll.unemployment_training_fogasa_base)}</td></tr>
                  <tr><td style={styles.receiptConceptCell}>Base sujeta a retención del IRPF</td><td style={styles.receiptAmountCell}>{formatCurrency(payroll.irpf_base)}</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section style={styles.receiptTableBox}>
            <table style={styles.receiptTable}>
              <thead>
                <tr>
                  <th style={styles.receiptHeaderConcept}>COSTE EMPRESA</th>
                  <th style={styles.receiptHeaderSmall}>TIPO</th>
                  <th style={styles.receiptHeaderAmount}>TOTALES</th>
                </tr>
              </thead>
              <tbody>
                <ReceiptDeductionRow label="Contingencias comunes empresa" percentage="23,60 %" amount={payroll.company_common_contingencies} />
                <ReceiptDeductionRow label="Desempleo empresa" percentage="5,50 %" amount={payroll.company_unemployment} />
                <ReceiptDeductionRow label="FOGASA" percentage="0,20 %" amount={payroll.company_fogasa} />
                <ReceiptDeductionRow label="Formación profesional empresa" percentage="0,60 %" amount={payroll.company_training} />
                <ReceiptDeductionRow label="AT/EP" percentage="1,50 %" amount={payroll.company_at_ep} />
                <ReceiptDeductionRow label="MEI empresa" percentage="0,67 %" amount={payroll.company_mei} />
                <ReceiptDeductionRow label="Total Seguridad Social empresa" amount={payroll.company_total_social_security} bold />
                <ReceiptDeductionRow label="Coste empresa total" amount={payroll.company_total_cost} bold />
              </tbody>
            </table>
          </section>

          <section style={styles.signatureGrid}>
            <div>
              <p><strong>Fecha de ingreso de la nómina:</strong></p>
              <p><strong>Entidad financiera:</strong></p>
              <p><strong>Número de cuenta:</strong></p>
            </div>
            <div style={styles.signatureBox}>Firma del trabajador</div>
          </section>

          <p style={styles.receiptFooter}>Recibo generado para fines formativos. No sustituye a una nómina oficial ni a documentación laboral real.</p>
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

const styles = {
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px" },
  modal: { width: "min(1180px, 100%)", maxHeight: "92vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "20px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "14px", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" },
  headerActions: { display: "flex", alignItems: "center", gap: "10px" },
  modalTitleRow: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  printButton: { backgroundColor: "#e6d85c", color: "#111827", border: "2px solid #111827", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  receiptDocument: { maxWidth: "1040px", margin: "0 auto 18px", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "22px", backgroundColor: "#f8fafc", color: "#1f2937" },
  receiptTopBar: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "start", border: "2px solid #111827", borderRadius: "14px", backgroundColor: "#ffffff", padding: "16px", marginBottom: "18px", boxShadow: "4px 4px 0 #fef3c7" },
  receiptEyebrow: { margin: 0, fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", color: "#111827" },
  receiptTitle: { margin: "3px 0", fontSize: "24px", fontWeight: 900, color: "#111827" },
  receiptSubtitle: { margin: 0, color: "#6b7280", fontSize: "11px", fontWeight: 700 },
  receiptCodeBox: { border: "2px solid #111827", borderRadius: "10px", padding: "10px 13px", minWidth: "138px", textAlign: "right", backgroundColor: "#fef3c7", display: "flex", flexDirection: "column", gap: "2px" },
  identityGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" },
  identityBlock: { padding: "14px", border: "2px solid #111827", borderRadius: "14px", minHeight: "92px", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #e5e7eb" },
  identityHeader: { margin: "-14px -14px 10px", padding: "8px 12px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", borderRadius: "12px 12px 0 0", textAlign: "left", fontWeight: 900, color: "#111827" },
  periodRow: { display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", gap: "10px", border: "2px solid #111827", borderRadius: "14px", backgroundColor: "#fffdf0", padding: "12px 14px", marginBottom: "18px", boxShadow: "3px 3px 0 #e5e7eb" },
  mainPayrollGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "18px" },
  lowerGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "18px" },
  receiptTableBox: { border: "2px solid #111827", borderRadius: "14px", overflow: "hidden", backgroundColor: "#ffffff", breakInside: "avoid", boxShadow: "3px 3px 0 #e5e7eb", marginBottom: "18px" },
  receiptTable: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  receiptHeaderConcept: { textAlign: "left", padding: "9px 10px", backgroundColor: "#f3f4f6", color: "#111827", fontWeight: 900, borderBottom: "1px solid #d1d5db" },
  receiptHeaderSmall: { width: "72px", textAlign: "right", padding: "9px 10px", backgroundColor: "#f3f4f6", color: "#111827", fontWeight: 900, borderBottom: "1px solid #d1d5db" },
  receiptHeaderAmount: { width: "100px", textAlign: "right", padding: "9px 10px", backgroundColor: "#f3f4f6", color: "#111827", fontWeight: 900, borderBottom: "1px solid #d1d5db" },
  subsectionLabel: { padding: "8px 10px 3px", fontWeight: 900, color: "#111827" },
  receiptConceptCell: { padding: "7px 10px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
  receiptQtyCell: { padding: "7px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", verticalAlign: "top" },
  receiptPriceCell: { padding: "7px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", verticalAlign: "top" },
  receiptDeductionPercentCell: { width: "72px", padding: "7px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", verticalAlign: "top" },
  receiptAmountCell: { padding: "7px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", verticalAlign: "top", fontWeight: 800 },
  receiptTotalRow: { backgroundColor: "#fffdf0", fontWeight: 900 },
  netReceiptBox: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderTop: "2px solid #111827", backgroundColor: "#fef3c7", padding: "11px 12px", fontSize: "17px", fontWeight: 900 },
  signatureGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", border: "2px solid #111827", borderRadius: "14px", backgroundColor: "#ffffff", padding: "12px 14px", marginBottom: "10px", boxShadow: "3px 3px 0 #e5e7eb" },
  signatureBox: { display: "flex", alignItems: "end", justifyContent: "center", minHeight: "52px", color: "#374151" },
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
