import { useEffect, useMemo, useState } from "react";

import { fetchContracts } from "../../services/api";
import { fetchAllEmployees } from "../../services/employeeApi";
import {
  createPayrollItem,
  deletePayrollItem,
  ensurePayrollPreparation,
  fetchPayrollConcepts,
  previewPayrollPreparation,
  updatePayrollItem,
} from "../../services/payrollApi";
import PayrollReceiptModal from "./PayrollReceiptModal";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const OVERRIDE_MARKER = "[PREPARATION_OVERRIDE] Edición desde preparación mensual";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value) {
  const numeric = Number(value || 0);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toLocaleString("es-ES", { maximumFractionDigits: 2 });
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
  if (source === "regularization") return "Regularización";
  if (line?.is_automatic || source === "system") return "Automático";
  return "Preparación";
}

function lineGroup(line) {
  const type = String(line?.concept_type || "").toUpperCase();
  const category = String(line?.category || "").toUpperCase();
  if (category === "COSTE_EMPRESA") return "company";
  if (type === "DEDUCCION") return "deductions";
  if (type === "BASE_INFORMATIVA" || type === "INFORMATIVO") return "bases";
  return "earnings";
}

function groupLabel(group) {
  if (group === "earnings") return "Devengos";
  if (group === "deductions") return "Deducciones";
  if (group === "bases") return "Bases / informativos";
  if (group === "company") return "Coste empresa";
  return "Todos";
}

function conceptGroupLabel(type) {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "DEVENGO") return "Devengos";
  if (normalized === "DEDUCCION") return "Deducciones";
  return "Bases e informativos";
}

