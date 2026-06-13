import { useEffect, useMemo, useState } from "react";

import {
  createAgreementExtraPay,
  createAgreementExtraPayConcept,
  deleteAgreementExtraPay,
  deleteAgreementExtraPayConcept,
  fetchAgreementExtraPayCandidates,
  fetchAgreementExtraPayPreview,
  fetchAgreementExtraPays,
  updateAgreementExtraPay,
  updateAgreementExtraPayConcept,
} from "../../services/agreementExtraPayApi";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const EMPTY_PAY = {
  id: null,
  name: "",
  code: "",
  payment_month: "7",
  accrual_start_month: "1",
  accrual_end_month: "6",
  accrual_months: "6",
  proration_allowed: true,
  proration_default: false,
  notes: "",
};

const EMPTY_LINE = {
  id: null,
  concept_key: "",
  concept_name: "",
  scope: "general",
  calculation_mode: "percentage",
  percentage: "100",
  fixed_amount: "",
  display_order: "10",
  notes: "",
};

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function monthLabel(value) {
  return MONTHS[Number(value) - 1] || "—";
}

function buildPayForm(pay) {
  if (!pay) return EMPTY_PAY;
  return {
    id: pay.id,
    name: pay.name || "",
    code: pay.code || "",
    payment_month: String(pay.payment_month || 7),
    accrual_start_month: String(pay.accrual_start_month || 1),
    accrual_end_month: String(pay.accrual_end_month || 6),
    accrual_months: String(pay.accrual_months || 6),
    proration_allowed: pay.proration_allowed !== false,
    proration_default: Boolean(pay.proration_default),
    notes: pay.notes || "",
  };
}

