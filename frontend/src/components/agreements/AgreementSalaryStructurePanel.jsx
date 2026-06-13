import { useEffect, useMemo, useState } from "react";

import {
  createAgreementSalaryConcept,
  deleteAgreementSalaryConcept,
  fetchAgreementParameterization,
  updateAgreementSalaryConcept,
} from "../../services/collectiveAgreementApi";

const EMPTY_FORM = {
  id: null,
  salary_table_id: "",
  professional_category_id: "",
  concept_catalog_id: "",
  character: "salarial",
  name: "",
  amount: "",
  payment_type: "mensual",
  calculation_type: "importe_fijo",
  contributes: true,
  taxable: true,
  cra_code: "",
  notes: "",
};

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function characterLabel(value) {
  if (value === "no_salarial") return "No salarial";
  if (value === "deduccion") return "Deducción";
  return "Salarial";
}

function paymentLabel(value) {
  const labels = {
    mensual: "Mensual",
    anual: "Anual",
    diario: "Diario",
    paga_extra: "Paga extra",
    unidad: "Por unidad",
    unico: "Pago único",
  };
  return labels[value] || value || "—";
}

function calculationLabel(value) {
  const labels = {
    importe_fijo: "Importe fijo",
    porcentaje: "Porcentaje",
    unidad: "Por unidad",
    manual: "Manual",
    sin_definir: "Sin definir",
  };
  return labels[value] || value || "—";
}

function normalizedName(value) {
  return String(value || "").toLocaleLowerCase("es-ES").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_");
}

