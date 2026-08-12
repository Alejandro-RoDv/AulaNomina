import { useEffect, useState } from "react";

import {
  calculateIrpf,
  fetchEmployeeIrpfAnnualSummary,
  simulateEmployeeIrpfAnnualSummary,
  updateEmployeeTaxProfile,
} from "../../services/taxProfileApi";
import "../payrolls/irpfWorkspace.css";

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

function getReal(row) {
  return row?.real || null;
}

function getProjected(row) {
  return row?.projected || row || null;
}

function getProjectedVariables(row) {
  return Number(getProjected(row)?.salary_supplements || 0);
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
  const [activeTab, setActiveTab] = useState("summary");
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
    setActiveTab("summary");
  }, [employee?.id, taxProfile, activeContract?.id]);

  useEffect(() => {
    setSimulationActive(false);
    loadSummary({ simulate: false });
  }, [employee?.id, year]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleIrpfModeChange = (event) => {
    const nextMode = event.target.value;
    setIrpfMode(nextMode);
    if (nextMode === "auto") {
      setForm((prev) => ({ ...prev, voluntary_irpf: "", manual_regularization: false }));
    } else {
      setForm((prev) => ({ ...prev, manual_regularization: true }));
    }
  };

  const handleRecalculate = async () => {
    if (!employee?.id) return;
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const result = await calculateIrpf(buildPayload(form));
      setCalculation(result);
      setMessage("IRPF recalculado. Revisa el tipo sugerido antes de aplicarlo.");
    } catch (err) {
      setError(err.message || "Error al recalcular IRPF");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateVariables = async () => {
    setSimulationActive(true);
    await loadSummary({ simulate: true });
    setMessage("Simulación actualizada. La previsión anual incluye las variables indicadas.");
  };

  const handleClearSimulation = async () => {
    setSalaryIncrease("0");
    setIncentives([]);
    setSimulationActive(false);
    await loadSummary({ simulate: false });
    setMessage("Simulación descartada.");
  };

  const handleSaveFiscalData = async () => {
    if (!employee?.id) return;
    try {
      setSaving(true);
      setError("");
      await updateEmployeeTaxProfile(employee.id, buildPayload(form));
      setMessage("Datos fiscales guardados correctamente.");
      await onRefresh?.();
      await loadSummary({ simulate: false });
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
      const suggested = Number(calculation.suggested_irpf || 0);
      const payload = { ...buildPayload(form), voluntary_irpf: suggested, manual_regularization: true };
      await updateEmployeeTaxProfile(employee.id, payload);
      setForm((prev) => ({ ...prev, voluntary_irpf: String(suggested), manual_regularization: true }));
      setIrpfMode("voluntary");
      setMessage("IRPF sugerido aplicado para las próximas nóminas.");
      await onRefresh?.();
      await loadSummary({ simulate: false });
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
    setMessage("Cambios descartados.");
    setError("");
  };

  const goToPayrolls = () => {
    window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: "payroll-history" } }));
  };

  const addIncentive = () => setIncentives((prev) => [...prev, buildEmptyIncentive(year)]);
  const updateIncentive = (index, field, value) => setIncentives((prev) => prev.map((item, current) => current === index ? { ...item, [field]: value } : item));
  const removeIncentive = (index) => setIncentives((prev) => prev.filter((_, current) => current !== index));

  const suggestedIrpf = calculation?.suggested_irpf ?? summary?.suggested_irpf ?? null;
  const effectiveIrpf = irpfMode !== "auto" && form.voluntary_irpf !== "" ? Number(form.voluntary_irpf) : Number(suggestedIrpf || summary?.current_irpf || 0);
  const realTotals = summary?.totals?.real || { gross: 0, net: 0, irpf: 0 };
  const forecastTotals = summary?.totals?.forecast || { gross: 0, net: 0, irpf: 0 };
  const annualTotals = summary?.totals?.annual || { gross: 0, net: 0, irpf: 0 };
  const rows = summary?.months || [];
  const realMonthsCount = rows.filter((row) => row.real).length;
  const impact = simulationActive ? buildImpact(baselineSummary, summary) : null;
  const modeLabel = irpfMode === "voluntary" ? "Voluntario" : irpfMode === "manual" ? "Manual docente" : "Automático";
  const modeOrigin = irpfMode === "voluntary" ? "Tipo voluntario definido para el trabajador" : irpfMode === "manual" ? "Tipo forzado para práctica docente" : "Cálculo automático del sistema";

  const renderSummary = () => (
    <div className="irpf-tab-panel">
      {realMonthsCount > 0 && (
        <div className="irpf-banner irpf-banner--info">
          Hay {realMonthsCount} nóminas ya generadas. El recálculo afecta a la previsión y a futuras nóminas, no a los meses ya cobrados.
        </div>
      )}

      <div className="irpf-status-strip">
        <div><span>Modo actual</span><strong>{modeLabel}</strong></div>
        <div><span>IRPF aplicado</span><strong>{formatPercent(effectiveIrpf)}</strong></div>
        <div className="is-wide"><span>Origen</span><strong>{modeOrigin}</strong></div>
      </div>

      <div className="irpf-kpi-grid irpf-kpi-grid--main">
        <div className="irpf-kpi"><span>Bruto anual previsto</span><strong>{formatMoney(annualTotals.gross)}</strong></div>
        <div className="irpf-kpi"><span>Neto anual previsto</span><strong>{formatMoney(annualTotals.net)}</strong></div>
        <div className="irpf-kpi"><span>IRPF anual previsto</span><strong>{formatMoney(annualTotals.irpf)}</strong></div>
        <div className="irpf-kpi irpf-kpi--accent"><span>Tipo aplicado</span><strong>{formatPercent(effectiveIrpf)}</strong></div>
      </div>

      <div className="irpf-summary-split">
        <section className="irpf-subcard">
          <div className="irpf-subcard__heading"><div><span className="irpf-eyebrow">Situación del ejercicio</span><h3>Real frente a pendiente</h3></div></div>
          <div className="irpf-mini-grid">
            <div><span>Ya cobrado</span><strong>{formatMoney(realTotals.gross)}</strong><small>Neto {formatMoney(realTotals.net)}</small></div>
            <div><span>IRPF retenido</span><strong>{formatMoney(realTotals.irpf)}</strong><small>{realMonthsCount} meses reales</small></div>
            <div><span>Pendiente bruto</span><strong>{formatMoney(forecastTotals.gross)}</strong><small>Neto {formatMoney(forecastTotals.net)}</small></div>
            <div><span>IRPF pendiente</span><strong>{formatMoney(forecastTotals.irpf)}</strong><small>Previsión restante</small></div>
          </div>
        </section>

        <section className="irpf-subcard">
          <div className="irpf-subcard__heading"><div><span className="irpf-eyebrow">Operativa</span><h3>Recalcular retención</h3></div></div>
          <p>Recalcula con los datos fiscales actuales. El resultado no se aplica hasta confirmarlo.</p>
          <div className="irpf-calc-result">
            <span>Tipo sugerido</span>
            <strong>{formatPercent(calculation?.suggested_irpf ?? suggestedIrpf)}</strong>
          </div>
          <div className="irpf-action-row">
            <button type="button" className="irpf-btn irpf-btn--primary" onClick={handleRecalculate} disabled={loading || saving}>{loading ? "Recalculando..." : "Recalcular IRPF"}</button>
            <button type="button" className="irpf-btn irpf-btn--secondary" onClick={handleApplySuggestedIrpf} disabled={!calculation || saving}>Aplicar sugerido</button>
            <button type="button" className="irpf-btn irpf-btn--secondary" onClick={goToPayrolls}>Ver nóminas</button>
          </div>
        </section>
      </div>
    </div>
  );

  const renderForecast = () => (
    <div className="irpf-tab-panel">
      <div className="irpf-panel-toolbar">
        <div>
          <span className="irpf-eyebrow">Ejercicio</span>
          <h3>Previsión mensual</h3>
          <p>Una sola lectura por mes: usa el dato real cuando existe y la previsión cuando todavía no se ha generado la nómina.</p>
        </div>
        <label className="irpf-field irpf-field--year">Año<input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value || currentYear))} /></label>
      </div>

      <div className="irpf-table-shell">
        <table className="irpf-table irpf-table--forecast">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Estado</th>
              <th className="is-number">Variables</th>
              <th className="is-number">Bruto</th>
              <th className="is-number">IRPF %</th>
              <th className="is-number">Retención</th>
              <th className="is-number">Neto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const real = getReal(row);
              const projected = getProjected(row);
              const snapshot = real || projected;
              return (
                <tr key={`${row.year}-${row.month}-${row.source}-${row.payroll_id || "forecast"}`}>
                  <td><strong>{getMonthLabel(row.month)}</strong></td>
                  <td><span className={`irpf-state ${real ? "irpf-state--real" : "irpf-state--forecast"}`}>{real ? "Cobrado" : row.status || "Previsto"}</span></td>
                  <td className="is-number">{getProjectedVariables(row) ? formatMoney(getProjectedVariables(row)) : "-"}</td>
                  <td className="is-number">{formatMoney(snapshot?.gross_salary || 0)}</td>
                  <td className="is-number">{formatPercent(snapshot?.irpf_percentage ?? effectiveIrpf)}</td>
                  <td className="is-number"><strong>{formatMoney(snapshot?.irpf || 0)}</strong></td>
                  <td className="is-number">{formatMoney(snapshot?.net_salary || 0)}</td>
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr className="irpf-total-row">
                <td><strong>Total anual</strong></td>
                <td>Real + previsto</td>
                <td className="is-number">{formatMoney(summary?.future_variables_total || 0)}</td>
                <td className="is-number"><strong>{formatMoney(annualTotals.gross)}</strong></td>
                <td className="is-number"><strong>{formatPercent(effectiveIrpf)}</strong></td>
                <td className="is-number"><strong>{formatMoney(annualTotals.irpf)}</strong></td>
                <td className="is-number"><strong>{formatMoney(annualTotals.net)}</strong></td>
              </tr>
            )}
            {rows.length === 0 && <tr><td colSpan="7" className="irpf-table-empty">Sin datos anuales disponibles.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSimulation = () => (
    <div className="irpf-tab-panel">
      <div className="irpf-panel-toolbar">
        <div>
          <span className="irpf-eyebrow">Escenario</span>
          <h3>Variables futuras e incentivos</h3>
          <p>Prueba subidas o conceptos futuros sin modificar los datos fiscales guardados ni las nóminas ya generadas.</p>
        </div>
        <div className="irpf-action-row">
          <button type="button" className="irpf-btn irpf-btn--secondary" onClick={addIncentive}>Añadir variable</button>
          <button type="button" className="irpf-btn irpf-btn--primary" onClick={handleSimulateVariables} disabled={loadingSummary}>Simular</button>
          <button type="button" className="irpf-btn irpf-btn--danger" onClick={handleClearSimulation} disabled={loadingSummary}>Limpiar</button>
        </div>
      </div>

      <section className="irpf-subcard">
        <div className="irpf-simulation-base">
          <label className="irpf-field">Subida mensual simulada (€)<input type="number" step="0.01" value={salaryIncrease} onChange={(event) => setSalaryIncrease(event.target.value)} /></label>
          <div className="irpf-simulation-reference"><span>IRPF de referencia</span><strong>{formatPercent(effectiveIrpf)}</strong></div>
        </div>

        {incentives.length === 0 ? (
          <div className="irpf-empty-inline">No hay variables añadidas. Puedes simular solo una subida mensual o añadir conceptos puntuales.</div>
        ) : (
          <div className="irpf-variable-list">
            {incentives.map((item, index) => (
              <div key={`irpf-incentive-${index}`} className="irpf-variable-row">
                <select value={item.period_month} onChange={(event) => updateIncentive(index, "period_month", event.target.value)}>{MONTHS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <input type="number" step="0.01" value={item.amount} onChange={(event) => updateIncentive(index, "amount", event.target.value)} placeholder="Importe" />
                <input value={item.description} onChange={(event) => updateIncentive(index, "description", event.target.value)} placeholder="Descripción" />
                <button type="button" className="irpf-btn irpf-btn--danger irpf-btn--small" onClick={() => removeIncentive(index)}>Quitar</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {simulationActive && (
        <>
          <div className="irpf-kpi-grid">
            <div className="irpf-kpi"><span>Variables futuras</span><strong>{formatMoney(summary?.future_variables_total || 0)}</strong></div>
            <div className="irpf-kpi"><span>Bruto anual simulado</span><strong>{formatMoney(annualTotals.gross)}</strong></div>
            <div className="irpf-kpi"><span>Neto anual simulado</span><strong>{formatMoney(annualTotals.net)}</strong></div>
            <div className="irpf-kpi irpf-kpi--accent"><span>IRPF sugerido</span><strong>{formatPercent(summary?.suggested_irpf ?? effectiveIrpf)}</strong></div>
          </div>

          {impact && (
            <section className="irpf-impact-panel">
              <div><span>Variación tipo IRPF</span><strong>{formatSignedPercent(impact.irpfRate)}</strong></div>
              <div><span>Variación bruto anual</span><strong>{formatSignedMoney(impact.gross)}</strong></div>
              <div><span>Variación neto anual</span><strong>{formatSignedMoney(impact.net)}</strong></div>
              <div><span>Variación IRPF anual</span><strong>{formatSignedMoney(impact.irpf)}</strong></div>
            </section>
          )}
        </>
      )}
    </div>
  );

  const renderFiscalData = () => (
    <div className="irpf-tab-panel">
      <div className="irpf-panel-toolbar">
        <div>
          <span className="irpf-eyebrow">Ficha fiscal</span>
          <h3>Datos que afectan al cálculo</h3>
          <p>Modifica los datos estructurales del trabajador y guarda antes de recalcular.</p>
        </div>
        <div className="irpf-action-row">
          <button type="button" className="irpf-btn irpf-btn--secondary" onClick={handleCancel} disabled={saving}>Descartar</button>
          <button type="button" className="irpf-btn irpf-btn--primary" onClick={handleSaveFiscalData} disabled={saving}>{saving ? "Guardando..." : "Guardar datos fiscales"}</button>
        </div>
      </div>

      <section className="irpf-form-section">
        <div className="irpf-form-section__title"><span>1</span><div><h4>Retención y ejercicio</h4><p>Modo de cálculo y tipo voluntario cuando proceda.</p></div></div>
        <div className="irpf-form-grid irpf-form-grid--4">
          <label className="irpf-field">Año<input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value || currentYear))} /></label>
          <label className="irpf-field">Modo IRPF<select value={irpfMode} onChange={handleIrpfModeChange}><option value="auto">Automático</option><option value="voluntary">Voluntario</option><option value="manual">Manual docente</option></select></label>
          <label className="irpf-field">IRPF voluntario / manual (%)<input name="voluntary_irpf" type="number" min="0" max="100" step="0.01" value={form.voluntary_irpf} onChange={handleChange} disabled={irpfMode === "auto"} /></label>
          <div className="irpf-readonly-field"><span>Tipo efectivo</span><strong>{formatPercent(effectiveIrpf)}</strong></div>
        </div>
      </section>

      <section className="irpf-form-section">
        <div className="irpf-form-section__title"><span>2</span><div><h4>Situación personal y familiar</h4><p>Datos personales que intervienen en el cálculo de retenciones.</p></div></div>
        <div className="irpf-form-grid irpf-form-grid--3">
          <label className="irpf-field">Comunidad autónoma<select name="autonomous_community" value={form.autonomous_community} onChange={handleChange}>{COMMUNITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="irpf-field">Año nacimiento<input name="birth_year" type="number" min="1906" max="2026" value={form.birth_year || ""} onChange={handleChange} /></label>
          <label className="irpf-field">Situación familiar<select name="family_situation" value={form.family_situation} onChange={handleChange}>{FAMILY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="irpf-field">NIF cónyuge<input name="spouse_nif" value={form.spouse_nif || ""} onChange={handleChange} /></label>
          <label className="irpf-field">Hijos / descendientes<input name="children_count" type="number" min="0" value={form.children_count || 0} onChange={handleChange} /></label>
          <label className="irpf-field">Ascendientes a cargo<input name="ascendants_in_care" type="number" min="0" value={form.ascendants_in_care || 0} onChange={handleChange} /></label>
        </div>
      </section>

      <section className="irpf-form-section">
        <div className="irpf-form-section__title"><span>3</span><div><h4>Relación laboral y retribución</h4><p>Contrato, previsión salarial y cotizaciones del ejercicio.</p></div></div>
        <div className="irpf-form-grid irpf-form-grid--3">
          <label className="irpf-field">Situación laboral<select name="employment_situation" value={form.employment_situation} onChange={handleChange}>{EMPLOYMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="irpf-field">Categoría contrato IRPF<select name="contract_category" value={form.contract_category} onChange={handleChange}>{CONTRACT_CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="irpf-field">Tipo contrato interno<input name="contract_type" value={form.contract_type || ""} onChange={handleChange} /></label>
          <label className="irpf-field">Inicio contrato<input name="contract_start_date" type="date" value={form.contract_start_date || ""} onChange={handleChange} /></label>
          <label className="irpf-field">Retribución anual prevista<input name="expected_annual_salary" type="number" min="0" step="0.01" value={form.expected_annual_salary || 0} onChange={handleChange} /></label>
          <label className="irpf-field">Cotizaciones SS previstas<input name="social_security_contributions" type="number" min="0" step="0.01" value={form.social_security_contributions || 0} onChange={handleChange} /></label>
        </div>
      </section>

      <section className="irpf-form-section">
        <div className="irpf-form-section__title"><span>4</span><div><h4>Circunstancias y ajustes</h4><p>Discapacidad, pensiones, anualidades y rendimientos irregulares.</p></div></div>
        <div className="irpf-form-grid irpf-form-grid--3">
          <label className="irpf-field">Grado discapacidad trabajador<select name="disability_degree" value={form.disability_degree} onChange={handleChange}>{DISABILITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="irpf-field">Pensión compensatoria<input name="compensatory_pension" type="number" min="0" step="0.01" value={form.compensatory_pension || 0} onChange={handleChange} /></label>
          <label className="irpf-field">Anualidades alimentos<input name="child_support_annuity" type="number" min="0" step="0.01" value={form.child_support_annuity || 0} onChange={handleChange} /></label>
          <label className="irpf-field">Rendimiento irregular art. 18.2<input name="irregular_income_18_2" type="number" min="0" step="0.01" value={form.irregular_income_18_2 || 0} onChange={handleChange} /></label>
          <label className="irpf-field">Rendimiento irregular art. 18.3<input name="irregular_income_18_3" type="number" min="0" step="0.01" value={form.irregular_income_18_3 || 0} onChange={handleChange} /></label>
        </div>

        <div className="irpf-check-grid">
          <label><input name="employee_disability" type="checkbox" checked={Boolean(form.employee_disability)} onChange={handleChange} /> Discapacidad trabajador</label>
          <label><input name="reduced_mobility" type="checkbox" checked={Boolean(form.reduced_mobility)} onChange={handleChange} /> Movilidad reducida</label>
          <label><input name="descendants_disability" type="checkbox" checked={Boolean(form.descendants_disability)} onChange={handleChange} /> Discapacidad descendientes</label>
          <label><input name="geographic_mobility" type="checkbox" checked={Boolean(form.geographic_mobility)} onChange={handleChange} /> Movilidad geográfica</label>
          <label><input name="home_loan" type="checkbox" checked={Boolean(form.home_loan)} onChange={handleChange} /> Préstamo vivienda habitual</label>
          <label><input name="ceuta_melilla_residence" type="checkbox" checked={Boolean(form.ceuta_melilla_residence)} onChange={handleChange} /> Reside Ceuta/Melilla</label>
          <label><input name="ceuta_melilla_income" type="checkbox" checked={Boolean(form.ceuta_melilla_income)} onChange={handleChange} /> Rentas Ceuta/Melilla</label>
          <label><input name="manual_regularization" type="checkbox" checked={Boolean(form.manual_regularization)} onChange={handleChange} /> Regularización manual</label>
        </div>

        <label className="irpf-field">Notas fiscales internas<textarea name="notes" value={form.notes || ""} onChange={handleChange} rows="3" /></label>
      </section>
    </div>
  );

  return (
    <section className="irpf-detail-panel">
      <div className="irpf-detail-header">
        <div>
          <span className="irpf-eyebrow">IRPF anual del trabajador</span>
          <h2>Situación fiscal y previsión</h2>
          <p>Consulta el resultado, revisa la previsión o modifica los datos fiscales sin mezclar todas las tareas en una sola pantalla.</p>
        </div>
        <div className="irpf-header-status">
          <span>Ejercicio</span><strong>{year}</strong>
        </div>
      </div>

      <nav className="irpf-tabs" aria-label="Secciones de IRPF">
        <button type="button" className={activeTab === "summary" ? "is-active" : ""} onClick={() => setActiveTab("summary")}><strong>Resumen</strong><small>Situación actual</small></button>
        <button type="button" className={activeTab === "forecast" ? "is-active" : ""} onClick={() => setActiveTab("forecast")}><strong>Previsión anual</strong><small>Mes a mes</small></button>
        <button type="button" className={activeTab === "simulation" ? "is-active" : ""} onClick={() => setActiveTab("simulation")}><strong>Simulación</strong><small>Variables futuras</small></button>
        <button type="button" className={activeTab === "fiscal" ? "is-active" : ""} onClick={() => setActiveTab("fiscal")}><strong>Datos fiscales</strong><small>Configuración</small></button>
      </nav>

      {error && <div className="irpf-banner irpf-banner--error">{error}</div>}
      {message && <div className="irpf-banner irpf-banner--success">{message}</div>}
      {loadingSummary && <div className="irpf-banner irpf-banner--info">Actualizando resumen anual...</div>}
      {!activeContract && <div className="irpf-banner irpf-banner--warning">El trabajador no tiene contrato activo. La previsión puede contener importes a cero.</div>}

      {activeTab === "summary" && renderSummary()}
      {activeTab === "forecast" && renderForecast()}
      {activeTab === "simulation" && renderSimulation()}
      {activeTab === "fiscal" && renderFiscalData()}
    </section>
  );
}
