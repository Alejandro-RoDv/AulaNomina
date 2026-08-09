import { useEffect, useMemo, useState } from "react";

import { fetchContracts } from "../../services/api";
import { fetchAllEmployees } from "../../services/employeeApi";
import {
  createPayrollItem,
  deletePayrollItem,
  ensurePayrollPreparation,
  fetchPayrollConcepts,
  fetchPayrollPreparation,
  updatePayrollItem,
} from "../../services/payrollApi";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function employeeName(employee) {
  return [employee?.first_name, employee?.last_name, employee?.second_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function sourceLabel(line) {
  const source = String(line?.source_type || "").toLowerCase();
  if (source === "manual" || source === "custom") return "Manual";
  if (source === "incident") return "Incidencia";
  if (source === "agreement") return "Convenio";
  if (source === "contract") return line?.is_automatic ? "Contrato" : "Permanente";
  if (line?.is_automatic) return "Automático";
  return "Preparación";
}

function PreviewModal({ preparation, onClose }) {
  if (!preparation) return null;
  const preview = preparation.preview || {};
  return (
    <div className="payroll-prep__overlay" role="dialog" aria-modal="true" aria-label="Vista previa de nómina">
      <section className="payroll-prep__preview-modal">
        <header>
          <div>
            <span>VISTA PREVIA · NO GENERADA</span>
            <h2>{preparation.employee_name}</h2>
            <p>{String(preparation.period_month).padStart(2, "0")}/{preparation.period_year} · {preparation.company_name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="payroll-prep__preview-body">
          <div className="payroll-prep__preview-totals">
            <div><span>Devengos</span><strong>{formatMoney(preview.gross_salary)} €</strong></div>
            <div><span>Deducciones</span><strong>{formatMoney(preview.total_deductions)} €</strong></div>
            <div className="is-primary"><span>Líquido estimado</span><strong>{formatMoney(preview.net_salary)} €</strong></div>
          </div>
          <section className="payroll-prep__preview-lines">
            <div className="payroll-prep__preview-line payroll-prep__preview-line--head">
              <span>Concepto</span><span>Origen</span><span>Importe</span>
            </div>
            {preparation.lines.map((line) => (
              <div className="payroll-prep__preview-line" key={line.id}>
                <div><strong>{line.name}</strong><small>{line.code}</small></div>
                <span>{sourceLabel(line)}</span>
                <strong>{formatMoney(line.amount)} €</strong>
              </div>
            ))}
          </section>
          <div className="payroll-prep__preview-bases">
            <div><span>Base contingencias comunes</span><strong>{formatMoney(preview.contribution_base)} €</strong></div>
            <div><span>Base profesional</span><strong>{formatMoney(preview.professional_base)} €</strong></div>
            <div><span>Base IRPF</span><strong>{formatMoney(preview.irpf_base)} €</strong></div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function MonthlyPayrollPreparation({ companies = [], workCenters = [], onPrepared }) {
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [scope, setScope] = useState({
    company_id: "",
    employee_id: "",
    contract_id: "",
    period_month: String(currentMonth),
    period_year: String(currentYear),
  });
  const [preparation, setPreparation] = useState(null);
  const [lineAmounts, setLineAmounts] = useState({});
  const [deletedIds, setDeletedIds] = useState([]);
  const [newLines, setNewLines] = useState([]);
  const [newConceptId, setNewConceptId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchContracts(), fetchAllEmployees(), fetchPayrollConcepts()])
      .then(([contractData, employeeData, conceptData]) => {
        if (cancelled) return;
        setContracts(Array.isArray(contractData) ? contractData : []);
        setEmployees(Array.isArray(employeeData) ? employeeData : []);
        setConcepts(Array.isArray(conceptData) ? conceptData : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "No se pudieron cargar los datos de preparación");
      });
    return () => { cancelled = true; };
  }, []);

  const activeCompanies = useMemo(
    () => companies.filter((company) => company.is_active),
    [companies]
  );

  const companyContracts = useMemo(() => {
    if (!scope.company_id) return [];
    return contracts.filter(
      (contract) => String(contract.company_id) === String(scope.company_id) && contract.status === "active"
    );
  }, [contracts, scope.company_id]);

  const companyEmployeeIds = useMemo(
    () => new Set(companyContracts.map((contract) => String(contract.employee_id))),
    [companyContracts]
  );

  const companyEmployees = useMemo(
    () => employees
      .filter((employee) => employee.is_active && companyEmployeeIds.has(String(employee.id)))
      .sort((a, b) => employeeName(a).localeCompare(employeeName(b), "es")),
    [employees, companyEmployeeIds]
  );

  const employeeContracts = useMemo(() => companyContracts.filter(
    (contract) => String(contract.employee_id) === String(scope.employee_id)
  ), [companyContracts, scope.employee_id]);

  const selectedContract = employeeContracts.find((contract) => String(contract.id) === String(scope.contract_id));
  const selectedCenter = workCenters.find((center) => String(center.id) === String(selectedContract?.center_id));

  const addableConcepts = useMemo(() => concepts.filter((concept) => {
    if (!concept.is_active) return false;
    if (!["DEVENGO", "DEDUCCION"].includes(String(concept.concept_type).toUpperCase())) return false;
    const code = String(concept.code || "").toUpperCase();
    return !code.startsWith("SS_") && code !== "IRPF";
  }), [concepts]);

  const resetPreparation = () => {
    setPreparation(null);
    setLineAmounts({});
    setDeletedIds([]);
    setNewLines([]);
    setNewConceptId("");
    setNewAmount("");
    setMessage("");
    setPreviewOpen(false);
  };

  const handleScopeChange = (event) => {
    const { name, value } = event.target;
    setError("");
    resetPreparation();
    setScope((previous) => {
      if (name === "company_id") return { ...previous, company_id: value, employee_id: "", contract_id: "" };
      if (name === "employee_id") {
        const candidates = contracts.filter(
          (contract) => String(contract.company_id) === String(previous.company_id)
            && String(contract.employee_id) === String(value)
            && contract.status === "active"
        );
        return { ...previous, employee_id: value, contract_id: candidates.length === 1 ? String(candidates[0].id) : "" };
      }
      return { ...previous, [name]: value };
    });
  };

  const hydratePreparation = (data) => {
    setPreparation(data);
    setLineAmounts(Object.fromEntries((data.lines || []).map((line) => [line.id, String(line.amount)])));
    setDeletedIds([]);
    setNewLines([]);
  };

  const handleOpenPreparation = async () => {
    if (!scope.employee_id || !scope.contract_id) return;
    setError("");
    setMessage("");
    try {
      setLoading(true);
      const data = await ensurePayrollPreparation({
        employee_id: Number(scope.employee_id),
        contract_id: Number(scope.contract_id),
        period_month: Number(scope.period_month),
        period_year: Number(scope.period_year),
      });
      hydratePreparation(data);
      if (data.generated) setMessage("La nómina de este trabajador y periodo ya está generada. Puedes consultarla desde el histórico.");
    } catch (err) {
      setError(err.message || "No se pudo abrir la preparación");
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocalLine = () => {
    const concept = addableConcepts.find((item) => String(item.id) === String(newConceptId));
    const amount = Number(newAmount);
    if (!concept || Number.isNaN(amount) || amount < 0) return;
    setNewLines((previous) => [
      ...previous,
      {
        tempId: `new-${Date.now()}-${previous.length}`,
        concept_id: concept.id,
        name: concept.name,
        code: concept.code,
        source_type: "manual",
        amount: String(amount),
      },
    ]);
    setNewConceptId("");
    setNewAmount("");
  };

  const handleSave = async () => {
    if (!preparation || preparation.generated) return;
    setError("");
    setMessage("");
    try {
      setSaving(true);
      const existingLines = preparation.lines || [];
      const updates = existingLines
        .filter((line) => !deletedIds.includes(line.id))
        .filter((line) => Number(lineAmounts[line.id]) !== Number(line.amount))
        .map((line) => updatePayrollItem(line.id, { amount: Number(lineAmounts[line.id] || 0) }));
      const deletes = deletedIds.map((itemId) => deletePayrollItem(itemId));
      const creates = newLines.map((line, index) => createPayrollItem(preparation.payroll_id, {
        concept_id: Number(line.concept_id),
        description: "Concepto mensual informado en preparación",
        quantity: 1,
        unit_price: Number(line.amount || 0),
        amount: Number(line.amount || 0),
        display_order: 700 + index,
        notes: "Preparación mensual manual",
      }));
      await Promise.all([...updates, ...deletes, ...creates]);
      const refreshed = await fetchPayrollPreparation(preparation.payroll_id);
      hydratePreparation(refreshed);
      setMessage("Preparación guardada. Todavía no se ha generado ninguna nómina.");
      if (onPrepared) await onPrepared(refreshed);
    } catch (err) {
      setError(err.message || "No se pudo guardar la preparación");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!preparation) return;
    if (!preparation.generated && (deletedIds.length || newLines.length || preparation.lines.some((line) => Number(lineAmounts[line.id]) !== Number(line.amount)))) {
      await handleSave();
    }
    try {
      const refreshed = await fetchPayrollPreparation(preparation.payroll_id);
      hydratePreparation(refreshed);
      setPreviewOpen(true);
    } catch (err) {
      setError(err.message || "No se pudo calcular la vista previa");
    }
  };

  const openHistory = () => {
    const params = new URLSearchParams();
    params.set("period", `${scope.period_year}-${String(scope.period_month).padStart(2, "0")}`);
    const selectedCompany = companies.find((company) => String(company.id) === String(scope.company_id));
    if (selectedCompany?.name) params.set("company", selectedCompany.name);
    const selectedEmployee = employees.find((employee) => String(employee.id) === String(scope.employee_id));
    if (selectedEmployee) params.set("employee", employeeName(selectedEmployee));
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: "payroll-history" } }));
  };

  const visibleLines = (preparation?.lines || []).filter((line) => !deletedIds.includes(line.id));

  return (
    <div className="payroll-prep">
      <section className="payroll-prep__scope">
        <div className="payroll-prep__scope-heading">
          <div>
            <span>PREPARACIÓN DEL PERIODO</span>
            <h2>Empresa, trabajador y mes</h2>
            <p>Selecciona un trabajador para cargar sus conceptos base y permanentes. Guardar aquí no genera la nómina.</p>
          </div>
        </div>
        <div className="payroll-prep__scope-grid">
          <label>
            <span>Empresa</span>
            <select name="company_id" value={scope.company_id} onChange={handleScopeChange}>
              <option value="">Seleccionar empresa</option>
              {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label>
            <span>Trabajador</span>
            <select name="employee_id" value={scope.employee_id} onChange={handleScopeChange} disabled={!scope.company_id}>
              <option value="">Seleccionar trabajador</option>
              {companyEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employeeName(employee)}</option>)}
            </select>
          </label>
          <label>
            <span>Contrato</span>
            <select name="contract_id" value={scope.contract_id} onChange={handleScopeChange} disabled={!scope.employee_id}>
              <option value="">Seleccionar contrato</option>
              {employeeContracts.map((contract) => (
                <option key={contract.id} value={contract.id}>{contract.contract_code || contract.code || `Contrato ${contract.id}`}</option>
              ))}
            </select>
          </label>
          <label className="payroll-prep__month">
            <span>Mes</span>
            <select name="period_month" value={scope.period_month} onChange={handleScopeChange}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>{String(month).padStart(2, "0")}</option>
              ))}
            </select>
          </label>
          <label className="payroll-prep__year">
            <span>Año</span>
            <input name="period_year" type="number" value={scope.period_year} onChange={handleScopeChange} />
          </label>
        </div>
        {selectedContract && (
          <div className="payroll-prep__context-line">
            <span>{selectedCenter?.name || "Sin centro asignado"}</span>
            <span>{selectedContract.professional_category || selectedContract.job_position || "Categoría sin informar"}</span>
          </div>
        )}
        <button
          type="button"
          className="payroll-s42__primary"
          disabled={!scope.contract_id || loading}
          onClick={handleOpenPreparation}
        >
          {loading ? "Cargando..." : "Abrir preparación"}
        </button>
      </section>

      {error && <div className="payroll-prep__error">{error}</div>}
      {message && <div className="payroll-prep__message">{message}</div>}

      {preparation && (
        <section className="payroll-prep__workspace">
          <header className="payroll-prep__workspace-header">
            <div>
              <span>{preparation.generated ? "NÓMINA GENERADA" : "BORRADOR GUARDABLE"}</span>
              <h2>{preparation.employee_name}</h2>
              <p>{preparation.company_name}{preparation.center_name ? ` · ${preparation.center_name}` : ""} · {String(preparation.period_month).padStart(2, "0")}/{preparation.period_year}</p>
            </div>
            <div className={`payroll-prep__status${preparation.generated ? " is-generated" : ""}`}>
              {preparation.generated ? "Generada" : "Sin generar"}
            </div>
          </header>

          {!preparation.generated && (
            <>
              <div className="payroll-prep__line-head">
                <span>Concepto</span><span>Origen</span><span>Importe</span><span></span>
              </div>
              <div className="payroll-prep__lines">
                {visibleLines.map((line) => (
                  <div className="payroll-prep__line" key={line.id}>
                    <div><strong>{line.name}</strong><small>{line.code}</small></div>
                    <span className="payroll-prep__source">{sourceLabel(line)}</span>
                    <label className="payroll-prep__amount">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={lineAmounts[line.id] ?? line.amount}
                        onChange={(event) => setLineAmounts((previous) => ({ ...previous, [line.id]: event.target.value }))}
                      />
                      <span>€</span>
                    </label>
                    <button type="button" className="payroll-prep__remove" onClick={() => setDeletedIds((previous) => [...previous, line.id])}>Eliminar</button>
                  </div>
                ))}
                {newLines.map((line) => (
                  <div className="payroll-prep__line is-new" key={line.tempId}>
                    <div><strong>{line.name}</strong><small>{line.code}</small></div>
                    <span className="payroll-prep__source">Manual</span>
                    <label className="payroll-prep__amount">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.amount}
                        onChange={(event) => setNewLines((previous) => previous.map((candidate) => candidate.tempId === line.tempId ? { ...candidate, amount: event.target.value } : candidate))}
                      />
                      <span>€</span>
                    </label>
                    <button type="button" className="payroll-prep__remove" onClick={() => setNewLines((previous) => previous.filter((candidate) => candidate.tempId !== line.tempId))}>Eliminar</button>
                  </div>
                ))}
              </div>

              <div className="payroll-prep__add-line">
                <label>
                  <span>Añadir concepto</span>
                  <select value={newConceptId} onChange={(event) => setNewConceptId(event.target.value)}>
                    <option value="">Seleccionar concepto</option>
                    {addableConcepts.map((concept) => <option key={concept.id} value={concept.id}>{concept.name}</option>)}
                  </select>
                </label>
                <label>
                  <span>Importe</span>
                  <input type="number" min="0" step="0.01" value={newAmount} onChange={(event) => setNewAmount(event.target.value)} />
                </label>
                <button type="button" className="payroll-s42__secondary" onClick={handleAddLocalLine} disabled={!newConceptId || newAmount === ""}>Añadir</button>
              </div>
            </>
          )}

          <div className="payroll-prep__summary">
            <div><span>Devengos previstos</span><strong>{formatMoney(preparation.preview?.gross_salary)} €</strong></div>
            <div><span>Deducciones previstas</span><strong>{formatMoney(preparation.preview?.total_deductions)} €</strong></div>
            <div><span>Líquido previsto</span><strong>{formatMoney(preparation.preview?.net_salary)} €</strong></div>
          </div>

          <footer className="payroll-prep__actions">
            {preparation.generated ? (
              <button type="button" className="payroll-s42__primary" onClick={openHistory}>Abrir en histórico</button>
            ) : (
              <>
                <button type="button" className="payroll-s42__secondary" onClick={handlePreview}>Vista previa</button>
                <button type="button" className="payroll-s42__primary" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar preparación"}</button>
              </>
            )}
          </footer>
        </section>
      )}

      {previewOpen && <PreviewModal preparation={preparation} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}
