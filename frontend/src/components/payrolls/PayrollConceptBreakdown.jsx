import { useEffect, useState } from "react";

import { createPayrollItem, fetchPayrollBreakdown, fetchPayrollConcepts } from "../../services/payrollApi";
import { formatCurrency } from "./PayrollForm";

const EMPTY_FORM = { concept_id: "", description: "", quantity: "1", unit_price: "0", amount: "" };

function ConceptTable({ title, items }) {
  return (
    <div style={styles.box}>
      <h5 style={styles.boxTitle}>{title}</h5>
      {!items?.length ? <p style={styles.empty}>Sin líneas.</p> : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.left}>Concepto</th>
              <th style={styles.right}>Uds.</th>
              <th style={styles.right}>Precio</th>
              <th style={styles.right}>Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={styles.cell}><strong>{item.concept_name}</strong>{item.description && <small style={styles.note}>{item.description}</small>}</td>
                <td style={styles.num}>{Number(item.quantity || 0).toLocaleString("es-ES")}</td>
                <td style={styles.num}>{formatCurrency(item.unit_price)}</td>
                <td style={styles.amount}>{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
          <p style={styles.subtitle}>Devengos, conceptos extrasalariales, deducciones y bases informativas.</p>
        </div>
        <button type="button" onClick={loadData} style={styles.secondaryButton}>{loading ? "Cargando..." : "Actualizar"}</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {breakdown && (
        <>
          <div style={styles.summary}>
            <div><span>Total devengos</span><strong>{formatCurrency(breakdown.total_devengos)}</strong></div>
            <div><span>Total deducciones</span><strong>{formatCurrency(breakdown.total_deducciones)}</strong></div>
            <div><span>Neto manual</span><strong>{formatCurrency(breakdown.neto_manual)}</strong></div>
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
        <div style={styles.formGrid}>
          <select name="concept_id" value={form.concept_id} onChange={handleChange} style={styles.input}>
            <option value="">Concepto</option>
            {concepts.map((concept) => <option key={concept.id} value={concept.id}>{concept.name}</option>)}
          </select>
          <input name="description" value={form.description} onChange={handleChange} placeholder="Descripción" style={styles.input} />
          <input type="number" step="0.01" name="quantity" value={form.quantity} onChange={handleChange} placeholder="Uds." style={styles.input} />
          <input type="number" step="0.01" name="unit_price" value={form.unit_price} onChange={handleChange} placeholder="Precio" style={styles.input} />
          <input type="number" step="0.01" name="amount" value={form.amount} onChange={handleChange} placeholder="Importe directo" style={styles.input} />
          <button type="submit" disabled={saving} style={styles.primaryButton}>{saving ? "Añadiendo..." : "Añadir"}</button>
        </div>
      </form>
    </section>
  );
}

const styles = {
  wrapper: { maxWidth: "1040px", margin: "0 auto 18px", padding: "16px", border: "2px solid #111827", borderRadius: "16px", backgroundColor: "#ffffff", boxShadow: "4px 4px 0 #e6d85c" },
  header: { display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "14px" },
  title: { margin: 0, fontSize: "17px", fontWeight: 900, color: "#111827" },
  subtitle: { margin: "4px 0 0", fontSize: "12px", fontWeight: 700, color: "#6b7280" },
  secondaryButton: { backgroundColor: "#ffffff", border: "2px solid #111827", borderRadius: "8px", padding: "8px 12px", fontWeight: 900, cursor: "pointer" },
  summary: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "14px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  box: { border: "1px solid #d1d5db", borderRadius: "12px", overflow: "hidden" },
  boxTitle: { margin: 0, padding: "9px 10px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", fontWeight: 900 },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  left: { textAlign: "left", padding: "8px", fontSize: "11px" },
  right: { textAlign: "right", padding: "8px", fontSize: "11px" },
  cell: { padding: "8px", borderTop: "1px solid #f3f4f6" },
  num: { padding: "8px", borderTop: "1px solid #f3f4f6", textAlign: "right" },
  amount: { padding: "8px", borderTop: "1px solid #f3f4f6", textAlign: "right", fontWeight: 900 },
  note: { display: "block", color: "#6b7280", marginTop: "3px" },
  empty: { margin: 0, padding: "12px", color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  form: { marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #e5e7eb" },
  formTitle: { margin: "0 0 10px", fontSize: "15px", fontWeight: 900 },
  formGrid: { display: "grid", gridTemplateColumns: "1.2fr 1.4fr 0.6fr 0.7fr 0.8fr 0.5fr", gap: "8px" },
  input: { border: "2px solid #d1d5db", borderRadius: "8px", padding: "8px", fontWeight: 700 },
  primaryButton: { backgroundColor: "#111827", color: "#ffffff", border: "2px solid #111827", borderRadius: "8px", padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  error: { marginBottom: "12px", padding: "10px", borderRadius: "10px", border: "1px solid #fecaca", backgroundColor: "#fef2f2", color: "#991b1b", fontWeight: 800 },
};