export default function AgreementExtraPayPanel({ agreement, onChanged }) {
  const salaryTables = agreement?.salary_tables || [];
  const categories = agreement?.professional_categories || [];
  const defaultTable = salaryTables.find((item) => item.status === "active") || salaryTables[0] || null;

  const [open, setOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [extraPays, setExtraPays] = useState([]);
  const [selectedPayId, setSelectedPayId] = useState("");
  const [payForm, setPayForm] = useState(EMPTY_PAY);
  const [lineForm, setLineForm] = useState(EMPTY_LINE);
  const [candidates, setCandidates] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedTable = useMemo(
    () => salaryTables.find((item) => String(item.id) === String(selectedTableId)) || defaultTable,
    [salaryTables, selectedTableId, defaultTable]
  );
  const selectedCategory = useMemo(
    () => categories.find((item) => String(item.id) === String(selectedCategoryId)) || categories[0] || null,
    [categories, selectedCategoryId]
  );
  const selectedPay = useMemo(
    () => extraPays.find((item) => String(item.id) === String(selectedPayId)) || extraPays[0] || null,
    [extraPays, selectedPayId]
  );

  useEffect(() => {
    setSelectedTableId(defaultTable?.id ? String(defaultTable.id) : "");
    setSelectedCategoryId(categories[0]?.id ? String(categories[0].id) : "");
    setExtraPays([]);
    setSelectedPayId("");
    setPayForm(EMPTY_PAY);
    setLineForm(EMPTY_LINE);
    setPreview(null);
    setCandidates([]);
  }, [agreement?.id]);

  useEffect(() => {
    if (!open || !agreement?.id || !selectedTable?.id) return;
    loadExtraPays();
  }, [open, agreement?.id, selectedTable?.id]);

  useEffect(() => {
    if (!open || !agreement?.id || !selectedTable?.id || !selectedCategory?.id) {
      setCandidates([]);
      return;
    }
    loadCandidates();
  }, [open, agreement?.id, selectedTable?.id, selectedCategory?.id]);

  useEffect(() => {
    setPayForm(buildPayForm(selectedPay));
    setLineForm(EMPTY_LINE);
    setPreview(null);
  }, [selectedPay?.id]);

  async function loadExtraPays(preferredId = null) {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAgreementExtraPays(agreement.id, selectedTable.id);
      setExtraPays(data);
      const nextId = preferredId || selectedPayId || data[0]?.id || "";
      setSelectedPayId(nextId ? String(nextId) : "");
    } catch (err) {
      setError(err.message || "No se pudieron cargar las pagas extraordinarias.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCandidates() {
    try {
      const data = await fetchAgreementExtraPayCandidates(
        agreement.id,
        selectedTable.id,
        selectedCategory.id
      );
      setCandidates(data);
    } catch (err) {
      setCandidates([]);
      setError(err.message || "No se pudieron cargar los conceptos disponibles.");
    }
  }

  async function loadPreview() {
    if (!selectedPay?.id || !selectedCategory?.id || !selectedTable?.id) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchAgreementExtraPayPreview(
        selectedPay.id,
        selectedCategory.id,
        selectedTable.id
      );
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err.message || "No se pudo calcular la paga extraordinaria.");
    } finally {
      setLoading(false);
    }
  }

  function newPay() {
    setSelectedPayId("");
    setPayForm({
      ...EMPTY_PAY,
      payment_month: "7",
      accrual_start_month: "1",
      accrual_end_month: "6",
    });
    setLineForm(EMPTY_LINE);
    setPreview(null);
  }

  async function savePay(event) {
    event.preventDefault();
    if (!selectedTable?.id) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        salary_table_id: Number(selectedTable.id),
        code: payForm.code.trim() || null,
        name: payForm.name.trim(),
        payment_month: Number(payForm.payment_month),
        accrual_start_month: Number(payForm.accrual_start_month),
        accrual_end_month: Number(payForm.accrual_end_month),
        accrual_months: Number(payForm.accrual_months),
        proration_allowed: payForm.proration_allowed,
        proration_default: payForm.proration_allowed && payForm.proration_default,
        is_active: true,
        notes: payForm.notes.trim() || null,
      };
      const saved = payForm.id
        ? await updateAgreementExtraPay(payForm.id, payload)
        : await createAgreementExtraPay(agreement.id, { ...payload, concept_lines: [] });
      setMessage(payForm.id ? "Paga extraordinaria actualizada." : "Paga extraordinaria creada.");
      await loadExtraPays(saved.id);
      await onChanged?.();
    } catch (err) {
      setError(err.message || "No se pudo guardar la paga extraordinaria.");
    } finally {
      setSaving(false);
    }
  }

  async function removePay() {
    if (!selectedPay?.id) return;
    if (!window.confirm(`¿Eliminar ${selectedPay.name} y su configuración de conceptos?`)) return;
    setSaving(true);
    setError("");
    try {
      await deleteAgreementExtraPay(selectedPay.id);
      setMessage("Paga extraordinaria eliminada.");
      setSelectedPayId("");
      await loadExtraPays();
    } catch (err) {
      setError(err.message || "No se pudo eliminar la paga extraordinaria.");
    } finally {
      setSaving(false);
    }
  }

  function selectCandidate(value) {
    const candidate = candidates.find((item) => item.concept_key === value);
    setLineForm((current) => ({
      ...current,
      concept_key: value,
      concept_name: candidate?.name || "",
    }));
  }

  function editLine(line) {
    setLineForm({
      id: line.id,
      concept_key: line.concept_key,
      concept_name: line.concept_name,
      scope: line.professional_category_id ? "category" : "general",
      calculation_mode: line.calculation_mode || "percentage",
      percentage: line.percentage ?? "100",
      fixed_amount: line.fixed_amount ?? "",
      display_order: String(line.display_order || 10),
      notes: line.notes || "",
    });
  }

  async function saveLine(event) {
    event.preventDefault();
    if (!selectedPay?.id || !lineForm.concept_key) {
      setError("Selecciona un concepto para incluir en la paga.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        professional_category_id: lineForm.scope === "category" ? Number(selectedCategory.id) : null,
        concept_key: lineForm.concept_key,
        concept_name: lineForm.concept_name,
        calculation_mode: lineForm.calculation_mode,
        percentage: lineForm.calculation_mode === "percentage" ? Number(lineForm.percentage || 0) : null,
        fixed_amount: lineForm.calculation_mode === "fixed" ? Number(lineForm.fixed_amount || 0) : null,
        is_active: true,
        display_order: Number(lineForm.display_order || 10),
        notes: lineForm.notes.trim() || null,
      };
      if (lineForm.id) await updateAgreementExtraPayConcept(lineForm.id, payload);
      else await createAgreementExtraPayConcept(selectedPay.id, payload);
      setLineForm(EMPTY_LINE);
      setMessage(lineForm.id ? "Participación actualizada." : "Concepto añadido a la paga extraordinaria.");
      await loadExtraPays(selectedPay.id);
      setPreview(null);
    } catch (err) {
      setError(err.message || "No se pudo guardar el concepto de la paga.");
    } finally {
      setSaving(false);
    }
  }

  async function removeLine(line) {
    if (!window.confirm(`¿Excluir ${line.concept_name} de esta paga extraordinaria?`)) return;
    setSaving(true);
    setError("");
    try {
      await deleteAgreementExtraPayConcept(line.id);
      setMessage("Concepto eliminado de la paga extraordinaria.");
      if (lineForm.id === line.id) setLineForm(EMPTY_LINE);
      await loadExtraPays(selectedPay.id);
      setPreview(null);
    } catch (err) {
      setError(err.message || "No se pudo eliminar el concepto de la paga.");
    } finally {
      setSaving(false);
    }
  }

  if (!salaryTables.length) return null;

  return (
    <section style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h3 style={styles.title}>Pagas extraordinarias</h3>
          <p style={styles.subtitle}>Define devengo, abono, prorrateo y conceptos computables por tabla salarial.</p>
        </div>
        <button type="button" onClick={() => setOpen((current) => !current)} style={styles.toggleButton}>
          {open ? "Cerrar" : "Configurar pagas extra"}
        </button>
      </header>

      {open && (
        <div style={styles.body}>
          <div style={styles.filters}>
            <label style={styles.field}>Tabla salarial
              <select value={selectedTable?.id || ""} onChange={(event) => { setSelectedTableId(event.target.value); setSelectedPayId(""); setPreview(null); }} style={styles.input}>
                {salaryTables.map((table) => <option key={table.id} value={table.id}>{table.name} · {table.year || "sin año"}</option>)}
              </select>
            </label>
            <label style={styles.field}>Categoría para configurar y simular
              <select value={selectedCategory?.id || ""} onChange={(event) => { setSelectedCategoryId(event.target.value); setPreview(null); }} style={styles.input}>
                {!categories.length && <option value="">Sin categorías</option>}
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}
          {loading && <div style={styles.notice}>Cargando configuración…</div>}

          <div style={styles.layout}>
            <aside style={styles.payList}>
              <div style={styles.listHeader}><strong>Pagas configuradas</strong><button type="button" onClick={newPay} style={styles.linkButton}>Nueva paga</button></div>
              {extraPays.map((pay) => (
                <button key={pay.id} type="button" onClick={() => setSelectedPayId(String(pay.id))} style={Number(selectedPay?.id) === Number(pay.id) ? styles.payActive : styles.payButton}>
                  <span><strong>{pay.name}</strong><small>Abono: {monthLabel(pay.payment_month)}</small></span>
                  <em>{pay.concept_lines?.length || 0}</em>
                </button>
              ))}
              {!extraPays.length && <div style={styles.emptySmall}>No hay pagas configuradas para esta tabla.</div>}
            </aside>

            <main style={styles.content}>
              <form onSubmit={savePay} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div><h4 style={styles.cardTitle}>{payForm.id ? "Datos de la paga" : "Nueva paga extraordinaria"}</h4><p style={styles.cardSubtitle}>La definición queda vinculada a {selectedTable?.name}.</p></div>
                  {payForm.id && <button type="button" onClick={removePay} style={styles.deleteButton}>Eliminar paga</button>}
                </div>
                <div style={styles.formGrid}>
                  <Field label="Denominación"><input value={payForm.name} onChange={(event) => setPayForm({ ...payForm, name: event.target.value })} style={styles.input} required /></Field>
                  <Field label="Código interno"><input value={payForm.code} onChange={(event) => setPayForm({ ...payForm, code: event.target.value })} style={styles.input} placeholder="PAGA_VERANO" /></Field>
                  <Field label="Mes de abono"><MonthSelect value={payForm.payment_month} onChange={(value) => setPayForm({ ...payForm, payment_month: value })} /></Field>
                  <Field label="Inicio de devengo"><MonthSelect value={payForm.accrual_start_month} onChange={(value) => setPayForm({ ...payForm, accrual_start_month: value })} /></Field>
                  <Field label="Fin de devengo"><MonthSelect value={payForm.accrual_end_month} onChange={(value) => setPayForm({ ...payForm, accrual_end_month: value })} /></Field>
                  <Field label="Meses de devengo"><input type="number" min="1" max="12" value={payForm.accrual_months} onChange={(event) => setPayForm({ ...payForm, accrual_months: event.target.value })} style={styles.input} /></Field>
                  <label style={styles.check}><input type="checkbox" checked={payForm.proration_allowed} onChange={(event) => setPayForm({ ...payForm, proration_allowed: event.target.checked, proration_default: event.target.checked ? payForm.proration_default : false })} />Permite prorrateo</label>
                  <label style={styles.check}><input type="checkbox" disabled={!payForm.proration_allowed} checked={payForm.proration_default} onChange={(event) => setPayForm({ ...payForm, proration_default: event.target.checked })} />Prorrateada por defecto</label>
                  <Field label="Observaciones"><textarea value={payForm.notes} onChange={(event) => setPayForm({ ...payForm, notes: event.target.value })} style={styles.textarea} /></Field>
                  <button type="submit" disabled={saving} style={styles.primaryButton}>{saving ? "Guardando…" : payForm.id ? "Actualizar paga" : "Crear paga"}</button>
                </div>
              </form>

              {selectedPay && (
                <>
                  <section style={styles.card}>
                    <div style={styles.cardHeader}><div><h4 style={styles.cardTitle}>Conceptos que integran {selectedPay.name}</h4><p style={styles.cardSubtitle}>Las reglas específicas de categoría prevalecen sobre las generales.</p></div></div>
                    <div style={styles.tableWrap}>
                      <table style={styles.table}>
                        <thead><tr><th style={styles.th}>Concepto</th><th style={styles.th}>Ámbito</th><th style={styles.th}>Cálculo</th><th style={styles.th}>Valor</th><th style={styles.th}>Acciones</th></tr></thead>
                        <tbody>
                          {(selectedPay.concept_lines || []).map((line) => (
                            <tr key={line.id}>
                              <td style={styles.td}><strong>{line.concept_name}</strong></td>
                              <td style={styles.td}>{line.professional_category_id ? categories.find((item) => item.id === line.professional_category_id)?.name || "Categoría" : "Todas las categorías"}</td>
                              <td style={styles.td}>{line.calculation_mode === "fixed" ? "Importe fijo" : "Porcentaje"}</td>
                              <td style={styles.tdAmount}>{line.calculation_mode === "fixed" ? money(line.fixed_amount) : `${Number(line.percentage || 0).toLocaleString("es-ES")} %`}</td>
                              <td style={styles.td}><button type="button" onClick={() => editLine(line)} style={styles.linkButton}>Editar</button> <button type="button" onClick={() => removeLine(line)} style={styles.deleteLink}>Eliminar</button></td>
                            </tr>
                          ))}
                          {!selectedPay.concept_lines?.length && <tr><td colSpan="5" style={styles.emptyCell}>Todavía no se han incluido conceptos.</td></tr>}
                        </tbody>
                      </table>
                    </div>

                    <form onSubmit={saveLine} style={styles.lineForm}>
                      <Field label="Concepto salarial"><select value={lineForm.concept_key} onChange={(event) => selectCandidate(event.target.value)} style={styles.input} required><option value="">Seleccionar concepto</option>{candidates.map((candidate) => <option key={candidate.concept_key} value={candidate.concept_key}>{candidate.name} · {money(candidate.amount)}</option>)}</select></Field>
                      <Field label="Ámbito"><select value={lineForm.scope} onChange={(event) => setLineForm({ ...lineForm, scope: event.target.value })} style={styles.input}><option value="general">Todas las categorías</option><option value="category">Solo {selectedCategory?.name || "categoría"}</option></select></Field>
                      <Field label="Forma de cómputo"><select value={lineForm.calculation_mode} onChange={(event) => setLineForm({ ...lineForm, calculation_mode: event.target.value })} style={styles.input}><option value="percentage">Porcentaje del concepto</option><option value="fixed">Importe fijo</option></select></Field>
                      {lineForm.calculation_mode === "percentage" ? <Field label="Porcentaje"><input type="number" min="0" max="1000" step="0.01" value={lineForm.percentage} onChange={(event) => setLineForm({ ...lineForm, percentage: event.target.value })} style={styles.input} /></Field> : <Field label="Importe fijo"><input type="number" min="0" step="0.01" value={lineForm.fixed_amount} onChange={(event) => setLineForm({ ...lineForm, fixed_amount: event.target.value })} style={styles.input} /></Field>}
                      <Field label="Orden"><input type="number" min="0" value={lineForm.display_order} onChange={(event) => setLineForm({ ...lineForm, display_order: event.target.value })} style={styles.input} /></Field>
                      <button type="submit" disabled={saving} style={styles.secondaryButton}>{lineForm.id ? "Actualizar participación" : "Añadir a la paga"}</button>
                      {lineForm.id && <button type="button" onClick={() => setLineForm(EMPTY_LINE)} style={styles.linkButton}>Cancelar edición</button>}
                    </form>
                  </section>

                  <section style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div><h4 style={styles.cardTitle}>Vista previa para {selectedCategory?.name || "categoría"}</h4><p style={styles.cardSubtitle}>Importe teórico según la tabla y conceptos configurados.</p></div>
                      <button type="button" onClick={loadPreview} disabled={loading || !selectedCategory} style={styles.previewButton}>Calcular vista previa</button>
                    </div>
                    {preview && (
                      <>
                        <div style={styles.previewStats}>
                          <Stat label="Importe íntegro" value={money(preview.total_amount)} />
                          <Stat label="Prorrata mensual" value={preview.proration_allowed ? money(preview.monthly_proration_amount) : "No permitida"} />
                          <Stat label="Mes de abono" value={monthLabel(preview.payment_month)} />
                          <Stat label="Devengo" value={`${monthLabel(preview.accrual_start_month)} – ${monthLabel(preview.accrual_end_month)}`} />
                        </div>
                        <div style={styles.tableWrap}>
                          <table style={styles.table}>
                            <thead><tr><th style={styles.th}>Concepto</th><th style={styles.th}>Base</th><th style={styles.th}>Regla</th><th style={styles.th}>Computa</th></tr></thead>
                            <tbody>{preview.lines.map((line) => <tr key={line.concept_line_id}><td style={styles.td}><strong>{line.concept_name}</strong>{line.warning && <span style={styles.warningText}>{line.warning}</span>}</td><td style={styles.tdAmount}>{money(line.base_amount)}</td><td style={styles.td}>{line.calculation_mode === "fixed" ? money(line.fixed_amount) : `${Number(line.percentage || 0).toLocaleString("es-ES")} %`}</td><td style={styles.tdAmount}>{money(line.computed_amount)}</td></tr>)}</tbody>
                          </table>
                        </div>
                        {preview.warnings?.length > 0 && <div style={styles.warning}>{preview.warnings.map((item) => <span key={item}>{item}</span>)}</div>}
                      </>
                    )}
                  </section>
                </>
              )}
            </main>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }) {
  return <label style={styles.field}><span>{label}</span>{children}</label>;
}

