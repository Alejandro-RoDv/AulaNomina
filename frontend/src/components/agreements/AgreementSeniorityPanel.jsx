import { useEffect, useMemo, useState } from "react";

import {
  createAgreementSeniorityRule,
  deactivateAgreementSeniorityRule,
  fetchAgreementSeniorityPreview,
  fetchAgreementSeniorityRules,
  updateAgreementSeniorityRule,
} from "../../services/collectiveAgreementApi";

const EMPTY_FORM = {
  id: null,
  salary_table_id: "",
  professional_category_id: "",
  code: "ANT",
  name: "Antigüedad",
  module_years: "3",
  calculation_mode: "table_amount",
  fixed_amount: "",
  percentage: "",
  percentage_base: "salary_base",
  max_modules: "",
  applies_partiality: true,
  daily_proration_on_maturity: true,
  contributes: true,
  taxable: true,
  affects_extra_payments: true,
  effective_from: "",
  effective_to: "",
  is_active: true,
  display_order: 10,
  notes: "",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function money(value) {
  return Number(value || 0).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function dateLabel(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function calculationLabel(rule) {
  if (rule.calculation_mode === "fixed_amount") return `${money(rule.fixed_amount)} por módulo`;
  if (rule.calculation_mode === "percentage") return `${Number(rule.percentage || 0).toLocaleString("es-ES")} % del salario base`;
  return "Importe de la fila salarial";
}

function cleanPayload(form) {
  return {
    salary_table_id: form.salary_table_id ? Number(form.salary_table_id) : null,
    professional_category_id: form.professional_category_id ? Number(form.professional_category_id) : null,
    code: form.code || "ANT",
    name: form.name || "Antigüedad",
    module_years: Number(form.module_years || 3),
    calculation_mode: form.calculation_mode,
    fixed_amount: form.calculation_mode === "fixed_amount" && form.fixed_amount !== "" ? Number(form.fixed_amount) : null,
    percentage: form.calculation_mode === "percentage" && form.percentage !== "" ? Number(form.percentage) : null,
    percentage_base: "salary_base",
    max_modules: form.max_modules ? Number(form.max_modules) : null,
    applies_partiality: form.applies_partiality,
    daily_proration_on_maturity: form.daily_proration_on_maturity,
    contributes: form.contributes,
    taxable: form.taxable,
    affects_extra_payments: form.affects_extra_payments,
    effective_from: form.effective_from || null,
    effective_to: form.effective_to || null,
    is_active: form.is_active,
    display_order: Number(form.display_order || 10),
    notes: form.notes || null,
  };
}

export default function AgreementSeniorityPanel({ agreement, onChanged }) {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [previewDate, setPreviewDate] = useState(todayIso());
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const tables = agreement?.salary_tables || [];
  const categories = agreement?.professional_categories || [];

  const activeRules = useMemo(() => rules.filter((rule) => rule.is_active), [rules]);

  async function loadRules(showLoading = true) {
    if (!agreement?.id) return;
    if (showLoading) setLoading(true);
    setError("");
    try {
      setRules(await fetchAgreementSeniorityRules(agreement.id, true));
    } catch (err) {
      setError(err.message || "No se pudieron cargar las reglas de antigüedad.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRules();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreement?.id]);

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (form.effective_from && form.effective_to && form.effective_to < form.effective_from) {
      setError("La fecha final no puede ser anterior a la fecha inicial.");
      return;
    }
    try {
      setSaving(true);
      const payload = cleanPayload(form);
      if (form.id) {
        await updateAgreementSeniorityRule(form.id, payload);
        setMessage("Regla de antigüedad actualizada.");
      } else {
        await createAgreementSeniorityRule(agreement.id, payload);
        setMessage("Regla de antigüedad creada.");
      }
      setForm(EMPTY_FORM);
      setFormOpen(false);
      setPreview(null);
      await loadRules(false);
      await onChanged?.();
    } catch (err) {
      setError(err.message || "No se pudo guardar la regla de antigüedad.");
    } finally {
      setSaving(false);
    }
  }

  function editRule(rule) {
    setForm({
      ...EMPTY_FORM,
      ...rule,
      salary_table_id: rule.salary_table_id ? String(rule.salary_table_id) : "",
      professional_category_id: rule.professional_category_id ? String(rule.professional_category_id) : "",
      module_years: String(rule.module_years || 3),
      fixed_amount: rule.fixed_amount ?? "",
      percentage: rule.percentage ?? "",
      max_modules: rule.max_modules ?? "",
      effective_from: rule.effective_from || "",
      effective_to: rule.effective_to || "",
      notes: rule.notes || "",
    });
    setFormOpen(true);
    setMessage("");
  }

  async function deactivateRule(rule) {
    if (!window.confirm(`¿Desactivar la regla “${rule.name}”?`)) return;
    setError("");
    try {
      await deactivateAgreementSeniorityRule(rule.id);
      setMessage("Regla de antigüedad desactivada.");
      setPreview(null);
      await loadRules(false);
      await onChanged?.();
    } catch (err) {
      setError(err.message || "No se pudo desactivar la regla.");
    }
  }

  async function refreshPreview() {
    setLoading(true);
    setError("");
    try {
      setPreview(await fetchAgreementSeniorityPreview(agreement.id, previewDate));
    } catch (err) {
      setError(err.message || "No se pudo calcular la vista previa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h3 style={styles.title}>Antigüedad y vencimientos</h3>
          <p style={styles.subtitle}>Define trienios, quinquenios u otros módulos y revisa su aplicación real por contrato.</p>
        </div>
        <button type="button" onClick={() => { setForm(EMPTY_FORM); setFormOpen((value) => !value); }} style={styles.primaryButton}>
          {formOpen ? "Cerrar formulario" : "Nueva regla"}
        </button>
      </header>

      {(error || message) && <div style={error ? styles.error : styles.success}>{error || message}</div>}

      {formOpen && (
        <form onSubmit={handleSave} style={styles.form}>
          <div style={styles.formTitle}>{form.id ? "Editar regla de antigüedad" : "Nueva regla de antigüedad"}</div>
          <div style={styles.formGrid}>
            <Field label="Denominación"><input style={styles.input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <Field label="Código"><input style={styles.input} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required /></Field>
            <Field label="Tabla salarial">
              <select style={styles.input} value={form.salary_table_id} onChange={(event) => setForm({ ...form, salary_table_id: event.target.value })}>
                <option value="">Todas las tablas</option>
                {tables.map((table) => <option key={table.id} value={table.id}>{table.name} · {table.year || "sin año"}</option>)}
              </select>
            </Field>
            <Field label="Categoría profesional">
              <select style={styles.input} value={form.professional_category_id} onChange={(event) => setForm({ ...form, professional_category_id: event.target.value })}>
                <option value="">Todas las categorías</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="Años por módulo"><input type="number" min="1" max="50" style={styles.input} value={form.module_years} onChange={(event) => setForm({ ...form, module_years: event.target.value })} required /></Field>
            <Field label="Máximo de módulos"><input type="number" min="1" style={styles.input} value={form.max_modules} onChange={(event) => setForm({ ...form, max_modules: event.target.value })} placeholder="Sin límite" /></Field>
            <Field label="Forma de cálculo">
              <select style={styles.input} value={form.calculation_mode} onChange={(event) => setForm({ ...form, calculation_mode: event.target.value })}>
                <option value="table_amount">Importe de la fila salarial</option>
                <option value="fixed_amount">Importe fijo por módulo</option>
                <option value="percentage">Porcentaje del salario base</option>
              </select>
            </Field>
            {form.calculation_mode === "fixed_amount" && <Field label="Importe por módulo"><input type="number" min="0" step="0.01" style={styles.input} value={form.fixed_amount} onChange={(event) => setForm({ ...form, fixed_amount: event.target.value })} required /></Field>}
            {form.calculation_mode === "percentage" && <Field label="Porcentaje por módulo"><input type="number" min="0" max="100" step="0.01" style={styles.input} value={form.percentage} onChange={(event) => setForm({ ...form, percentage: event.target.value })} required /></Field>}
            <Field label="Vigente desde"><input type="date" style={styles.input} value={form.effective_from} onChange={(event) => setForm({ ...form, effective_from: event.target.value })} /></Field>
            <Field label="Vigente hasta"><input type="date" style={styles.input} value={form.effective_to} onChange={(event) => setForm({ ...form, effective_to: event.target.value })} /></Field>
          </div>

          <div style={styles.checkGrid}>
            <Check label="Aplicar parcialidad" checked={form.applies_partiality} onChange={(value) => setForm({ ...form, applies_partiality: value })} />
            <Check label="Prorratear el mes del vencimiento" checked={form.daily_proration_on_maturity} onChange={(value) => setForm({ ...form, daily_proration_on_maturity: value })} />
            <Check label="Cotiza" checked={form.contributes} onChange={(value) => setForm({ ...form, contributes: value })} />
            <Check label="Tributa en IRPF" checked={form.taxable} onChange={(value) => setForm({ ...form, taxable: value })} />
            <Check label="Participa en pagas extra" checked={form.affects_extra_payments} onChange={(value) => setForm({ ...form, affects_extra_payments: value })} />
          </div>

          <Field label="Notas"><textarea style={styles.textarea} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
          <div style={styles.actions}>
            <button type="button" onClick={() => { setForm(EMPTY_FORM); setFormOpen(false); }} style={styles.secondaryButton}>Cancelar</button>
            <button type="submit" disabled={saving} style={styles.primaryButton}>{saving ? "Guardando…" : "Guardar regla"}</button>
          </div>
        </form>
      )}

      <div style={styles.rulesHeader}>
        <div><strong>Reglas configuradas</strong><span>{activeRules.length} activas de {rules.length}</span></div>
      </div>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>Regla</th><th style={styles.th}>Ámbito</th><th style={styles.th}>Módulo</th><th style={styles.th}>Cálculo</th><th style={styles.th}>Límite</th><th style={styles.th}>Estado</th><th style={styles.thRight}>Acciones</th></tr></thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} style={!rule.is_active ? styles.inactiveRow : undefined}>
                <td style={styles.tdStrong}>{rule.name}<div style={styles.muted}>{rule.code}</div></td>
                <td style={styles.td}>{rule.salary_table_name || "Todas las tablas"}<div style={styles.muted}>{rule.professional_category_name || "Todas las categorías"}</div></td>
                <td style={styles.td}>{rule.module_years} años</td>
                <td style={styles.td}>{calculationLabel(rule)}</td>
                <td style={styles.td}>{rule.max_modules ? `${rule.max_modules} módulos` : "Sin límite"}</td>
                <td style={styles.td}>{rule.is_active ? "Activa" : "Inactiva"}</td>
                <td style={styles.tdRight}><button type="button" onClick={() => editRule(rule)} style={styles.linkButton}>Editar</button>{rule.is_active && <button type="button" onClick={() => deactivateRule(rule)} style={styles.dangerLink}>Desactivar</button>}</td>
              </tr>
            ))}
            {!rules.length && <tr><td colSpan="7" style={styles.empty}>No hay reglas de antigüedad configuradas.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={styles.previewHeader}>
        <div><h4 style={styles.previewTitle}>Vencimientos por contrato</h4><p style={styles.previewSubtitle}>La fecha reconocida del contrato prevalece sobre la fecha ordinaria de antigüedad.</p></div>
        <div style={styles.previewControls}><input type="date" style={styles.inputDate} value={previewDate} onChange={(event) => { setPreviewDate(event.target.value); setPreview(null); }} /><button type="button" onClick={refreshPreview} disabled={loading} style={styles.secondaryButton}>{loading ? "Calculando…" : preview ? "Actualizar" : "Calcular vencimientos"}</button></div>
      </div>

      {!preview && !loading && <div style={styles.previewNotice}>Selecciona una fecha y pulsa “Calcular vencimientos” para consultar los contratos vinculados.</div>}

      {preview && (
        <>
          <div style={styles.metrics}>
            <Metric label="Contratos" value={preview.total_contracts} />
            <Metric label="Con antigüedad calculable" value={preview.eligible_contracts} />
            <Metric label="Bloqueados" value={preview.blocked_contracts} />
            <Metric label="Importe mensual conjunto" value={money(preview.total_monthly_amount)} strong />
          </div>
          <div style={styles.tableWrapper}>
            <table style={{ ...styles.table, minWidth: "1060px" }}>
              <thead><tr><th style={styles.th}>Trabajador</th><th style={styles.th}>Fecha antigüedad</th><th style={styles.th}>Regla</th><th style={styles.thCenter}>Módulos</th><th style={styles.thRight}>Por módulo</th><th style={styles.thRight}>Mensual</th><th style={styles.th}>Próximo vencimiento</th><th style={styles.th}>Detalle</th></tr></thead>
              <tbody>
                {preview.contracts.map((item) => (
                  <tr key={item.contract_id}>
                    <td style={styles.tdStrong}>{item.employee_code ? `${item.employee_code} · ` : ""}{item.employee_name || `Trabajador ${item.employee_id}`}<div style={styles.muted}>{item.contract_code || `Contrato ${item.contract_id}`}</div></td>
                    <td style={styles.td}>{dateLabel(item.seniority_date)}<div style={styles.muted}>{item.seniority_date_source === "recognized_seniority_date" ? "Reconocida" : item.seniority_date_source === "seniority_date" ? "Contractual" : "Inicio del contrato"}</div></td>
                    <td style={styles.td}>{item.rule_name || item.reason || "—"}</td>
                    <td style={styles.tdCenter}>{item.completed_modules || 0}{item.max_modules ? ` / ${item.max_modules}` : ""}</td>
                    <td style={styles.tdRight}>{money(item.amount_per_module)}</td>
                    <td style={styles.tdRightStrong}>{money(item.monthly_amount)}</td>
                    <td style={styles.td}>{dateLabel(item.next_maturity_date)}{item.capped && <div style={styles.muted}>Límite alcanzado</div>}</td>
                    <td style={styles.td}>{item.maturities?.length ? <details><summary style={styles.detailSummary}>{item.maturities.length} vencimientos</summary><div style={styles.detailList}>{item.maturities.map((maturity) => <div key={maturity.module_number} style={styles.detailLine}><span>Módulo {maturity.module_number} · {dateLabel(maturity.maturity_date)}</span><strong>{money(maturity.amount)}</strong></div>)}</div></details> : item.reason || "Sin vencimientos consolidados"}</td>
                  </tr>
                ))}
                {!preview.contracts.length && <tr><td colSpan="8" style={styles.empty}>No hay contratos vinculados a este convenio.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Field({ label, children }) {
  return <label style={styles.field}><span>{label}</span>{children}</label>;
}

function Check({ label, checked, onChange }) {
  return <label style={styles.check}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function Metric({ label, value, strong = false }) {
  return <div style={styles.metric}><span>{label}</span><strong style={strong ? styles.metricStrong : undefined}>{value}</strong></div>;
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "12px", border: "1px solid #d1d5db", background: "#fff", padding: "14px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px" },
  title: { margin: 0, color: "#111827", fontSize: "17px", fontWeight: 900 },
  subtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "12px" },
  form: { display: "flex", flexDirection: "column", gap: "12px", border: "1px solid #e5e7eb", background: "#f9fafb", padding: "12px" },
  formTitle: { color: "#111827", fontWeight: 900, fontSize: "14px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" },
  field: { display: "flex", flexDirection: "column", gap: "5px", color: "#374151", fontSize: "12px", fontWeight: 750 },
  input: { width: "100%", height: "35px", border: "1px solid #d1d5db", background: "#fff", padding: "6px 8px", boxSizing: "border-box", fontSize: "12px" },
  inputDate: { height: "34px", border: "1px solid #d1d5db", background: "#fff", padding: "5px 8px", fontSize: "12px" },
  textarea: { minHeight: "70px", border: "1px solid #d1d5db", background: "#fff", padding: "8px", resize: "vertical", fontFamily: "inherit" },
  checkGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "8px", padding: "10px", border: "1px solid #e5e7eb", background: "#fff" },
  check: { display: "flex", alignItems: "center", gap: "8px", color: "#374151", fontSize: "12px", fontWeight: 700 },
  actions: { display: "flex", justifyContent: "flex-end", gap: "8px" },
  primaryButton: { minHeight: "34px", border: "1px solid #111827", background: "#111827", color: "#fff", padding: "7px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 850 },
  secondaryButton: { minHeight: "34px", border: "1px solid #d1d5db", background: "#fff", color: "#374151", padding: "7px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 800 },
  rulesHeader: { display: "flex", justifyContent: "space-between", borderTop: "1px solid #e5e7eb", paddingTop: "12px" },
  previewHeader: { display: "flex", justifyContent: "space-between", alignItems: "end", gap: "12px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" },
  previewTitle: { margin: 0, color: "#111827", fontSize: "14px", fontWeight: 900 },
  previewSubtitle: { margin: "3px 0 0", color: "#6b7280", fontSize: "11px" },
  previewControls: { display: "flex", alignItems: "center", gap: "8px" },
  previewNotice: { border: "1px solid #e5e7eb", background: "#f9fafb", color: "#4b5563", padding: "12px", fontSize: "12px", fontWeight: 700 },
  tableWrapper: { width: "100%", overflowX: "auto", border: "1px solid #e5e7eb" },
  table: { width: "100%", minWidth: "900px", borderCollapse: "collapse", fontSize: "12px" },
  th: { padding: "9px", textAlign: "left", background: "#f9fafb", borderBottom: "1px solid #d1d5db", whiteSpace: "nowrap" },
  thCenter: { padding: "9px", textAlign: "center", background: "#f9fafb", borderBottom: "1px solid #d1d5db" },
  thRight: { padding: "9px", textAlign: "right", background: "#f9fafb", borderBottom: "1px solid #d1d5db", whiteSpace: "nowrap" },
  td: { padding: "9px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
  tdStrong: { padding: "9px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", fontWeight: 850 },
  tdCenter: { padding: "9px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", textAlign: "center" },
  tdRight: { padding: "9px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap" },
  tdRightStrong: { padding: "9px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap", fontWeight: 900 },
  muted: { marginTop: "2px", color: "#6b7280", fontSize: "10px", fontWeight: 600 },
  linkButton: { border: 0, background: "transparent", color: "#1d4ed8", padding: "2px 5px", cursor: "pointer", fontWeight: 800 },
  dangerLink: { border: 0, background: "transparent", color: "#b91c1c", padding: "2px 5px", cursor: "pointer", fontWeight: 800 },
  inactiveRow: { opacity: 0.55 },
  empty: { padding: "18px", textAlign: "center", color: "#6b7280" },
  metrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" },
  metric: { display: "flex", flexDirection: "column", gap: "3px", border: "1px solid #e5e7eb", background: "#f9fafb", padding: "9px", color: "#4b5563", fontSize: "11px" },
  metricStrong: { color: "#111827", fontSize: "16px" },
  detailSummary: { cursor: "pointer", fontWeight: 800 },
  detailList: { marginTop: "6px", minWidth: "250px", display: "flex", flexDirection: "column", gap: "4px" },
  detailLine: { display: "flex", justifyContent: "space-between", gap: "8px", paddingBottom: "4px", borderBottom: "1px dashed #d1d5db" },
  error: { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: "9px", fontSize: "12px", fontWeight: 750 },
  success: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", padding: "9px", fontSize: "12px", fontWeight: 750 },
};
