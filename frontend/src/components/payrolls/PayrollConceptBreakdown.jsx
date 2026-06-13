import { useEffect, useMemo, useState } from "react";

import {
  createPayrollItem,
  deletePayrollItem,
  fetchPayrollBreakdown,
  fetchPayrollConcepts,
  loadContractConceptsIntoPayroll,
  updatePayrollItem,
} from "../../services/payrollApi";
import { formatCurrency } from "./PayrollForm";

const EMPTY_FORM = { concept_id: "", description: "", quantity: "1", unit_price: "0", amount: "" };
const SENIORITY_PREFIX = "SENIORITY_AUTO_";
const RETROACTIVE_PREFIX = "RETRO_TABLE_";

function getCalculationLabel(item) {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unit_price || 0);

  if (item.concept_type === "BASE_INFORMATIVA") return item.description || "Traza automática";
  if (unitPrice > 0 && quantity > 0) {
    return `${quantity.toLocaleString("es-ES")} × ${formatCurrency(unitPrice)}`;
  }
  return "Importe directo";
}

function getSourceLabel(sourceType) {
  if (sourceType === "AGREEMENT") return "Convenio";
  if (sourceType === "CUSTOM") return "Personalizado";
  return "Sistema";
}

function Field({ label, children, style }) {
  return (
    <label style={{ ...styles.field, ...style }}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function ConceptTable({
  title,
  items,
  readOnly = false,
  editingItemId,
  editLineForm,
  onStartEdit,
  onCancelEdit,
  onEditChange,
  onSaveEdit,
  onDelete,
}) {
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
              <th style={styles.actionsHeader}>{readOnly ? "Origen" : "Acciones"}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isEditing = !readOnly && editingItemId === item.id;
              return (
                <tr key={item.id}>
                  <td style={styles.cell}>
                    <strong style={styles.conceptName}>{item.concept_name}</strong>
                    {isEditing ? (
                      <input name="description" value={editLineForm.description} onChange={onEditChange} placeholder="Descripción" style={styles.lineInput} />
                    ) : (
                      item.description && <small style={styles.note}>{item.description}</small>
                    )}
                  </td>
                  <td style={styles.calcCell}>
                    {isEditing ? (
                      <div style={styles.inlineEditGrid}>
                        <input type="number" step="0.01" name="quantity" value={editLineForm.quantity} onChange={onEditChange} style={styles.lineInput} />
                        <input type="number" step="0.01" name="unit_price" value={editLineForm.unit_price} onChange={onEditChange} style={styles.lineInput} />
                      </div>
                    ) : getCalculationLabel(item)}
                  </td>
                  <td style={styles.amount}>
                    {isEditing ? (
                      <input type="number" step="0.01" name="amount" value={editLineForm.amount} onChange={onEditChange} style={styles.lineInput} />
                    ) : formatCurrency(item.amount)}
                  </td>
                  <td style={styles.actionsCell}>
                    {readOnly ? (
                      <span style={styles.automaticBadge}>Automática</span>
                    ) : isEditing ? (
                      <>
                        <button type="button" onClick={() => onSaveEdit(item)} style={styles.smallPrimaryButton}>Guardar</button>
                        <button type="button" onClick={onCancelEdit} style={styles.smallButton}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => onStartEdit(item)} style={styles.smallButton}>Editar</button>
                        <button type="button" onClick={() => onDelete(item)} style={styles.smallDangerButton}>Eliminar</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
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
  const [editingItemId, setEditingItemId] = useState(null);
  const [editLineForm, setEditLineForm] = useState({ description: "", quantity: "1", unit_price: "0", amount: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingContractConcepts, setLoadingContractConcepts] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const groupedConcepts = useMemo(() => {
    const groups = { SYSTEM: [], AGREEMENT: [], CUSTOM: [] };
    concepts.forEach((concept) => {
      const source = concept.source_type || "SYSTEM";
      if (!groups[source]) groups[source] = [];
      groups[source].push(concept);
    });
    return groups;
  }, [concepts]);

  const pureProrationLines = useMemo(() => (
    (breakdown?.prorratas_automaticas || []).filter((item) => {
      const code = String(item.concept_code || "");
      return !code.startsWith(SENIORITY_PREFIX) && !code.startsWith(RETROACTIVE_PREFIX);
    })
  ), [breakdown]);

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
    setMessage("");
  }

  function handleEditLineChange(event) {
    setEditLineForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setMessage("");
  }

  function handleStartEdit(item) {
    setEditingItemId(item.id);
    setEditLineForm({
      description: item.description || "",
      quantity: String(item.quantity ?? "1"),
      unit_price: String(item.unit_price ?? "0"),
      amount: String(item.amount ?? ""),
    });
    setError("");
    setMessage("");
  }

  function handleCancelEdit() {
    setEditingItemId(null);
    setEditLineForm({ description: "", quantity: "1", unit_price: "0", amount: "" });
  }

  async function handleSaveEdit(item) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updatePayrollItem(item.id, {
        description: editLineForm.description || null,
        quantity: Number(editLineForm.quantity || 0),
        unit_price: Number(editLineForm.unit_price || 0),
        amount: editLineForm.amount === "" ? null : Number(editLineForm.amount),
      });
      setMessage("Línea de nómina actualizada.");
      handleCancelEdit();
      await loadData();
    } catch (err) {
      setError(err.message || "Error al actualizar la línea de nómina.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(item) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await deletePayrollItem(item.id);
      setMessage("Línea de nómina eliminada.");
      if (editingItemId === item.id) handleCancelEdit();
      await loadData();
    } catch (err) {
      setError(err.message || "Error al eliminar la línea de nómina.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadContractConcepts() {
    setLoadingContractConcepts(true);
    setError("");
    setMessage("");
    try {
      const result = await loadContractConceptsIntoPayroll(payrollId);
      setMessage(`Conceptos permanentes cargados: ${result.created_items}. Omitidos por duplicado: ${result.skipped_items}.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Error al cargar los conceptos permanentes del contrato.");
    } finally {
      setLoadingContractConcepts(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.concept_id) {
      setError("Selecciona un concepto.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
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

  const tableProps = {
    editingItemId,
    editLineForm,
    onStartEdit: handleStartEdit,
    onCancelEdit: handleCancelEdit,
    onEditChange: handleEditLineChange,
    onSaveEdit: handleSaveEdit,
    onDelete: handleDeleteItem,
  };

  return (
    <section style={styles.wrapper} className="no-print">
      <div style={styles.header}>
        <div>
          <h4 style={styles.title}>Desglose de conceptos</h4>
          <p style={styles.subtitle}>Las líneas automáticas explican los cálculos del motor. Las líneas manuales pueden editarse de forma independiente.</p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" onClick={handleLoadContractConcepts} style={styles.contractButton} disabled={loadingContractConcepts || saving}>
            {loadingContractConcepts ? "Cargando..." : "Cargar permanentes"}
          </button>
          <button type="button" onClick={loadData} style={styles.secondaryButton}>{loading ? "Cargando..." : "Actualizar"}</button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      {breakdown && (
        <>
          <div style={styles.summary}>
            <div style={styles.summaryCard}><span>Devengos del desglose</span><strong>{formatCurrency(breakdown.total_devengos)}</strong></div>
            <div style={styles.summaryCard}><span>Antigüedad automática</span><strong>{formatCurrency(breakdown.total_antiguedad_automatica)}</strong></div>
            <div style={styles.summaryCard}><span>Prorratas automáticas</span><strong>{formatCurrency(breakdown.total_prorrata_automatica)}</strong></div>
            <div style={styles.summaryCard}><span>Regularizaciones</span><strong>{formatCurrency(breakdown.total_regularizacion_automatica)}</strong></div>
            <div style={styles.summaryCard}><span>Deducciones manuales</span><strong>{formatCurrency(breakdown.total_deducciones)}</strong></div>
            <div style={styles.netCard}><span>Neto según desglose</span><strong>{formatCurrency(breakdown.neto_manual)}</strong></div>
          </div>

          <div style={styles.automaticGrid}>
            <ConceptTable title="Antigüedad automática" items={breakdown.antiguedad_automatica} readOnly />
            <ConceptTable title="Prorratas y pagas automáticas" items={pureProrationLines} readOnly />
            <ConceptTable title="Regularizaciones retroactivas" items={breakdown.regularizaciones_automaticas} readOnly />
          </div>

          <div style={styles.grid}>
            <ConceptTable title="Devengos salariales manuales" items={breakdown.devengos_salariales} {...tableProps} />
            <ConceptTable title="Devengos extrasalariales manuales" items={breakdown.devengos_extrasalariales} {...tableProps} />
            <ConceptTable title="Deducciones manuales" items={breakdown.deducciones} {...tableProps} />
            <ConceptTable title="Bases informativas manuales" items={breakdown.bases_informativas} {...tableProps} />
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
              {["SYSTEM", "AGREEMENT", "CUSTOM"].map((source) => (
                groupedConcepts[source]?.length ? (
                  <optgroup key={source} label={getSourceLabel(source)}>
                    {groupedConcepts[source].map((concept) => (
                      <option key={concept.id} value={concept.id}>{concept.name}</option>
                    ))}
                  </optgroup>
                ) : null
              ))}
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
          <button type="submit" disabled={saving} style={styles.primaryButton}>{saving ? "Guardando..." : "Añadir"}</button>
        </div>
      </form>
    </section>
  );
}

const styles = {
  wrapper: { width: "100%", boxSizing: "border-box", margin: "0", padding: "14px", border: "2px solid #111827", borderRadius: "14px", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #e6d85c", overflow: "hidden" },
  header: { display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "12px", alignItems: "start" },
  headerActions: { display: "flex", gap: "8px", alignItems: "center" },
  title: { margin: 0, fontSize: "17px", fontWeight: 900, color: "#111827" },
  subtitle: { margin: "4px 0 0", fontSize: "12px", fontWeight: 700, color: "#6b7280" },
  secondaryButton: { backgroundColor: "#ffffff", border: "2px solid #111827", borderRadius: "8px", padding: "8px 12px", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  contractButton: { backgroundColor: "#e6d85c", border: "2px solid #111827", color: "#111827", borderRadius: "8px", padding: "8px 12px", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  summary: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginBottom: "12px" },
  summaryCard: { border: "1px solid #d1d5db", borderRadius: "10px", padding: "10px", backgroundColor: "#f9fafb", display: "flex", justifyContent: "space-between", gap: "8px" },
  netCard: { border: "2px solid #111827", borderRadius: "10px", padding: "10px", backgroundColor: "#fffdf0", display: "flex", justifyContent: "space-between", gap: "8px" },
  automaticGrid: { display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginBottom: "12px" },
  grid: { display: "grid", gridTemplateColumns: "1fr", gap: "12px" },
  box: { border: "1px solid #d1d5db", borderRadius: "12px", overflow: "hidden", backgroundColor: "#ffffff" },
  boxTitle: { margin: 0, padding: "8px 10px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", fontWeight: 900, fontSize: "14px" },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "auto" },
  left: { textAlign: "left", padding: "7px 8px", fontSize: "11px", color: "#4b5563" },
  calcHeader: { width: "260px", textAlign: "right", padding: "7px 8px", fontSize: "11px", color: "#4b5563", whiteSpace: "nowrap" },
  amountHeader: { width: "130px", textAlign: "right", padding: "7px 8px", fontSize: "11px", color: "#4b5563", whiteSpace: "nowrap" },
  actionsHeader: { width: "150px", textAlign: "right", padding: "7px 8px", fontSize: "11px", color: "#4b5563", whiteSpace: "nowrap" },
  cell: { padding: "8px", borderTop: "1px solid #f3f4f6", minWidth: "260px" },
  conceptName: { display: "block", fontSize: "13px", lineHeight: 1.25 },
  calcCell: { width: "260px", padding: "8px", borderTop: "1px solid #f3f4f6", textAlign: "right", color: "#4b5563", fontWeight: 700 },
  amount: { width: "130px", padding: "8px", borderTop: "1px solid #f3f4f6", textAlign: "right", fontWeight: 900, whiteSpace: "nowrap" },
  actionsCell: { width: "150px", padding: "8px", borderTop: "1px solid #f3f4f6", textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "6px", flexWrap: "wrap" },
  automaticBadge: { display: "inline-flex", padding: "4px 7px", borderRadius: "999px", background: "#e0f2fe", color: "#075985", fontSize: "11px", fontWeight: 900 },
  note: { display: "block", color: "#6b7280", marginTop: "3px", lineHeight: 1.35 },
  empty: { margin: 0, padding: "10px", color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  inlineEditGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" },
  lineInput: { width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: "6px", padding: "6px", fontWeight: 700 },
  smallButton: { backgroundColor: "#ffffff", color: "#111827", border: "1px solid #111827", borderRadius: "7px", padding: "6px 8px", fontWeight: 800, cursor: "pointer" },
  smallPrimaryButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "7px", padding: "6px 8px", fontWeight: 800, cursor: "pointer" },
  smallDangerButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #991b1b", borderRadius: "7px", padding: "6px 8px", fontWeight: 800, cursor: "pointer" },
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
  success: { marginBottom: "12px", padding: "10px", borderRadius: "10px", border: "1px solid #bbf7d0", backgroundColor: "#f0fdf4", color: "#166534", fontWeight: 800 },
};