function PreviewTable({ title, lines }) {
  return (
    <section className="payroll-prep__preview-section">
      <div className="payroll-prep__preview-section-title">
        <h3>{title}</h3>
        <span>{lines.length} líneas</span>
      </div>
      <div className="payroll-prep__preview-table-wrap">
        <table className="payroll-prep__preview-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Concepto</th>
              <th>Origen</th>
              <th className="is-number">Cantidad</th>
              <th className="is-number">Importe</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={`${title}-${line.id}-${line.code}`}>
                <td className="is-code">{line.code}</td>
                <td>
                  <strong>{line.name}</strong>
                  {line.description && <small>{line.description}</small>}
                </td>
                <td>{sourceLabel(line)}</td>
                <td className="is-number">{formatQuantity(line.quantity)}</td>
                <td className="is-number"><strong>{formatMoney(line.amount)} €</strong></td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan="5" className="payroll-prep__preview-empty">Sin líneas en este bloque.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PreviewModal({ preparation, onClose }) {
  if (!preparation) return null;
  const preview = preparation.preview || {};
  const groups = {
    earnings: preparation.lines.filter((line) => lineGroup(line) === "earnings"),
    deductions: preparation.lines.filter((line) => lineGroup(line) === "deductions"),
    bases: preparation.lines.filter((line) => lineGroup(line) === "bases"),
    company: preparation.lines.filter((line) => lineGroup(line) === "company"),
  };

  return (
    <div className="payroll-prep__overlay" role="dialog" aria-modal="true" aria-label="Vista previa de nómina">
      <section className="payroll-prep__preview-modal payroll-prep__preview-modal--wide">
        <header>
          <div>
            <span>VISTA PREVIA · NO GENERADA</span>
            <h2>{preparation.employee_name}</h2>
            <p>{preparation.company_name}{preparation.center_name ? ` · ${preparation.center_name}` : ""} · {String(preparation.period_month).padStart(2, "0")}/{preparation.period_year}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="payroll-prep__preview-body">
          <div className="payroll-prep__preview-banner">
            Esta es la nómina completa que resultaría de la preparación actual. Visualizarla no genera ni cierra el periodo.
          </div>
          <div className="payroll-prep__preview-totals">
            <div><span>Total devengado</span><strong>{formatMoney(preview.gross_salary)} €</strong></div>
            <div><span>Total deducciones</span><strong>{formatMoney(preview.total_deductions)} €</strong></div>
            <div className="is-primary"><span>Líquido a percibir</span><strong>{formatMoney(preview.net_salary)} €</strong></div>
            <div><span>Seguridad Social trabajador</span><strong>{formatMoney(preview.employee_social_security)} €</strong></div>
            <div><span>IRPF</span><strong>{formatMoney(preview.irpf)} €</strong></div>
            <div><span>Coste total empresa</span><strong>{formatMoney(preview.company_total_cost)} €</strong></div>
          </div>

          <PreviewTable title="Devengos" lines={groups.earnings} />
          <PreviewTable title="Deducciones" lines={groups.deductions} />
          <PreviewTable title="Bases de cotización e IRPF" lines={groups.bases} />
          <PreviewTable title="Coste empresarial" lines={groups.company} />

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
  const [lineEdits, setLineEdits] = useState({});
  const [deletedIds, setDeletedIds] = useState([]);
  const [newLines, setNewLines] = useState([]);
  const [newConceptId, setNewConceptId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newAmount, setNewAmount] = useState("");
  const [lineFilter, setLineFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [receiptPayrollId, setReceiptPayrollId] = useState(null);

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

  const sortedConcepts = useMemo(
    () => [...concepts]
      .filter((concept) => concept.is_active)
      .sort((a, b) => (Number(a.display_order || 0) - Number(b.display_order || 0)) || String(a.code).localeCompare(String(b.code), "es")),
    [concepts]
  );

  const conceptGroups = useMemo(() => {
    const groups = new Map();
    sortedConcepts.forEach((concept) => {
      const label = conceptGroupLabel(concept.concept_type);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(concept);
    });
    return [...groups.entries()];
  }, [sortedConcepts]);

  const selectedNewConcept = sortedConcepts.find((concept) => String(concept.id) === String(newConceptId));

  const resetPreparation = () => {
    setPreparation(null);
    setLineEdits({});
    setDeletedIds([]);
    setNewLines([]);
    setNewConceptId("");
    setNewQuantity("1");
    setNewAmount("");
    setMessage("");
    setPreviewOpen(false);
    setReceiptPayrollId(null);
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
    setLineEdits(Object.fromEntries((data.lines || []).map((line) => [line.id, {
      quantity: String(line.quantity ?? 1),
      amount: String(line.amount ?? 0),
    }])));
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
      const refreshedConcepts = await fetchPayrollConcepts();
      setConcepts(Array.isArray(refreshedConcepts) ? refreshedConcepts : []);
      if (data.generated) {
        setMessage("Periodo ya generado: la matriz se muestra completa en modo consulta. Puedes visualizar la nómina aquí mismo.");
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar los conceptos del periodo");
    } finally {
      setLoading(false);
    }
  };

  const updateLineEdit = (lineId, field, value) => {
    setLineEdits((previous) => ({
      ...previous,
      [lineId]: { ...previous[lineId], [field]: value },
    }));
  };

  const handleAddLocalLine = () => {
    const concept = selectedNewConcept;
    const amount = Number(newAmount);
    const quantity = Number(newQuantity);
    if (!concept || Number.isNaN(amount) || amount < 0 || Number.isNaN(quantity) || quantity < 0) return;
    setNewLines((previous) => [
      ...previous,
      {
        tempId: `new-${Date.now()}-${previous.length}`,
        concept_id: concept.id,
        name: concept.name,
        code: concept.code,
        concept_type: concept.concept_type,
        category: concept.category,
        source_type: "manual",
        quantity: String(quantity),
        amount: String(amount),
      },
    ]);
    setNewConceptId("");
    setNewQuantity("1");
    setNewAmount("");
  };

  const hasPendingChanges = useMemo(() => {
    if (!preparation || preparation.generated) return false;
    if (deletedIds.length || newLines.length) return true;
    return (preparation.lines || []).some((line) => {
      const edit = lineEdits[line.id];
      if (!edit) return false;
      return Number(edit.amount) !== Number(line.amount) || Number(edit.quantity) !== Number(line.quantity);
    });
  }, [preparation, deletedIds, newLines, lineEdits]);

  const persistPreparation = async ({ announce = true } = {}) => {
    if (!preparation || preparation.generated) return preparation;
    setError("");
    if (announce) setMessage("");
    try {
      setSaving(true);
      const existingLines = preparation.lines || [];
      const updates = existingLines
        .filter((line) => !deletedIds.includes(line.id))
        .filter((line) => {
          const edit = lineEdits[line.id];
          return edit && (Number(edit.amount) !== Number(line.amount) || Number(edit.quantity) !== Number(line.quantity));
        })
        .map((line) => {
          const edit = lineEdits[line.id];
          const quantity = Number(edit.quantity || 0);
          const amount = Number(edit.amount || 0);
          const payload = {
            quantity,
            unit_price: quantity > 0 ? amount / quantity : amount,
            amount,
          };
          if (line.is_automatic) payload.notes = OVERRIDE_MARKER;
          return updatePayrollItem(line.id, payload);
        });
      const deletes = deletedIds.map((itemId) => deletePayrollItem(itemId));
      const creates = newLines.map((line, index) => {
        const quantity = Number(line.quantity || 0);
        const amount = Number(line.amount || 0);
        return createPayrollItem(preparation.payroll_id, {
          concept_id: Number(line.concept_id),
          description: "Concepto mensual informado en preparación",
          quantity,
          unit_price: quantity > 0 ? amount / quantity : amount,
          amount,
          display_order: 700 + index,
          notes: OVERRIDE_MARKER,
        });
      });
      await Promise.all([...updates, ...deletes, ...creates]);
      const refreshed = await previewPayrollPreparation(preparation.payroll_id);
      hydratePreparation(refreshed);
      if (announce) setMessage("Preparación guardada. La nómina todavía no se ha generado.");
      if (onPrepared) await onPrepared(refreshed);
      return refreshed;
    } catch (err) {
      setError(err.message || "No se pudo guardar la preparación");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!preparation) return;
    if (preparation.generated) {
      setReceiptPayrollId(preparation.payroll_id);
      return;
    }

    let refreshed = preparation;
    if (hasPendingChanges) {
      refreshed = await persistPreparation({ announce: false });
      if (!refreshed) return;
    } else {
      try {
        refreshed = await previewPayrollPreparation(preparation.payroll_id);
        hydratePreparation(refreshed);
      } catch (err) {
        setError(err.message || "No se pudo calcular la vista previa");
        return;
      }
    }
    setPreparation(refreshed);
    setPreviewOpen(true);
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

  const visibleLines = useMemo(() => {
    const lines = (preparation?.lines || [])
      .filter((line) => !deletedIds.includes(line.id))
      .sort((a, b) => (Number(a.display_order || 0) - Number(b.display_order || 0)) || String(a.code).localeCompare(String(b.code), "es"));
    if (lineFilter === "all") return lines;
    return lines.filter((line) => lineGroup(line) === lineFilter);
  }, [preparation, deletedIds, lineFilter]);

  const lineCounts = useMemo(() => {
    const counts = { all: 0, earnings: 0, deductions: 0, bases: 0, company: 0 };
    (preparation?.lines || []).filter((line) => !deletedIds.includes(line.id)).forEach((line) => {
      counts.all += 1;
      counts[lineGroup(line)] += 1;
    });
    return counts;
  }, [preparation, deletedIds]);

  return (
    <div className="payroll-prep">
      <section className="payroll-prep__scope">
        <div className="payroll-prep__scope-heading">
          <div>
            <span>PREPARACIÓN DEL PERIODO</span>
            <h2>Selecciona trabajador y periodo</h2>
            <p>Al cargar el periodo aparecerá la matriz completa de conceptos. Guardar modifica el borrador; no genera la nómina.</p>
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
          {loading ? "Cargando conceptos..." : "Cargar conceptos del periodo"}
        </button>
      </section>

      {error && <div className="payroll-prep__error">{error}</div>}
      {message && <div className="payroll-prep__message">{message}</div>}

      {preparation && (
        <section className="payroll-prep__workspace">
          <header className="payroll-prep__workspace-header">
            <div>
              <span>{preparation.generated ? "NÓMINA GENERADA · CONSULTA" : "MATRIZ DE CONCEPTOS · BORRADOR"}</span>
              <h2>{preparation.employee_name}</h2>
              <p>{preparation.company_name}{preparation.center_name ? ` · ${preparation.center_name}` : ""} · {String(preparation.period_month).padStart(2, "0")}/{preparation.period_year}</p>
            </div>
            <div className="payroll-prep__workspace-meta">
              {hasPendingChanges && <span className="payroll-prep__pending">Cambios sin guardar</span>}
              <div className={`payroll-prep__status${preparation.generated ? " is-generated" : ""}`}>
                {preparation.generated ? "Generada" : "Sin generar"}
              </div>
            </div>
          </header>

          <div className="payroll-prep__matrix-intro">
            <div>
              <h3>Conceptos de la nómina</h3>
              <p>Código, concepto, cantidad e importe están concentrados aquí. Los cálculos automáticos pueden sobrescribirse en el borrador; el bruto y el líquido se recalculan a partir de las líneas.</p>
            </div>
            <div className="payroll-prep__filters" aria-label="Filtrar conceptos">
              {["all", "earnings", "deductions", "bases", "company"].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={lineFilter === filter ? "is-active" : ""}
                  onClick={() => setLineFilter(filter)}
                >
                  {filter === "all" ? "Todos" : groupLabel(filter)} <span>{lineCounts[filter]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="payroll-prep__matrix-wrap">
            <table className="payroll-prep__matrix">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Concepto / descripción</th>
                  <th>Origen</th>
                  <th className="is-number">Cantidad</th>
                  <th className="is-number">Importe</th>
                  <th aria-label="Acciones"></th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((line) => {
                  const edit = lineEdits[line.id] || { quantity: line.quantity, amount: line.amount };
                  return (
                    <tr key={line.id} className={line.is_automatic ? "is-automatic" : ""}>
                      <td className="payroll-prep__code">
                        <strong>{line.code}</strong>
                        <small>{groupLabel(lineGroup(line))}</small>
                      </td>
                      <td className="payroll-prep__description">
                        <strong>{line.name}</strong>
                        <small>{line.description || line.category}</small>
                      </td>
                      <td><span className="payroll-prep__source">{sourceLabel(line)}</span></td>
                      <td className="is-number">
                        {preparation.generated ? (
                          <strong>{formatQuantity(line.quantity)}</strong>
                        ) : (
                          <input
                            className="payroll-prep__matrix-input payroll-prep__matrix-input--quantity"
                            type="number"
                            min="0"
                            step="0.01"
                            value={edit.quantity}
                            onChange={(event) => updateLineEdit(line.id, "quantity", event.target.value)}
                            aria-label={`Cantidad de ${line.name}`}
                          />
                        )}
                      </td>
                      <td className="is-number">
                        {preparation.generated ? (
                          <strong>{formatMoney(line.amount)} €</strong>
                        ) : (
                          <label className="payroll-prep__matrix-amount">
                            <input
                              className="payroll-prep__matrix-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={edit.amount}
                              onChange={(event) => updateLineEdit(line.id, "amount", event.target.value)}
                              aria-label={`Importe de ${line.name}`}
                            />
                            <span>€</span>
                          </label>
                        )}
                      </td>
                      <td className="payroll-prep__row-action">
                        {!preparation.generated && !line.is_automatic && (
                          <button type="button" onClick={() => setDeletedIds((previous) => [...previous, line.id])}>Quitar</button>
                        )}
                        {!preparation.generated && line.is_automatic && <small>Auto</small>}
                      </td>
                    </tr>
                  );
                })}

                {!preparation.generated && lineFilter === "all" && newLines.map((line) => (
                  <tr key={line.tempId} className="is-new">
                    <td className="payroll-prep__code"><strong>{line.code}</strong><small>Nuevo</small></td>
                    <td className="payroll-prep__description"><strong>{line.name}</strong><small>{line.category}</small></td>
                    <td><span className="payroll-prep__source">Manual</span></td>
                    <td className="is-number">
                      <input
                        className="payroll-prep__matrix-input payroll-prep__matrix-input--quantity"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(event) => setNewLines((previous) => previous.map((candidate) => candidate.tempId === line.tempId ? { ...candidate, quantity: event.target.value } : candidate))}
                      />
                    </td>
                    <td className="is-number">
                      <label className="payroll-prep__matrix-amount">
                        <input
                          className="payroll-prep__matrix-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.amount}
                          onChange={(event) => setNewLines((previous) => previous.map((candidate) => candidate.tempId === line.tempId ? { ...candidate, amount: event.target.value } : candidate))}
                        />
                        <span>€</span>
                      </label>
                    </td>
                    <td className="payroll-prep__row-action"><button type="button" onClick={() => setNewLines((previous) => previous.filter((candidate) => candidate.tempId !== line.tempId))}>Quitar</button></td>
                  </tr>
                ))}

                {!preparation.generated && lineFilter === "all" && (
                  <tr className="payroll-prep__new-row">
                    <td>
                      <select value={newConceptId} onChange={(event) => setNewConceptId(event.target.value)} aria-label="Código del nuevo concepto">
                        <option value="">Código...</option>
                        {conceptGroups.map(([label, groupConcepts]) => (
                          <optgroup key={label} label={label}>
                            {groupConcepts.map((concept) => (
                              <option key={concept.id} value={concept.id}>{concept.code} · {concept.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="payroll-prep__description">
                      <strong>{selectedNewConcept?.name || "Selecciona un concepto"}</strong>
                      <small>{selectedNewConcept ? `${selectedNewConcept.category} · ${conceptGroupLabel(selectedNewConcept.concept_type)}` : "El catálogo incluye devengos, deducciones, IT, cotizaciones, bases y costes."}</small>
                    </td>
                    <td><span className="payroll-prep__source">Manual</span></td>
                    <td className="is-number">
                      <input className="payroll-prep__matrix-input payroll-prep__matrix-input--quantity" type="number" min="0" step="0.01" value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} aria-label="Cantidad del nuevo concepto" />
                    </td>
                    <td className="is-number">
                      <label className="payroll-prep__matrix-amount">
                        <input className="payroll-prep__matrix-input" type="number" min="0" step="0.01" value={newAmount} onChange={(event) => setNewAmount(event.target.value)} aria-label="Importe del nuevo concepto" />
                        <span>€</span>
                      </label>
                    </td>
                    <td className="payroll-prep__row-action">
                      <button type="button" className="is-add" onClick={handleAddLocalLine} disabled={!newConceptId || newAmount === ""}>Añadir</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="payroll-prep__summary">
            <div><span>Bruto / devengos</span><strong>{formatMoney(preparation.preview?.gross_salary)} €</strong></div>
            <div><span>Deducciones</span><strong>{formatMoney(preparation.preview?.total_deductions)} €</strong></div>
            <div className="is-primary"><span>Líquido a percibir</span><strong>{formatMoney(preparation.preview?.net_salary)} €</strong></div>
            <div><span>Base CC</span><strong>{formatMoney(preparation.preview?.contribution_base)} €</strong></div>
            <div><span>IRPF</span><strong>{formatMoney(preparation.preview?.irpf)} €</strong></div>
            <div><span>Coste empresa</span><strong>{formatMoney(preparation.preview?.company_total_cost)} €</strong></div>
          </div>

          <footer className="payroll-prep__actions">
            {preparation.generated ? (
              <>
                <button type="button" className="payroll-s42__secondary" onClick={openHistory}>Abrir histórico</button>
                <button type="button" className="payroll-s42__primary" onClick={handlePreview}>Visualizar nómina</button>
              </>
            ) : (
              <>
                <span className="payroll-prep__action-help">Visualizar sincroniza el borrador y recalcula cotizaciones, IRPF, bases y líquido; no genera la nómina.</span>
                <button type="button" className="payroll-s42__secondary" onClick={() => persistPreparation()} disabled={saving || !hasPendingChanges}>{saving ? "Guardando..." : "Guardar preparación"}</button>
                <button type="button" className="payroll-s42__primary" onClick={handlePreview} disabled={saving}>{saving ? "Recalculando..." : "Visualizar nómina"}</button>
              </>
            )}
          </footer>
        </section>
      )}

      {previewOpen && <PreviewModal preparation={preparation} onClose={() => setPreviewOpen(false)} />}
      {receiptPayrollId && <PayrollReceiptModal payrollId={receiptPayrollId} onClose={() => setReceiptPayrollId(null)} />}
    </div>
  );
}
