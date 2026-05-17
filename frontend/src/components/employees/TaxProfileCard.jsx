import { useEffect, useState } from "react";

import { calculateIrpf, updateEmployeeTaxProfile } from "../../services/taxProfileApi";

const defaultTaxProfile = {
  birth_year: "",
  family_situation: "situation_3",
  spouse_nif: "",
  employment_situation: "active",
  contract_category: "general",
  children_count: 0,
  descendants: [],
  ascendants_in_care: 0,
  ascendants: [],
  employee_disability: false,
  disability_degree: "none",
  reduced_mobility: false,
  descendants_disability: false,
  geographic_mobility: false,
  ceuta_melilla_residence: false,
  ceuta_melilla_income: false,
  home_loan: false,
  compensatory_pension: 0,
  child_support_annuity: 0,
  irregular_income_18_2: 0,
  irregular_income_18_3: 0,
  social_security_contributions: 0,
  contract_type: "",
  contract_start_date: "",
  expected_annual_salary: 0,
  manual_regularization: false,
  voluntary_irpf: "",
  notes: "",
};

function toFormValue(profile, employee) {
  return {
    ...defaultTaxProfile,
    ...(profile || {}),
    birth_year: profile?.birth_year || employee?.birth_date?.slice?.(0, 4) || "",
    descendants: profile?.descendants || [],
    ascendants: profile?.ascendants || [],
    contract_start_date: profile?.contract_start_date || "",
    voluntary_irpf: profile?.voluntary_irpf ?? "",
    notes: profile?.notes || "",
  };
}

