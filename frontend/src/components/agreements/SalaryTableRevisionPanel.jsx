import { useEffect, useMemo, useState } from "react";

import { duplicateSalaryTableRevision } from "../../services/collectiveAgreementApi";

const EMPTY_FORM = {
  source_table_id: "",
  name: "",
  year: "",
  effective_from: "",
  effective_to: "",
  status: "draft",
  increment_percentage: "0",
  copy_rows: true,
  copy_concepts: true,
  copy_extra_pays: true,
  copy_seniority_rules: true,
  increase_non_salary: false,
  mark_source_historical: false,
  notes: "",
};

function buildDefaults(table) {
  const sourceYear = Number(table?.year || new Date().getFullYear());
  const nextYear = sourceYear + 1;
  return {
    ...EMPTY_FORM,
    source_table_id: table?.id ? String(table.id) : "",
    name: table ? `${table.name.replace(String(sourceYear), "").trim()} ${nextYear}`.trim() : `Tabla salarial ${nextYear}`,
    year: String(nextYear),
    effective_from: `${nextYear}-01-01`,
    effective_to: `${nextYear}-12-31`,
  };
}

function statusLabel(value) {
  const labels = {
    draft: "Borrador",
    active: "Activa",
    historical: "Histórica",
    pending_review: "Pendiente de revisión",
  };
  return labels[value] || value;
}

export default function SalaryTableRevisionPanel({ agreement, onCompleted }) {
  const tables = agreement?.salary_tables || [];
  const initialSource = tables.find((item) => item.status === "active") || tables[0] || null;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => buildDefaults(initialSource));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const sourceTable = useMemo(
    () => tables.find((item) => String(item.id) === String(form.source_table_id)) || initialSource,
    [tables, form.source_table_id, initialSource]
  );

  useEffect(() => {
    setForm(buildDefaults(initialSource));
    setResult(null);
    setError("");
  }, [agreement?.id]);

  function changeSource(value) {
    const table = tables.find((item) => String(item.id) === String(value));
    setForm(buildDefaults(table));
    setResult(null);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!sourceTable?.id) {
      setError("Selecciona una tabla salarial de origen.");
      return;
    }

    setSaving(true);
    setError("");
    setResult(null);
    try {
      const response = await duplicateSalaryTableRevision(sourceTable.id, {
        name: form.name.trim(),
        year: Number(form.year),
        effective_from: form.effective_from || null,
        effective_to: form.effective_to || null,
        status: form.status,
        increment_percentage: Number(form.increment_percentage || 0),
        copy_rows: form.copy_rows,
        copy_concepts: form.copy_concepts,
        copy_extra_pays: form.copy_extra_pays,
        copy_seniority_rules: form.copy_seniority_rules,
        increase_non_salary: form.increase_non_salary,
        mark_source_historical: form.mark_source_historical,
        notes: form.notes.trim() || null,
      });
      setResult(response);
      await onCompleted?.(response);
    } catch (err) {
      setError(err.message || "No se pudo crear la revisión salarial.");
    } finally {
      setSaving(false);
    }
  }

  if (!tables.length) return null;

  return (
    <section style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h3 style={styles.title}>Revisión de tabla salarial</h3>
          <p style={styles.subtitle}>Copia un ejercicio anterior, conserva el histórico y aplica un incremento común.</p>
        </div>
        <button type="button" onClick={() => setOpen((current) => !current)} style={styles.toggleButton}>
          {open ? "Cerrar" : "Crear nueva revisión"}
        </button>
      </header>

      {open && (
        <form onSubmit={handleSubmit} style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}
          {result && (
            <div style={styles.success}>
              <strong>{result.salary_table.name} creada correctamente.</strong>
              <span>{result.copied_rows} filas, {result.copied_concepts} conceptos, {result.copied_extra_pays} pagas extraordinarias y {result.copied_seniority_rules || 0} reglas de antigüedad copiadas.</span>
              <span>{result.copied_extra_pay_lines} reglas de participación en pagas extra. Incremento aplicado: {Number(result.increment_percentage).toLocaleString("es-ES")} %.</span>
            </div>
          )}

          <div style={styles.sourceSummary}>
            <Field label="Tabla de origen">
              <select value={sourceTable?.id || ""} onChange={(event) => changeSource(event.target.value)} style={styles.input}>
                {tables.map((table) => <option key={table.id} value={table.id}>{table.name} · {table.year || "sin año"} · {statusLabel(table.status)}</option>)}
              </select>
            </Field>
            <Summary label="Filas de origen" value={sourceTable?.rows?.length || 0} />
            <Summary label="Pagas" value={sourceTable?.number_of_payments || "—"} />
            <Summary label="Tipo de importe" value={sourceTable?.amount_type || "—"} />
          </div>

          <div style={styles.formGrid}>
            <Field label="Nombre de la nueva tabla"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} style={styles.input} required /></Field>
            <Field label="Ejercicio"><input type="number" min="1900" max="2200" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} style={styles.input} required /></Field>
            <Field label="Vigente desde"><input type="date" value={form.effective_from} onChange={(event) => setForm({ ...form, effective_from: event.target.value })} style={styles.input} /></Field>
            <Field label="Vigente hasta"><input type="date" value={form.effective_to} onChange={(event) => setForm({ ...form, effective_to: event.target.value })} style={styles.input} /></Field>
            <Field label="Estado inicial"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} style={styles.input}><option value="draft">Borrador</option><option value="pending_review">Pendiente de revisión</option><option value="historical">Histórica</option></select></Field>
            <Field label="Incremento general"><div style={styles.percentage}><input type="number" min="0" max="1000" step="0.01" value={form.increment_percentage} onChange={(event) => setForm({ ...form, increment_percentage: event.target.value })} style={styles.input} /><span>%</span></div></Field>
          </div>

          <div style={styles.options}>
            <Check label="Copiar filas salariales" checked={form.copy_rows} onChange={(value) => setForm({ ...form, copy_rows: value })} />
            <Check label="Copiar conceptos editables" checked={form.copy_concepts} onChange={(value) => setForm({ ...form, copy_concepts: value })} />
            <Check label="Copiar pagas extraordinarias" checked={form.copy_extra_pays} onChange={(value) => setForm({ ...form, copy_extra_pays: value })} />
            <Check label="Copiar reglas de antigüedad" checked={form.copy_seniority_rules} onChange={(value) => setForm({ ...form, copy_seniority_rules: value })} />
            <Check label="Aplicar incremento a conceptos no salariales" checked={form.increase_non_salary} onChange={(value) => setForm({ ...form, increase_non_salary: value })} />
            <Check label="Marcar la tabla de origen como histórica" checked={form.mark_source_historical} onChange={(value) => setForm({ ...form, mark_source_historical: value })} />
          </div>

          <Field label="Observaciones de la revisión"><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} style={styles.textarea} placeholder="Ej. Revisión salarial publicada para el nuevo ejercicio." /></Field>

          <div style={styles.notice}>
            <strong>Aplicación del porcentaje</strong>
            <span>Se incrementan las filas y los conceptos salariales. Las deducciones se copian sin variación. Los conceptos generales sin ejercicio continúan aplicándose y no se duplican.</span>
            <span>Las reglas de pagas extra conservan sus porcentajes e importes fijos. Las reglas de antigüedad se copian; los importes fijos por módulo sí reciben el incremento general.</span>
            <span>La tabla se crea sin activar. La activación y la migración de contratos se realizan después desde el bloque específico.</span>
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={() => setOpen(false)} style={styles.secondaryButton}>Cancelar</button>
            <button type="submit" disabled={saving} style={styles.primaryButton}>{saving ? "Creando revisión…" : "Crear revisión salarial"}</button>
          </div>
        </form>
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

