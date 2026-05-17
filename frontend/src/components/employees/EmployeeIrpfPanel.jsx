import { useEffect, useState } from "react";

import {
  calculateIrpf,
  fetchEmployeeIrpfAnnualSummary,
  simulateEmployeeIrpfAnnualSummary,
  updateEmployeeTaxProfile,
} from "../../services/taxProfileApi";

const COMMUNITY_OPTIONS = [
  ["andalucia", "Andalucía"], ["aragon", "Aragón"], ["asturias", "Asturias"],
  ["baleares", "Baleares"], ["canarias", "Canarias"], ["cantabria", "Cantabria"],
  ["castilla_la_mancha", "Castilla-La Mancha"], ["castilla_y_leon", "Castilla y León"],
  ["cataluna", "Cataluña"], ["madrid", "Comunidad de Madrid"],
  ["extremadura", "Extremadura · pendiente"], ["galicia", "Galicia · pendiente"],
  ["la_rioja", "La Rioja · pendiente"], ["murcia", "Murcia · pendiente"],
  ["navarra", "Navarra · pendiente"], ["pais_vasco", "País Vasco · pendiente"],
  ["comunidad_valenciana", "Comunidad Valenciana · pendiente"],
];

const FAMILY_OPTIONS = [
  ["situation_1", "Situación 1 · monoparental con hijos"],
  ["situation_2", "Situación 2 · cónyuge sin rentas superiores al límite"],
  ["situation_3", "Situación 3 · resto de situaciones"],
];

const EMPLOYMENT_OPTIONS = [["active", "Activo"], ["pensioner", "Pensionista"], ["unemployed", "Desempleado"], ["other", "Otra situación"]];
const CONTRACT_CATEGORY_OPTIONS = [["general", "General"], ["inferior_year", "Contrato inferior al año"], ["special", "Relación laboral especial"], ["manual", "Manual docente"]];
const DISABILITY_OPTIONS = [["none", "Sin discapacidad"], ["from_33_to_65", "33% a 64%"], ["from_65", "65% o superior"]];
const MONTHS = [[1, "Enero"], [2, "Febrero"], [3, "Marzo"], [4, "Abril"], [5, "Mayo"], [6, "Junio"], [7, "Julio"], [8, "Agosto"], [9, "Septiembre"], [10, "Octubre"], [11, "Noviembre"], [12, "Diciembre"]];