function MonthSelect({ value, onChange }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} style={styles.input}>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select>;
}

function Stat({ label, value }) {
  return <div style={styles.stat}><span>{label}</span><strong>{value}</strong></div>;
}

const styles = {
  wrapper: { border: "1px solid #d1d5db", background: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 14px", background: "#f9fafb" },
  title: { margin: 0, color: "#111827", fontSize: "15px", fontWeight: 850 },
  subtitle: { margin: "3px 0 0", color: "#6b7280", fontSize: "12px" },
  toggleButton: { height: "32px", border: "1px solid #111827", background: "#111827", color: "#fff", padding: "0 12px", fontSize: "12px", fontWeight: 850, cursor: "pointer" },
  body: { borderTop: "1px solid #e5e7eb", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" },
  filters: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" },
  layout: { display: "grid", gridTemplateColumns: "250px minmax(0, 1fr)", border: "1px solid #e5e7eb", minHeight: "520px" },
  payList: { borderRight: "1px solid #e5e7eb", background: "#f9fafb", padding: "10px", display: "flex", flexDirection: "column", gap: "5px" },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 3px 8px", color: "#374151", fontSize: "12px" },
  payButton: { border: "1px solid transparent", background: "transparent", padding: "9px", display: "flex", justifyContent: "space-between", textAlign: "left", color: "#374151", cursor: "pointer" },
  payActive: { border: "1px solid #eab308", borderLeft: "3px solid #eab308", background: "#fffbeb", padding: "9px", display: "flex", justifyContent: "space-between", textAlign: "left", color: "#111827", cursor: "pointer" },
  content: { minWidth: 0, padding: "12px", display: "flex", flexDirection: "column", gap: "12px" },
  card: { border: "1px solid #e5e7eb", background: "#fff", padding: "12px" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "10px" },
  cardTitle: { margin: 0, color: "#111827", fontSize: "14px", fontWeight: 850 },
  cardSubtitle: { margin: "2px 0 0", color: "#6b7280", fontSize: "11px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "9px", alignItems: "end" },
  lineForm: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "9px", alignItems: "end", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e5e7eb" },
  field: { display: "flex", flexDirection: "column", gap: "5px", color: "#374151", fontSize: "11px", fontWeight: 800 },
  input: { width: "100%", height: "34px", boxSizing: "border-box", border: "1px solid #d1d5db", background: "#fff", padding: "6px 8px", fontSize: "12px" },
  textarea: { width: "100%", minHeight: "62px", boxSizing: "border-box", border: "1px solid #d1d5db", padding: "7px 8px", fontSize: "12px" },
  check: { minHeight: "34px", display: "flex", alignItems: "center", gap: "7px", color: "#374151", fontSize: "11px", fontWeight: 750 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", minWidth: "680px", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "7px", background: "#f9fafb", borderBottom: "1px solid #d1d5db", color: "#374151", fontSize: "10px", fontWeight: 850 },
  td: { padding: "7px", borderBottom: "1px solid #e5e7eb", color: "#374151", fontSize: "11px", verticalAlign: "top" },
  tdAmount: { padding: "7px", borderBottom: "1px solid #e5e7eb", color: "#111827", fontSize: "11px", fontWeight: 850, textAlign: "right" },
  previewStats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px", marginBottom: "10px" },
  stat: { border: "1px solid #e5e7eb", padding: "9px", display: "flex", flexDirection: "column", gap: "2px", color: "#374151", fontSize: "11px" },
  primaryButton: { height: "34px", border: "1px solid #111827", background: "#111827", color: "#fff", padding: "0 13px", fontSize: "12px", fontWeight: 850, cursor: "pointer" },
  secondaryButton: { height: "34px", border: "1px solid #d1d5db", background: "#fff", color: "#374151", padding: "0 11px", fontSize: "11px", fontWeight: 800, cursor: "pointer" },
  previewButton: { height: "32px", border: "1px solid #eab308", background: "#facc15", color: "#111827", padding: "0 11px", fontSize: "11px", fontWeight: 850, cursor: "pointer" },
  linkButton: { border: 0, background: "transparent", padding: 0, color: "#374151", fontSize: "11px", fontWeight: 750, textDecoration: "underline", cursor: "pointer" },
  deleteButton: { border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", height: "30px", padding: "0 9px", fontSize: "11px", fontWeight: 800, cursor: "pointer" },
  deleteLink: { border: 0, background: "transparent", padding: 0, color: "#b91c1c", fontSize: "11px", fontWeight: 750, textDecoration: "underline", cursor: "pointer" },
  notice: { padding: "9px", border: "1px solid #e5e7eb", background: "#f9fafb", color: "#4b5563", fontSize: "11px" },
  error: { padding: "9px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: "11px", fontWeight: 750 },
  success: { padding: "9px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", fontSize: "11px", fontWeight: 750 },
  warning: { padding: "9px", border: "1px solid #fde68a", background: "#fffbeb", color: "#78350f", display: "flex", flexDirection: "column", gap: "3px", fontSize: "11px" },
  warningText: { display: "block", marginTop: "2px", color: "#b45309", fontSize: "9px" },
  emptySmall: { padding: "10px 4px", color: "#6b7280", fontSize: "11px" },
  emptyCell: { padding: "14px 7px", color: "#6b7280", fontSize: "11px" },
};