function buildPayload(form) {
  return {
    birth_year: form.birth_year === "" ? null : Number(form.birth_year),
    family_situation: form.family_situation || "situation_3",
    spouse_nif: form.spouse_nif || null,
    employment_situation: form.employment_situation || "active",
    contract_category: form.contract_category || "general",
    children_count: Number(form.children_count || 0),
    descendants: Array.isArray(form.descendants) ? form.descendants : [],
    ascendants_in_care: Number(form.ascendants_in_care || 0),
    ascendants: Array.isArray(form.ascendants) ? form.ascendants : [],
    employee_disability: Boolean(form.employee_disability),
    disability_degree: form.disability_degree || "none",
    reduced_mobility: Boolean(form.reduced_mobility),
    descendants_disability: Boolean(form.descendants_disability),
    geographic_mobility: Boolean(form.geographic_mobility),
    ceuta_melilla_residence: Boolean(form.ceuta_melilla_residence),
    ceuta_melilla_income: Boolean(form.ceuta_melilla_income),
    home_loan: Boolean(form.home_loan),
    compensatory_pension: Number(form.compensatory_pension || 0),
    child_support_annuity: Number(form.child_support_annuity || 0),
    irregular_income_18_2: Number(form.irregular_income_18_2 || 0),
    irregular_income_18_3: Number(form.irregular_income_18_3 || 0),
    social_security_contributions: Number(form.social_security_contributions || 0),
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

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function getFamilySituationLabel(value) {
  const labels = {
    general: "General",
    situation_1: "Situación 1 · Monoparental con hijos",
    situation_2: "Situación 2 · Cónyuge sin rentas superiores al límite",
    situation_3: "Situación 3 · Resto de situaciones",
  };
  return labels[value] || labels.situation_3;
}

function getContractCategoryLabel(value) {
  const labels = {
    general: "General",
    inferior_year: "Inferior al año",
    special: "Relación laboral especial",
    manual: "Manual",
  };
  return labels[value] || "General";
}

function getDisabilityLabel(value) {
  const labels = {
    none: "Sin discapacidad",
    from_33_to_65: "33% a 64%",
    from_65: "65% o superior",
  };
  return labels[value] || "Sin discapacidad";
}

function buildDefaultDescendant() {
  return {
    birth_year: "",
    adoption_year: "",
    whole: false,
    disability_degree: "none",
    reduced_mobility: false,
  };
}

function buildDefaultAscendant() {
  return {
    birth_year: "",
    cohabitation_people: 1,
    disability_degree: "none",
    reduced_mobility: false,
  };
}

export default function TaxProfileCard({ employee, taxProfile, activeContract, onRefresh }) {
  const [form, setForm] = useState(toFormValue(taxProfile, employee));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculation, setCalculation] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setForm(toFormValue(taxProfile, employee));
    setCalculation(null);
    setError("");
    setSuccess("");
  }, [taxProfile, employee?.id]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleNestedChange = (collectionName, index, field, value) => {
    setForm((prev) => ({
      ...prev,
      [collectionName]: prev[collectionName].map((item, currentIndex) => currentIndex === index ? { ...item, [field]: value } : item),
    }));
  };

  const addDescendant = () => {
    setForm((prev) => ({ ...prev, descendants: [...prev.descendants, buildDefaultDescendant()], children_count: Number(prev.children_count || 0) + 1 }));
  };

  const removeDescendant = (index) => {
    setForm((prev) => ({
      ...prev,
      descendants: prev.descendants.filter((_, currentIndex) => currentIndex !== index),
      children_count: Math.max(0, Number(prev.children_count || 0) - 1),
    }));
  };

  const addAscendant = () => {
    setForm((prev) => ({ ...prev, ascendants: [...prev.ascendants, buildDefaultAscendant()], ascendants_in_care: Number(prev.ascendants_in_care || 0) + 1 }));
  };

  const removeAscendant = (index) => {
    setForm((prev) => ({
      ...prev,
      ascendants: prev.ascendants.filter((_, currentIndex) => currentIndex !== index),
      ascendants_in_care: Math.max(0, Number(prev.ascendants_in_care || 0) - 1),
    }));
  };

  const handleUseContractData = () => {
    setForm((prev) => ({
      ...prev,
      contract_type: activeContract?.contract_type || prev.contract_type,
      contract_start_date: activeContract?.start_date || prev.contract_start_date,
      expected_annual_salary: activeContract?.salary_base ? Number(activeContract.salary_base) * 14 : prev.expected_annual_salary,
    }));
  };

  const handleCalculate = async () => {
    try {
      setIsCalculating(true);
      setError("");
      setCalculation(await calculateIrpf(buildPayload(form)));
    } catch (err) {
      setError(err.message || "Error al calcular IRPF");
    } finally {
      setIsCalculating(false);
    }
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

  const effectiveIrpf = form.voluntary_irpf !== "" && form.voluntary_irpf !== null && form.voluntary_irpf !== undefined
    ? Number(form.voluntary_irpf)
    : calculation?.suggested_irpf;

  if (!isEditing) {
    return (
      <section style={styles.card}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>MODELO 145 + IRPF 2026</p>
            <h3 style={styles.title}>Datos fiscales</h3>
            <p style={styles.subtitle}>Base fiscal y simulación de retención según algoritmo AEAT 2026 simplificado para formación.</p>
          </div>
          <div style={styles.actions}>
            {taxProfile && <button type="button" onClick={handleCalculate} disabled={isCalculating} style={styles.secondaryButton}>{isCalculating ? "Calculando..." : "Calcular IRPF"}</button>}
            <button type="button" onClick={() => setIsEditing(true)} style={styles.primaryButton}>{taxProfile ? "Editar" : "Crear ficha fiscal"}</button>
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}
        {!taxProfile && <p style={styles.emptyText}>Todavía no hay datos fiscales registrados para este trabajador.</p>}

        {taxProfile && (
          <>
            {calculation && (
              <div style={styles.resultBox}>
                <div><span>IRPF sugerido</span><strong>{formatPercent(calculation.suggested_irpf)}</strong></div>
                <div><span>IRPF efectivo</span><strong>{formatPercent(effectiveIrpf)}</strong></div>
                <div><span>Retención anual</span><strong>{formatMoney(calculation.annual_withholding)}</strong></div>
                <div><span>Base de retención</span><strong>{formatMoney(calculation.base)}</strong></div>
                <div><span>Mínimo personal/familiar</span><strong>{formatMoney(calculation.minimum_personal_family)}</strong></div>
                <div><span>Exento</span><strong>{calculation.exempt ? "Sí" : "No"}</strong></div>
              </div>
            )}

            <div style={styles.summaryGrid}>
              <div><span>Situación familiar</span><strong>{getFamilySituationLabel(taxProfile.family_situation)}</strong></div>
              <div><span>Hijos</span><strong>{taxProfile.descendants?.length || taxProfile.children_count || 0}</strong></div>
              <div><span>Ascendientes</span><strong>{taxProfile.ascendants?.length || taxProfile.ascendants_in_care || 0}</strong></div>
              <div><span>Discapacidad</span><strong>{getDisabilityLabel(taxProfile.disability_degree)}</strong></div>
              <div><span>Contrato fiscal</span><strong>{getContractCategoryLabel(taxProfile.contract_category)}</strong></div>
              <div><span>Cotizaciones</span><strong>{taxProfile.social_security_contributions ? formatMoney(taxProfile.social_security_contributions) : "Estimadas"}</strong></div>
              <div><span>Retribución anual prevista</span><strong>{formatMoney(taxProfile.expected_annual_salary)}</strong></div>
              <div><span>IRPF voluntario</span><strong>{taxProfile.voluntary_irpf === null || taxProfile.voluntary_irpf === undefined ? "-" : formatPercent(taxProfile.voluntary_irpf)}</strong></div>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section style={styles.card}>
      <form onSubmit={handleSubmit}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>MODELO 145 + IRPF 2026</p>
            <h3 style={styles.title}>Datos fiscales</h3>
            <p style={styles.subtitle}>Campos clave del algoritmo oficial para alcanzar una simulación realista sin complicar el MVP.</p>
          </div>
          <div style={styles.actions}>
            <button type="button" onClick={handleUseContractData} style={styles.secondaryButton}>Usar contrato</button>
            <button type="button" onClick={handleCalculate} disabled={isCalculating} style={styles.secondaryButton}>{isCalculating ? "Calculando..." : "Calcular"}</button>
            <button type="button" onClick={() => setIsEditing(false)} style={styles.secondaryButton}>Cancelar</button>
            <button type="submit" disabled={isSaving} style={styles.primaryButton}>{isSaving ? "Guardando..." : "Guardar"}</button>
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.success}>{success}</p>}

        {calculation && (
          <div style={styles.resultBox}>
            <div><span>IRPF sugerido</span><strong>{formatPercent(calculation.suggested_irpf)}</strong></div>
            <div><span>IRPF efectivo</span><strong>{formatPercent(effectiveIrpf)}</strong></div>
            <div><span>Retención anual</span><strong>{formatMoney(calculation.annual_withholding)}</strong></div>
            <div><span>Cuota</span><strong>{formatMoney(calculation.cuota)}</strong></div>
            <div><span>Base</span><strong>{formatMoney(calculation.base)}</strong></div>
            <div><span>Reducción art. 20</span><strong>{formatMoney(calculation.reduction_work_income)}</strong></div>
          </div>
        )}

        <h4 style={styles.sectionTitle}>Perceptor</h4>
        <div style={styles.formGrid}>
          <label style={styles.field}>Año nacimiento
            <input name="birth_year" type="number" min="1906" max="2026" value={form.birth_year || ""} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Situación familiar
            <select name="family_situation" value={form.family_situation} onChange={handleChange} style={styles.input}>
              <option value="situation_1">Situación 1 · Monoparental con hijos</option>
              <option value="situation_2">Situación 2 · Cónyuge sin rentas superiores al límite</option>
              <option value="situation_3">Situación 3 · Resto de situaciones</option>
            </select>
          </label>
          <label style={styles.field}>NIF cónyuge
            <input name="spouse_nif" value={form.spouse_nif || ""} onChange={handleChange} placeholder="Solo situación 2" style={styles.input} />
          </label>
          <label style={styles.field}>Situación laboral
            <select name="employment_situation" value={form.employment_situation} onChange={handleChange} style={styles.input}>
              <option value="active">Activo</option>
              <option value="pensioner">Pensionista</option>
              <option value="unemployed">Desempleado</option>
              <option value="other">Otra situación</option>
            </select>
          </label>
          <label style={styles.field}>Categoría contrato IRPF
            <select name="contract_category" value={form.contract_category} onChange={handleChange} style={styles.input}>
              <option value="general">General</option>
              <option value="inferior_year">Inferior al año</option>
              <option value="special">Relación laboral especial</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label style={styles.field}>Tipo de contrato interno
            <input name="contract_type" value={form.contract_type || ""} onChange={handleChange} placeholder="Indefinido, temporal..." style={styles.input} />
          </label>
          <label style={styles.field}>Fecha inicio contrato
            <input name="contract_start_date" type="date" value={form.contract_start_date || ""} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Grado discapacidad trabajador
            <select name="disability_degree" value={form.disability_degree} onChange={handleChange} style={styles.input}>
              <option value="none">Sin discapacidad</option>
              <option value="from_33_to_65">33% a 64%</option>
              <option value="from_65">65% o superior</option>
            </select>
          </label>
          <label style={styles.field}>IRPF voluntario (%)
            <input name="voluntary_irpf" type="number" min="0" max="100" step="0.01" value={form.voluntary_irpf} onChange={handleChange} placeholder="Sin forzar" style={styles.input} />
          </label>
        </div>

        <div style={styles.checkGrid}>
          <label style={styles.check}><input name="employee_disability" type="checkbox" checked={form.employee_disability} onChange={handleChange} /> Discapacidad trabajador</label>
          <label style={styles.check}><input name="reduced_mobility" type="checkbox" checked={form.reduced_mobility} onChange={handleChange} /> Movilidad reducida</label>
          <label style={styles.check}><input name="geographic_mobility" type="checkbox" checked={form.geographic_mobility} onChange={handleChange} /> Movilidad geográfica</label>
          <label style={styles.check}><input name="home_loan" type="checkbox" checked={form.home_loan} onChange={handleChange} /> Préstamo vivienda habitual</label>
          <label style={styles.check}><input name="ceuta_melilla_residence" type="checkbox" checked={form.ceuta_melilla_residence} onChange={handleChange} /> Reside Ceuta/Melilla</label>
          <label style={styles.check}><input name="ceuta_melilla_income" type="checkbox" checked={form.ceuta_melilla_income} onChange={handleChange} /> Rentas Ceuta/Melilla</label>
          <label style={styles.check}><input name="manual_regularization" type="checkbox" checked={form.manual_regularization} onChange={handleChange} /> Regularización manual</label>
        </div>

        <h4 style={styles.sectionTitle}>Datos económicos</h4>
        <div style={styles.formGrid}>
          <label style={styles.field}>Retribución anual prevista
            <input name="expected_annual_salary" type="number" min="0" step="0.01" value={form.expected_annual_salary} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Cotizaciones Seguridad Social
            <input name="social_security_contributions" type="number" min="0" step="0.01" value={form.social_security_contributions} onChange={handleChange} placeholder="0 = estimar" style={styles.input} />
          </label>
          <label style={styles.field}>Reducción art. 18.2
            <input name="irregular_income_18_2" type="number" min="0" max="90000" step="0.01" value={form.irregular_income_18_2} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Reducción art. 18.3
            <input name="irregular_income_18_3" type="number" min="0" step="0.01" value={form.irregular_income_18_3} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Pensión compensatoria
            <input name="compensatory_pension" type="number" min="0" step="0.01" value={form.compensatory_pension} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Anualidades por alimentos
            <input name="child_support_annuity" type="number" min="0" step="0.01" value={form.child_support_annuity} onChange={handleChange} style={styles.input} />
          </label>
        </div>

        <h4 style={styles.sectionTitle}>Descendientes</h4>
        <div style={styles.collectionHeader}>
          <span>Hijos y otros descendientes con derecho a mínimo.</span>
          <button type="button" onClick={addDescendant} style={styles.secondaryButton}>Añadir descendiente</button>
        </div>
        {form.descendants.length === 0 && <p style={styles.emptyText}>Sin descendientes detallados. Puedes usar solo el número de hijos, pero el cálculo será menos fino.</p>}
        {form.descendants.map((descendant, index) => (
          <div key={`descendant-${index}`} style={styles.collectionRow}>
            <label style={styles.field}>Año nacimiento
              <input type="number" min="1906" max="2026" value={descendant.birth_year || ""} onChange={(event) => handleNestedChange("descendants", index, "birth_year", event.target.value)} style={styles.input} />
            </label>
            <label style={styles.field}>Año adopción/acogimiento
              <input type="number" min="1906" max="2026" value={descendant.adoption_year || ""} onChange={(event) => handleNestedChange("descendants", index, "adoption_year", event.target.value)} style={styles.input} />
            </label>
            <label style={styles.field}>Discapacidad
              <select value={descendant.disability_degree || "none"} onChange={(event) => handleNestedChange("descendants", index, "disability_degree", event.target.value)} style={styles.input}>
                <option value="none">Sin discapacidad</option>
                <option value="from_33_to_65">33% a 64%</option>
                <option value="from_65">65% o superior</option>
              </select>
            </label>
            <label style={styles.check}><input type="checkbox" checked={Boolean(descendant.whole)} onChange={(event) => handleNestedChange("descendants", index, "whole", event.target.checked)} /> Cómputo entero</label>
            <label style={styles.check}><input type="checkbox" checked={Boolean(descendant.reduced_mobility)} onChange={(event) => handleNestedChange("descendants", index, "reduced_mobility", event.target.checked)} /> Movilidad reducida</label>
            <button type="button" onClick={() => removeDescendant(index)} style={styles.dangerButton}>Quitar</button>
          </div>
        ))}

        <h4 style={styles.sectionTitle}>Ascendientes</h4>
        <div style={styles.collectionHeader}>
          <span>Ascendientes mayores de 65 años o con discapacidad.</span>
          <button type="button" onClick={addAscendant} style={styles.secondaryButton}>Añadir ascendiente</button>
        </div>
        {form.ascendants.length === 0 && <p style={styles.emptyText}>Sin ascendientes detallados.</p>}
        {form.ascendants.map((ascendant, index) => (
          <div key={`ascendant-${index}`} style={styles.collectionRow}>
            <label style={styles.field}>Año nacimiento
              <input type="number" min="1906" max="2026" value={ascendant.birth_year || ""} onChange={(event) => handleNestedChange("ascendants", index, "birth_year", event.target.value)} style={styles.input} />
            </label>
            <label style={styles.field}>Personas convivencia
              <input type="number" min="1" max="9" value={ascendant.cohabitation_people || 1} onChange={(event) => handleNestedChange("ascendants", index, "cohabitation_people", event.target.value)} style={styles.input} />
            </label>
            <label style={styles.field}>Discapacidad
              <select value={ascendant.disability_degree || "none"} onChange={(event) => handleNestedChange("ascendants", index, "disability_degree", event.target.value)} style={styles.input}>
                <option value="none">Sin discapacidad</option>
                <option value="from_33_to_65">33% a 64%</option>
                <option value="from_65">65% o superior</option>
              </select>
            </label>
            <label style={styles.check}><input type="checkbox" checked={Boolean(ascendant.reduced_mobility)} onChange={(event) => handleNestedChange("ascendants", index, "reduced_mobility", event.target.checked)} /> Movilidad reducida</label>
            <button type="button" onClick={() => removeAscendant(index)} style={styles.dangerButton}>Quitar</button>
          </div>
        ))}

        <label style={styles.field}>Notas fiscales internas
          <textarea name="notes" value={form.notes || ""} onChange={handleChange} rows="3" style={styles.textarea} placeholder="Ejemplo: IRPF voluntario solicitado, regularización pendiente, cambio salarial previsto..." />
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
  sectionTitle: { margin: "18px 0 10px", fontSize: "15px", fontWeight: 950, color: "#111827", borderBottom: "2px solid #111", paddingBottom: "6px" },
  emptyText: { margin: "8px 0", color: "#6b7280", fontSize: "14px", fontWeight: 750 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" },
  resultBox: { border: "2px solid #111", backgroundColor: "#fffdf0", boxShadow: "3px 3px 0 #111", padding: "14px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", marginBottom: "14px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" },
  checkGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px", margin: "14px 0" },
  collectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "10px", color: "#4b5563", fontSize: "13px", fontWeight: 800 },
  collectionRow: { display: "grid", gridTemplateColumns: "120px 150px 150px 150px 150px 80px", gap: "10px", alignItems: "end", border: "1px solid #d1d5db", padding: "10px", marginBottom: "8px", backgroundColor: "#f9fafb" },
  field: { display: "flex", flexDirection: "column", gap: "6px", color: "#374151", fontSize: "13px", fontWeight: 850 },
  check: { display: "flex", alignItems: "center", gap: "8px", border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "10px", color: "#374151", fontSize: "13px", fontWeight: 850, minHeight: "39px", boxSizing: "border-box" },
  input: { height: "39px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box", width: "100%" },
  textarea: { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box", resize: "vertical" },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" },
  primaryButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  secondaryButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  dangerButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", padding: "9px 10px", cursor: "pointer", fontWeight: 900 },
  error: { margin: "0 0 10px", color: "#991b1b", backgroundColor: "#fee2e2", border: "1px solid #fecaca", padding: "9px", fontWeight: 800 },
  success: { margin: "0 0 10px", color: "#166534", backgroundColor: "#dcfce7", border: "1px solid #bbf7d0", padding: "9px", fontWeight: 800 },
};
