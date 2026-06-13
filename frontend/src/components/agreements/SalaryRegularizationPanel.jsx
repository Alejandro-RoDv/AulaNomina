import { useEffect, useMemo, useState } from "react";

import {
  generateSalaryRegularizations,
  previewSalaryRegularization,
} from "../../services/collectiveAgreementApi";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function defaultSelection(tables) {
  const ordered = [...tables].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
  const target = ordered.find((table) => table.status === "active") || ordered[0] || null;
  const source = ordered.find((table) => table.id !== target?.id && table.status === "historical")
    || ordered.find((table) => table.id !== target?.id)
    || null;
  const year = Number(target?.year || new Date().getFullYear());
  return {
    source_table_id: source?.id ? String(source.id) : "",
    target_table_id: target?.id ? String(target.id) : "",
    period_from: target?.effective_from || `${year}-01-01`,
    period_to: `${year}-12-31`,
    include_base_salary: true,
    include_salary_concepts: true,
    include_extra_pay_proration: true,
    include_non_salary: false,
    positive_only: true,
    irpf_mode: "auto",
    irpf_percentage: "",
  };
}

function statusLabel(value) {
  return {
    active: "Activa",
    historical: "Histórica",
    draft: "Borrador",
    pending_review: "Pendiente de revisión",
  }[value] || value;
}

function lineTypeLabel(value) {
  return {
    base_salary: "Salario base",
    salary_concept: "Concepto",
    extra_pay_proration: "Prorrata extra",
  }[value] || value;
}