function Summary({ label, value }) {
  return <div style={styles.summary}><span>{label}</span><strong>{value}</strong></div>;
}

const styles = {
  wrapper: { border: "1px solid #d1d5db", background: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 14px", background: "#f9fafb" },
  title: { margin: 0, fontSize: "15px", fontWeight: 850, color: "#111827" },
  subtitle: { margin: "3px 0 0", color: "#6b7280", fontSize: "12px" },
  toggleButton: { height: "32px", border: "1px solid #111827", background: "#111827", color: "#fff", padding: "0 12px", fontSize: "12px", fontWeight: 850, cursor: "pointer" },
  body: { borderTop: "1px solid #e5e7eb", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" },
  sourceSummary: { display: "grid", gridTemplateColumns: "minmax(260px, 1.5fr) repeat(3, minmax(120px, .5fr))", gap: "10px", alignItems: "end", padding: "10px", border: "1px solid #e5e7eb", background: "#f9fafb" },
  summary: { minHeight: "34px", display: "flex", flexDirection: "column", gap: "2px", justifyContent: "center", color: "#374151", fontSize: "11px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" },
  field: { display: "flex", flexDirection: "column", gap: "5px", color: "#374151", fontSize: "12px", fontWeight: 750 },
  input: { width: "100%", height: "34px", boxSizing: "border-box", border: "1px solid #d1d5db", background: "#fff", padding: "6px 8px", fontSize: "12px" },
  percentage: { position: "relative" },
  options: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", padding: "10px", border: "1px solid #e5e7eb" },
  check: { display: "flex", alignItems: "center", gap: "8px", color: "#374151", fontSize: "12px", fontWeight: 700 },
  textarea: { width: "100%", minHeight: "68px", boxSizing: "border-box", border: "1px solid #d1d5db", padding: "7px 8px", fontSize: "12px" },
  notice: { display: "flex", flexDirection: "column", gap: "3px", padding: "10px", border: "1px solid #fde68a", background: "#fffbeb", color: "#78350f", fontSize: "12px" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "8px" },
  primaryButton: { height: "34px", border: "1px solid #111827", background: "#111827", color: "#fff", padding: "0 14px", fontSize: "12px", fontWeight: 850, cursor: "pointer" },
  secondaryButton: { height: "34px", border: "1px solid #d1d5db", background: "#fff", color: "#374151", padding: "0 12px", fontSize: "12px", fontWeight: 800, cursor: "pointer" },
  error: { padding: "9px 10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: "12px", fontWeight: 750 },
  success: { padding: "9px 10px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", display: "flex", flexDirection: "column", gap: "3px", fontSize: "12px" },
};