export default function AgreementSalaryStructurePanel({ agreement }) {
  const categories = agreement?.professional_categories || [];
  const salaryTables = agreement?.salary_tables || [];
  const [parameterization, setParameterization] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedTable = useMemo(() => {
    return salaryTables.find((item) => String(item.id) === String(selectedTableId)) || salaryTables.find((item) => item.status === "active") || salaryTables[0] || null;
  }, [salaryTables, selectedTableId]);

  const selectedCategory = useMemo(() => {
    return categories.find((item) => String(item.id) === String(selectedCategoryId)) || null;
  }, [categories, selectedCategoryId]);

  const selectedRow = useMemo(() => {
    if (!selectedTable || !selectedCategory) return null;
    return (selectedTable.rows || []).find((row) => Number(row.professional_category_id) === Number(selectedCategory.id)) || null;
  }, [selectedTable, selectedCategory]);

  const concepts = parameterization?.salary_concepts || [];
  const catalog = parameterization?.concept_catalog || [];

  const tableConcepts = useMemo(() => {
    if (!selectedTable) return [];
    return concepts
      .filter((item) => item.is_active !== false)
      .filter((item) => item.salary_table_id == null || Number(item.salary_table_id) === Number(selectedTable.id));
  }, [concepts, selectedTable]);

  const visibleConcepts = useMemo(() => {
    return tableConcepts
      .filter((item) => selectedCategory
        ? item.professional_category_id == null || Number(item.professional_category_id) === Number(selectedCategory.id)
        : item.professional_category_id == null)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));
  }, [tableConcepts, selectedCategory]);

  const conceptCountByCategory = useMemo(() => {
    const generalCount = tableConcepts.filter((item) => item.professional_category_id == null).length;
    const counts = { general: generalCount };
    categories.forEach((category) => { counts[String(category.id)] = generalCount; });
    tableConcepts.forEach((item) => {
      if (item.professional_category_id == null) return;
      const key = String(item.professional_category_id);
      counts[key] = (counts[key] || generalCount) + 1;
    });
    return counts;
  }, [tableConcepts, categories]);

  const totals = useMemo(() => {
    return visibleConcepts.reduce((result, item) => {
      const amount = Number(item.amount || 0);
      if (item.character === "deduccion") result.deductions += amount;
      else if (item.character === "no_salarial") result.nonSalary += amount;
      else result.salary += amount;
      return result;
    }, { salary: 0, nonSalary: 0, deductions: 0 });
  }, [visibleConcepts]);

  async function load() {
    if (!agreement?.id) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchAgreementParameterization(agreement.id);
      setParameterization(data);
    } catch (err) {
      setError(err.message || "No se pudo cargar la estructura salarial.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelectedTableId("");
    setSelectedCategoryId("");
    setForm(EMPTY_FORM);
    setMessage("");
    load();
  }, [agreement?.id, salaryTables.length]);

  useEffect(() => {
    if (!selectedTable?.id) return;
    setSelectedTableId(String(selectedTable.id));
    setForm((current) => ({
      ...current,
      id: null,
      salary_table_id: String(selectedTable.id),
      professional_category_id: selectedCategory ? String(selectedCategory.id) : "",
    }));
  }, [selectedTable?.id, selectedCategory?.id]);

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      salary_table_id: selectedTable?.id ? String(selectedTable.id) : "",
      professional_category_id: selectedCategory?.id ? String(selectedCategory.id) : "",
    });
  }

  function selectCatalogItem(value) {
    const item = catalog.find((entry) => String(entry.id) === String(value));
    if (!item) {
      setForm((current) => ({ ...current, concept_catalog_id: "" }));
      return;
    }
    setForm((current) => ({
      ...current,
      concept_catalog_id: String(item.id),
      name: current.name || item.name || "",
      character: item.catalog_type === "deduction" ? "deduccion" : item.catalog_type === "non_salary" ? "no_salarial" : "salarial",
      payment_type: item.default_payment_type || current.payment_type,
      calculation_type: item.default_calculation_type || current.calculation_type,
      contributes: item.default_contributes ?? current.contributes,
      taxable: item.default_taxable ?? current.taxable,
      cra_code: item.default_cra_code || current.cra_code,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedTable?.id) {
      setError("Selecciona una tabla salarial.");
      return;
    }
    if (!form.name.trim()) {
      setError("Indica la denominación del concepto.");
      return;
    }

    const tableId = form.id
      ? (form.salary_table_id ? Number(form.salary_table_id) : null)
      : Number(selectedTable.id);
    const categoryId = form.id
      ? (form.professional_category_id ? Number(form.professional_category_id) : null)
      : (selectedCategory ? Number(selectedCategory.id) : null);

    const payload = {
      salary_table_id: tableId,
      professional_category_id: categoryId,
      concept_catalog_id: form.concept_catalog_id ? Number(form.concept_catalog_id) : null,
      character: form.character,
      name: form.name.trim(),
      scope: categoryId ? "specific" : "global",
      amount: numberOrNull(form.amount),
      payment_type: form.payment_type || null,
      calculation_type: form.calculation_type,
      contributes: Boolean(form.contributes),
      taxable: Boolean(form.taxable),
      cra_code: form.cra_code.trim() || null,
      is_active: true,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (form.id) await updateAgreementSalaryConcept(form.id, payload);
      else await createAgreementSalaryConcept(agreement.id, payload);
      setMessage(form.id ? "Concepto salarial actualizado." : "Concepto salarial añadido.");
      resetForm();
      await load();
    } catch (err) {
      setError(err.message || "No se pudo guardar el concepto salarial.");
    } finally {
      setSaving(false);
    }
  }

  function editConcept(item) {
    setForm({
      id: item.id,
      salary_table_id: item.salary_table_id || "",
      professional_category_id: item.professional_category_id || "",
      concept_catalog_id: item.concept_catalog_id || "",
      character: item.character || "salarial",
      name: item.name || "",
      amount: item.amount ?? "",
      payment_type: item.payment_type || "mensual",
      calculation_type: item.calculation_type || "importe_fijo",
      contributes: item.contributes !== false,
      taxable: item.taxable !== false,
      cra_code: item.cra_code || "",
      notes: item.notes || "",
    });
  }

  async function removeConcept(item) {
    if (!window.confirm(`¿Eliminar el concepto ${item.name}?`)) return;
    setSaving(true);
    setError("");
    try {
      await deleteAgreementSalaryConcept(item.id);
      setMessage("Concepto salarial eliminado.");
      if (form.id === item.id) resetForm();
      await load();
    } catch (err) {
      setError(err.message || "No se pudo eliminar el concepto salarial.");
    } finally {
      setSaving(false);
    }
  }

  async function importSalaryRow() {
    if (!selectedTable || !selectedCategory || !selectedRow) {
      setError("La categoría seleccionada no tiene una fila en esta tabla salarial.");
      return;
    }

    const candidates = [
      ["Salario base", selectedRow.base_salary],
      ["Plus convenio", selectedRow.agreement_plus],
      ["Antigüedad", selectedRow.seniority_amount],
      ["Complemento específico", selectedRow.specific_complement],
    ].filter(([, amount]) => amount !== null && amount !== undefined && Number(amount) !== 0);

    const existingNames = new Set(
      concepts
        .filter((item) => Number(item.salary_table_id) === Number(selectedTable.id))
        .filter((item) => Number(item.professional_category_id) === Number(selectedCategory.id))
        .map((item) => normalizedName(item.name))
    );
    const pending = candidates.filter(([name]) => !existingNames.has(normalizedName(name)));
    if (!pending.length) {
      setMessage("La fila salarial ya está representada mediante conceptos editables.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      for (const [name, amount] of pending) {
        await createAgreementSalaryConcept(agreement.id, {
          salary_table_id: Number(selectedTable.id),
          professional_category_id: Number(selectedCategory.id),
          concept_catalog_id: null,
          character: "salarial",
          name,
          scope: "specific",
          amount: Number(amount),
          payment_type: selectedTable.amount_type === "annual" ? "anual" : "mensual",
          calculation_type: "importe_fijo",
          contributes: true,
          taxable: true,
          cra_code: null,
          is_active: true,
          notes: "Concepto creado desde la fila salarial histórica.",
        });
      }
      setMessage(`${pending.length} conceptos creados desde la fila salarial.`);
      await load();
    } catch (err) {
      setError(err.message || "No se pudo convertir la fila salarial.");
    } finally {
      setSaving(false);
    }
  }

  if (!salaryTables.length) {
    return <section style={styles.empty}><strong>Sin tablas salariales.</strong><span>Crea primero una tabla anual desde Gestión del convenio.</span></section>;
  }

  return (
    <section style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h3 style={styles.title}>Estructura salarial</h3>
          <p style={styles.subtitle}>Conceptos por tabla anual y categoría profesional.</p>
        </div>
        <label style={styles.tableSelector}>Tabla salarial
          <select value={selectedTable?.id || ""} onChange={(event) => setSelectedTableId(event.target.value)} style={styles.select}>
            {salaryTables.map((table) => <option key={table.id} value={table.id}>{table.name} · {table.year || "sin año"} · {table.status || "sin estado"}</option>)}
          </select>
        </label>
      </header>

      {loading && <Feedback>Cargando estructura salarial…</Feedback>}
      {error && <Feedback error>{error}</Feedback>}
      {message && <Feedback success>{message}</Feedback>}

      <div style={styles.layout}>
        <aside style={styles.categoryPane}>
          <div style={styles.paneHeader}><strong>Categorías</strong><span>{categories.length} registradas</span></div>
          <button type="button" onClick={() => setSelectedCategoryId("")} style={!selectedCategory ? styles.categoryActive : styles.categoryButton}>
            <span>Aplicación general</span><small>{conceptCountByCategory.general || 0}</small>
          </button>
          {categories.map((category) => (
            <button key={category.id} type="button" onClick={() => setSelectedCategoryId(String(category.id))} style={Number(selectedCategory?.id) === Number(category.id) ? styles.categoryActive : styles.categoryButton}>
              <span><strong>{category.name}</strong><em>{category.code || category.level || "Sin código"}</em></span>
              <small>{conceptCountByCategory[String(category.id)] || 0}</small>
            </button>
          ))}
        </aside>

        <main style={styles.detailPane}>
          <section style={styles.categoryHeader}>
            <div>
              <span style={styles.eyebrow}>{selectedTable?.name}</span>
              <h4 style={styles.categoryTitle}>{selectedCategory?.name || "Conceptos generales del convenio"}</h4>
              <p style={styles.categorySubtitle}>{selectedCategory ? "Conceptos generales y específicos aplicables a esta categoría." : "Conceptos aplicables a todas las categorías de la tabla."}</p>
            </div>
            {selectedCategory && <button type="button" onClick={importSalaryRow} disabled={saving || !selectedRow} style={selectedRow ? styles.secondaryButton : styles.disabledButton}>Crear desde fila salarial</button>}
          </section>

          {selectedCategory && <SalaryRowSummary row={selectedRow} table={selectedTable} />}

          <div style={styles.stats}>
            <Stat label="Salariales" value={money(totals.salary)} />
            <Stat label="No salariales" value={money(totals.nonSalary)} />
            <Stat label="Deducciones" value={money(totals.deductions)} />
            <Stat label="Conceptos aplicables" value={visibleConcepts.length} />
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>Concepto</th><th style={styles.th}>Carácter</th><th style={styles.th}>Importe</th><th style={styles.th}>Pago</th><th style={styles.th}>Cálculo</th><th style={styles.th}>Cotiza</th><th style={styles.th}>IRPF</th><th style={styles.th}>CRA</th><th style={styles.th}>Acciones</th></tr></thead>
              <tbody>
                {visibleConcepts.map((item) => <tr key={item.id}><td style={styles.td}><strong>{item.name}</strong>{item.professional_category_id == null && <span style={styles.generalBadge}>Aplicación general</span>}{item.salary_table_id == null && <span style={styles.generalBadge}>Sin versión anual</span>}</td><td style={styles.td}>{characterLabel(item.character)}</td><td style={styles.tdAmount}>{money(item.amount)}</td><td style={styles.td}>{paymentLabel(item.payment_type)}</td><td style={styles.td}>{calculationLabel(item.calculation_type)}</td><td style={styles.td}>{item.contributes ? "Sí" : "No"}</td><td style={styles.td}>{item.taxable ? "Sí" : "No"}</td><td style={styles.td}>{item.cra_code || "—"}</td><td style={styles.td}><div style={styles.actions}><button type="button" onClick={() => editConcept(item)} style={styles.linkButton}>Editar</button><button type="button" onClick={() => removeConcept(item)} style={styles.deleteButton}>Eliminar</button></div></td></tr>)}
                {!visibleConcepts.length && <tr><td colSpan="9" style={styles.emptyCell}>No hay conceptos para esta tabla y categoría.</td></tr>}
              </tbody>
            </table>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formHeader}><h5>{form.id ? "Editar concepto salarial" : "Nuevo concepto salarial"}</h5>{form.id && <button type="button" onClick={resetForm} style={styles.linkButton}>Cancelar edición</button>}</div>
            <div style={styles.formGrid}>
              <Field label="Catálogo opcional"><select value={form.concept_catalog_id} onChange={(event) => selectCatalogItem(event.target.value)} style={styles.input}><option value="">Concepto manual</option>{catalog.filter((item) => item.is_active !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="Denominación"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} style={styles.input} required /></Field>
              <Field label="Carácter"><select value={form.character} onChange={(event) => setForm({ ...form, character: event.target.value })} style={styles.input}><option value="salarial">Salarial</option><option value="no_salarial">No salarial</option><option value="deduccion">Deducción</option></select></Field>
              <Field label="Importe o valor"><input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} style={styles.input} /></Field>
              <Field label="Forma de pago"><select value={form.payment_type} onChange={(event) => setForm({ ...form, payment_type: event.target.value })} style={styles.input}><option value="mensual">Mensual</option><option value="anual">Anual</option><option value="diario">Diario</option><option value="paga_extra">Paga extra</option><option value="unidad">Por unidad</option><option value="unico">Pago único</option></select></Field>
              <Field label="Forma de cálculo"><select value={form.calculation_type} onChange={(event) => setForm({ ...form, calculation_type: event.target.value })} style={styles.input}><option value="importe_fijo">Importe fijo</option><option value="porcentaje">Porcentaje</option><option value="unidad">Por unidad</option><option value="manual">Manual</option><option value="sin_definir">Sin definir</option></select></Field>
              <Field label="Código CRA"><input value={form.cra_code} onChange={(event) => setForm({ ...form, cra_code: event.target.value })} style={styles.input} /></Field>
              <label style={styles.check}><input type="checkbox" checked={form.contributes} onChange={(event) => setForm({ ...form, contributes: event.target.checked })} />Cotiza</label>
              <label style={styles.check}><input type="checkbox" checked={form.taxable} onChange={(event) => setForm({ ...form, taxable: event.target.checked })} />Tributa en IRPF</label>
              <Field label="Observaciones"><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} style={styles.textarea} /></Field>
              <button type="submit" disabled={saving} style={styles.primaryButton}>{saving ? "Guardando…" : form.id ? "Actualizar concepto" : "Añadir concepto"}</button>
            </div>
          </form>
        </main>
      </div>
    </section>
  );
}

