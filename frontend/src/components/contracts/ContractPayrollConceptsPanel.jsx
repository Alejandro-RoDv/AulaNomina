import { useEffect, useMemo, useState } from "react";

import {
  createContractPayrollConcept,
  deactivateContractPayrollConcept,
  fetchContractPayrollConcepts,
  fetchPayrollConcepts,
  loadAgreementConceptsIntoContract,
} from "../../services/payrollApi";
import { formatCurrency } from "../payrolls/PayrollForm";

const EMPTY_FORM = {
  concept_id: "",
  description: "",
  quantity: "1",
  unit_price: "0",
  amount: "",
  start_date: "",
  end_date: "",
};

function getSourceLabel(sourceType) {
  if (sourceType === "AGREEMENT") return "Convenio";
  if (sourceType === "CUSTOM") return "Personalizado";
  return "Sistema";
}

function getCalculationLabel(item) {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unit_price || 0);
  if (unitPrice > 0 && quantity > 0) return `${quantity.toLocaleString("es-ES")} × ${formatCurrency(unitPrice)}`;
  return "Importe mensual";
}

function buildSyncMessage(result) {
  const parts = [];
  if (result.salary_base_updated) parts.push(`Salario base actualizado a ${formatCurrency(result.salary_base_amount)}.`);
  if (result.salary_base_preserved) parts.push("Se ha conservado el salario base existente.");
  if (result.contract_concepts_created) parts.push(`${result.contract_concepts_created} conceptos añadidos.`);
  if (result.contract_concepts_reactivated) parts.push(`${result.contract_concepts_reactivated} conceptos reactivados.`);
  if (result.contract_concepts_skipped) parts.push(`${result.contract_concepts_skipped} conceptos existentes conservados.`);
  if (!parts.length) parts.push("No había cambios pendientes para aplicar desde el convenio.");
  return parts.join(" ");
}

