import { useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import { fetchCollectiveAgreements } from "../services/collectiveAgreementApi";
import {
  createPayrollConcept,
  deactivatePayrollConcept,
  fetchPayrollConcepts,
  updatePayrollConcept,
} from "../services/payrollApi";

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

const SOURCE_OPTIONS = [
  ["SYSTEM", "Sistema"],
  ["CUSTOM", "Personalizado"],
  ["AGREEMENT", "Convenio"],
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

function getSourceBadgeStyle(sourceType) {
  if (sourceType === "AGREEMENT") return styles.agreementBadge;
  if (sourceType === "CUSTOM") return styles.customBadge;
  return styles.systemBadge;
}

export default function PayrollConceptsPage() {
  const [concepts, setConcepts] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
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
      setConcepts(conceptData || []);
      setAgreements(agreementData || []);
    } catch (err) {
      setError(err.message || "No se han podido cargar los conceptos retributivos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadConcepts(); }, []);

  const agreementById = useMemo(() => {
    return agreements.reduce((acc, agreement) => {
      acc[agreement.id] = agreement;
      return acc;
    }, {});
  }, [agreements]);

  const filteredConcepts = useMemo(() => {
    const query = normalizeText(filters.search);

    return concepts.filter((concept) => {
      const agreementName = concept.agreement_id ? agreementById[concept.agreement_id]?.name : "";
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

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function startEdit(concept) {
    setEditingId(concept.id);
    setForm({
      name: concept.name || "",
      code: concept.code || "",
      category: concept.category || "OTRO",
      concept_type: concept.concept_type || "DEVENGO",
      salary_nature: concept.salary_nature || "SALARIAL",
      source_type: concept.source_type || "CUSTOM",
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
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage("");
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
      resetForm();
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

  const totals = {
    all: concepts.length,
    system: concepts.filter((concept) => concept.source_type === "SYSTEM").length,
    custom: concepts.filter((concept) => concept.source_type === "CUSTOM").length,
    agreement: concepts.filter((concept) => concept.source_type === "AGREEMENT").length,
    filtered: filteredConcepts.length,
  };

  return (
    <div style={styles.wrapper}>
      <PageCard title="Catálogo de conceptos retributivos" subtitle="Conceptos disponibles para nóminas: sistema, personalizados y conceptos de convenio.">
        <div style={styles.kpiGrid}>
          <div style={styles.kpi}><span>Total</span><strong>{totals.all}</strong></div>
          <div style={styles.kpi}><span>Sistema</span><strong>{totals.system}</strong></div>
          <div style={styles.kpi}><span>Personalizados</span><strong>{totals.custom}</strong></div>
          <div style={styles.kpi}><span>Convenio</span><strong>{totals.agreement}</strong></div>
          <div style={styles.kpi}><span>Filtrados</span><strong>{totals.filtered}</strong></div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formHeader}>
            <div>
              <h3 style={styles.formTitle}>{editingId ? "Editar concepto" : "Nuevo concepto"}</h3>
              <p style={styles.formSubtitle}>Define origen, convenio, tributación y forma de cálculo del concepto.</p>
            </div>
            {editingId && <button type="button" onClick={resetForm} style={styles.secondaryButton}>Cancelar edición</button>}
          </div>

          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}

          <div style={styles.formSection}>
            <h4 style={styles.sectionTitle}>Identificación</h4>
            <div style={styles.formGrid}>
              <label style={styles.field}>Nombre<input name="name" value={form.name} onChange={handleChange} style={styles.input} required /></label>
              <label style={styles.field}>Código<input name="code" value={form.code} onChange={handleChange} placeholder="Se genera si lo dejas vacío" style={styles.input} /></label>
              <label style={styles.field}>Origen<select name="source_type" value={form.source_type} onChange={handleChange} style={styles.input}>{SOURCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label style={styles.field}>Convenio<select name="agreement_id" value={form.agreement_id} onChange={handleChange} style={styles.input} disabled={form.source_type !== "AGREEMENT"}>
                <option value="">Sin convenio asociado</option>
                {agreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name}</option>)}
              </select></label>
              <label style={styles.field}>Categoría<select name="category" value={form.category} onChange={handleChange} style={styles.input}>{CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label style={styles.field}>Tipo<select name="concept_type" value={form.concept_type} onChange={handleChange} style={styles.input}>{TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label style={styles.field}>Naturaleza<select name="salary_nature" value={form.salary_nature} onChange={handleChange} style={styles.input}>{NATURE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label style={styles.field}>Orden<input type="number" name="display_order" value={form.display_order} onChange={handleChange} style={styles.input} /></label>
            </div>
          </div>

          <div style={styles.formSectionAlt}>
            <h4 style={styles.sectionTitle}>Cálculo por defecto</h4>
            <div style={styles.formGrid}>
              <label style={styles.field}>Tipo de importe<select name="calculation_type" value={form.calculation_type} onChange={handleChange} style={styles.input}>{CALCULATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label style={styles.field}>Importe íntegro / base<input type="number" step="0.01" name="default_amount" value={form.default_amount} onChange={handleChange} style={styles.input} /></label>
              <label style={styles.field}>Precio por unidad<input type="number" step="0.01" name="default_unit_price" value={form.default_unit_price} onChange={handleChange} style={styles.input} /></label>
              <label style={styles.checkField}><input type="checkbox" name="applies_workday_percentage" checked={form.applies_workday_percentage} onChange={handleChange} /> Aplicar % jornada</label>
            </div>
          </div>

          <div style={styles.flagGrid}>
            <label style={styles.checkField}><input type="checkbox" name="is_taxable" checked={form.is_taxable} onChange={handleChange} /> Tributa IRPF</label>
            <label style={styles.checkField}><input type="checkbox" name="is_contribution_base" checked={form.is_contribution_base} onChange={handleChange} /> Cotiza</label>
            <label style={styles.checkField}><input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} /> Activo</label>
          </div>

          <label style={styles.field}>Notas<textarea name="notes" value={form.notes} onChange={handleChange} style={styles.textarea} /></label>

          <div style={styles.actions}><button type="submit" disabled={submitting} style={styles.primaryButton}>{submitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear concepto"}</button></div>
        </form>
      </PageCard>

      <PageCard title="Conceptos disponibles" subtitle="Listado usado por los desplegables de nómina.">
        <div style={styles.filtersBox}>
          <div style={styles.filtersHeader}>
            <h3 style={styles.filterTitle}>Filtros del catálogo</h3>
            <div style={styles.filterActions}>
              <button type="button" onClick={resetFilters} style={styles.secondaryButton}>Limpiar filtros</button>
              <button type="button" onClick={loadConcepts} style={styles.secondaryButton}>{loading ? "Cargando..." : "Actualizar"}</button>
            </div>
          </div>

          <div style={styles.mainFiltersGrid}>
            <label style={styles.field}>Buscar
              <input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Nombre, código, categoría o convenio" style={styles.input} />
            </label>
            <label style={styles.field}>Convenio
              <select name="agreement" value={filters.agreement} onChange={handleFilterChange} style={styles.input}>
                <option value="ALL">Todos los convenios</option>
                <option value="">Sin convenio asociado</option>
                {agreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name}</option>)}
              </select>
            </label>
            <label style={styles.field}>Origen
              <select name="source" value={filters.source} onChange={handleFilterChange} style={styles.input}>
                <option value="ALL">Todos los orígenes</option>
                {SOURCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <div style={styles.compactFiltersGrid}>
            <label style={styles.field}>Categoría<select name="category" value={filters.category} onChange={handleFilterChange} style={styles.input}><option value="ALL">Todas</option>{CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={styles.field}>Tipo<select name="conceptType" value={filters.conceptType} onChange={handleFilterChange} style={styles.input}><option value="ALL">Todos</option>{TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={styles.field}>Naturaleza<select name="salaryNature" value={filters.salaryNature} onChange={handleFilterChange} style={styles.input}><option value="ALL">Todas</option>{NATURE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={styles.field}>Cálculo<select name="calculationType" value={filters.calculationType} onChange={handleFilterChange} style={styles.input}><option value="ALL">Todos</option>{CALCULATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={styles.field}>Jornada<select name="workday" value={filters.workday} onChange={handleFilterChange} style={styles.input}><option value="ALL">Todas</option><option value="true">Proporcional</option><option value="false">Íntegro</option></select></label>
            <label style={styles.field}>Cotiza<select name="contribution" value={filters.contribution} onChange={handleFilterChange} style={styles.input}><option value="ALL">Todos</option><option value="true">Sí</option><option value="false">No</option></select></label>
            <label style={styles.field}>Tributa<select name="taxable" value={filters.taxable} onChange={handleFilterChange} style={styles.input}><option value="ALL">Todos</option><option value="true">Sí</option><option value="false">No</option></select></label>
            <label style={styles.field}>Estado<select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}><option value="ALL">Todos</option><option value="true">Activo</option><option value="false">Inactivo</option></select></label>
          </div>
        </div>

        <div style={styles.resultInfo}>Mostrando {filteredConcepts.length} de {concepts.length} conceptos.</div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Concepto</th>
                <th style={styles.th}>Origen / convenio</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Cálculo</th>
                <th style={styles.th}>Jornada</th>
                <th style={styles.th}>Cotiza</th>
                <th style={styles.th}>Tributa</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.thActions}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredConcepts.map((concept) => (
                <tr key={concept.id}>
                  <td style={styles.td}><strong>{concept.name}</strong><span style={styles.code}>{concept.code}</span></td>
                  <td style={styles.td}>
                    <span style={getSourceBadgeStyle(concept.source_type)}>{labelFrom(SOURCE_OPTIONS, concept.source_type)}</span>
                    {concept.agreement_id && <span style={styles.code}>{agreementById[concept.agreement_id]?.name || `Convenio ${concept.agreement_id}`}</span>}
                  </td>
                  <td style={styles.td}>{labelFrom(TYPE_OPTIONS, concept.concept_type)}<span style={styles.code}>{labelFrom(NATURE_OPTIONS, concept.salary_nature)}</span></td>
                  <td style={styles.td}>{labelFrom(CALCULATION_OPTIONS, concept.calculation_type)}<span style={styles.code}>{concept.calculation_type === "UNIT_PRICE" ? formatMoney(concept.default_unit_price) + " / ud." : formatMoney(concept.default_amount)}</span></td>
                  <td style={styles.td}>{concept.applies_workday_percentage ? "Proporcional" : "Íntegro"}</td>
                  <td style={styles.td}>{concept.is_contribution_base ? "Sí" : "No"}</td>
                  <td style={styles.td}>{concept.is_taxable ? "Sí" : "No"}</td>
                  <td style={styles.td}>{concept.is_active ? "Activo" : "Inactivo"}</td>
                  <td style={styles.tdActions}>
                    <button type="button" onClick={() => startEdit(concept)} style={styles.smallButton}>Editar</button>
                    {concept.is_active && <button type="button" onClick={() => handleDeactivate(concept)} style={styles.dangerButton}>Desactivar</button>}
                  </td>
                </tr>
              ))}
              {filteredConcepts.length === 0 && <tr><td colSpan="9" style={styles.td}>No hay conceptos con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </PageCard>
    </div>
  );
}

const badge = { display: "inline-block", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 900 };

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "12px", marginBottom: "18px" },
  kpi: { border: "2px solid #111827", borderRadius: "12px", padding: "12px", backgroundColor: "#fffdf0", display: "flex", justifyContent: "space-between", fontWeight: 900 },
  form: { border: "2px solid #111827", borderRadius: "14px", padding: "16px", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #e6d85c" },
  formHeader: { display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "14px" },
  formTitle: { margin: 0, fontSize: "18px", fontWeight: 900 },
  formSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  formSection: { marginBottom: "14px" },
  formSectionAlt: { marginBottom: "14px", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px", backgroundColor: "#fffdf0" },
  sectionTitle: { margin: "0 0 10px", fontSize: "14px", fontWeight: 900, color: "#111827" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px", alignItems: "end" },
  flagGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", marginBottom: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px", fontWeight: 900, color: "#374151" },
  checkField: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 900, minHeight: "40px" },
  input: { border: "2px solid #d1d5db", borderRadius: "8px", padding: "9px", fontWeight: 700, minWidth: 0, width: "100%", boxSizing: "border-box" },
  textarea: { border: "2px solid #d1d5db", borderRadius: "8px", padding: "9px", fontWeight: 700, minHeight: "70px" },
  actions: { display: "flex", justifyContent: "flex-end", marginTop: "14px" },
  primaryButton: { backgroundColor: "#111827", color: "#ffffff", border: "2px solid #111827", borderRadius: "8px", padding: "9px 16px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { backgroundColor: "#ffffff", color: "#111827", border: "2px solid #111827", borderRadius: "8px", padding: "8px 12px", fontWeight: 900, cursor: "pointer" },
  smallButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "7px 10px", fontWeight: 800, cursor: "pointer" },
  dangerButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #991b1b", borderRadius: "8px", padding: "7px 10px", fontWeight: 800, cursor: "pointer" },
  filtersBox: { border: "2px solid #111827", borderRadius: "14px", padding: "14px", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #e6d85c", marginBottom: "14px" },
  filtersHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "12px" },
  filterTitle: { margin: 0, fontSize: "16px", fontWeight: 900, color: "#111827" },
  filterActions: { display: "flex", gap: "8px", alignItems: "center" },
  mainFiltersGrid: { display: "grid", gridTemplateColumns: "1.5fr 1.2fr 220px", gap: "12px", marginBottom: "12px" },
  compactFiltersGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" },
  resultInfo: { marginBottom: "12px", color: "#6b7280", fontSize: "13px", fontWeight: 800 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "1180px" },
  th: { textAlign: "left", padding: "10px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", fontSize: "12px" },
  thActions: { width: "170px", textAlign: "left", padding: "10px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", fontSize: "12px" },
  td: { padding: "10px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
  tdActions: { padding: "10px", borderBottom: "1px solid #e5e7eb", display: "flex", gap: "8px" },
  code: { display: "block", marginTop: "3px", color: "#6b7280", fontSize: "11px", fontWeight: 800 },
  systemBadge: { ...badge, backgroundColor: "#dbeafe", color: "#1e40af" },
  customBadge: { ...badge, backgroundColor: "#dcfce7", color: "#166534" },
  agreementBadge: { ...badge, backgroundColor: "#fef3c7", color: "#92400e" },
  error: { marginBottom: "12px", padding: "10px", borderRadius: "10px", border: "1px solid #fecaca", backgroundColor: "#fef2f2", color: "#991b1b", fontWeight: 800 },
  success: { marginBottom: "12px", padding: "10px", borderRadius: "10px", border: "1px solid #bbf7d0", backgroundColor: "#f0fdf4", color: "#166534", fontWeight: 800 },
};