function SalaryRowSummary({ row, table }) {
  if (!row) return <div style={styles.rowWarning}>La categoría no tiene una fila salarial en {table?.name}. Puedes crear conceptos manualmente o volver a Gestión del convenio para añadirla.</div>;
  return <section style={styles.rowSummary}><RowValue label="Salario base" value={money(row.base_salary)} /><RowValue label="Plus convenio" value={money(row.agreement_plus)} /><RowValue label="Antigüedad" value={money(row.seniority_amount)} /><RowValue label="Complemento específico" value={money(row.specific_complement)} /><RowValue label="Total fila" value={money(row.total_amount)} /></section>;
}

function RowValue({ label, value }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Stat({ label, value }) { return <div style={styles.stat}><strong>{value}</strong><span>{label}</span></div>; }
function Field({ label, children }) { return <label style={styles.field}><span>{label}</span>{children}</label>; }
function Feedback({ children, error, success }) { return <div style={{ ...styles.feedback, ...(error ? styles.feedbackError : success ? styles.feedbackSuccess : {}) }}>{children}</div>; }

const styles = {
  wrapper: { border: "1px solid #e5e7eb", background: "#fff" },
  header: { display: "grid", gridTemplateColumns: "minmax(240px, 1fr) minmax(300px, 480px)", gap: "16px", alignItems: "end", padding: "12px 14px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" },
  title: { margin: 0, fontSize: "17px", fontWeight: 850, color: "#111827" },
  subtitle: { margin: "3px 0 0", color: "#6b7280", fontSize: "12px" },
  tableSelector: { display: "flex", flexDirection: "column", gap: "5px", color: "#374151", fontSize: "12px", fontWeight: 800 },
  select: { width: "100%", height: "36px", border: "1px solid #d1d5db", background: "#fff", padding: "6px 8px", fontSize: "13px" },
  layout: { display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", minHeight: "600px" },
  categoryPane: { borderRight: "1px solid #e5e7eb", background: "#f9fafb", padding: "10px", display: "flex", flexDirection: "column", gap: "5px" },
  paneHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 4px 9px", color: "#374151", fontSize: "12px" },
  categoryButton: { width: "100%", border: "1px solid transparent", background: "transparent", padding: "9px", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", color: "#374151", cursor: "pointer" },
  categoryActive: { width: "100%", border: "1px solid #eab308", borderLeft: "3px solid #eab308", background: "#fffbeb", padding: "9px", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", color: "#111827", cursor: "pointer" },
  detailPane: { padding: "14px", minWidth: 0 },
  categoryHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "12px" },
  eyebrow: { color: "#6b7280", fontSize: "10px", fontWeight: 850, textTransform: "uppercase", letterSpacing: ".05em" },
  categoryTitle: { margin: "2px 0", fontSize: "17px", fontWeight: 850 },
  categorySubtitle: { margin: 0, color: "#6b7280", fontSize: "12px" },
  rowSummary: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", marginBottom: "12px", padding: "10px", border: "1px solid #e5e7eb", background: "#f9fafb" },
  rowWarning: { marginBottom: "12px", padding: "10px", border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", fontSize: "12px", fontWeight: 700 },
  stats: { display: "grid", gridTemplateColumns: "repeat(4, minmax(110px, 1fr))", gap: "8px", marginBottom: "12px" },
  stat: { border: "1px solid #e5e7eb", padding: "9px", display: "flex", flexDirection: "column", gap: "2px" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", minWidth: "980px", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "8px", background: "#f9fafb", borderBottom: "1px solid #d1d5db", color: "#374151", fontSize: "11px", fontWeight: 850 },
  td: { padding: "8px", borderBottom: "1px solid #e5e7eb", color: "#374151", fontSize: "12px", verticalAlign: "top" },
  tdAmount: { padding: "8px", borderBottom: "1px solid #e5e7eb", color: "#111827", fontSize: "12px", fontWeight: 850, textAlign: "right" },
  emptyCell: { padding: "16px 8px", color: "#6b7280", fontSize: "12px" },
  generalBadge: { display: "block", marginTop: "3px", color: "#92400e", fontSize: "10px", fontWeight: 750 },
  actions: { display: "flex", gap: "8px" },
  linkButton: { border: 0, background: "transparent", padding: 0, color: "#374151", fontSize: "12px", fontWeight: 750, cursor: "pointer", textDecoration: "underline" },
  deleteButton: { border: 0, background: "transparent", padding: 0, color: "#b91c1c", fontSize: "12px", fontWeight: 750, cursor: "pointer", textDecoration: "underline" },
  form: { marginTop: "16px", borderTop: "1px solid #d1d5db", paddingTop: "12px" },
  formHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px", alignItems: "end" },
  field: { display: "flex", flexDirection: "column", gap: "5px", color: "#374151", fontSize: "12px", fontWeight: 750, minWidth: 0 },
  input: { width: "100%", height: "34px", boxSizing: "border-box", border: "1px solid #d1d5db", background: "#fff", padding: "6px 8px", fontSize: "12px" },
  textarea: { width: "100%", minHeight: "64px", boxSizing: "border-box", border: "1px solid #d1d5db", background: "#fff", padding: "7px 8px", fontSize: "12px" },
  check: { minHeight: "34px", display: "flex", alignItems: "center", gap: "7px", color: "#374151", fontSize: "12px", fontWeight: 750 },
  primaryButton: { height: "34px", border: "1px solid #111827", background: "#111827", color: "#fff", padding: "0 13px", fontSize: "12px", fontWeight: 850, cursor: "pointer" },
  secondaryButton: { height: "32px", border: "1px solid #d1d5db", background: "#fff", color: "#374151", padding: "0 11px", fontSize: "12px", fontWeight: 800, cursor: "pointer" },
  disabledButton: { height: "32px", border: "1px solid #e5e7eb", background: "#f3f4f6", color: "#9ca3af", padding: "0 11px", fontSize: "12px", fontWeight: 800, cursor: "not-allowed" },
  feedback: { margin: "10px 14px 0", padding: "9px 10px", border: "1px solid #d1d5db", background: "#f9fafb", color: "#374151", fontSize: "12px", fontWeight: 750 },
  feedbackError: { borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b" },
  feedbackSuccess: { borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" },
  empty: { border: "1px solid #e5e7eb", background: "#fff", padding: "18px", display: "flex", flexDirection: "column", gap: "4px", color: "#4b5563" },
};