export default function ContractPayrollConceptsPanel({ contract }) {
  const [concepts, setConcepts] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const groupedConcepts = useMemo(() => {
    const groups = { SYSTEM: [], AGREEMENT: [], CUSTOM: [] };
    concepts.forEach((concept) => {
      const source = concept.source_type || "SYSTEM";
      if (!groups[source]) groups[source] = [];
      groups[source].push(concept);
    });
    return groups;
  }, [concepts]);

  const conceptById = useMemo(() => {
    return concepts.reduce((accumulator, concept) => {
      accumulator[concept.id] = concept;
      return accumulator;
    }, {});
  }, [concepts]);

  async function loadData() {
    if (!contract?.id) return;
    setLoading(true);
    setError("");
    try {
      const [conceptData, itemData] = await Promise.all([
        fetchPayrollConcepts(),
        fetchContractPayrollConcepts(contract.id),
      ]);
      setConcepts(conceptData || []);
      setItems(itemData || []);
    } catch (err) {
      setError(err.message || "No se han podido cargar los conceptos permanentes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSyncResult(null);
    setMessage("");
    setError("");
    loadData();
  }, [contract?.id]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setMessage("");
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
      await createContractPayrollConcept(contract.id, {
        concept_id: Number(form.concept_id),
        description: form.description || null,
        quantity: Number(form.quantity || 0),
        unit_price: Number(form.unit_price || 0),
        amount: form.amount === "" ? null : Number(form.amount),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        is_active: true,
      });
      setForm(EMPTY_FORM);
      setMessage("Concepto permanente añadido al contrato.");
      await loadData();
    } catch (err) {
      setError(err.message || "No se ha podido añadir el concepto permanente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadAgreementConcepts() {
    if (!contract?.collective_agreement_id) {
      setError("El contrato no tiene un convenio colectivo vinculado.");
      return;
    }

    const currentSalaryBase = Number(contract.salary_base || 0);
    const overwriteSalaryBase = currentSalaryBase <= 0
      ? true
      : window.confirm(
        `El contrato ya tiene un salario base de ${formatCurrency(currentSalaryBase)}.\n\nAceptar: sustituirlo por el importe del convenio.\nCancelar: conservarlo y cargar únicamente los complementos.`
      );

    setSyncing(true);
    setError("");
    setMessage("");
    setSyncResult(null);
    try {
      const result = await loadAgreementConceptsIntoContract(contract.id, {
        overwrite_salary_base: overwriteSalaryBase,
        reactivate_inactive: true,
      });
      setSyncResult(result);
      setMessage(buildSyncMessage(result));
      await loadData();
    } catch (err) {
      setError(err.message || "No se han podido cargar los conceptos del convenio.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeactivate(item) {
    setError("");
    setMessage("");
    try {
      await deactivateContractPayrollConcept(item.id);
      setMessage("Concepto permanente desactivado.");
      await loadData();
    } catch (err) {
      setError(err.message || "No se ha podido desactivar el concepto.");
    }
  }

  if (!contract) return null;

  return (
    <section style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Conceptos permanentes del contrato</h3>
          <p style={styles.subtitle}>Importes recurrentes que podrán cargarse en las nóminas mensuales.</p>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            onClick={handleLoadAgreementConcepts}
            disabled={syncing || !contract.collective_agreement_id}
            style={syncing || !contract.collective_agreement_id ? styles.agreementButtonDisabled : styles.agreementButton}
          >
            {syncing ? "Cargando convenio..." : "Cargar desde convenio"}
          </button>
          <button type="button" onClick={loadData} style={styles.secondaryButton}>{loading ? "Cargando..." : "Actualizar"}</button>
        </div>
      </div>

      {!contract.collective_agreement_id && (
        <div style={styles.warning}>Este contrato no tiene un convenio vinculado. Asígnalo en la ficha contractual antes de cargar conceptos.</div>
      )}
      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}
      {syncResult?.warnings?.length > 0 && (
        <div style={styles.warning}>
          <strong>Observaciones de la carga</strong>
          {syncResult.warnings.map((warning) => <span key={warning} style={styles.warningLine}>{warning}</span>)}
        </div>
      )}
      {syncResult?.imported_names?.length > 0 && (
        <div style={styles.syncSummary}>
          <strong>Conceptos aplicados desde {syncResult.agreement_name || "el convenio"}</strong>
          <span>{syncResult.imported_names.join(" · ")}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGrid}>
          <label style={styles.field}>Concepto
            <select name="concept_id" value={form.concept_id} onChange={handleChange} style={styles.input}>
              <option value="">Seleccionar</option>
              {["SYSTEM", "AGREEMENT", "CUSTOM"].map((source) => (
                groupedConcepts[source]?.length ? (
                  <optgroup key={source} label={getSourceLabel(source)}>
                    {groupedConcepts[source].map((concept) => <option key={concept.id} value={concept.id}>{concept.name}</option>)}
                  </optgroup>
                ) : null
              ))}
            </select>
          </label>
          <label style={styles.field}>Descripción
            <input name="description" value={form.description} onChange={handleChange} placeholder="Ej. Antigüedad mensual" style={styles.input} />
          </label>
          <label style={styles.field}>Cantidad
            <input type="number" step="0.01" name="quantity" value={form.quantity} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Precio unitario
            <input type="number" step="0.01" name="unit_price" value={form.unit_price} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Importe mensual
            <input type="number" step="0.01" name="amount" value={form.amount} onChange={handleChange} placeholder="Ej. 95" style={styles.input} />
          </label>
          <button type="submit" disabled={saving} style={styles.primaryButton}>{saving ? "Añadiendo..." : "Añadir"}</button>
        </div>
      </form>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Concepto</th>
              <th style={styles.th}>Origen</th>
              <th style={styles.th}>Cálculo</th>
              <th style={styles.thRight}>Importe</th>
              <th style={styles.th}>Vigencia</th>
              <th style={styles.thActions}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={styles.td}><strong>{item.concept_name}</strong>{item.description && <span style={styles.note}>{item.description}</span>}</td>
                <td style={styles.td}>{getSourceLabel(conceptById[item.concept_id]?.source_type)}</td>
                <td style={styles.td}>{getCalculationLabel(item)}</td>
                <td style={styles.tdRight}>{formatCurrency(item.amount)}</td>
                <td style={styles.td}>{item.start_date || "-"} / {item.end_date || "sin fin"}</td>
                <td style={styles.tdActions}><button type="button" onClick={() => handleDeactivate(item)} style={styles.dangerButton}>Desactivar</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="6" style={styles.td}>Este contrato no tiene conceptos permanentes.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const styles = {
  wrapper: { marginTop: "16px", border: "2px solid #111827", borderRadius: "14px", padding: "14px", backgroundColor: "#fffdf0", boxShadow: "3px 3px 0 #111827" },
  header: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "start", marginBottom: "12px", flexWrap: "wrap" },
  headerActions: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" },
  title: { margin: 0, fontSize: "18px", fontWeight: 900, color: "#111827" },
  subtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  form: { marginBottom: "14px" },
  formGrid: { display: "grid", gridTemplateColumns: "minmax(210px, 1.2fr) minmax(240px, 1.4fr) 110px 130px 140px auto", gap: "10px", alignItems: "end", overflowX: "auto" },
  field: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px", fontWeight: 900, color: "#374151" },
  input: { border: "2px solid #d1d5db", borderRadius: "8px", padding: "8px", fontWeight: 700, width: "100%", boxSizing: "border-box" },
  primaryButton: { backgroundColor: "#111827", color: "#ffffff", border: "2px solid #111827", borderRadius: "8px", padding: "9px 16px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { backgroundColor: "#ffffff", color: "#111827", border: "2px solid #111827", borderRadius: "8px", padding: "8px 12px", fontWeight: 900, cursor: "pointer" },
  agreementButton: { backgroundColor: "#facc15", color: "#111827", border: "2px solid #111827", borderRadius: "8px", padding: "8px 12px", fontWeight: 900, cursor: "pointer" },
  agreementButtonDisabled: { backgroundColor: "#e5e7eb", color: "#6b7280", border: "2px solid #d1d5db", borderRadius: "8px", padding: "8px 12px", fontWeight: 900, cursor: "not-allowed" },
  dangerButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #991b1b", borderRadius: "8px", padding: "7px 10px", fontWeight: 800, cursor: "pointer" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", backgroundColor: "#ffffff", minWidth: "760px" },
  th: { textAlign: "left", padding: "8px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", fontSize: "12px" },
  thRight: { textAlign: "right", padding: "8px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", fontSize: "12px" },
  thActions: { width: "110px", textAlign: "left", padding: "8px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", fontSize: "12px" },
  td: { padding: "9px 8px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
  tdRight: { padding: "9px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontWeight: 900 },
  tdActions: { padding: "9px 8px", borderBottom: "1px solid #e5e7eb" },
  note: { display: "block", color: "#6b7280", fontSize: "11px", fontWeight: 700, marginTop: "3px" },
  error: { marginBottom: "10px", padding: "10px", borderRadius: "10px", backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontWeight: 800 },
  success: { marginBottom: "10px", padding: "10px", borderRadius: "10px", backgroundColor: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontWeight: 800 },
  warning: { marginBottom: "10px", padding: "10px", borderRadius: "10px", backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fde68a", fontWeight: 800, display: "flex", flexDirection: "column", gap: "4px" },
  warningLine: { display: "block", fontSize: "12px" },
  syncSummary: { marginBottom: "10px", padding: "10px", borderRadius: "10px", backgroundColor: "#eff6ff", color: "#1e3a8a", border: "1px solid #bfdbfe", fontWeight: 800, display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" },
};