const defaultForm = {
  birth_year: "",
  autonomous_community: "andalucia",
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

function toFormValue(taxProfile, employee, activeContract) {
  const annualSalary = Number(activeContract?.salary_base || taxProfile?.expected_annual_salary || 0);
  return {
    ...defaultForm,
    ...(taxProfile || {}),
    birth_year: taxProfile?.birth_year || employee?.birth_date?.slice?.(0, 4) || "",
    autonomous_community: taxProfile?.autonomous_community || "andalucia",
    descendants: taxProfile?.descendants || [],
    ascendants: taxProfile?.ascendants || [],
    contract_type: taxProfile?.contract_type || activeContract?.contract_type || "",
    contract_start_date: taxProfile?.contract_start_date || activeContract?.start_date || "",
    expected_annual_salary: taxProfile?.expected_annual_salary || annualSalary,
    voluntary_irpf: taxProfile?.voluntary_irpf ?? "",
    notes: taxProfile?.notes || "",
  };
}

function buildPayload(form) {
  return {
    birth_year: form.birth_year === "" ? null : Number(form.birth_year),
    autonomous_community: form.autonomous_community || "andalucia",
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
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function formatSignedMoney(value) {
  const number = Number(value || 0);
  const sign = number > 0 ? "+" : "";
  return `${sign}${formatMoney(number)}`;
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatSignedPercent(value) {
  const number = Number(value || 0);
  const sign = number > 0 ? "+" : "";
  return `${sign}${formatPercent(number)}`;
}

function getMonthLabel(month) {
  return MONTHS.find(([value]) => Number(value) === Number(month))?.[1] || String(month).padStart(2, "0");
}

function buildEmptyIncentive(year) {
  return { period_month: "9", amount: "0", description: "Variable futura", year };
}

function getRowVariables(row) {
  return Number(row?.salary_supplements || 0);
}

function buildImpact(baseSummary, currentSummary) {
  if (!baseSummary || !currentSummary) return null;
  return {
    irpfRate: Number(currentSummary.suggested_irpf || 0) - Number(baseSummary.suggested_irpf || 0),
    gross: Number(currentSummary.totals?.annual?.gross || 0) - Number(baseSummary.totals?.annual?.gross || 0),
    net: Number(currentSummary.totals?.annual?.net || 0) - Number(baseSummary.totals?.annual?.net || 0),
    irpf: Number(currentSummary.totals?.annual?.irpf || 0) - Number(baseSummary.totals?.annual?.irpf || 0),
  };
}

export default function EmployeeIrpfPanel({ employee, taxProfile, activeContract, onRefresh }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [form, setForm] = useState(toFormValue(taxProfile, employee, activeContract));
  const [summary, setSummary] = useState(null);
  const [baselineSummary, setBaselineSummary] = useState(null);
  const [calculation, setCalculation] = useState(null);
  const [irpfMode, setIrpfMode] = useState(taxProfile?.voluntary_irpf ? "voluntary" : "auto");
  const [salaryIncrease, setSalaryIncrease] = useState("0");
  const [incentives, setIncentives] = useState([]);
  const [simulationActive, setSimulationActive] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSummary = async ({ simulate = simulationActive } = {}) => {
    if (!employee?.id) return;
    try {
      setLoadingSummary(true);
      setError("");
      if (simulate) {
        const simulated = await simulateEmployeeIrpfAnnualSummary(employee.id, {
          year: Number(year),
          salary_increase: Number(salaryIncrease || 0),
          incentives: incentives
            .filter((item) => Number(item.amount || 0) !== 0)
            .map((item) => ({
              period_month: Number(item.period_month),
              amount: Number(item.amount || 0),
              description: item.description || "Variable futura",
            })),
        });
        setSummary(simulated);
      } else {
        const base = await fetchEmployeeIrpfAnnualSummary(employee.id, year);
        setSummary(base);
        setBaselineSummary(base);
      }
    } catch (err) {
      setError(err.message || "No se pudo cargar el resumen anual de IRPF");
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    setForm(toFormValue(taxProfile, employee, activeContract));
    setIrpfMode(taxProfile?.voluntary_irpf ? "voluntary" : "auto");
    setCalculation(null);
    setMessage("");
    setError("");
  }, [employee?.id, taxProfile, activeContract?.id]);

  useEffect(() => {
    setSimulationActive(false);
    loadSummary({ simulate: false });
  }, [employee?.id, year]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleRecalculate = async () => {
    if (!employee?.id) {
      setError("Selecciona un trabajador para recalcular IRPF");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");
      const result = await calculateIrpf(buildPayload(form));
      setCalculation(result);
      setMessage("IRPF recalculado. Revisa el resultado antes de aplicarlo.");
    } catch (err) {
      setError(err.message || "Error al recalcular IRPF");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateVariables = async () => {
    setSimulationActive(true);
    await loadSummary({ simulate: true });
    setMessage("Previsión anual simulada con variables futuras.");
  };

  const handleClearSimulation = async () => {
    setSalaryIncrease("0");
    setIncentives([]);
    setSimulationActive(false);
    await loadSummary({ simulate: false });
    setMessage("Simulación de variables descartada.");
  };

  const handleSaveFiscalData = async () => {
    if (!employee?.id) return;
    try {
      setSaving(true);
      setError("");
      await updateEmployeeTaxProfile(employee.id, buildPayload(form));
      setMessage("Datos fiscales guardados correctamente");
      await onRefresh?.();
      await loadSummary();
    } catch (err) {
      setError(err.message || "Error al guardar datos fiscales");
    } finally {
      setSaving(false);
    }
  };

  const handleApplySuggestedIrpf = async () => {
    if (!employee?.id || !calculation) return;
    try {
      setSaving(true);
      setError("");
      const payload = { ...buildPayload(form), voluntary_irpf: Number(calculation.suggested_irpf || 0), manual_regularization: true };
      await updateEmployeeTaxProfile(employee.id, payload);
      setForm((prev) => ({ ...prev, voluntary_irpf: String(calculation.suggested_irpf || 0), manual_regularization: true }));
      setIrpfMode("voluntary");
      setMessage("IRPF sugerido aplicado como IRPF voluntario para próximas nóminas.");
      await onRefresh?.();
      await loadSummary();
    } catch (err) {
      setError(err.message || "Error al aplicar el IRPF sugerido");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(toFormValue(taxProfile, employee, activeContract));
    setCalculation(null);
    setIrpfMode(taxProfile?.voluntary_irpf ? "voluntary" : "auto");
    setMessage("Cambios descartados");
    setError("");
  };

  const goToPayrolls = () => {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    window.dispatchEvent(new Event("aulanomina-route-change"));
  };

  const addIncentive = () => setIncentives((prev) => [...prev, buildEmptyIncentive(year)]);
  const updateIncentive = (index, field, value) => setIncentives((prev) => prev.map((item, current) => current === index ? { ...item, [field]: value } : item));
  const removeIncentive = (index) => setIncentives((prev) => prev.filter((_, current) => current !== index));

  const suggestedIrpf = calculation?.suggested_irpf ?? summary?.suggested_irpf ?? null;
  const effectiveIrpf = irpfMode === "voluntary" && form.voluntary_irpf !== "" ? Number(form.voluntary_irpf) : Number(suggestedIrpf || summary?.current_irpf || 0);
  const realTotals = summary?.totals?.real || { gross: 0, net: 0, irpf: 0 };
  const forecastTotals = summary?.totals?.forecast || { gross: 0, net: 0, irpf: 0 };
  const annualTotals = summary?.totals?.annual || { gross: 0, net: 0, irpf: 0 };
  const rows = summary?.months || [];
  const realMonthsCount = rows.filter((row) => row.source === "real").length;
  const impact = simulationActive ? buildImpact(baselineSummary, summary) : null;
  const modeLabel = irpfMode === "voluntary" ? "Voluntario" : irpfMode === "manual" ? "Manual docente" : "Automático";
  const modeOrigin = irpfMode === "voluntary" ? "Introducido como IRPF voluntario" : irpfMode === "manual" ? "Forzado para práctica docente" : "Cálculo automático del sistema";

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>IRPF ANUAL DEL TRABAJADOR</p>
          <h3 style={styles.title}>IRPF y previsión anual</h3>
          <p style={styles.subtitle}>Cada mes muestra una única cantidad: real si la nómina ya existe, prevista si aún no existe.</p>
        </div>
        <div style={styles.actions}>
          <button type="button" onClick={handleRecalculate} disabled={loading || saving} style={styles.primaryButton}>{loading ? "Recalculando..." : "Recalcular IRPF"}</button>
          <button type="button" onClick={handleApplySuggestedIrpf} disabled={!calculation || saving} style={styles.secondaryButton}>Aplicar IRPF sugerido</button>
          <button type="button" onClick={handleSaveFiscalData} disabled={saving} style={styles.secondaryButton}>Guardar datos fiscales</button>
          <button type="button" onClick={goToPayrolls} style={styles.secondaryButton}>Ver nóminas reales</button>
          <button type="button" onClick={handleCancel} disabled={saving} style={styles.cancelButton}>Cancelar</button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}
      {loadingSummary && <div style={styles.warning}>Actualizando resumen anual...</div>}
      {!activeContract && <div style={styles.warning}>El trabajador no tiene contrato activo. El backend calculará el resumen con contrato disponible o importes a cero.</div>}
      {realMonthsCount > 0 && <div style={styles.info}>Hay {realMonthsCount} nóminas ya generadas. El recálculo afecta a la previsión y a futuras nóminas; no modifica los meses ya cobrados.</div>}

      <div style={styles.statusGrid}>
        <div style={styles.statusBox}><span>Modo actual</span><strong>{modeLabel}</strong></div>
        <div style={styles.statusBox}><span>IRPF aplicado en nómina</span><strong>{formatPercent(effectiveIrpf)}</strong></div>
        <div style={styles.statusBoxWide}><span>Origen</span><strong>{modeOrigin}</strong></div>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.kpiAccent}><span>Bruto anual previsto</span><strong>{formatMoney(annualTotals.gross)}</strong></div>
        <div style={styles.kpiAccent}><span>Neto anual previsto</span><strong>{formatMoney(annualTotals.net)}</strong></div>
        <div style={styles.kpiAccent}><span>IRPF anual previsto</span><strong>{formatMoney(annualTotals.irpf)}</strong></div>
        <div style={styles.kpiAccent}><span>IRPF aplicado</span><strong>{formatPercent(effectiveIrpf)}</strong></div>
        <div style={styles.kpi}><span>Ya cobrado bruto/neto</span><strong>{formatMoney(realTotals.gross)} / {formatMoney(realTotals.net)}</strong></div>
        <div style={styles.kpi}><span>IRPF ya retenido</span><strong>{formatMoney(realTotals.irpf)}</strong></div>
        <div style={styles.kpi}><span>Pendiente bruto/neto</span><strong>{formatMoney(forecastTotals.gross)} / {formatMoney(forecastTotals.net)}</strong></div>
        <div style={styles.kpi}><span>IRPF pendiente previsto</span><strong>{formatMoney(forecastTotals.irpf)}</strong></div>
      </div>

      {impact && (
        <div style={styles.impactBox}>
          <strong>Impacto de la simulación</strong>
          <div style={styles.impactGrid}>
            <span>IRPF sugerido: {formatSignedPercent(impact.irpfRate)}</span>
            <span>Bruto anual: {formatSignedMoney(impact.gross)}</span>
            <span>Neto anual: {formatSignedMoney(impact.net)}</span>
            <span>IRPF anual: {formatSignedMoney(impact.irpf)}</span>
          </div>
        </div>
      )}

      <div style={styles.controlGrid}>
        <label style={styles.field}>Año<input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value || currentYear))} style={styles.input} /></label>
        <label style={styles.field}>Modo IRPF<select value={irpfMode} onChange={(event) => setIrpfMode(event.target.value)} style={styles.input}><option value="auto">Automático</option><option value="voluntary">Voluntario</option><option value="manual">Manual docente</option></select></label>
        <label style={styles.field}>IRPF voluntario / manual (%)<input name="voluntary_irpf" type="number" min="0" max="100" step="0.01" value={form.voluntary_irpf} onChange={handleChange} style={styles.input} /></label>
        <div style={styles.resultBox}><span>IRPF usado en meses previstos</span><strong>{formatPercent(effectiveIrpf)}</strong></div>
      </div>

      <details style={styles.variableBox} open>
        <summary style={styles.summary}>Variables futuras e incentivos</summary>
        <div style={styles.variableToolbar}>
          <label style={styles.field}>Subida mensual simulada<input type="number" step="0.01" value={salaryIncrease} onChange={(event) => setSalaryIncrease(event.target.value)} style={styles.input} /></label>
          <div style={styles.variableActions}>
            <button type="button" onClick={addIncentive} style={styles.secondaryButton}>Añadir variable</button>
            <button type="button" onClick={handleSimulateVariables} disabled={loadingSummary} style={styles.primaryButton}>Simular variables</button>
            <button type="button" onClick={handleClearSimulation} disabled={loadingSummary} style={styles.cancelButton}>Limpiar simulación</button>
          </div>
        </div>

        {simulationActive && <div style={styles.info}>Simulación activa. Variables futuras totales: {formatMoney(summary?.future_variables_total || 0)}. Salario anual con variables: {formatMoney(summary?.expected_annual_salary_with_variables || 0)}.</div>}
        {incentives.length === 0 && <p style={styles.emptyText}>Sin variables futuras añadidas.</p>}
        {incentives.map((item, index) => (
          <div key={`irpf-incentive-${index}`} style={styles.incentiveRow}>
            <select value={item.period_month} onChange={(event) => updateIncentive(index, "period_month", event.target.value)} style={styles.input}>{MONTHS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <input type="number" step="0.01" value={item.amount} onChange={(event) => updateIncentive(index, "amount", event.target.value)} placeholder="Importe" style={styles.input} />
            <input value={item.description} onChange={(event) => updateIncentive(index, "description", event.target.value)} placeholder="Descripción" style={styles.input} />
            <button type="button" onClick={() => removeIncentive(index)} style={styles.dangerButton}>Quitar</button>
          </div>
        ))}
      </details>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr><th style={styles.th}>Mes</th><th style={styles.th}>Estado</th><th style={styles.thAmount}>Variables</th><th style={styles.thAmount}>Bruto</th><th style={styles.thAmount}>Neto</th><th style={styles.thAmount}>IRPF</th><th style={styles.thAmount}>IRPF %</th><th style={styles.th}>Origen</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isReal = row.source === "real";
              return (
                <tr key={`${row.year}-${row.month}-${row.source}-${row.payroll_id || "forecast"}`}>
                  <td style={styles.tdStrong}>{getMonthLabel(row.month)}</td>
                  <td style={styles.td}><span style={isReal ? styles.realBadge : styles.forecastBadge}>{isReal ? "Cobrado" : row.status || "Previsto"}</span></td>
                  <td style={styles.tdAmount}>{getRowVariables(row) !== 0 ? formatMoney(getRowVariables(row)) : "-"}</td>
                  <td style={styles.tdAmount}>{formatMoney(row.gross_salary)}</td>
                  <td style={styles.tdAmount}>{formatMoney(row.net_salary)}</td>
                  <td style={styles.tdAmountStrong}>{formatMoney(row.irpf)}</td>
                  <td style={styles.tdAmount}>{formatPercent(row.irpf_percentage)}</td>
                  <td style={styles.td}>{isReal ? "Nómina real" : "Previsión"}</td>
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr style={styles.totalRow}>
                <td style={styles.totalLabel}>Total anual</td>
                <td style={styles.totalCell}>Real + previsto</td>
                <td style={styles.totalAmount}>{formatMoney(summary?.future_variables_total || 0)}</td>
                <td style={styles.totalAmount}>{formatMoney(annualTotals.gross)}</td>
                <td style={styles.totalAmount}>{formatMoney(annualTotals.net)}</td>
                <td style={styles.totalAmountStrong}>{formatMoney(annualTotals.irpf)}</td>
                <td style={styles.totalAmount}>{formatPercent(effectiveIrpf)}</td>
                <td style={styles.totalCell}>Anual</td>
              </tr>
            )}
            {rows.length === 0 && <tr><td style={styles.td} colSpan="8">Sin datos anuales disponibles.</td></tr>}
          </tbody>
        </table>
      </div>

      <details style={styles.details}>
        <summary style={styles.summary}>Configuración fiscal que afecta al IRPF</summary>
        <div style={styles.formGrid}>
          <label style={styles.field}>Comunidad autónoma<select name="autonomous_community" value={form.autonomous_community} onChange={handleChange} style={styles.input}>{COMMUNITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label style={styles.field}>Año nacimiento<input name="birth_year" type="number" min="1906" max="2026" value={form.birth_year || ""} onChange={handleChange} style={styles.input} /></label>
          <label style={styles.field}>Situación familiar<select name="family_situation" value={form.family_situation} onChange={handleChange} style={styles.input}>{FAMILY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label style={styles.field}>NIF cónyuge<input name="spouse_nif" value={form.spouse_nif || ""} onChange={handleChange} style={styles.input} /></label>
          <label style={styles.field}>Situación laboral<select name="employment_situation" value={form.employment_situation} onChange={handleChange} style={styles.input}>{EMPLOYMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label style={styles.field}>Categoría contrato IRPF<select name="contract_category" value={form.contract_category} onChange={handleChange} style={styles.input}>{CONTRACT_CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label style={styles.field}>Tipo contrato interno<input name="contract_type" value={form.contract_type || ""} onChange={handleChange} style={styles.input} /></label>
          <label style={styles.field}>Inicio contrato<input name="contract_start_date" type="date" value={form.contract_start_date || ""} onChange={handleChange} style={styles.input} /></label>
          <label style={styles.field}>Retribución anual prevista<input name="expected_annual_salary" type="number" min="0" step="0.01" value={form.expected_annual_salary || 0} onChange={handleChange} style={styles.input} /></label>
          <label style={styles.field}>Cotizaciones SS previstas<input name="social_security_contributions" type="number" min="0" step="0.01" value={form.social_security_contributions || 0} onChange={handleChange} style={styles.input} /></label>
          <label style={styles.field}>Hijos / descendientes<input name="children_count" type="number" min="0" value={form.children_count || 0} onChange={handleChange} style={styles.input} /></label>
          <label style={styles.field}>Ascendientes a cargo<input name="ascendants_in_care" type="number" min="0" value={form.ascendants_in_care || 0} onChange={handleChange} style={styles.input} /></label>
          <label style={styles.field}>Grado discapacidad trabajador<select name="disability_degree" value={form.disability_degree} onChange={handleChange} style={styles.input}>{DISABILITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label style={styles.field}>Pensión compensatoria<input name="compensatory_pension" type="number" min="0" step="0.01" value={form.compensatory_pension || 0} onChange={handleChange} style={styles.input} /></label>
          <label style={styles.field}>Anualidades alimentos<input name="child_support_annuity" type="number" min="0" step="0.01" value={form.child_support_annuity || 0} onChange={handleChange} style={styles.input} /></label>
          <label style={styles.field}>Rendimiento irregular art. 18.2<input name="irregular_income_18_2" type="number" min="0" step="0.01" value={form.irregular_income_18_2 || 0} onChange={handleChange} style={styles.input} /></label>
          <label style={styles.field}>Rendimiento irregular art. 18.3<input name="irregular_income_18_3" type="number" min="0" step="0.01" value={form.irregular_income_18_3 || 0} onChange={handleChange} style={styles.input} /></label>
        </div>

        <div style={styles.checkGrid}>
          <label style={styles.check}><input name="employee_disability" type="checkbox" checked={Boolean(form.employee_disability)} onChange={handleChange} /> Discapacidad trabajador</label>
          <label style={styles.check}><input name="reduced_mobility" type="checkbox" checked={Boolean(form.reduced_mobility)} onChange={handleChange} /> Movilidad reducida</label>
          <label style={styles.check}><input name="descendants_disability" type="checkbox" checked={Boolean(form.descendants_disability)} onChange={handleChange} /> Discapacidad descendientes</label>
          <label style={styles.check}><input name="geographic_mobility" type="checkbox" checked={Boolean(form.geographic_mobility)} onChange={handleChange} /> Movilidad geográfica</label>
          <label style={styles.check}><input name="home_loan" type="checkbox" checked={Boolean(form.home_loan)} onChange={handleChange} /> Préstamo vivienda habitual</label>
          <label style={styles.check}><input name="ceuta_melilla_residence" type="checkbox" checked={Boolean(form.ceuta_melilla_residence)} onChange={handleChange} /> Reside Ceuta/Melilla</label>
          <label style={styles.check}><input name="ceuta_melilla_income" type="checkbox" checked={Boolean(form.ceuta_melilla_income)} onChange={handleChange} /> Rentas Ceuta/Melilla</label>
          <label style={styles.check}><input name="manual_regularization" type="checkbox" checked={Boolean(form.manual_regularization)} onChange={handleChange} /> Regularización manual</label>
        </div>
        <label style={styles.field}>Notas fiscales internas<textarea name="notes" value={form.notes || ""} onChange={handleChange} rows="3" style={styles.textarea} /></label>
      </details>
    </section>
  );
}

const styles = {
  card: { border: "2px solid #111", backgroundColor: "#fff", boxShadow: "4px 4px 0 #f5ef9c", padding: "18px", display: "flex", flexDirection: "column", gap: "16px" },
  header: { display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "flex-start" },
  eyebrow: { margin: "0 0 6px", fontSize: "11px", fontWeight: 950, letterSpacing: "0.08em", color: "#92400e" },
  title: { margin: 0, color: "#111", fontSize: "22px", fontWeight: 950 },
  subtitle: { margin: "6px 0 0", color: "#4b5563", fontSize: "13px", fontWeight: 750 },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" },
  primaryButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  secondaryButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  cancelButton: { backgroundColor: "#fff", color: "#991b1b", border: "1px solid #fecaca", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  dangerButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", padding: "8px 10px", cursor: "pointer", fontWeight: 900 },
  statusGrid: { display: "grid", gridTemplateColumns: "180px 220px 1fr", gap: "12px" },
  statusBox: { border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "10px", display: "flex", flexDirection: "column", gap: "4px" },
  statusBoxWide: { border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "10px", display: "flex", flexDirection: "column", gap: "4px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" },
  kpi: { border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" },
  kpiAccent: { border: "2px solid #111", backgroundColor: "#fffdf0", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" },
  impactBox: { border: "2px solid #1d4ed8", backgroundColor: "#eff6ff", padding: "12px", display: "flex", flexDirection: "column", gap: "8px", color: "#1e3a8a" },
  impactGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px", fontWeight: 900 },
  controlGrid: { display: "grid", gridTemplateColumns: "120px 180px 220px 1fr", gap: "12px", alignItems: "end" },
  resultBox: { border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "10px", display: "flex", justifyContent: "space-between", gap: "12px", fontWeight: 900 },
  variableBox: { border: "1px solid #e5e7eb", padding: "12px", backgroundColor: "#fffdf0" },
  variableToolbar: { display: "grid", gridTemplateColumns: "220px 1fr", gap: "12px", alignItems: "end" },
  variableActions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  incentiveRow: { display: "grid", gridTemplateColumns: "180px 130px 1fr 80px", gap: "8px", alignItems: "center", marginTop: "10px" },
  info: { backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "9px", fontWeight: 800 },
  emptyText: { margin: "10px 0 0", color: "#6b7280", fontWeight: 750, fontSize: "13px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", color: "#374151", fontSize: "13px", fontWeight: 850 },
  input: { height: "38px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box", width: "100%" },
  textarea: { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px", resize: "vertical" },
  tableWrapper: { overflowX: "auto", width: "100%" },
  table: { width: "100%", minWidth: "900px", borderCollapse: "collapse", fontSize: "13px" },
  th: { textAlign: "left", borderBottom: "2px solid #111", padding: "10px", backgroundColor: "#f8f3b5", fontWeight: 900 },
  thAmount: { textAlign: "right", borderBottom: "2px solid #111", padding: "10px", backgroundColor: "#f8f3b5", fontWeight: 900 },
  td: { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "middle" },
  tdStrong: { borderBottom: "1px solid #e5e7eb", padding: "10px", fontWeight: 900, verticalAlign: "middle" },
  tdAmount: { borderBottom: "1px solid #e5e7eb", padding: "10px", textAlign: "right", whiteSpace: "nowrap" },
  tdAmountStrong: { borderBottom: "1px solid #e5e7eb", padding: "10px", textAlign: "right", whiteSpace: "nowrap", fontWeight: 950 },
  totalRow: { backgroundColor: "#f3f4f6", color: "#111827" },
  totalLabel: { padding: "12px 10px", fontWeight: 950, borderTop: "2px solid #d1d5db" },
  totalCell: { padding: "12px 10px", fontWeight: 900, borderTop: "2px solid #d1d5db" },
  totalAmount: { padding: "12px 10px", textAlign: "right", whiteSpace: "nowrap", fontWeight: 950, borderTop: "2px solid #d1d5db" },
  totalAmountStrong: { padding: "12px 10px", textAlign: "right", whiteSpace: "nowrap", fontWeight: 950, borderTop: "2px solid #d1d5db" },
  realBadge: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", padding: "4px 8px", fontWeight: 900 },
  forecastBadge: { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "4px 8px", fontWeight: 900 },
  details: { border: "1px solid #e5e7eb", padding: "12px", backgroundColor: "#fff" },
  summary: { cursor: "pointer", fontWeight: 950, color: "#111827", marginBottom: "12px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" },
  checkGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px", margin: "14px 0" },
  check: { display: "flex", alignItems: "center", gap: "8px", border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "10px", color: "#374151", fontSize: "13px", fontWeight: 850 },
  error: { color: "#991b1b", backgroundColor: "#fee2e2", border: "1px solid #fecaca", padding: "9px", fontWeight: 800 },
  success: { color: "#166534", backgroundColor: "#dcfce7", border: "1px solid #bbf7d0", padding: "9px", fontWeight: 800 },
  warning: { color: "#92400e", backgroundColor: "#fef3c7", border: "1px solid #fde68a", padding: "9px", fontWeight: 800 },
};
