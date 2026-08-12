import { useEffect, useMemo, useState } from "react";

import {
  createContractPayrollConcept,
  deactivateContractPayrollConcept,
  fetchContractPayrollConcepts,
  fetchPayrollConcepts,
  loadAgreementConceptsIntoContract,
} from "../../services/payrollApi";
import { formatCurrency } from "../payrolls/PayrollForm";
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

function getSourceLabel(sourceType) {
  if (sourceType === "AGREEMENT") return "Convenio";
  if (sourceType === "CUSTOM") return "Personalizado";
  return "Sistema";
}

function getSourceBadge(sourceType) {
  if (sourceType === "AGREEMENT") return "sc-badge--agreement";
  if (sourceType === "CUSTOM") return "sc-badge--custom";
  return "sc-badge--system";
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

export default function ContractPayrollConceptsPanel({ contract, refreshKey = 0 }) {
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

  const conceptById = useMemo(() => new Map(concepts.map((concept) => [Number(concept.id), concept])), [concepts]);

  async function loadData() {
    if (!contract?.id) return;
    setLoading(true);
    setError("");
    try {
      const [conceptData, itemData] = await Promise.all([
        fetchPayrollConcepts(),
        fetchContractPayrollConcepts(contract.id),
      ]);
      setConcepts(Array.isArray(conceptData) ? conceptData : []);
      setItems(Array.isArray(itemData) ? itemData : []);
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
    setForm(EMPTY_FORM);
    loadData();
  }, [contract?.id, refreshKey]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setMessage("");
  }

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
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.concept_id) {
      setError("Selecciona un concepto.");
      return;
    }
    if (items.some((item) => Number(item.concept_id) === Number(form.concept_id) && item.is_active !== false)) {
      setError("Este contrato ya tiene ese concepto permanente activo. Desactívalo o edita el existente antes de volver a añadirlo.");
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
    <section className="contract-concepts-panel">
      <div className="sc-panel-header">
        <div>
          <h3>Conceptos del contrato</h3>
          <p>Importes recurrentes que se cargarán en las nóminas mensuales de este contrato.</p>
        </div>
        <div className="sc-panel-actions">
          <button
            type="button"
            className="sc-button sc-button--secondary"
            onClick={handleLoadAgreementConcepts}
            disabled={syncing || !contract.collective_agreement_id}
          >
            {syncing ? "Cargando convenio..." : "Cargar desde convenio"}
          </button>
          <button type="button" className="sc-button sc-button--ghost" onClick={loadData} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {!contract.collective_agreement_id && (
        <div className="sc-feedback sc-feedback--warning">Este contrato no tiene un convenio vinculado. Puedes añadir conceptos manuales, pero para cargar los del convenio primero debes asignarlo en la ficha contractual.</div>
      )}
      {error && <div className="sc-feedback sc-feedback--error">{error}</div>}
      {message && <div className="sc-feedback sc-feedback--success">{message}</div>}
      {syncResult?.warnings?.length > 0 && (
        <div className="sc-feedback sc-feedback--warning">
          <strong>Observaciones de la carga:</strong> {syncResult.warnings.join(" · ")}
        </div>
      )}

      <form className="contract-concepts-panel__form" onSubmit={handleSubmit}>
        <div className="sc-section-header">
          <div>
            <h3>Añadir concepto permanente</h3>
            <p>Selecciona el concepto y define el importe aplicable a este contrato.</p>
          </div>
        </div>

        <div className="contract-concepts-panel__grid">
          <label className="sc-field">Concepto
            <select name="concept_id" value={form.concept_id} onChange={handleConceptChange} disabled={saving}>
              <option value="">Seleccionar concepto</option>
              {["SYSTEM", "AGREEMENT", "CUSTOM"].map((source) => groupedConcepts[source]?.length ? (
                <optgroup key={source} label={getSourceLabel(source)}>
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
            <input type="number" step="0.01" name="amount" value={form.amount} onChange={handleChange} placeholder="Calculado si se deja vacío" disabled={saving} />
          </label>
        </div>

        <div className="contract-concepts-panel__dates">
          <label className="sc-field">Vigente desde
            <input type="date" name="start_date" value={form.start_date} onChange={handleChange} disabled={saving} />
          </label>
          <label className="sc-field">Vigente hasta
            <input type="date" name="end_date" value={form.end_date} onChange={handleChange} disabled={saving} />
          </label>
        </div>

        <div className="sc-editor__actions">
          <button type="submit" className="sc-button sc-button--primary" disabled={saving}>
            {saving ? "Añadiendo..." : "Añadir concepto"}
          </button>
        </div>
      </form>

      <div className="sc-result-info">{items.length} conceptos permanentes activos en este contrato.</div>
      <div className="sc-table-wrap">
        <table className="sc-table">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Origen</th>
              <th>Cálculo</th>
              <th>Importe</th>
              <th>Vigencia</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const concept = conceptById.get(Number(item.concept_id));
              return (
                <tr key={item.id}>
                  <td>
                    <span className="sc-table__primary">{item.concept_name}</span>
                    <span className="sc-code">{item.concept_code || concept?.code || ""}</span>
                    {item.description && <span className="sc-table__secondary">{item.description}</span>}
                  </td>
                  <td><span className={`sc-badge ${getSourceBadge(concept?.source_type)}`}>{getSourceLabel(concept?.source_type)}</span></td>
                  <td>{getCalculationLabel(item)}</td>
                  <td><span className="sc-table__primary">{formatCurrency(item.amount)}</span></td>
                  <td>{item.start_date || "Sin inicio"} · {item.end_date || "sin fin"}</td>
                  <td>
                    <button type="button" className="sc-button sc-button--danger sc-button--small" onClick={() => handleDeactivate(item)}>Desactivar</button>
                  </td>
                </tr>
              );
            })}
            {!items.length && <tr><td colSpan="6" className="sc-empty">Este contrato todavía no tiene conceptos permanentes.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
