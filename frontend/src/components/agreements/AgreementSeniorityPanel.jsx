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
  professional_category_id: "",
  code: "ANT",
  name: "Antigüedad",
  module_years: "3",
  calculation_mode: "fixed_amount",
  fixed_amount: "",
  percentage: "",
  percentage_base: "salary_base",
  max_modules: "5",
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

const PERCENTAGE_BASES = {
  salary_base: "Salario base",
  salary_base_plus_agreement: "Salario base + plus convenio",
  salary_table_total: "Total mensual de la fila salarial",
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
  if (rule.calculation_mode === "fixed_amount") return `${money(rule.fixed_amount)} por tramo`;
  if (rule.calculation_mode === "percentage") {
    return `${Number(rule.percentage || 0).toLocaleString("es-ES")} % sobre ${PERCENTAGE_BASES[rule.percentage_base] || "salario base"}`;
  }
  return "Configuración antigua basada en tabla salarial";
}

function cleanPayload(form) {
  return {
    salary_table_id: null,
    professional_category_id: form.professional_category_id ? Number(form.professional_category_id) : null,
    code: form.code || "ANT",
    name: form.name || "Antigüedad",
    module_years: Number(form.module_years || 3),
    calculation_mode: form.calculation_mode,
    fixed_amount: form.calculation_mode === "fixed_amount" && form.fixed_amount !== "" ? Number(form.fixed_amount) : null,
    percentage: form.calculation_mode === "percentage" && form.percentage !== "" ? Number(form.percentage) : null,
    percentage_base: form.percentage_base || "salary_base",
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

function buildTranches(form) {
  const years = Math.max(1, Number(form.module_years || 3));
  const count = Math.max(1, Math.min(12, Number(form.max_modules || 6)));
  const unit = form.calculation_mode === "percentage"
    ? Number(form.percentage || 0)
    : Number(form.fixed_amount || 0);

  return Array.from({ length: count }, (_, index) => {
    const moduleNumber = index + 1;
    return {
      moduleNumber,
      years: years * moduleNumber,
      unit,
      accumulated: unit * moduleNumber,
    };
  });
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

  const categories = agreement?.professional_categories || [];
  const activeRules = useMemo(() => rules.filter((rule) => rule.is_active), [rules]);
  const tranches = useMemo(() => buildTranches(form), [form]);

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
    const timer = window.setTimeout(() => loadRules(), 0);
    return () => window.clearTimeout(timer);
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
    if (form.calculation_mode === "fixed_amount" && form.fixed_amount === "") {
      setError("Indica el importe que se devenga en cada tramo.");
      return;
    }
    if (form.calculation_mode === "percentage" && form.percentage === "") {
      setError("Indica el porcentaje que se devenga en cada tramo.");
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
    const legacyMode = rule.calculation_mode === "table_amount";
    setForm({
      ...EMPTY_FORM,
      ...rule,
      salary_table_id: "",
      professional_category_id: rule.professional_category_id ? String(rule.professional_category_id) : "",
      module_years: String(rule.module_years || 3),
      calculation_mode: legacyMode ? "fixed_amount" : rule.calculation_mode,
      fixed_amount: legacyMode ? "" : (rule.fixed_amount ?? ""),
      percentage: rule.percentage ?? "",
      percentage_base: rule.percentage_base || "salary_base",
      max_modules: rule.max_modules ?? "",
      effective_from: rule.effective_from || "",
      effective_to: rule.effective_to || "",
      notes: legacyMode ? `${rule.notes || ""}\nRegla antigua convertida a importe fijo. Revisa el importe antes de guardar.`.trim() : (rule.notes || ""),
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
          <h3 style={styles.title}>Antigüedad</h3>
          <p style={styles.subtitle}>Configura cuánto se devenga, cada cuántos años y sobre qué base. La tabla de tramos se genera automáticamente.</p>
        </div>
        <button type="button" onClick={() => { setForm(EMPTY_FORM); setFormOpen((value) => !value); }} style={styles.primaryButton}>
          {formOpen ? "Cerrar formulario" : "Nueva regla"}
        </button>
      </header>

      {(error || message) && <div style={error ? styles.error : styles.success}>{error || message}</div>}

      {formOpen && (
        <form onSubmit={handleSave} style={styles.form}>
          <div style={styles.formTitle}>{form.id ? "Editar regla" : "Nueva regla de antigüedad"}</div>

          <div style={styles.stepBox}>
            <strong>1. Ámbito y periodicidad</strong>
            <div style={styles.formGrid}>
              <Field label="Denominación"><input style={styles.input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
              <Field label="Código"><input style={styles.input} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required /></Field>
              <Field label="Aplicar a">
                <select style={styles.input} value={form.professional_category_id} onChange={(event) => setForm({ ...form, professional_category_id: event.target.value })}>
                  <option value="">Todas las categorías</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </Field>
              <Field label="Se devenga cada"><div style={styles.inlineInput}><input type="number" min="1" max="50" style={styles.input} value={form.module_years} onChange={(event) => setForm({ ...form, module_years: event.target.value })} required /><span>años</span></div></Field>
              <Field label="Número máximo de tramos"><input type="number" min="1" max="100" style={styles.input} value={form.max_modules} onChange={(event) => setForm({ ...form, max_modules: event.target.value })} placeholder="Sin límite" /></Field>
            </div>
          </div>

          <div style={styles.stepBox}>
            <strong>2. Importe de cada tramo</strong>
            <div style={styles.modeButtons}>
              <button type="button" onClick={() => setForm({ ...form, calculation_mode: "fixed_amount" })} style={form.calculation_mode === "fixed_amount" ? styles.modeActive : styles.modeButton}>
                <strong>Importe fijo</strong><span>Ej.: 32,50 € por cada trienio</span>
              </button>
              <button type="button" onClick={() => setForm({ ...form, calculation_mode: "percentage" })} style={form.calculation_mode === "percentage" ? styles.modeActive : styles.modeButton}>
                <strong>Porcentaje</strong><span>Ej.: 4 % del salario base por cada trienio</span>
              </button>
            </div>
            <div style={styles.formGrid}>
              {form.calculation_mode === "fixed_amount" && <Field label="Importe por tramo (€)"><input type="number" min="0" step="0.01" style={styles.input} value={form.fixed_amount} onChange={(event) => setForm({ ...form, fixed_amount: event.target.value })} required /></Field>}
              {form.calculation_mode === "percentage" && (
                <>
                  <Field label="Porcentaje por tramo"><div style={styles.inlineInput}><input type="number" min="0" max="100" step="0.01" style={styles.input} value={form.percentage} onChange={(event) => setForm({ ...form, percentage: event.target.value })} required /><span>%</span></div></Field>
                  <Field label="Base del porcentaje">
                    <select style={styles.input} value={form.percentage_base} onChange={(event) => setForm({ ...form, percentage_base: event.target.value })}>
                      {Object.entries(PERCENTAGE_BASES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Field>
                </>
              )}
            </div>
          </div>

          <div style={styles.stepBox}>
            <strong>3. Tabla de tramos resultante</strong>
            <p style={styles.help}>La cuantía es acumulativa: al completar dos tramos se perciben dos módulos.</p>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead><tr><th style={styles.th}>Tramo</th><th style={styles.th}>Antigüedad cumplida</th><th style={styles.thRight}>Valor del tramo</th><th style={styles.thRight}>Total acumulado</th></tr></thead>
                <tbody>{tranches.map((tranche) => (
                  <tr key={tranche.moduleNumber}>
                    <td style={styles.tdStrong}>{tranche.moduleNumber}</td>
                    <td style={styles.td}>{tranche.years} años</td>
                    <td style={styles.tdRight}>{form.calculation_mode === "percentage" ? `${tranche.unit.toLocaleString("es-ES")} %` : money(tranche.unit)}</td>
                    <td style={styles.tdRightStrong}>{form.calculation_mode === "percentage" ? `${tranche.accumulated.toLocaleString("es-ES")} %` : money(tranche.accumulated)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          <div style={styles.formGrid}>
            <Field label="Vigente desde"><input type="date" style={styles.input} value={form.effective_from} onChange={(event) => setForm({ ...form, effective_from: event.target.value })} /></Field>
            <Field label="Vigente hasta"><input type="date" style={styles.input} value={form.effective_to} onChange={(event) => setForm({ ...form, effective_to: event.target.value })} /></Field>
          </div>

          <div style={styles.checkGrid}>
            <Check label="Aplicar porcentaje de jornada" checked={form.applies_partiality} onChange={(value) => setForm({ ...form, applies_partiality: value })} />
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

      <div style={styles.rulesHeader}><div><strong>Reglas configuradas</strong><span>{activeRules.length} activas de {rules.length}</span></div></div>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>Regla</th><th style={styles.th}>Ámbito</th><th style={styles.th}>Periodicidad</th><th style={styles.th}>Cálculo</th><th style={styles.th}>Límite</th><th style={styles.th}>Estado</th><th style={styles.thRight}>Acciones</th></tr></thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} style={!rule.is_active ? styles.inactiveRow : undefined}>
                <td style={styles.tdStrong}>{rule.name}<div style={styles.muted}>{rule.code}</div></td>
                <td style={styles.td}>{rule.professional_category_name || "Todas las categorías"}</td>
                <td style={styles.td}>Cada {rule.module_years} años</td>
                <td style={styles.td}>{calculationLabel(rule)}</td>
                <td style={styles.td}>{rule.max_modules ? `${rule.max_modules} tramos` : "Sin límite"}</td>
                <td style={styles.td}>{rule.is_active ? "Activa" : "Inactiva"}</td>
                <td style={styles.tdRight}><button type="button" onClick={() => editRule(rule)} style={styles.linkButton}>Editar</button>{rule.is_active && <button type="button" onClick={() => deactivateRule(rule)} style={styles.dangerLink}>Desactivar</button>}</td>
              </tr>
            ))}
            {!rules.length && <tr><td colSpan="7" style={styles.empty}>No hay reglas de antigüedad configuradas.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={styles.previewHeader}>
        <div><h4 style={styles.previewTitle}>Comprobar trabajadores y vencimientos</h4><p style={styles.previewSubtitle}>Calcula el resultado real para los contratos vinculados al convenio.</p></div>
        <div style={styles.previewControls}><input type="date" style={styles.inputDate} value={previewDate} onChange={(event) => { setPreviewDate(event.target.value); setPreview(null); }} /><button type="button" onClick={refreshPreview} disabled={loading} style={styles.secondaryButton}>{loading ? "Calculando…" : preview ? "Actualizar" : "Calcular vencimientos"}</button></div>
      </div>

      {!preview && !loading && <div style={styles.previewNotice}>Selecciona una fecha y calcula para verificar módulos, importes y próximos vencimientos.</div>}

      {preview && (
        <>
          <div style={styles.metrics}>
            <Metric label="Contratos" value={preview.total_contracts} />
            <Metric label="Calculables" value={preview.eligible_contracts} />
            <Metric label="Bloqueados" value={preview.blocked_contracts} />
            <Metric label="Importe mensual conjunto" value={money(preview.total_monthly_amount)} strong />
          </div>
          <div style={styles.tableWrapper}>
            <table style={{ ...styles.table, minWidth: "960px" }}>
              <thead><tr><th style={styles.th}>Trabajador</th><th style={styles.th}>Fecha antigüedad</th><th style={styles.th}>Regla</th><th style={styles.thCenter}>Tramos</th><th style={styles.thRight}>Por tramo</th><th style={styles.thRight}>Mensual</th><th style={styles.th}>Próximo vencimiento</th></tr></thead>
              <tbody>
                {preview.contracts.map((item) => (
                  <tr key={item.contract_id}>
                    <td style={styles.tdStrong}>{item.employee_code ? `${item.employee_code} · ` : ""}{item.employee_name || `Trabajador ${item.employee_id}`}<div style={styles.muted}>{item.contract_code || `Contrato ${item.contract_id}`}</div></td>
                    <td style={styles.td}>{dateLabel(item.seniority_date)}</td>
                    <td style={styles.td}>{item.rule_name || item.reason || "—"}</td>
                    <td style={styles.tdCenter}>{item.completed_modules || 0}{item.max_modules ? ` / ${item.max_modules}` : ""}</td>
                    <td style={styles.tdRight}>{money(item.amount_per_module)}</td>
                    <td style={styles.tdRightStrong}>{money(item.monthly_amount)}</td>
                    <td style={styles.td}>{dateLabel(item.next_maturity_date)}{item.capped && <div style={styles.muted}>Límite alcanzado</div>}</td>
                  </tr>
                ))}
                {!preview.contracts.length && <tr><td colSpan="7" style={styles.empty}>No hay contratos vinculados a este convenio.</td></tr>}
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
  title: { margin: 0, color: "#111827", fontSize: "18px", fontWeight: 900 },
  subtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "12px" },
  form: { display: "flex", flexDirection: "column", gap: "12px", border: "1px solid #e5e7eb", background: "#f9fafb", padding: "12px" },
  formTitle: { color: "#111827", fontWeight: 900, fontSize: "15px" },
  stepBox: { display: "flex", flexDirection: "column", gap: "10px", background: "#fff", border: "1px solid #dbe2ea", padding: "12px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" },
  field: { display: "flex", flexDirection: "column", gap: "5px", color: "#374151", fontSize: "12px", fontWeight: 750 },
  input: { width: "100%", minHeight: "36px", border: "1px solid #d1d5db", background: "#fff", padding: "6px 8px", boxSizing: "border-box", fontSize: "12px" },
  inputDate: { height: "34px", border: "1px solid #d1d5db", background: "#fff", padding: "5px 8px", fontSize: "12px" },
  inlineInput: { display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: "7px" },
  textarea: { minHeight: "70px", border: "1px solid #d1d5db", background: "#fff", padding: "8px", resize: "vertical", fontFamily: "inherit" },
  modeButtons: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" },
  modeButton: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px", border: "1px solid #d1d5db", background: "#fff", color: "#374151", padding: "11px", cursor: "pointer", textAlign: "left" },
  modeActive: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px", border: "2px solid #111827", background: "#fef9c3", color: "#111827", padding: "10px", cursor: "pointer", textAlign: "left" },
  help: { margin: 0, color: "#6b7280", fontSize: "12px" },
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
  metrics: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px" },
  metric: { border: "1px solid #e5e7eb", background: "#fff", padding: "10px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", color: "#6b7280" },
  metricStrong: { color: "#166534" },
  tableWrapper: { overflowX: "auto", border: "1px solid #e5e7eb" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "760px", fontSize: "12px" },
  th: { textAlign: "left", padding: "8px", borderBottom: "1px solid #d1d5db", background: "#f3f4f6", color: "#374151" },
  thRight: { textAlign: "right", padding: "8px", borderBottom: "1px solid #d1d5db", background: "#f3f4f6", color: "#374151" },
  thCenter: { textAlign: "center", padding: "8px", borderBottom: "1px solid #d1d5db", background: "#f3f4f6", color: "#374151" },
  td: { padding: "8px", borderBottom: "1px solid #e5e7eb", color: "#374151", verticalAlign: "top" },
  tdStrong: { padding: "8px", borderBottom: "1px solid #e5e7eb", color: "#111827", fontWeight: 800, verticalAlign: "top" },
  tdRight: { padding: "8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: "#374151", verticalAlign: "top" },
  tdRightStrong: { padding: "8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: "#111827", fontWeight: 900, verticalAlign: "top" },
  tdCenter: { padding: "8px", borderBottom: "1px solid #e5e7eb", textAlign: "center", color: "#374151", verticalAlign: "top" },
  muted: { color: "#6b7280", fontSize: "10px", marginTop: "2px" },
  inactiveRow: { opacity: 0.55, background: "#f9fafb" },
  empty: { padding: "18px", textAlign: "center", color: "#6b7280" },
  linkButton: { border: 0, background: "transparent", color: "#1d4ed8", cursor: "pointer", fontWeight: 800, marginRight: "8px" },
  dangerLink: { border: 0, background: "transparent", color: "#b91c1c", cursor: "pointer", fontWeight: 800 },
  error: { border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: "10px", fontWeight: 800 },
  success: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", padding: "10px", fontWeight: 800 },
};
