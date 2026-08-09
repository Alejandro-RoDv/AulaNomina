import { useEffect, useMemo, useState } from "react";

import { generatePayrolls } from "../services/payrollApi";
import "../components/payrolls/payrollPreparationFlow.css";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

function employeeName(employee) {
  return [employee?.first_name, employee?.last_name, employee?.second_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function sourceLabel(value) {
  if (value === "prepared") return "Preparación guardada";
  if (value === "automatic") return "Datos automáticos";
  if (value === "existing") return "Ya generada";
  return value || "-";
}

export default function PayrollSimulationPage({ employees = [], contracts = [] }) {
  const [period, setPeriod] = useState({
    period_month: String(currentMonth),
    period_year: String(currentYear),
  });
  const [selectedContracts, setSelectedContracts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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

  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [String(employee.id), employee])),
    [employees]
  );

  const activeContracts = useMemo(
    () => contracts.filter((contract) => contract.status === "active" && employeeMap.get(String(contract.employee_id))?.is_active),
    [contracts, employeeMap]
  );

  const groupedContracts = useMemo(() => {
    const groups = new Map();
    activeContracts.forEach((contract) => {
      const key = String(contract.company_id || "none");
      if (!groups.has(key)) {
        groups.set(key, {
          company_id: contract.company_id,
          company_name: contract.company_name || `Empresa ${contract.company_id}`,
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
  }, [activeContracts, employeeMap]);

  const allContractIds = useMemo(() => activeContracts.map((contract) => Number(contract.id)), [activeContracts]);

  const toggleContract = (contractId) => {
    const numericId = Number(contractId);
    setSelectedContracts((previous) => previous.includes(numericId)
      ? previous.filter((id) => id !== numericId)
      : [...previous, numericId]);
    setResult(null);
  };

  const toggleCompany = (group) => {
    const ids = group.contracts.map((contract) => Number(contract.id));
    const allSelected = ids.every((id) => selectedContracts.includes(id));
    setSelectedContracts((previous) => allSelected
      ? previous.filter((id) => !ids.includes(id))
      : Array.from(new Set([...previous, ...ids])));
    setResult(null);
  };

  const toggleAll = () => {
    setSelectedContracts(selectedContracts.length === allContractIds.length ? [] : allContractIds);
    setResult(null);
  };

  const handleGenerate = async () => {
    if (!selectedContracts.length) return;
    setError("");
    setResult(null);
    try {
      setSubmitting(true);
      const data = await generatePayrolls({
        period_month: Number(period.period_month),
        period_year: Number(period.period_year),
        contract_ids: selectedContracts,
      });
      setResult(data);
    } catch (err) {
      setError(err.message || "No se pudieron generar las nóminas");
    } finally {
      setSubmitting(false);
    }
  };

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
            <p>Si existe una preparación guardada se usará esa versión. Si no existe, AulaNomina utilizará contrato, conceptos permanentes e incidencias del periodo.</p>
          </div>
          <button type="button" className="payroll-s42__secondary" onClick={toggleAll}>
            {selectedContracts.length === allContractIds.length && allContractIds.length ? "Deseleccionar todas" : "Seleccionar todas"}
          </button>
        </div>
        <div className="payroll-generation__period-grid">
          <label>
            <span>Mes</span>
            <select value={period.period_month} onChange={(event) => { setPeriod((previous) => ({ ...previous, period_month: event.target.value })); setResult(null); }}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>{String(month).padStart(2, "0")}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Año</span>
            <input type="number" value={period.period_year} onChange={(event) => { setPeriod((previous) => ({ ...previous, period_year: event.target.value })); setResult(null); }} />
          </label>
        </div>
      </section>

      {error && <div className="payroll-generation__error">{error}</div>}

      <section className="payroll-generation__workspace">
        <header className="payroll-generation__workspace-header">
          <div>
            <span>PLANTILLA ACTIVA</span>
            <h2>{selectedContracts.length} de {allContractIds.length} contratos seleccionados</h2>
            <p>Puedes generar una sola nómina, varios trabajadores, una empresa completa o toda la plantilla.</p>
          </div>
        </header>

        {groupedContracts.map((group) => {
          const ids = group.contracts.map((contract) => Number(contract.id));
          const selectedCount = ids.filter((id) => selectedContracts.includes(id)).length;
          const allSelected = selectedCount === ids.length && ids.length > 0;
          return (
            <section className="payroll-generation__company" key={group.company_id || group.company_name}>
              <div className="payroll-generation__company-header">
                <label>
                  <input type="checkbox" checked={allSelected} onChange={() => toggleCompany(group)} />
                  <strong>{group.company_name}</strong>
                </label>
                <small>{selectedCount} de {ids.length} seleccionados</small>
              </div>
              <div className="payroll-generation__workers">
                {group.contracts.map((contract) => {
                  const employee = employeeMap.get(String(contract.employee_id));
                  const checked = selectedContracts.includes(Number(contract.id));
                  return (
                    <div className="payroll-generation__worker" key={contract.id}>
                      <label>
                        <input type="checkbox" checked={checked} onChange={() => toggleContract(contract.id)} />
                        <span>
                          <strong>{employeeName(employee) || contract.employee_name || `Trabajador ${contract.employee_id}`}</strong>
                          <small>{employee?.employee_code || "Sin código"}</small>
                        </span>
                      </label>
                      <span>{contract.contract_code || contract.code || `Contrato ${contract.id}`}</span>
                      <small>{contract.center_name || "Sin centro"}</small>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {groupedContracts.length === 0 && <div className="payroll-prep__message">No hay contratos activos disponibles para generar nóminas.</div>}

        <footer className="payroll-generation__actions">
          <span>La generación crea la versión que aparecerá en el histórico. Una preparación guardada no aparece allí hasta este paso.</span>
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
              <h2>{String(result.period_month).padStart(2, "0")}/{result.period_year}</h2>
              <p>Resultado de la generación del periodo seleccionado.</p>
            </div>
            <button type="button" className="payroll-s42__secondary" onClick={openHistory}>Abrir histórico del periodo</button>
          </header>
          <div className="payroll-generation__result-summary">
            <div><span>Generadas</span><strong>{result.generated_count}</strong></div>
            <div><span>Ya existentes</span><strong>{result.existing_count}</strong></div>
            <div><span>Omitidas</span><strong>{result.skipped_count}</strong></div>
          </div>
          <div>
            {(result.items || []).map((item, index) => (
              <div className="payroll-generation__result-row" key={`${item.contract_id}-${index}`}>
                <strong>{item.employee_name || `Trabajador ${item.employee_id}`}</strong>
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
