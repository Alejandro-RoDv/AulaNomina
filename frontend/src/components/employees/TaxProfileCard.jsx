import { useEffect, useState } from "react";

import { updateEmployeeTaxProfile } from "../../services/taxProfileApi";

const defaultTaxProfile = {
  family_situation: "general",
  children_count: 0,
  employee_disability: false,
  descendants_disability: false,
  ascendants_in_care: 0,
  geographic_mobility: false,
  compensatory_pension: 0,
  child_support_annuity: 0,
  contract_type: "",
  contract_start_date: "",
  expected_annual_salary: 0,
  manual_regularization: false,
  voluntary_irpf: "",
  notes: "",
};

function toFormValue(profile) {
  return {
    ...defaultTaxProfile,
    ...(profile || {}),
    contract_start_date: profile?.contract_start_date || "",
    voluntary_irpf: profile?.voluntary_irpf ?? "",
    notes: profile?.notes || "",
  };
}

function buildPayload(form) {
  return {
    family_situation: form.family_situation || "general",
    children_count: Number(form.children_count || 0),
    employee_disability: Boolean(form.employee_disability),
    descendants_disability: Boolean(form.descendants_disability),
    ascendants_in_care: Number(form.ascendants_in_care || 0),
    geographic_mobility: Boolean(form.geographic_mobility),
    compensatory_pension: Number(form.compensatory_pension || 0),
    child_support_annuity: Number(form.child_support_annuity || 0),
    contract_type: form.contract_type || null,
    contract_start_date: form.contract_start_date || null,
    expected_annual_salary: Number(form.expected_annual_salary || 0),
    manual_regularization: Boolean(form.manual_regularization),
    voluntary_irpf: form.voluntary_irpf === "" ? null : Number(form.voluntary_irpf),
    notes: form.notes || null,
  };
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value));
}

function getFamilySituationLabel(value) {
  const labels = {
    general: "General",
    situation_1: "Situación 1 · Soltero/a, viudo/a, divorciado/a o separado/a con hijos",
    situation_2: "Situación 2 · Cónyuge sin rentas superiores al límite",
    situation_3: "Situación 3 · Resto de situaciones",
  };
  return labels[value] || "General";
}