export default function SalaryRegularizationPanel({ agreement, onGenerated }) {
  const tables = agreement?.salary_tables || [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => defaultSelection(tables));
  const [preview, setPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(defaultSelection(tables));
    setPreview(null);
    setSelectedIds([]);
    setResult(null);
    setError("");
  }, [agreement?.id, tables.length]);

  const targetTable = useMemo(
    () => tables.find((table) => String(table.id) === String(form.target_table_id)),
    [tables, form.target_table_id]
  );

  const eligibleContracts = preview?.contracts?.filter((item) => item.eligibility === "eligible") || [];

  function buildPayload(contractIds = []) {
    return {
      source_table_id: Number(form.source_table_id),
      period_from: form.period_from,
      period_to: form.period_to,
      contract_ids: contractIds,
      include_base_salary: form.include_base_salary,
      include_salary_concepts: form.include_salary_concepts,
      include_extra_pay_proration: form.include_extra_pay_proration,
      include_non_salary: form.include_non_salary,
      positive_only: form.positive_only,
    };
  }

  async function handlePreview(event) {
    event?.preventDefault();
    if (!form.source_table_id || !form.target_table_id) {
      setError("Selecciona una tabla de origen y otra de destino.");
      return;
    }
    if (form.source_table_id === form.target_table_id) {
      setError("La tabla de origen y la tabla de destino deben ser distintas.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await previewSalaryRegularization(form.target_table_id, buildPayload());
      setPreview(data);
      setSelectedIds(data.contracts.filter((item) => item.eligibility === "eligible").map((item) => item.contract_id));
    } catch (err) {
      setError(err.message || "No se pudo calcular la regularización.");
      setPreview(null);
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!selectedIds.length) {
      setError("Selecciona al menos un contrato con atrasos liquidables.");
      return;
    }
    if (targetTable?.status !== "active") {
      setError("La tabla de destino debe estar activa antes de generar complementarias.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const data = await generateSalaryRegularizations(form.target_table_id, {
        ...buildPayload(selectedIds),
        status: "pending",
        irpf_mode: form.irpf_mode,
        irpf_percentage: form.irpf_mode === "manual" && form.irpf_percentage !== ""
          ? Number(form.irpf_percentage)
          : null,
      });
      setResult(data);
      await onGenerated?.(data);
      await handlePreview();
    } catch (err) {
      setError(err.message || "No se pudieron generar las nóminas complementarias.");
    } finally {
      setGenerating(false);
    }
  }

  function toggleContract(contractId) {
    setSelectedIds((current) => current.includes(contractId)
      ? current.filter((id) => id !== contractId)
      : [...current, contractId]);
  }

  if (tables.length < 2) return null;

  return (
    <section style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h3 style={styles.title}>Regularización retroactiva</h3>
          <p style={styles.subtitle}>Compara dos tablas, calcula atrasos sobre nóminas históricas y genera complementarias en el período 15.</p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} style={styles.toggleButton}>
          {open ? "Cerrar" : "Calcular atrasos"}
        </button>
      </header>

      {open && (
        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}
          {result && (
            <div style={styles.success}>
              <strong>{result.generated_payrolls} complementarias generadas por {formatMoney(result.total_gross)}.</strong>
              <span>{result.skipped_contracts} contratos omitidos. Las nóminas originales permanecen sin cambios.</span>
            </div>
          )}

          <form onSubmit={handlePreview} style={styles.form}>
            <div style={styles.formGrid}>
              <Field label="Tabla de origen">
                <select value={form.source_table_id} onChange={(event) => setForm({ ...form, source_table_id: event.target.value })} style={styles.input}>
                  <option value="">Selecciona tabla</option>
                  {tables.map((table) => <option key={table.id} value={table.id}>{table.name} · {table.year || "sin año"} · {statusLabel(table.status)}</option>)}
                </select>
              </Field>
              <Field label="Tabla de destino">
                <select value={form.target_table_id} onChange={(event) => setForm({ ...form, target_table_id: event.target.value })} style={styles.input}>
                  <option value="">Selecciona tabla</option>
                  {tables.map((table) => <option key={table.id} value={table.id}>{table.name} · {table.year || "sin año"} · {statusLabel(table.status)}</option>)}
                </select>
              </Field>
              <Field label="Desde"><input type="date" value={form.period_from} onChange={(event) => setForm({ ...form, period_from: event.target.value })} style={styles.input} /></Field>
              <Field label="Hasta"><input type="date" value={form.period_to} onChange={(event) => setForm({ ...form, period_to: event.target.value })} style={styles.input} /></Field>
            </div>

            <div style={styles.options}>
              <Check label="Salario base" checked={form.include_base_salary} onChange={(value) => setForm({ ...form, include_base_salary: value })} />
              <Check label="Conceptos salariales" checked={form.include_salary_concepts} onChange={(value) => setForm({ ...form, include_salary_concepts: value })} />
              <Check label="Prorrata de pagas extra" checked={form.include_extra_pay_proration} onChange={(value) => setForm({ ...form, include_extra_pay_proration: value })} />
              <Check label="Incluir no salariales" checked={form.include_non_salary} onChange={(value) => setForm({ ...form, include_non_salary: value })} />
              <Check label="Solo diferencias positivas" checked={form.positive_only} onChange={(value) => setForm({ ...form, positive_only: value })} />
            </div>

            <div style={styles.actions}>
              <button type="submit" disabled={loading} style={styles.secondaryButton}>{loading ? "Calculando…" : "Vista previa"}</button>
            </div>
          </form>

          {preview && (
            <>
              <div style={styles.summaryGrid}>
                <Summary label="Contratos" value={preview.total_contracts} />
                <Summary label="Liquidables" value={preview.eligible_contracts} />
                <Summary label="Bloqueados" value={preview.blocked_contracts} />
                <Summary label="Nóminas revisadas" value={preview.payrolls_reviewed} />
                <Summary label="Atrasos brutos" value={formatMoney(preview.total_difference)} strong />
                <Summary label="Base cotizable" value={formatMoney(preview.contributory_difference)} />
              </div>

              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead><tr>
                    <th style={styles.thCenter}>Sel.</th>
                    <th style={styles.th}>Trabajador</th>
                    <th style={styles.th}>Categoría</th>
                    <th style={styles.thCenter}>Meses</th>
                    <th style={styles.thRight}>Diferencia</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Detalle</th>
                  </tr></thead>
                  <tbody>
                    {preview.contracts.map((item) => (
                      <tr key={item.contract_id}>
                        <td style={styles.tdCenter}><input type="checkbox" disabled={item.eligibility !== "eligible"} checked={selectedIds.includes(item.contract_id)} onChange={() => toggleContract(item.contract_id)} /></td>
                        <td style={styles.tdStrong}>{item.employee_code ? `${item.employee_code} · ` : ""}{item.employee_name || `Trabajador ${item.employee_id}`}</td>
                        <td style={styles.td}>{item.professional_category_name || "Sin categoría"}</td>
                        <td style={styles.tdCenter}>{item.payroll_count}</td>
                        <td style={styles.tdRight}>{formatMoney(item.total_difference)}</td>
                        <td style={styles.td}>{item.eligibility === "eligible" ? "Liquidable" : item.reason}</td>
                        <td style={styles.td}>
                          {item.lines.length ? (
                            <details>
                              <summary style={styles.detailSummary}>{item.lines.length} líneas</summary>
                              <div style={styles.detailLines}>
                                {item.lines.map((line, index) => (
                                  <div key={`${line.payroll_id}-${line.concept_key}-${index}`} style={styles.detailLine}>
                                    <span>{String(line.source_period_month).padStart(2, "0")}/{line.source_period_year} · {lineTypeLabel(line.line_type)} · {line.concept_name}</span>
                                    <strong>{formatMoney(line.amount)}</strong>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={styles.generationBox}>
                <div style={styles.formGridSmall}>
                  <Field label="IRPF de la complementaria">
                    <select value={form.irpf_mode} onChange={(event) => setForm({ ...form, irpf_mode: event.target.value })} style={styles.input}>
                      <option value="auto">Automático</option>
                      <option value="voluntary">Voluntario del trabajador</option>
                      <option value="manual">Manual</option>
                    </select>
                  </Field>
                  {form.irpf_mode === "manual" && <Field label="Porcentaje manual"><input type="number" min="0" max="100" step="0.01" value={form.irpf_percentage} onChange={(event) => setForm({ ...form, irpf_percentage: event.target.value })} style={styles.input} /></Field>}
                </div>
                <div style={styles.notice}>
                  <strong>Generación controlada</strong>
                  <span>Se creará una nómina complementaria por contrato en el período 15. Una complementaria activa existente bloqueará la generación para ese contrato.</span>
                  <span>Tabla destino: {targetTable?.name || "—"} · estado {statusLabel(targetTable?.status)}.</span>
                </div>
                <button type="button" onClick={handleGenerate} disabled={generating || !selectedIds.length || targetTable?.status !== "active"} style={styles.primaryButton}>
                  {generating ? "Generando…" : `Generar ${selectedIds.length} complementarias`}
                </button>
              </div>
            </>
          )}
        </div>
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

function Summary({ label, value, strong = false }) {
  return <div style={styles.summary}><span>{label}</span><strong style={strong ? styles.summaryStrong : undefined}>{value}</strong></div>;
}

const styles = {
  wrapper: { border: "1px solid #d1d5db", background: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 14px", background: "#f9fafb" },
  title: { margin: 0, fontSize: "15px", fontWeight: 850, color: "#111827" },
  subtitle: { margin: "3px 0 0", color: "#6b7280", fontSize: "12px" },
  toggleButton: { height: "32px", border: "1px solid #111827", background: "#111827", color: "#fff", padding: "0 12px", fontSize: "12px", fontWeight: 850, cursor: "pointer" },
  body: { borderTop: "1px solid #e5e7eb", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" },
  form: { display: "flex", flexDirection: "column", gap: "10px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" },
  formGridSmall: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 280px))", gap: "10px" },
  field: { display: "flex", flexDirection: "column", gap: "5px", color: "#374151", fontSize: "12px", fontWeight: 750 },
  input: { width: "100%", height: "34px", boxSizing: "border-box", border: "1px solid #d1d5db", background: "#fff", padding: "6px 8px", fontSize: "12px" },
  options: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "8px", padding: "10px", border: "1px solid #e5e7eb" },
  check: { display: "flex", alignItems: "center", gap: "8px", color: "#374151", fontSize: "12px", fontWeight: 700 },
  actions: { display: "flex", justifyContent: "flex-end" },
  primaryButton: { height: "36px", border: "1px solid #111827", background: "#111827", color: "#fff", padding: "0 14px", fontSize: "12px", fontWeight: 850, cursor: "pointer", alignSelf: "flex-end" },
  secondaryButton: { height: "34px", border: "1px solid #d1d5db", background: "#fff", color: "#374151", padding: "0 12px", fontSize: "12px", fontWeight: 800, cursor: "pointer" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" },
  summary: { display: "flex", flexDirection: "column", gap: "3px", border: "1px solid #e5e7eb", background: "#f9fafb", padding: "9px", color: "#374151", fontSize: "11px" },
  summaryStrong: { fontSize: "16px", color: "#111827" },
  tableWrapper: { overflowX: "auto", border: "1px solid #e5e7eb" },
  table: { width: "100%", minWidth: "980px", borderCollapse: "collapse", fontSize: "12px" },
  th: { textAlign: "left", padding: "9px", background: "#f9fafb", borderBottom: "1px solid #d1d5db", whiteSpace: "nowrap" },
  thCenter: { textAlign: "center", padding: "9px", background: "#f9fafb", borderBottom: "1px solid #d1d5db" },
  thRight: { textAlign: "right", padding: "9px", background: "#f9fafb", borderBottom: "1px solid #d1d5db" },
  td: { padding: "9px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
  tdStrong: { padding: "9px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", fontWeight: 850 },
  tdCenter: { padding: "9px", borderBottom: "1px solid #e5e7eb", textAlign: "center", verticalAlign: "top" },
  tdRight: { padding: "9px", borderBottom: "1px solid #e5e7eb", textAlign: "right", verticalAlign: "top", fontWeight: 850, whiteSpace: "nowrap" },
  detailSummary: { cursor: "pointer", fontWeight: 800 },
  detailLines: { marginTop: "7px", display: "flex", flexDirection: "column", gap: "5px", minWidth: "330px" },
  detailLine: { display: "flex", justifyContent: "space-between", gap: "10px", padding: "5px 0", borderBottom: "1px dashed #d1d5db" },
  generationBox: { display: "flex", flexDirection: "column", gap: "10px", border: "1px solid #facc15", background: "#fffbeb", padding: "12px" },
  notice: { display: "flex", flexDirection: "column", gap: "3px", color: "#78350f", fontSize: "12px" },
  error: { padding: "9px 10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: "12px", fontWeight: 750 },
  success: { padding: "9px 10px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", display: "flex", flexDirection: "column", gap: "3px", fontSize: "12px" },
};
