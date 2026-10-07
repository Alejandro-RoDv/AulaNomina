import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { generatePayrolls } from "../services/payrollApi";
import { fetchPayrollPreparationStatuses } from "../services/payrollPreparationApi";
import "../components/payrolls/payrollPreparationFlow.css";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const EXTRA_PERIODS = [
  { value: 13, label: "Paga extra · Verano" },
  { value: 14, label: "Paga extra · Diciembre" },
  { value: 15, label: "Paga extra · 1" },
  { value: 16, label: "Paga extra · 2" },
  { value: 17, label: "Paga extra · 3" },
  { value: 18, label: "Paga extra · 4" },
  { value: 19, label: "Paga extra · 5" },
];

function periodLabel(value) {
  const numeric = Number(value);
  if (numeric >= 1 && numeric <= 12) return `${String(numeric).padStart(2, "0")} · ${MONTHS[numeric - 1]}`;
  return EXTRA_PERIODS.find((item) => item.value === numeric)?.label || String(value);
}

function employeeName(employee) {
  return [employee?.first_name, employee?.last_name, employee?.second_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function sourceLabel(value) {
  if (value === "prepared") return "Preparación guardada";
  if (value === "automatic") return "Datos automáticos";
  if (value === "extra_pay") return "Paga extraordinaria";
  if (value === "existing") return "Ya generada";
  return value || "-";
}

function preparationLabel(status) {
  if (!status) return { label: "Automática", tone: "automatic" };
  if (status.generated) return { label: "Generada · se puede recalcular", tone: "generated" };
  return { label: "Preparada", tone: "prepared" };
}

export default function PayrollSimulationPage({ companies = [], initialCompanyId = "", employees = [], contracts = [], onGenerated }) {
  const [period, setPeriod] = useState({
    period_month: String(currentMonth),
    period_year: String(currentYear),
  });
  const [scope, setScope] = useState("single");
  const [singleCompanyId, setSingleCompanyId] = useState(String(initialCompanyId || ""));
  const [companyIds, setCompanyIds] = useState([]);
  const [excludedContracts, setExcludedContracts] = useState([]);
  const statusRequest = useRef(0);
  const [preparationStatuses, setPreparationStatuses] = useState([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const isExtraPeriod = Number(period.period_month) > 12;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("aulanomina-header-context", {
      detail: {
        eyebrow: "NÓMINA",
        title: "Generar nóminas",
        subtitle: "Generación individual o masiva a partir de preparaciones guardadas y datos automáticos",
      },
    }));
    return () => window.dispatchEvent(new CustomEvent("aulanomina-header-context", { detail: null }));
  }, []);

  const loadPreparationStatuses = useCallback(async () => {
    const requestId = ++statusRequest.current;
    try {
      setStatusLoading(true);
      const data = await fetchPayrollPreparationStatuses(period.period_month, period.period_year);
      if (requestId !== statusRequest.current) return;
      setPreparationStatuses(Array.isArray(data) ? data : []);
    } catch (err) {
      if (requestId !== statusRequest.current) return;
      setError(err.message || "No se pudo cargar el estado del periodo");
      setPreparationStatuses([]);
    } finally {
      if (requestId === statusRequest.current) setStatusLoading(false);
    }
  }, [period.period_month, period.period_year]);

  useEffect(() => {
    const timer = setTimeout(loadPreparationStatuses, 0);
    return () => { clearTimeout(timer); statusRequest.current += 1; };
  }, [loadPreparationStatuses]);

  const statusMap = useMemo(
    () => new Map(preparationStatuses.map((item) => [String(item.contract_id), item])),
    [preparationStatuses]
  );

  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [String(employee.id), employee])),
    [employees]
  );

  const availableCompanies = useMemo(() => companies
    .filter((company) => company.is_active !== false && company.status !== "baja_definitiva")
    .slice().sort((a, b) => a.name.localeCompare(b.name, "es")), [companies]);
  const availableCompanyIds = useMemo(() => availableCompanies.map((company) => String(company.id)), [availableCompanies]);
  const effectiveCompanyId = availableCompanyIds.includes(singleCompanyId) ? singleCompanyId : (availableCompanyIds[0] || "");
  const scopeCompanyIds = useMemo(() => scope === "all" ? availableCompanyIds
    : scope === "single" ? [effectiveCompanyId].filter(Boolean)
      : companyIds.filter((id) => availableCompanyIds.includes(id)),
  [scope, availableCompanyIds, effectiveCompanyId, companyIds]);
  const companyMap = useMemo(() => new Map(companies.map((company) => [String(company.id), company])), [companies]);

  const activeContracts = useMemo(
    () => contracts.filter((contract) => contract.status === "active" && employeeMap.get(String(contract.employee_id))?.is_active && scopeCompanyIds.includes(String(contract.company_id))),
    [contracts, employeeMap, scopeCompanyIds]
  );

  const groupedContracts = useMemo(() => {
    const groups = new Map();
    activeContracts.forEach((contract) => {
      const key = String(contract.company_id || "none");
      if (!groups.has(key)) {
        groups.set(key, {
          company_id: contract.company_id,
          company_name: companyMap.get(key)?.name || contract.company_name || `Empresa ${contract.company_id}`,
          contracts: [],
        });
      }
      groups.get(key).contracts.push(contract);
    });
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        contracts: group.contracts.sort((a, b) => {
          const aName = employeeName(employeeMap.get(String(a.employee_id)));
          const bName = employeeName(employeeMap.get(String(b.employee_id)));
          return aName.localeCompare(bName, "es");
        }),
      }))
      .sort((a, b) => a.company_name.localeCompare(b.company_name, "es"));
  }, [activeContracts, employeeMap, companyMap]);

  const eligibleContractIds = useMemo(
    () => activeContracts
      .map((contract) => Number(contract.id)),
    [activeContracts]
  );

  const selectedContracts = useMemo(() => {
    const excluded = new Set(excludedContracts);
    return eligibleContractIds.filter((id) => !excluded.has(id));
  }, [eligibleContractIds, excludedContracts]);
  const selectedContractSet = useMemo(() => new Set(selectedContracts), [selectedContracts]);
  const selectedCompanyCount = new Set(activeContracts.filter((contract) => selectedContractSet.has(Number(contract.id))).map((contract) => contract.company_id)).size;

  const clearSelectionChanges = () => { setExcludedContracts([]); setResult(null); setError(""); };
  const changeScope = (value) => { setScope(value); clearSelectionChanges(); };
  const toggleScopeCompany = (id) => {
    setCompanyIds((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]);
    clearSelectionChanges();
  };
  const toggleContract = (contractId) => {
    const id = Number(contractId);
    setExcludedContracts((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]);
    setResult(null);
  };
  const toggleCompany = (group) => {
    const ids = group.contracts.map((contract) => Number(contract.id));
    const allSelected = ids.every((id) => selectedContractSet.has(id));
    setExcludedContracts((previous) => allSelected ? Array.from(new Set([...previous, ...ids])) : previous.filter((id) => !ids.includes(id)));
    setResult(null);
  };
  const toggleAll = () => {
    setExcludedContracts(selectedContracts.length === eligibleContractIds.length ? eligibleContractIds : []);
    setResult(null);
  };

  const handlePeriodChange = (field, value) => {
    setPeriod((previous) => ({ ...previous, [field]: value }));
    setExcludedContracts([]);
    setResult(null);
    setError("");
  };

  const handleGenerate = async () => {
    if (!selectedContracts.length || submitting) return;
    const year = Number(period.period_year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) { setError("Introduce un año entre 2000 y 2100."); return; }
    setError("");
    setResult(null);
    try {
      setSubmitting(true);
      const data = await generatePayrolls({
        period_month: Number(period.period_month),
        period_year: Number(period.period_year),
        company_ids: scopeCompanyIds.map(Number),
        contract_ids: selectedContracts,
        recalculate_existing: true,
      });
      setResult(data);
      await loadPreparationStatuses();
      if (onGenerated) await onGenerated(data);
    } catch (err) {
      setError(err.message || "No se pudieron generar las nóminas");
    } finally {
      setSubmitting(false);
    }
  };

  const resultCompanies = useMemo(() => {
    const groups = new Map();
    for (const item of result?.items || []) {
      const key = String(item.company_id);
      if (!groups.has(key)) groups.set(key, { id: key, name: item.company_name || companyMap.get(key)?.name || `Empresa ${key}`, generated: 0, skipped: 0, existing: 0 });
      const group = groups.get(key);
      if (item.status === "skipped") group.skipped += 1;
      else if (item.source === "existing") group.existing += 1;
      else group.generated += 1;
    }
    return Array.from(groups.values());
  }, [result, companyMap]);

  const openHistory = () => {
    const params = new URLSearchParams();
    params.set("period", `${period.period_year}-${String(period.period_month).padStart(2, "0")}`);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: "payroll-history" } }));
  };

  return (
    <div className="payroll-s42 payroll-generation">
      <section className="payroll-generation__scope">
        <div className="payroll-generation__scope-heading">
          <div>
            <span>GENERACIÓN DEL PERIODO</span>
            <h2>Selecciona qué nóminas quieres generar</h2>
            <p>
              {isExtraPeriod
                ? "La paga extraordinaria se resuelve desde la configuración del convenio y del contrato. Los contratos sin una paga configurada para este periodo se omitirán con su motivo."
                : "Las preparaciones guardadas conservan sus últimos conceptos. El resto se calcula automáticamente desde contrato, permanentes e incidencias."}
            </p>
          </div>
          <button type="button" className="payroll-s42__secondary" onClick={toggleAll} disabled={submitting || !eligibleContractIds.length}>
            {eligibleContractIds.length && eligibleContractIds.every((id) => selectedContractSet.has(id)) ? "Deseleccionar todas" : "Seleccionar todas"}
          </button>
        </div>
        <fieldset className="payroll-generation__company-scope" disabled={submitting}>
          <legend>Empresas para la generación</legend>
          <div className="payroll-generation__scope-options">
            {[["single", "Una empresa"], ["group", "Un grupo de empresas"], ["all", "Todas las empresas"]].map(([value, label]) => (
              <label key={value}><input type="radio" name="generation-scope" value={value} checked={scope === value} onChange={() => changeScope(value)} />{label}</label>
            ))}
          </div>
          {scope === "single" && <label className="payroll-generation__single-company"><span>Empresa</span>
            <select value={effectiveCompanyId} onChange={(event) => { setSingleCompanyId(event.target.value); clearSelectionChanges(); }}>
              {!availableCompanies.length && <option value="">Sin empresas disponibles</option>}
              {availableCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>}
          {scope === "group" && <div className="payroll-generation__company-choices">
            {availableCompanies.map((company) => <label key={company.id}>
              <input type="checkbox" checked={companyIds.includes(String(company.id))} onChange={() => toggleScopeCompany(String(company.id))} />
              <span>{company.name}<small>{company.cif}</small></span>
            </label>)}
          </div>}
          <p>{scopeCompanyIds.length} empresa{scopeCompanyIds.length === 1 ? "" : "s"} en el ámbito de generación. Puedes ajustar los trabajadores antes de generar.</p>
          <p>La selección de este apartado es independiente de la empresa de trabajo de la cabecera.</p>
        </fieldset>
        <div className="payroll-generation__period-grid">
          <label>
            <span>Periodo</span>
            <select disabled={submitting} value={period.period_month} onChange={(event) => handlePeriodChange("period_month", event.target.value)}>
              <optgroup label="Nóminas mensuales">
                {MONTHS.map((name, index) => {
                  const month = index + 1;
                  return <option key={month} value={month}>{String(month).padStart(2, "0")} · {name}</option>;
                })}
              </optgroup>
              <optgroup label="Pagas extraordinarias">
                {EXTRA_PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </optgroup>
            </select>
          </label>
          <label>
            <span>Año</span>
            <input type="number" min="2000" max="2100" disabled={submitting} value={period.period_year} onChange={(event) => handlePeriodChange("period_year", event.target.value)} />
          </label>
        </div>
      </section>

      {error && <div className="payroll-generation__error">{error}</div>}

      <section className="payroll-generation__workspace">
        <header className="payroll-generation__workspace-header">
          <div>
            <span>PLANTILLA ACTIVA</span>
            <h2>{selectedContracts.length} nómina{selectedContracts.length === 1 ? " seleccionada" : "s seleccionadas"} · {selectedCompanyCount} empresa{selectedCompanyCount === 1 ? "" : "s"}</h2>
            <p>
              {statusLoading
                ? "Comprobando el estado del periodo..."
                : isExtraPeriod
                  ? `${periodLabel(period.period_month)} · se utilizará la paga extraordinaria asignada al mismo periodo en el convenio.`
                  : "Preparada = se usará el último borrador guardado. Automática = se construirán los conceptos al generar."}
            </p>
          </div>
        </header>

        {groupedContracts.map((group) => {
          const ids = group.contracts
            .map((contract) => Number(contract.id))
            .filter((id) => eligibleContractIds.includes(id));
          const selectedCount = ids.filter((id) => selectedContractSet.has(id)).length;
          const allSelected = ids.length > 0 && selectedCount === ids.length;
          return (
            <section className="payroll-generation__company" key={group.company_id || group.company_name}>
              <div className="payroll-generation__company-header">
                <label>
                  <input type="checkbox" checked={allSelected} disabled={submitting || !ids.length} onChange={() => toggleCompany(group)} />
                  <strong>{group.company_name}</strong>
                </label>
                <small>{selectedCount} de {ids.length} disponibles seleccionadas</small>
              </div>
              <div className="payroll-generation__workers">
                {group.contracts.map((contract) => {
                  const employee = employeeMap.get(String(contract.employee_id));
                  const checked = selectedContractSet.has(Number(contract.id));
                  const status = statusMap.get(String(contract.id));
                  const statusInfo = preparationLabel(status);
                  const disabled = submitting;
                  return (
                    <div className={`payroll-generation__worker${disabled ? " is-generated" : ""}`} key={contract.id}>
                      <label>
                        <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleContract(contract.id)} />
                        <span>
                          <strong>{employeeName(employee) || contract.employee_name || `Trabajador ${contract.employee_id}`}</strong>
                          <small>{employee?.employee_code || "Sin código"}</small>
                        </span>
                      </label>
                      <span>{contract.contract_code || contract.code || `Contrato ${contract.id}`}</span>
                      <span className={`payroll-generation__worker-status is-${statusInfo.tone}`}>{statusInfo.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {groupedContracts.length === 0 && <div className="payroll-prep__message">No hay contratos activos disponibles en las empresas seleccionadas.</div>}

        <footer className="payroll-generation__actions">
          <span>
            {isExtraPeriod
              ? "Generar crea la paga extra o recalcula sus conceptos guardados si ya existe, sin duplicar el registro."
              : "Generar recalcula las nóminas seleccionadas con los conceptos guardados y actualiza el mismo registro del histórico."}
          </span>
          <button type="button" className="payroll-s42__primary" onClick={handleGenerate} disabled={!selectedContracts.length || submitting}>
            {submitting ? "Generando..." : `Generar ${selectedContracts.length || ""} nómina${selectedContracts.length === 1 ? "" : "s"}`}
          </button>
        </footer>
      </section>

      {result && (
        <section className="payroll-generation__workspace">
          <header className="payroll-generation__workspace-header">
            <div>
              <span>RESULTADO</span>
              <h2>{periodLabel(result.period_month)} · {result.period_year}</h2>
              <p>Resultado de la generación del periodo seleccionado.</p>
            </div>
            <button type="button" className="payroll-s42__secondary" onClick={openHistory}>Abrir histórico del periodo</button>
          </header>
          <div className="payroll-generation__result-summary">
            <div><span>Generadas</span><strong>{result.generated_count}</strong></div>
            <div><span>Ya existentes</span><strong>{result.existing_count}</strong></div>
            <div><span>Omitidas</span><strong>{result.skipped_count}</strong></div>
          </div>
          <div className="payroll-generation__company-results">
            {resultCompanies.map((company) => <div key={company.id}><strong>{company.name}</strong><span>{company.generated} generadas · {company.existing} existentes · {company.skipped} omitidas</span></div>)}
          </div>
          <div>
            {(result.items || []).map((item, index) => (
              <div className="payroll-generation__result-row" key={`${item.contract_id}-${index}`}>
                <strong>{item.employee_name || `Trabajador ${item.employee_id}`}<small className="payroll-generation__result-company">{item.company_name || companyMap.get(String(item.company_id))?.name}</small></strong>
                <span>{item.contract_code || "-"}</span>
                <span>{sourceLabel(item.source)}</span>
                <span>{item.message || (item.status === "calculated" ? "Generada correctamente" : item.status)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
