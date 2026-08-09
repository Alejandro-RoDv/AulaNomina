import { useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import "../components/payrolls/salaryConceptsSplit42.css";
import { fetchCollectiveAgreements } from "../services/collectiveAgreementApi";
import {
  createPayrollConcept,
  deactivatePayrollConcept,
  fetchPayrollConcepts,
  updatePayrollConcept,
} from "../services/payrollApi";

const PAGE_SIZE = 25;

const EMPTY_FORM = {
  name: "",
  code: "",
  category: "OTRO",
  concept_type: "DEVENGO",
  salary_nature: "SALARIAL",
  source_type: "CUSTOM",
  agreement_id: "",
  calculation_type: "FIXED_AMOUNT",
  default_amount: "0",
  default_unit_price: "0",
  applies_workday_percentage: true,
  is_taxable: true,
  is_contribution_base: true,
  is_active: true,
  display_order: 0,
  notes: "",
};

const EMPTY_FILTERS = {
  search: "",
  source: "ALL",
  agreement: "ALL",
  category: "ALL",
  conceptType: "ALL",
  salaryNature: "ALL",
  calculationType: "ALL",
  workday: "ALL",
  taxable: "ALL",
  contribution: "ALL",
  status: "ALL",
};

const CATEGORY_OPTIONS = [
  ["BASE", "Base"],
  ["COMPLEMENTO", "Complemento"],
  ["PLUS", "Plus"],
  ["EXTRA", "Extra"],
  ["PAGA_EXTRA", "Paga extra"],
  ["DIETA", "Dieta"],
  ["KILOMETRAJE", "Kilometraje"],
  ["DEDUCCION", "Deducción"],
  ["EMBARGO", "Embargo"],
  ["ANTICIPO", "Anticipo"],
  ["BASE_INFORMATIVA", "Base informativa"],
  ["OTRO", "Otro"],
];

const TYPE_OPTIONS = [
  ["DEVENGO", "Devengo"],
  ["DEDUCCION", "Deducción"],
  ["BASE_INFORMATIVA", "Base informativa"],
];

const NATURE_OPTIONS = [
  ["SALARIAL", "Salarial"],
  ["EXTRASALARIAL", "Extrasalarial"],
  ["INFORMATIVA", "Informativa"],
];

const EDITOR_SOURCE_OPTIONS = [
  ["SYSTEM", "Sistema"],
  ["CUSTOM", "Personalizado"],
  ["AGREEMENT", "Convenio"],
];

const SOURCE_OPTIONS = [
  ["SYSTEM", "Sistema"],
  ["CONTRACT", "Contrato"],
  ["AGREEMENT", "Convenio"],
  ["INCIDENT", "Incidencia"],
  ["MANUAL", "Manual"],
  ["CUSTOM", "Personalizado"],
  ["REGULARIZATION", "Regularización"],
];

const CALCULATION_OPTIONS = [
  ["FIXED_AMOUNT", "Importe fijo"],
  ["UNIT_PRICE", "Precio por unidad"],
];

function labelFrom(options, value) {
  return options.find(([optionValue]) => optionValue === value)?.[1] || value || "-";
}

function normalizeCode(value) {
  return value.trim().toUpperCase().replaceAll(" ", "_");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function sourceBadgeClass(sourceType) {
  if (sourceType === "AGREEMENT") return "sc-badge--agreement";
  if (sourceType === "CUSTOM") return "sc-badge--custom";
  return "sc-badge--system";
}

export default function PayrollConceptsPage() {
  const [concepts, setConcepts] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadConcepts() {
    setLoading(true);
    setError("");
    try {
      const [conceptData, agreementData] = await Promise.all([
        fetchPayrollConcepts(true),
        fetchCollectiveAgreements(),
      ]);
      setConcepts(Array.isArray(conceptData) ? conceptData : []);
      setAgreements(Array.isArray(agreementData) ? agreementData : []);
    } catch (err) {
      setError(err.message || "No se han podido cargar los conceptos retributivos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadConcepts(); }, []);

  const agreementById = useMemo(() => new Map(agreements.map((agreement) => [Number(agreement.id), agreement])), [agreements]);

  const filteredConcepts = useMemo(() => {
    const query = normalizeText(filters.search);
    return concepts.filter((concept) => {
      const agreementName = concept.agreement_id ? agreementById.get(Number(concept.agreement_id))?.name : "";
      const searchableText = normalizeText([
        concept.name,
        concept.code,
        concept.category,
        concept.concept_type,
        concept.salary_nature,
        concept.source_type,
        concept.calculation_type,
        agreementName,
      ].join(" "));

      if (query && !searchableText.includes(query)) return false;
      if (filters.source !== "ALL" && concept.source_type !== filters.source) return false;
      if (filters.agreement !== "ALL" && String(concept.agreement_id || "") !== String(filters.agreement)) return false;
      if (filters.category !== "ALL" && concept.category !== filters.category) return false;
      if (filters.conceptType !== "ALL" && concept.concept_type !== filters.conceptType) return false;
      if (filters.salaryNature !== "ALL" && concept.salary_nature !== filters.salaryNature) return false;
      if (filters.calculationType !== "ALL" && concept.calculation_type !== filters.calculationType) return false;
      if (filters.workday !== "ALL" && String(concept.applies_workday_percentage) !== filters.workday) return false;
      if (filters.taxable !== "ALL" && String(concept.is_taxable) !== filters.taxable) return false;
      if (filters.contribution !== "ALL" && String(concept.is_contribution_base) !== filters.contribution) return false;
      if (filters.status !== "ALL" && String(concept.is_active) !== filters.status) return false;
      return true;
    });
  }, [concepts, filters, agreementById]);

  const totals = useMemo(() => ({
    all: concepts.length,
    system: concepts.filter((concept) => concept.source_type === "SYSTEM").length,
    custom: concepts.filter((concept) => concept.source_type === "CUSTOM").length,
    agreement: concepts.filter((concept) => concept.source_type === "AGREEMENT").length,
    filtered: filteredConcepts.length,
  }), [concepts, filteredConcepts]);

  const totalPages = Math.max(1, Math.ceil(filteredConcepts.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredConcepts.length);
  const visibleConcepts = filteredConcepts.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  function openNewConcept() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage("");
    setError("");
    setEditorOpen(true);
  }

  function startEdit(concept) {
    setEditingId(concept.id);
    setForm({
      name: concept.name || "",
      code: concept.code || "",
      category: concept.category || "OTRO",
      concept_type: concept.concept_type || "DEVENGO",
      salary_nature: concept.salary_nature || "SALARIAL",
      source_type: EDITOR_SOURCE_OPTIONS.some(([value]) => value === concept.source_type) ? concept.source_type : "CUSTOM",
      agreement_id: concept.agreement_id || "",
      calculation_type: concept.calculation_type || "FIXED_AMOUNT",
      default_amount: String(concept.default_amount ?? "0"),
      default_unit_price: String(concept.default_unit_price ?? "0"),
      applies_workday_percentage: concept.applies_workday_percentage !== false,
      is_taxable: Boolean(concept.is_taxable),
      is_contribution_base: Boolean(concept.is_contribution_base),
      is_active: Boolean(concept.is_active),
      display_order: concept.display_order || 0,
      notes: concept.notes || "",
    });
    setMessage("");
    setError("");
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    const payload = {
      ...form,
      code: normalizeCode(form.code || form.name),
      display_order: Number(form.display_order || 0),
      default_amount: Number(form.default_amount || 0),
      default_unit_price: Number(form.default_unit_price || 0),
      is_system: form.source_type === "SYSTEM",
      agreement_id: form.source_type === "AGREEMENT" && form.agreement_id ? Number(form.agreement_id) : null,
      notes: form.notes || null,
    };

    try {
      if (editingId) {
        await updatePayrollConcept(editingId, payload);
        setMessage("Concepto retributivo actualizado.");
      } else {
        await createPayrollConcept(payload);
        setMessage("Concepto retributivo creado.");
      }
      setEditorOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadConcepts();
    } catch (err) {
      setError(err.message || "No se ha podido guardar el concepto retributivo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(concept) {
    setError("");
    setMessage("");
    try {
      await deactivatePayrollConcept(concept.id);
      setMessage("Concepto desactivado.");
      await loadConcepts();
    } catch (err) {
      setError(err.message || "No se ha podido desactivar el concepto.");
    }
  }

  return (
    <div className="salary-concepts">
      <PageCard
        title="Catálogo de conceptos retributivos"
        subtitle="Consulta, filtra y mantiene los conceptos que pueden utilizarse en nóminas y contratos."
        actions={(
          <div className="sc-toolbar__actions">
            <button type="button" className="sc-button sc-button--secondary" onClick={loadConcepts} disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
            <button type="button" className="sc-button sc-button--primary" onClick={openNewConcept}>Nuevo concepto</button>
          </div>
        )}
      >
        <div className="sc-metrics">
          <div className="sc-metric"><span>Total</span><strong>{totals.all}</strong></div>
          <div className="sc-metric"><span>Sistema</span><strong>{totals.system}</strong></div>
          <div className="sc-metric"><span>Personalizados</span><strong>{totals.custom}</strong></div>
          <div className="sc-metric"><span>Convenio</span><strong>{totals.agreement}</strong></div>
          <div className="sc-metric"><span>Resultados</span><strong>{totals.filtered}</strong></div>
        </div>

        {message && <div className="sc-feedback sc-feedback--success">{message}</div>}
        {!editorOpen && error && <div className="sc-feedback sc-feedback--error">{error}</div>}

        {editorOpen && (
          <form className="sc-editor" onSubmit={handleSubmit}>
            <div className="sc-editor__header">
              <div>
                <h3>{editingId ? "Editar concepto" : "Nuevo concepto"}</h3>
                <p>Define identificación, origen, comportamiento salarial y valores por defecto.</p>
              </div>
              <button type="button" className="sc-button sc-button--ghost" onClick={closeEditor}>Cerrar</button>
            </div>

            {error && <div className="sc-feedback sc-feedback--error">{error}</div>}

            <section className="sc-editor__section">
              <h4>Identificación</h4>
              <div className="sc-editor__grid">
                <label className="sc-field">Nombre
                  <input name="name" value={form.name} onChange={handleChange} required />
                </label>
                <label className="sc-field">Código
                  <input name="code" value={form.code} onChange={handleChange} placeholder="Se genera desde el nombre si queda vacío" />
                </label>
                <label className="sc-field">Origen
                  <select name="source_type" value={form.source_type} onChange={handleChange}>
                    {EDITOR_SOURCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="sc-field">Convenio
                  <select name="agreement_id" value={form.agreement_id} onChange={handleChange} disabled={form.source_type !== "AGREEMENT"}>
                    <option value="">Sin convenio asociado</option>
                    {agreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name}</option>)}
                  </select>
                </label>
                <label className="sc-field">Categoría
                  <select name="category" value={form.category} onChange={handleChange}>
                    {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="sc-field">Tipo
                  <select name="concept_type" value={form.concept_type} onChange={handleChange}>
                    {TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="sc-field">Naturaleza
                  <select name="salary_nature" value={form.salary_nature} onChange={handleChange}>
                    {NATURE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="sc-field">Orden
                  <input type="number" name="display_order" value={form.display_order} onChange={handleChange} />
                </label>
              </div>
            </section>

            <section className="sc-editor__section">
              <h4>Cálculo por defecto</h4>
              <div className="sc-editor__grid">
                <label className="sc-field">Tipo de importe
                  <select name="calculation_type" value={form.calculation_type} onChange={handleChange}>
                    {CALCULATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="sc-field">Importe íntegro / base
                  <input type="number" step="0.01" name="default_amount" value={form.default_amount} onChange={handleChange} />
                </label>
                <label className="sc-field">Precio por unidad
                  <input type="number" step="0.01" name="default_unit_price" value={form.default_unit_price} onChange={handleChange} />
                </label>
              </div>
              <div className="sc-editor__checks">
                <label className="sc-check"><input type="checkbox" name="applies_workday_percentage" checked={form.applies_workday_percentage} onChange={handleChange} /> Aplicar % de jornada</label>
                <label className="sc-check"><input type="checkbox" name="is_taxable" checked={form.is_taxable} onChange={handleChange} /> Tributa IRPF</label>
                <label className="sc-check"><input type="checkbox" name="is_contribution_base" checked={form.is_contribution_base} onChange={handleChange} /> Cotiza</label>
                <label className="sc-check"><input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} /> Activo</label>
              </div>
            </section>

            <section className="sc-editor__section">
              <label className="sc-field">Notas
                <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Observaciones o criterio de uso" />
              </label>
            </section>

            <div className="sc-editor__actions">
              <button type="button" className="sc-button sc-button--secondary" onClick={closeEditor}>Cancelar</button>
              <button type="submit" className="sc-button sc-button--primary" disabled={submitting}>
                {submitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear concepto"}
              </button>
            </div>
          </form>
        )}

        <div className="sc-filters">
          <div className="sc-filters__grid">
            <label className="sc-field">Buscar
              <input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Nombre, código, categoría o convenio" />
            </label>
            <label className="sc-field">Origen
              <select name="source" value={filters.source} onChange={handleFilterChange}>
                <option value="ALL">Todos los orígenes</option>
                {SOURCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="sc-field">Convenio
              <select name="agreement" value={filters.agreement} onChange={handleFilterChange}>
                <option value="ALL">Todos los convenios</option>
                <option value="">Sin convenio asociado</option>
                {agreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name}</option>)}
              </select>
            </label>
            <label className="sc-field">Estado
              <select name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="ALL">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </label>
          </div>

          {advancedFilters && (
            <div className="sc-filters__advanced">
              <label className="sc-field">Categoría
                <select name="category" value={filters.category} onChange={handleFilterChange}><option value="ALL">Todas</option>{CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label className="sc-field">Tipo
                <select name="conceptType" value={filters.conceptType} onChange={handleFilterChange}><option value="ALL">Todos</option>{TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label className="sc-field">Naturaleza
                <select name="salaryNature" value={filters.salaryNature} onChange={handleFilterChange}><option value="ALL">Todas</option>{NATURE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label className="sc-field">Cálculo
                <select name="calculationType" value={filters.calculationType} onChange={handleFilterChange}><option value="ALL">Todos</option>{CALCULATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label className="sc-field">Jornada
                <select name="workday" value={filters.workday} onChange={handleFilterChange}><option value="ALL">Todas</option><option value="true">Proporcional</option><option value="false">Íntegro</option></select>
              </label>
              <label className="sc-field">Cotiza
                <select name="contribution" value={filters.contribution} onChange={handleFilterChange}><option value="ALL">Todos</option><option value="true">Sí</option><option value="false">No</option></select>
              </label>
              <label className="sc-field">Tributa
                <select name="taxable" value={filters.taxable} onChange={handleFilterChange}><option value="ALL">Todos</option><option value="true">Sí</option><option value="false">No</option></select>
              </label>
            </div>
          )}

          <div className="sc-filters__footer">
            <span className="sc-result-info">{filteredConcepts.length} conceptos coinciden con los filtros.</span>
            <div className="sc-actions">
              <button type="button" className="sc-button sc-button--ghost sc-button--small" onClick={() => setAdvancedFilters((value) => !value)}>
                {advancedFilters ? "Ocultar filtros avanzados" : "Más filtros"}
              </button>
              <button type="button" className="sc-button sc-button--ghost sc-button--small" onClick={resetFilters}>Limpiar filtros</button>
            </div>
          </div>
        </div>

        <div className="sc-table-wrap">
          <table className="sc-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Origen / convenio</th>
                <th>Tipo</th>
                <th>Cálculo</th>
                <th>Jornada</th>
                <th>SS / IRPF</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleConcepts.map((concept) => (
                <tr key={concept.id}>
                  <td>
                    <span className="sc-table__primary">{concept.name}</span>
                    <span className="sc-code">{concept.code}</span>
                  </td>
                  <td>
                    <span className={`sc-badge ${sourceBadgeClass(concept.source_type)}`}>{labelFrom(SOURCE_OPTIONS, concept.source_type)}</span>
                    {concept.agreement_id && <span className="sc-table__secondary">{agreementById.get(Number(concept.agreement_id))?.name || `Convenio ${concept.agreement_id}`}</span>}
                  </td>
                  <td>
                    <span className="sc-table__primary">{labelFrom(TYPE_OPTIONS, concept.concept_type)}</span>
                    <span className="sc-table__secondary">{labelFrom(NATURE_OPTIONS, concept.salary_nature)}</span>
                  </td>
                  <td>
                    <span className="sc-table__primary">{labelFrom(CALCULATION_OPTIONS, concept.calculation_type)}</span>
                    <span className="sc-table__secondary">{concept.calculation_type === "UNIT_PRICE" ? `${formatMoney(concept.default_unit_price)} / ud.` : formatMoney(concept.default_amount)}</span>
                  </td>
                  <td>{concept.applies_workday_percentage ? "Proporcional" : "Íntegro"}</td>
                  <td>
                    <span className="sc-table__primary">Cotiza: {concept.is_contribution_base ? "Sí" : "No"}</span>
                    <span className="sc-table__secondary">IRPF: {concept.is_taxable ? "Sí" : "No"}</span>
                  </td>
                  <td><span className={`sc-badge ${concept.is_active ? "sc-badge--active" : "sc-badge--inactive"}`}>{concept.is_active ? "Activo" : "Inactivo"}</span></td>
                  <td>
                    <div className="sc-row-actions">
                      <button type="button" className="sc-button sc-button--secondary sc-button--small" onClick={() => startEdit(concept)}>Editar</button>
                      {concept.is_active && <button type="button" className="sc-button sc-button--danger sc-button--small" onClick={() => handleDeactivate(concept)}>Desactivar</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleConcepts.length && <tr><td colSpan="8" className="sc-empty">No hay conceptos que coincidan con los filtros.</td></tr>}
            </tbody>
          </table>
        </div>

        {filteredConcepts.length > 0 && (
          <div className="sc-selection-bar">
            <div className="sc-selection-bar__summary">
              <strong>{pageStart + 1}–{pageEnd}</strong>
              <span>de {filteredConcepts.length} conceptos · página {page} de {totalPages}</span>
            </div>
            <div className="sc-actions">
              <button type="button" className="sc-button sc-button--secondary sc-button--small" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>Anterior</button>
              <button type="button" className="sc-button sc-button--secondary sc-button--small" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>Siguiente</button>
            </div>
          </div>
        )}
      </PageCard>
    </div>
  );
}
