import { useEffect, useMemo, useState } from "react";

import { fetchPayrollConcepts } from "../../services/payrollApi";
import { assignPermanentConceptToContracts } from "../../services/contractPayrollConceptBulkApi";
import "../payrolls/salaryConceptsSplit42.css";

const EMPTY_FORM = {
  concept_id: "",
  description: "",
  quantity: "1",
  unit_price: "0",
  amount: "",
  start_date: "",
  end_date: "",
};

function sourceLabel(value) {
  if (value === "AGREEMENT") return "Convenio";
  if (value === "CUSTOM") return "Personalizado";
  return "Sistema";
}

export default function BulkContractPayrollConceptsPanel({ contractIds = [], onClose, onCompleted }) {
  const [concepts, setConcepts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPayrollConcepts()
      .then((data) => {
        if (active) setConcepts(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active) setError(err.message || "No se pudieron cargar los conceptos disponibles.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const groupedConcepts = useMemo(() => {
    const groups = { SYSTEM: [], AGREEMENT: [], CUSTOM: [] };
    concepts.forEach((concept) => {
      const source = concept.source_type || "SYSTEM";
      if (!groups[source]) groups[source] = [];
      groups[source].push(concept);
    });
    return groups;
  }, [concepts]);

  function handleConceptChange(event) {
    const value = event.target.value;
    const concept = concepts.find((item) => String(item.id) === String(value));
    setForm((current) => ({
      ...current,
      concept_id: value,
      description: current.description || concept?.name || "",
      unit_price: String(concept?.default_unit_price ?? "0"),
      amount: Number(concept?.default_amount || 0) > 0 ? String(concept.default_amount) : "",
    }));
    setResult(null);
    setError("");
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setResult(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.concept_id) {
      setError("Selecciona un concepto salarial.");
      return;
    }
    if (!contractIds.length) {
      setError("Selecciona al menos un contrato.");
      return;
    }

    setSaving(true);
    setError("");
    setResult(null);
    try {
      const summary = await assignPermanentConceptToContracts(contractIds, {
        concept_id: Number(form.concept_id),
        description: form.description || null,
        quantity: Number(form.quantity || 0),
        unit_price: Number(form.unit_price || 0),
        amount: form.amount === "" ? null : Number(form.amount),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        is_active: true,
      });
      setResult(summary);
      await onCompleted?.(summary);
    } catch (err) {
      setError(err.message || "No se pudo completar la asignación masiva.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="sc-bulk-panel" aria-label="Asignación masiva de concepto permanente">
      <div className="sc-panel-header">
        <div>
          <h3>Asignar concepto a varios contratos</h3>
          <p>El mismo concepto e importe se aplicará a todos los contratos seleccionados. Los duplicados activos se omiten y los inactivos se reactivan.</p>
        </div>
        <button type="button" className="sc-button sc-button--ghost" onClick={onClose}>Cerrar</button>
      </div>

      <p className="sc-bulk-panel__summary"><strong>{contractIds.length}</strong> contratos seleccionados.</p>
      {error && <div className="sc-feedback sc-feedback--error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="sc-bulk-grid">
          <label className="sc-field">Concepto
            <select value={form.concept_id} onChange={handleConceptChange} disabled={loading || saving}>
              <option value="">{loading ? "Cargando conceptos..." : "Seleccionar concepto"}</option>
              {["SYSTEM", "AGREEMENT", "CUSTOM"].map((source) => groupedConcepts[source]?.length ? (
                <optgroup key={source} label={sourceLabel(source)}>
                  {groupedConcepts[source].map((concept) => <option key={concept.id} value={concept.id}>{concept.name} · {concept.code}</option>)}
                </optgroup>
              ) : null)}
            </select>
          </label>
          <label className="sc-field">Descripción
            <input name="description" value={form.description} onChange={handleChange} placeholder="Descripción opcional" disabled={saving} />
          </label>
          <label className="sc-field">Cantidad
            <input type="number" step="0.01" name="quantity" value={form.quantity} onChange={handleChange} disabled={saving} />
          </label>
          <label className="sc-field">Precio unitario
            <input type="number" step="0.01" name="unit_price" value={form.unit_price} onChange={handleChange} disabled={saving} />
          </label>
          <label className="sc-field">Importe mensual
            <input type="number" step="0.01" name="amount" value={form.amount} onChange={handleChange} placeholder="Automático si se deja vacío" disabled={saving} />
          </label>
        </div>

        <div className="sc-bulk-dates">
          <label className="sc-field">Desde
            <input type="date" name="start_date" value={form.start_date} onChange={handleChange} disabled={saving} />
          </label>
          <label className="sc-field">Hasta
            <input type="date" name="end_date" value={form.end_date} onChange={handleChange} disabled={saving} />
          </label>
        </div>

        <div className="sc-editor__actions">
          <button type="submit" className="sc-button sc-button--primary" disabled={saving || loading || !contractIds.length}>
            {saving ? "Aplicando..." : `Asignar a ${contractIds.length} contrato${contractIds.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </form>

      {result && (
        <div className="sc-bulk-result">
          <span><strong>{result.created_count}</strong> añadidos</span>
          <span><strong>{result.reactivated_count}</strong> reactivados</span>
          <span><strong>{result.skipped_count}</strong> ya existentes</span>
          <span><strong>{result.error_count}</strong> errores</span>
        </div>
      )}
    </section>
  );
}