export default function TaxProfileCard({ employee, taxProfile, activeContract, onRefresh }) {
  const [form, setForm] = useState(toFormValue(taxProfile));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setForm(toFormValue(taxProfile));
    setError("");
    setSuccess("");
  }, [taxProfile, employee?.id]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleUseContractData = () => {
    setForm((prev) => ({
      ...prev,
      contract_type: activeContract?.contract_type || prev.contract_type,
      contract_start_date: activeContract?.start_date || prev.contract_start_date,
      expected_annual_salary: activeContract?.salary_base ? Number(activeContract.salary_base) * 14 : prev.expected_annual_salary,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!employee?.id) return;

    try {
      setIsSaving(true);
      setError("");
      setSuccess("");
      await updateEmployeeTaxProfile(employee.id, buildPayload(form));
      setSuccess("Datos fiscales guardados correctamente");
      setIsEditing(false);
      await onRefresh?.();
    } catch (err) {
      setError(err.message || "Error al guardar datos fiscales");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <section style={styles.card}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>MODELO 145 SIMULADO</p>
            <h3 style={styles.title}>Datos fiscales</h3>
            <p style={styles.subtitle}>Base fiscal del trabajador para el futuro cálculo automático de IRPF.</p>
          </div>
          <button type="button" onClick={() => setIsEditing(true)} style={styles.primaryButton}>
            {taxProfile ? "Editar" : "Crear ficha fiscal"}
          </button>
        </div>

        {!taxProfile && <p style={styles.emptyText}>Todavía no hay datos fiscales registrados para este trabajador.</p>}

        {taxProfile && (
          <div style={styles.summaryGrid}>
            <div><span>Situación familiar</span><strong>{getFamilySituationLabel(taxProfile.family_situation)}</strong></div>
            <div><span>Hijos</span><strong>{taxProfile.children_count}</strong></div>
            <div><span>Discapacidad trabajador</span><strong>{taxProfile.employee_disability ? "Sí" : "No"}</strong></div>
            <div><span>Ascendientes a cargo</span><strong>{taxProfile.ascendants_in_care}</strong></div>
            <div><span>Movilidad geográfica</span><strong>{taxProfile.geographic_mobility ? "Sí" : "No"}</strong></div>
            <div><span>Retribución anual prevista</span><strong>{formatMoney(taxProfile.expected_annual_salary)}</strong></div>
            <div><span>Regularización manual</span><strong>{taxProfile.manual_regularization ? "Activada" : "No"}</strong></div>
            <div><span>IRPF voluntario</span><strong>{taxProfile.voluntary_irpf === null || taxProfile.voluntary_irpf === undefined ? "-" : `${taxProfile.voluntary_irpf}%`}</strong></div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section style={styles.card}>
      <form onSubmit={handleSubmit}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>MODELO 145 SIMULADO</p>
            <h3 style={styles.title}>Datos fiscales</h3>
            <p style={styles.subtitle}>Campos suficientes para una simulación didáctica, sin replicar todo el modelo oficial.</p>
          </div>
          <div style={styles.actions}>
            <button type="button" onClick={handleUseContractData} style={styles.secondaryButton}>Usar contrato</button>
            <button type="button" onClick={() => setIsEditing(false)} style={styles.secondaryButton}>Cancelar</button>
            <button type="submit" disabled={isSaving} style={styles.primaryButton}>{isSaving ? "Guardando..." : "Guardar"}</button>
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.success}>{success}</p>}

        <div style={styles.formGrid}>
          <label style={styles.field}>Situación familiar
            <select name="family_situation" value={form.family_situation} onChange={handleChange} style={styles.input}>
              <option value="general">General</option>
              <option value="situation_1">Situación 1 · Soltero/a, viudo/a, divorciado/a o separado/a con hijos</option>
              <option value="situation_2">Situación 2 · Cónyuge sin rentas superiores al límite</option>
              <option value="situation_3">Situación 3 · Resto de situaciones</option>
            </select>
          </label>
          <label style={styles.field}>Número de hijos
            <input name="children_count" type="number" min="0" value={form.children_count} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Ascendientes a cargo
            <input name="ascendants_in_care" type="number" min="0" value={form.ascendants_in_care} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Tipo de contrato fiscal
            <input name="contract_type" value={form.contract_type || ""} onChange={handleChange} placeholder="Indefinido, temporal, prácticas..." style={styles.input} />
          </label>
          <label style={styles.field}>Fecha inicio contrato
            <input name="contract_start_date" type="date" value={form.contract_start_date || ""} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Retribución anual prevista
            <input name="expected_annual_salary" type="number" min="0" step="0.01" value={form.expected_annual_salary} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Pensión compensatoria
            <input name="compensatory_pension" type="number" min="0" step="0.01" value={form.compensatory_pension} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Anualidades por alimentos
            <input name="child_support_annuity" type="number" min="0" step="0.01" value={form.child_support_annuity} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>IRPF voluntario (%)
            <input name="voluntary_irpf" type="number" min="0" max="100" step="0.01" value={form.voluntary_irpf} onChange={handleChange} placeholder="Sin forzar" style={styles.input} />
          </label>
        </div>

        <div style={styles.checkGrid}>
          <label style={styles.check}><input name="employee_disability" type="checkbox" checked={form.employee_disability} onChange={handleChange} /> Discapacidad trabajador</label>
          <label style={styles.check}><input name="descendants_disability" type="checkbox" checked={form.descendants_disability} onChange={handleChange} /> Discapacidad descendientes</label>
          <label style={styles.check}><input name="geographic_mobility" type="checkbox" checked={form.geographic_mobility} onChange={handleChange} /> Movilidad geográfica</label>
          <label style={styles.check}><input name="manual_regularization" type="checkbox" checked={form.manual_regularization} onChange={handleChange} /> Regularización manual</label>
        </div>

        <label style={styles.field}>Notas fiscales internas
          <textarea name="notes" value={form.notes || ""} onChange={handleChange} rows="3" style={styles.textarea} placeholder="Ejemplo: IRPF voluntario solicitado por el trabajador, regularización pendiente, cambio salarial previsto..." />
        </label>
      </form>
    </section>
  );
}

const styles = {
  card: { border: "2px solid #111", backgroundColor: "#fff", boxShadow: "4px 4px 0 #f5ef9c", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" },
  header: { display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "flex-start", marginBottom: "12px" },
  eyebrow: { margin: "0 0 6px", fontSize: "11px", fontWeight: 950, letterSpacing: "0.08em", color: "#92400e" },
  title: { margin: 0, color: "#111", fontSize: "22px", fontWeight: 950 },
  subtitle: { margin: "6px 0 0", color: "#4b5563", fontSize: "13px", fontWeight: 750 },
  emptyText: { margin: 0, color: "#6b7280", fontSize: "14px", fontWeight: 750 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" },
  checkGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px", margin: "14px 0" },
  field: { display: "flex", flexDirection: "column", gap: "6px", color: "#374151", fontSize: "13px", fontWeight: 850 },
  check: { display: "flex", alignItems: "center", gap: "8px", border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "10px", color: "#374151", fontSize: "13px", fontWeight: 850 },
  input: { height: "39px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box" },
  textarea: { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box", resize: "vertical" },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" },
  primaryButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  secondaryButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  error: { margin: "0 0 10px", color: "#991b1b", backgroundColor: "#fee2e2", border: "1px solid #fecaca", padding: "9px", fontWeight: 800 },
  success: { margin: "0 0 10px", color: "#166534", backgroundColor: "#dcfce7", border: "1px solid #bbf7d0", padding: "9px", fontWeight: 800 },
};
