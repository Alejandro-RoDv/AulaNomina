import { useEffect, useState } from "react";

import { createPayrollItem, fetchPayrollBreakdown, fetchPayrollConcepts } from "../../services/payrollApi";
import { formatCurrency } from "./PayrollForm";

const EMPTY_FORM = { concept_id: "", description: "", quantity: "1", unit_price: "0", amount: "" };

function getCalculationLabel(item) {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unit_price || 0);

  if (item.concept_type === "BASE_INFORMATIVA") return "Base informativa";
  if (unitPrice > 0 && quantity > 0) {
    return `${quantity.toLocaleString("es-ES")} × ${formatCurrency(unitPrice)}`;
  }
  return "Importe directo";
}

function ConceptTable({ title, items }) {
  return (
    <div style={styles.box}>
      <h5 style={styles.boxTitle}>{title}</h5>
      {!items?.length ? <p style={styles.empty}>Sin líneas.</p> : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.left}>Concepto</th>
              <th style={styles.calcHeader}>Cálculo</th>
              <th style={styles.amountHeader}>Total línea</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={styles.cell}>
                  <strong style={styles.conceptName}>{item.concept_name}</strong>
                  {item.description && <small style={styles.note}>{item.description}</small>}
                </td>
                <td style={styles.calcCell}>{getCalculationLabel(item)}</td>
                <td style={styles.amount}>{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <label style={{ ...styles.field, ...style }}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

export default function PayrollConceptBreakdown({ payrollId }) {
  const [concepts, setConcepts] = useState([]);
  const [breakdown, setBreakdown] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    if (!payrollId) return;
    setLoading(true);
    setError("");
    try {
      const [conceptData, breakdownData] = await Promise.all([
        fetchPayrollConcepts(),
        fetchPayrollBreakdown(payrollId),
      ]);
      setConcepts(conceptData || []);
      setBreakdown(breakdownData);
    } catch (err) {
      setError(err.message || "Error al cargar el desglose.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [payrollId]);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.concept_id) {
      setError("Selecciona un concepto.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createPayrollItem(payrollId, {
        concept_id: Number(form.concept_id),
        description: form.description || null,
        quantity: Number(form.quantity || 0),
        unit_price: Number(form.unit_price || 0),
        amount: form.amount === "" ? null : Number(form.amount),
      });
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      setError(err.message || "Error al añadir concepto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={styles.wrapper} className="no-print">
      <div style={styles.header}>
        <div>
          <h4 style={styles.title}>Desglose de conceptos</h4>
          <p style={styles.subtitle}>Vista manual para explicar de dónde sale cada concepto. No recalcula todavía la nómina principal.</p>
        </div>
        <button type="button" onClick={loadData} style={styles.secondaryButton}>{loading ? "Cargando..." : "Actualizar"}</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {breakdown && (
        <>
          <div style={styles.summary}>
            <div style={styles.summaryCard}><span>Devengos introducidos</span><strong>{formatCurrency(breakdown.total_devengos)}</strong></div>
            <div style={styles.summaryCard}><span>Deducciones introducidas</span><strong>{formatCurrency(breakdown.total_deducciones)}</strong></div>
            <div style={styles.netCard}><span>Neto según desglose</span><strong>{formatCurrency(breakdown.neto_manual)}</strong></div>
          </div>
          <div style={styles.grid}>
            <ConceptTable title="Devengos salariales" items={breakdown.devengos_salariales} />
            <ConceptTable title="Devengos extrasalariales" items={breakdown.devengos_extrasalariales} />
            <ConceptTable title="Deducciones" items={breakdown.deducciones} />
            <ConceptTable title="Bases informativas" items={breakdown.bases_informativas} />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <h5 style={styles.formTitle}>Añadir línea manual</h5>
        <p style={styles.formHelp}>Para horas o kilometraje, usa cantidad y precio unitario. Para un importe fijo, usa importe directo.</p>
        <div style={styles.formGrid}>
          <Field label="Concepto" style={styles.conceptField}>
            <select name="concept_id" value={form.concept_id} onChange={handleChange} style={styles.input}>
              <option value="">Seleccionar</option>
              {concepts.map((concept) => <option key={concept.id} value={concept.id}>{concept.name}</option>)}
            </select>
          </Field>
          <Field label="Descripción" style={styles.descriptionField}>
            <input name="description" value={form.description} onChange={handleChange} placeholder="Ej. Caso práctico" style={styles.input} />
          </Field>
          <Field label="Cantidad" style={styles.numberField}>
            <input type="number" step="0.01" name="quantity" value={form.quantity} onChange={handleChange} style={styles.input} />
          </Field>
          <Field label="Precio unitario" style={styles.numberField}>
            <input type="number" step="0.01" name="unit_price" value={form.unit_price} onChange={handleChange} style={styles.input} />
          </Field>
          <Field label="Importe directo" style={styles.amountField}>
            <input type="number" step="0.01" name="amount" value={form.amount} onChange={handleChange} placeholder="Ej. 120" style={styles.input} />
          </Field>
          <button type="submit" disabled={saving} style={styles.primaryButton}>{saving ? "Añadiendo..." : "Añadir"}</button>
        </div>
      </form>
    </section>
  );
}

const styles = {
  wrapper: { width: "100%", boxSizing: "border-box", margin: "0", padding: "14px", border: "2px solid #111827", borderRadius: "14px", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #e6d85c", overflow: "hidden" },
  header: { display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "12px", alignItems: "start" },
  title: { margin: 0, fontSize: "17px", fontWeight: 900, color: "#111827" },
  subtitle: { margin: "4px 0 0", fontSize: "12px", fontWeight: 700, color: "#6b7280" },
  secondaryButton: { backgroundColor: "#ffffff", border: "2px solid #111827", borderRadius: "8px", padding: "8px 12px", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  summary: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginBottom: "12px" },
  summaryCard: { border: "1px solid #d1d5db", borderRadius: "10px", padding: "10px", backgroundColor: "#f9fafb", display: "flex", justifyContent: "space-between", gap: "8px" },
  netCard: { border: "2px solid #111827", borderRadius: "10px", padding: "10px", backgroundColor: "#fffdf0", display: "flex", justifyContent: "space-between", gap: "8px" },
  grid: { display: "grid", gridTemplateColumns: "1fr", gap: "12px" },
  box: { border: "1px solid #d1d5db", borderRadius: "12px", overflow: "hidden", backgroundColor: "#ffffff" },
  boxTitle: { margin: 0, padding: "8px 10px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", fontWeight: 900, fontSize: "14px" },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "auto" },
  left: { textAlign: "left", padding: "7px 8px", fontSize: "11px", color: "#4b5563" },
  calcHeader: { width: "190px", textAlign: "right", padding: "7px 8px", fontSize: "11px", color: "#4b5563", whiteSpace: "nowrap" },
  amountHeader: { width: "130px", textAlign: "right", padding: "7px 8px", fontSize: "11px", color: "#4b5563", whiteSpace: "nowrap" },
  cell: { padding: "8px", borderTop: "1px solid #f3f4f6", minWidth: "260px" },
  conceptName: { display: "block", fontSize: "13px", lineHeight: 1.25 },
  calcCell: { width: "190px", padding: "8px", borderTop: "1px solid #f3f4f6", textAlign: "right", whiteSpace: "nowrap", color: "#4b5563", fontWeight: 700 },
  amount: { width: "130px", padding: "8px", borderTop: "1px solid #f3f4f6", textAlign: "right", fontWeight: 900, whiteSpace: "nowrap" },
  note: { display: "block", color: "#6b7280", marginTop: "3px", lineHeight: 1.35 },
  empty: { margin: 0, padding: "10px", color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  form: { marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #e5e7eb", width: "100%" },
  formTitle: { margin: "0 0 4px", fontSize: "15px", fontWeight: 900 },
  formHelp: { margin: "0 0 10px", color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  formGrid: { display: "grid", gridTemplateColumns: "minmax(220px, 1.15fr) minmax(260px, 1.65fr) minmax(115px, 0.55fr) minmax(135px, 0.65fr) minmax(165px, 0.8fr) auto", gap: "10px", alignItems: "start", width: "100%" },
  field: { display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, width: "100%" },
  conceptField: { gridColumn: "auto" },
  descriptionField: { gridColumn: "auto" },
  numberField: { gridColumn: "auto" },
  amountField: { gridColumn: "auto" },
  fieldLabel: { fontSize: "12px", fontWeight: 900, color: "#374151" },
  input: { border: "2px solid #d1d5db", borderRadius: "8px", padding: "8px", fontWeight: 700, minWidth: 0, width: "100%", boxSizing: "border-box" },
  primaryButton: { alignSelf: "end", backgroundColor: "#111827", color: "#ffffff", border: "2px solid #111827", borderRadius: "8px", padding: "9px 18px", fontWeight: 900, cursor: "pointer", minHeight: "38px", whiteSpace: "nowrap" },
  error: { marginBottom: "12px", padding: "10px", borderRadius: "10px", border: "1px solid #fecaca", backgroundColor: "#fef2f2", color: "#991b1b", fontWeight: 800 },
};
