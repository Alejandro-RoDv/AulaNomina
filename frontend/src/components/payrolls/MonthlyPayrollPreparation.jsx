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
const OVERRIDE_DESCRIPTION_PREFIX = "[AULANOMINA_MONTHLY_OVERRIDE]";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value) {
  const numeric = Number(value || 0);
  return Number.isInteger(numeric)
    ? String(numeric)
    : numeric.toLocaleString("es-ES", { maximumFractionDigits: 2 });
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

function conceptFamily(concept) {
  const type = String(concept?.concept_type || "").toUpperCase();
  const category = String(concept?.category || "").toUpperCase();
  const nature = String(concept?.salary_nature || "").toUpperCase();

  if (category === "IT" || category === "PRESTACION_IT" || category === "COMPLEMENTO_IT") return "IT y prestaciones";
  if (category === "SEGURIDAD_SOCIAL") return "Cotización trabajador";
  if (category === "COSTE_EMPRESA") return "Coste empresa";
  if (type === "BASE_INFORMATIVA" || type === "INFORMATIVO") return "Bases e informativos";
  if (type === "DEDUCCION") return "Deducciones";
  if (category === "HORAS_EXTRA") return "Horas y jornada";
  if (category === "PAGA_EXTRA") return "Pagas extraordinarias";
  if (nature === "EXTRASALARIAL") return "Percepciones no salariales";
  return "Devengos salariales";
}

function serializeOverrideDescription(line) {
  const originalDescription = encodeURIComponent(String(line?.description || ""));
  return `${OVERRIDE_DESCRIPTION_PREFIX}|q=${line?.quantity ?? 1}|a=${line?.amount ?? 0}|d=${originalDescription}`;
}

function parseOverrideDescription(line) {
  const description = String(line?.description || "");
  if (!description.startsWith(`${OVERRIDE_DESCRIPTION_PREFIX}|`)) return null;
  const match = description.match(/^\[AULANOMINA_MONTHLY_OVERRIDE\]\|q=([^|]*)\|a=([^|]*)\|d=(.*)$/);
  if (!match) return null;
  let originalDescription = "";
  try {
    originalDescription = decodeURIComponent(match[3] || "");
  } catch {
    originalDescription = "";
  }
  return {
    quantity: Number(match[1] || 0),
    amount: Number(match[2] || 0),
    description: originalDescription || null,
  };
}

function isStoredOverride(line) {
  const description = String(line?.description || "");
  const source = String(line?.source_type || "").toLowerCase();
  if (description.startsWith(OVERRIDE_DESCRIPTION_PREFIX)) return true;
  if (description.toLowerCase().includes("concepto mensual informado en preparación")) return true;
  if (description.toLowerCase().includes("ajuste mensual")) return true;
  return !line?.is_automatic && ["manual", "custom"].includes(source);
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
                  {line.description && !String(line.description).startsWith(OVERRIDE_DESCRIPTION_PREFIX) && <small>{line.description}</small>}
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
  const lines = preparation.lines || [];
  const earnings = lines.filter((line) => String(line.concept_type).toUpperCase() === "DEVENGO");
  const deductions = lines.filter((line) => String(line.concept_type).toUpperCase() === "DEDUCCION");
  const bases = lines.filter((line) => ["BASE_INFORMATIVA", "INFORMATIVO"].includes(String(line.concept_type).toUpperCase()) && String(line.category).toUpperCase() !== "COSTE_EMPRESA");
  const company = lines.filter((line) => String(line.category).toUpperCase() === "COSTE_EMPRESA");

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
            Cálculo completo con la configuración por defecto y los ajustes mensuales guardados. Esta vista no genera la nómina.
          </div>
          <div className="payroll-prep__preview-totals">
            <div><span>Total devengado</span><strong>{formatMoney(preview.gross_salary)} €</strong></div>
            <div><span>Total deducciones</span><strong>{formatMoney(preview.total_deductions)} €</strong></div>
            <div className="is-primary"><span>Líquido a percibir</span><strong>{formatMoney(preview.net_salary)} €</strong></div>
            <div><span>Seguridad Social trabajador</span><strong>{formatMoney(preview.employee_social_security)} €</strong></div>
            <div><span>IRPF</span><strong>{formatMoney(preview.irpf)} €</strong></div>
            <div><span>Coste total empresa</span><strong>{formatMoney(preview.company_total_cost)} €</strong></div>
          </div>
          <PreviewTable title="Devengos" lines={earnings} />
          <PreviewTable title="Deducciones" lines={deductions} />
          <PreviewTable title="Bases de cotización e IRPF" lines={bases} />
          <PreviewTable title="Coste empresarial" lines={company} />
        </div>
      </section>
    </div>
  );
}

function ReadOnlyBaseTable({ lines }) {
  return (
    <div className="payroll-prep__defaults-table-wrap">
      <table className="payroll-prep__defaults-table">
        <thead>
          <tr><th>Código</th><th>Concepto</th><th>Origen</th><th>Cantidad</th><th>Importe</th></tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={`default-${line.id}-${line.code}`}>
              <td>{line.code}</td>
              <td>{line.name}</td>
              <td>{sourceLabel(line)}</td>
              <td className="is-number">{formatQuantity(line.quantity)}</td>
              <td className="is-number">{formatMoney(line.amount)} €</td>
            </tr>
          ))}
          {lines.length === 0 && <tr><td colSpan="5" className="payroll-prep__empty-cell">No hay líneas base materializadas para este periodo.</td></tr>}
        </tbody>
      </table>
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
  const [touchedLineIds, setTouchedLineIds] = useState([]);
  const [removedOverrideIds, setRemovedOverrideIds] = useState([]);
  const [newLines, setNewLines] = useState([]);
  const [newConceptId, setNewConceptId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newAmount, setNewAmount] = useState("");
  const [conceptSearch, setConceptSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
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

  const activeCompanies = useMemo(() => companies.filter((company) => company.is_active), [companies]);

  const companyContracts = useMemo(() => {
    if (!scope.company_id) return [];
    return contracts.filter((contract) => String(contract.company_id) === String(scope.company_id) && contract.status === "active");
  }, [contracts, scope.company_id]);

  const companyEmployeeIds = useMemo(() => new Set(companyContracts.map((contract) => String(contract.employee_id))), [companyContracts]);

  const companyEmployees = useMemo(
    () => employees
      .filter((employee) => employee.is_active && companyEmployeeIds.has(String(employee.id)))
      .sort((a, b) => employeeName(a).localeCompare(employeeName(b), "es")),
    [employees, companyEmployeeIds]
  );

  const employeeContracts = useMemo(
    () => companyContracts.filter((contract) => String(contract.employee_id) === String(scope.employee_id)),
    [companyContracts, scope.employee_id]
  );

  const selectedContract = employeeContracts.find((contract) => String(contract.id) === String(scope.contract_id));
  const selectedCenter = workCenters.find((center) => String(center.id) === String(selectedContract?.center_id));

  const sortedConcepts = useMemo(
    () => [...concepts]
      .filter((concept) => concept.is_active)
      .sort((a, b) => (Number(a.display_order || 0) - Number(b.display_order || 0)) || String(a.code).localeCompare(String(b.code), "es")),
    [concepts]
  );

  const families = useMemo(() => [...new Set(sortedConcepts.map(conceptFamily))], [sortedConcepts]);

  const catalogConcepts = useMemo(() => {
    const search = conceptSearch.trim().toLocaleLowerCase("es");
    return sortedConcepts.filter((concept) => {
      if (familyFilter !== "all" && conceptFamily(concept) !== familyFilter) return false;
      if (!search) return true;
      return [concept.code, concept.name, concept.category, concept.salary_nature]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("es").includes(search));
    });
  }, [sortedConcepts, conceptSearch, familyFilter]);

  const catalogGroups = useMemo(() => {
    const groups = new Map();
    catalogConcepts.forEach((concept) => {
      const label = conceptFamily(concept);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(concept);
    });
    return [...groups.entries()];
  }, [catalogConcepts]);

  const selectedNewConcept = sortedConcepts.find((concept) => String(concept.id) === String(newConceptId));

  const resetPreparation = () => {
    setPreparation(null);
    setLineEdits({});
    setTouchedLineIds([]);
    setRemovedOverrideIds([]);
    setNewLines([]);
    setNewConceptId("");
    setNewQuantity("1");
    setNewAmount("");
    setConceptSearch("");
    setFamilyFilter("all");
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
    setTouchedLineIds([]);
    setRemovedOverrideIds([]);
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
    } catch (err) {
      setError(err.message || "No se pudo abrir la preparación del periodo");
    } finally {
      setLoading(false);
    }
  };

  const baselineLines = useMemo(
    () => (preparation?.lines || []).filter((line) => !isStoredOverride(line)),
    [preparation]
  );

  const savedOverrideLines = useMemo(
    () => (preparation?.lines || []).filter((line) => isStoredOverride(line)),
    [preparation]
  );

  const visibleOverrideLines = useMemo(() => {
    if (!preparation) return [];
    const saved = savedOverrideLines.filter((line) => !removedOverrideIds.includes(line.id));
    const pending = baselineLines.filter((line) => touchedLineIds.includes(line.id));
    return [...saved, ...pending].sort(
      (a, b) => (Number(a.display_order || 0) - Number(b.display_order || 0)) || String(a.code).localeCompare(String(b.code), "es")
    );
  }, [preparation, savedOverrideLines, baselineLines, removedOverrideIds, touchedLineIds]);

  const updateLineEdit = (lineId, field, value) => {
    setLineEdits((previous) => ({ ...previous, [lineId]: { ...previous[lineId], [field]: value } }));
  };

  const handleAddLocalLine = () => {
    const concept = selectedNewConcept;
    const amount = Number(newAmount);
    const quantity = Number(newQuantity);
    if (!concept || Number.isNaN(amount) || amount < 0 || Number.isNaN(quantity) || quantity < 0) return;

    const existingSaved = savedOverrideLines.find(
      (line) => String(line.concept_id) === String(concept.id) && !removedOverrideIds.includes(line.id)
    );
    const existingPending = baselineLines.find(
      (line) => String(line.concept_id) === String(concept.id) && touchedLineIds.includes(line.id)
    );
    const existingNew = newLines.find((line) => String(line.concept_id) === String(concept.id));
    if (existingSaved || existingPending || existingNew) {
      setMessage("Ese concepto ya está incluido entre los ajustes del mes. Edita directamente su cantidad o importe.");
      return;
    }

    const baseline = baselineLines.find((line) => String(line.concept_id) === String(concept.id));
    if (baseline) {
      setTouchedLineIds((previous) => [...previous, baseline.id]);
      setLineEdits((previous) => ({
        ...previous,
        [baseline.id]: { quantity: String(quantity), amount: String(amount) },
      }));
    } else {
      setNewLines((previous) => [
        ...previous,
        {
          tempId: `new-${Date.now()}-${previous.length}`,
          concept_id: concept.id,
          name: concept.name,
          code: concept.code,
          concept_type: concept.concept_type,
          category: concept.category,
          salary_nature: concept.salary_nature,
          source_type: "manual",
          quantity: String(quantity),
          amount: String(amount),
        },
      ]);
    }
    setMessage("");
    setNewConceptId("");
    setNewQuantity("1");
    setNewAmount("");
  };

  const removeModification = (line) => {
    if (touchedLineIds.includes(line.id) && !isStoredOverride(line)) {
      setTouchedLineIds((previous) => previous.filter((id) => id !== line.id));
      setLineEdits((previous) => ({ ...previous, [line.id]: { quantity: String(line.quantity ?? 1), amount: String(line.amount ?? 0) } }));
      return;
    }
    setRemovedOverrideIds((previous) => previous.includes(line.id) ? previous : [...previous, line.id]);
  };

  const hasPendingChanges = useMemo(() => {
    if (!preparation || preparation.generated) return false;
    if (touchedLineIds.length || removedOverrideIds.length || newLines.length) return true;
    return savedOverrideLines.some((line) => {
      const edit = lineEdits[line.id];
      if (!edit) return false;
      return Number(edit.amount) !== Number(line.amount) || Number(edit.quantity) !== Number(line.quantity);
    });
  }, [preparation, touchedLineIds, removedOverrideIds, newLines, savedOverrideLines, lineEdits]);

  const persistPreparation = async ({ announce = true } = {}) => {
    if (!preparation || preparation.generated) return preparation;
    setError("");
    if (announce) setMessage("");
    try {
      setSaving(true);
      const touchedOrSaved = [...visibleOverrideLines];
      const updates = touchedOrSaved
        .filter((line) => {
          const edit = lineEdits[line.id];
          if (!edit) return false;
          return touchedLineIds.includes(line.id)
            || Number(edit.amount) !== Number(line.amount)
            || Number(edit.quantity) !== Number(line.quantity);
        })
        .map((line) => {
          const edit = lineEdits[line.id];
          const quantity = Number(edit.quantity || 0);
          const amount = Number(edit.amount || 0);
          const alreadyMarked = parseOverrideDescription(line);
          return updatePayrollItem(line.id, {
            quantity,
            unit_price: quantity > 0 ? amount / quantity : amount,
            amount,
            description: alreadyMarked ? line.description : serializeOverrideDescription(line),
            notes: OVERRIDE_MARKER,
          });
        });

      const removals = removedOverrideIds.map((itemId) => {
        const line = savedOverrideLines.find((candidate) => candidate.id === itemId);
        if (!line) return Promise.resolve();
        const original = parseOverrideDescription(line);
        if (!original) return deletePayrollItem(itemId);
        return updatePayrollItem(itemId, {
          quantity: original.quantity,
          unit_price: original.quantity > 0 ? original.amount / original.quantity : original.amount,
          amount: original.amount,
          description: original.description,
          notes: null,
        });
      });

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

      await Promise.all([...updates, ...removals, ...creates]);
      const refreshed = await previewPayrollPreparation(preparation.payroll_id);
      hydratePreparation(refreshed);
      if (announce) setMessage("Ajustes del mes guardados. La nómina continúa sin generar.");
      if (onPrepared) await onPrepared(refreshed);
      return refreshed;
    } catch (err) {
      setError(err.message || "No se pudieron guardar los ajustes del periodo");
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

  const adjustmentCount = visibleOverrideLines.length + newLines.length;
  const preview = preparation?.preview || {};

  return (
    <div className="payroll-prep payroll-prep--overrides">
      <section className="payroll-prep__scope">
        <div className="payroll-prep__scope-heading">
          <div>
            <span>PREPARACIÓN DEL PERIODO</span>
            <h2>Selecciona trabajador y periodo</h2>
            <p>El periodo parte siempre de la configuración del contrato, convenio, conceptos permanentes e incidencias registradas.</p>
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

        <div className="payroll-prep__scope-action">
          <div>
            <strong>Abrir el periodo de trabajo</strong>
            <span>No genera la nómina. Solo carga el cálculo de referencia y permite registrar ajustes del mes.</span>
          </div>
          <button
            type="button"
            className="payroll-s42__primary"
            disabled={!scope.contract_id || loading}
            onClick={handleOpenPreparation}
          >
            {loading ? "Abriendo periodo..." : "Abrir preparación"}
          </button>
        </div>
      </section>

      {error && <div className="payroll-prep__error">{error}</div>}
      {message && <div className="payroll-prep__message">{message}</div>}

      {!preparation && (
        <section className="payroll-prep__workspace payroll-prep__workspace--placeholder">
          <header className="payroll-prep__workspace-header">
            <div>
              <span>AJUSTES DEL MES</span>
              <h2>Conceptos a modificar o añadir</h2>
              <p>Este es el panel operativo. Si permanece vacío, la nómina se calculará íntegramente con la configuración por defecto.</p>
            </div>
            <div className="payroll-prep__status">0 ajustes</div>
          </header>
          <div className="payroll-prep__default-rule">
            <strong>Sin ajustes manuales = cálculo automático.</strong>
            <span>Se aplicarán salario y condiciones del contrato, convenio, conceptos permanentes, incidencias, cotizaciones e IRPF configurados.</span>
          </div>
          <div className="payroll-prep__empty-editor">
            Selecciona empresa, trabajador, contrato y periodo; después abre la preparación para editar conceptos.
          </div>
        </section>
      )}

      {preparation && preparation.generated && (
        <section className="payroll-prep__workspace payroll-prep__generated">
          <header className="payroll-prep__workspace-header">
            <div>
              <span>NÓMINA GENERADA · CONSULTA</span>
              <h2>{preparation.employee_name}</h2>
              <p>{preparation.company_name}{preparation.center_name ? ` · ${preparation.center_name}` : ""} · {String(preparation.period_month).padStart(2, "0")}/{preparation.period_year}</p>
            </div>
            <div className="payroll-prep__status is-generated">Generada</div>
          </header>
          <div className="payroll-prep__summary">
            <div><span>Bruto / devengos</span><strong>{formatMoney(preview.gross_salary)} €</strong></div>
            <div><span>Deducciones</span><strong>{formatMoney(preview.total_deductions)} €</strong></div>
            <div className="is-primary"><span>Líquido a percibir</span><strong>{formatMoney(preview.net_salary)} €</strong></div>
            <div><span>Base CC</span><strong>{formatMoney(preview.contribution_base)} €</strong></div>
            <div><span>IRPF</span><strong>{formatMoney(preview.irpf)} €</strong></div>
            <div><span>Coste empresa</span><strong>{formatMoney(preview.company_total_cost)} €</strong></div>
          </div>
          <footer className="payroll-prep__actions">
            <span className="payroll-prep__action-help">El periodo ya está generado y se consulta en modo lectura.</span>
            <button type="button" className="payroll-s42__secondary" onClick={openHistory}>Abrir histórico</button>
            <button type="button" className="payroll-s42__primary" onClick={handlePreview}>Visualizar nómina</button>
          </footer>
        </section>
      )}

      {preparation && !preparation.generated && (
        <section className="payroll-prep__workspace">
          <header className="payroll-prep__workspace-header">
            <div>
              <span>AJUSTES DEL MES · BORRADOR</span>
              <h2>{preparation.employee_name}</h2>
              <p>{preparation.company_name}{preparation.center_name ? ` · ${preparation.center_name}` : ""} · {String(preparation.period_month).padStart(2, "0")}/{preparation.period_year}</p>
            </div>
            <div className="payroll-prep__workspace-meta">
              {hasPendingChanges && <span className="payroll-prep__pending">Cambios sin guardar</span>}
              <div className="payroll-prep__status">{adjustmentCount} ajustes</div>
            </div>
          </header>

          <div className="payroll-prep__default-rule">
            <strong>La tabla puede quedar completamente vacía.</strong>
            <span>En ese caso la generación utilizará exactamente el cálculo por defecto del trabajador. Solo añade aquí excepciones del mes: dietas, pluses, variables, IT, horas, descuentos, cotizaciones, bases o cualquier otro concepto que quieras modificar.</span>
          </div>

          <div className="payroll-prep__reference-strip">
            <div><span>Bruto de referencia</span><strong>{formatMoney(preview.gross_salary)} €</strong></div>
            <div><span>Deducciones</span><strong>{formatMoney(preview.total_deductions)} €</strong></div>
            <div className="is-primary"><span>Líquido</span><strong>{formatMoney(preview.net_salary)} €</strong></div>
            <div><span>Base CC</span><strong>{formatMoney(preview.contribution_base)} €</strong></div>
            <div><span>IRPF</span><strong>{formatMoney(preview.irpf)} €</strong></div>
          </div>

          <div className="payroll-prep__matrix-intro payroll-prep__matrix-intro--overrides">
            <div>
              <h3>Modificaciones del periodo</h3>
              <p>Una fila sustituye el valor por defecto de ese concepto cuando ya existe; si el concepto no existe en la nómina base, se añade como línea nueva.</p>
            </div>
            <span className="payroll-prep__catalog-count">{sortedConcepts.length} conceptos disponibles</span>
          </div>

          <div className="payroll-prep__catalog-tools">
            <label>
              <span>Buscar concepto</span>
              <input
                type="search"
                value={conceptSearch}
                onChange={(event) => setConceptSearch(event.target.value)}
                placeholder="Código, salario, nocturnidad, IT, IRPF, cotización..."
              />
            </label>
            <label>
              <span>Familia</span>
              <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)}>
                <option value="all">Todas las familias</option>
                {families.map((family) => <option key={family} value={family}>{family}</option>)}
              </select>
            </label>
          </div>

          <div className="payroll-prep__matrix-wrap">
            <table className="payroll-prep__matrix payroll-prep__matrix--overrides">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Concepto / descripción</th>
                  <th className="is-number">Cantidad</th>
                  <th className="is-number">Importe</th>
                  <th aria-label="Acciones"></th>
                </tr>
              </thead>
              <tbody>
                {visibleOverrideLines.map((line) => {
                  const edit = lineEdits[line.id] || { quantity: line.quantity, amount: line.amount };
                  return (
                    <tr key={`override-${line.id}`}>
                      <td className="payroll-prep__code"><strong>{line.code}</strong><small>{sourceLabel(line)}</small></td>
                      <td className="payroll-prep__description"><strong>{line.name}</strong><small>{line.category || conceptFamily(line)}</small></td>
                      <td className="is-number">
                        <input
                          className="payroll-prep__matrix-input payroll-prep__matrix-input--quantity"
                          type="number"
                          min="0"
                          step="0.01"
                          value={edit.quantity}
                          onChange={(event) => updateLineEdit(line.id, "quantity", event.target.value)}
                          aria-label={`Cantidad de ${line.name}`}
                        />
                      </td>
                      <td className="is-number">
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
                      </td>
                      <td className="payroll-prep__row-action"><button type="button" onClick={() => removeModification(line)}>Quitar</button></td>
                    </tr>
                  );
                })}

                {newLines.map((line) => (
                  <tr key={line.tempId} className="is-new">
                    <td className="payroll-prep__code"><strong>{line.code}</strong><small>Nuevo</small></td>
                    <td className="payroll-prep__description"><strong>{line.name}</strong><small>{line.category}</small></td>
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

                {visibleOverrideLines.length === 0 && newLines.length === 0 && (
                  <tr className="payroll-prep__matrix-empty-row">
                    <td colSpan="5">
                      <strong>Sin modificaciones para este trabajador y periodo.</strong>
                      <span>La nómina se calculará con sus valores por defecto mientras no añadas una fila.</span>
                    </td>
                  </tr>
                )}

                <tr className="payroll-prep__new-row payroll-prep__new-row--overrides">
                  <td>
                    <select value={newConceptId} onChange={(event) => setNewConceptId(event.target.value)} aria-label="Código del nuevo concepto">
                      <option value="">Seleccionar código...</option>
                      {catalogGroups.map(([label, groupConcepts]) => (
                        <optgroup key={label} label={label}>
                          {groupConcepts.map((concept) => (
                            <option key={concept.id} value={concept.id}>{concept.code}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="payroll-prep__description">
                    <strong>{selectedNewConcept?.name || "Selecciona un concepto del catálogo"}</strong>
                    <small>{selectedNewConcept ? `${conceptFamily(selectedNewConcept)} · ${selectedNewConcept.category}` : "El selector incluye devengos, extrasalariales, IT, deducciones, cotizaciones, bases e informativos."}</small>
                  </td>
                  <td className="is-number">
                    <input className="payroll-prep__matrix-input payroll-prep__matrix-input--quantity" type="number" min="0" step="0.01" value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} aria-label="Cantidad del concepto" />
                  </td>
                  <td className="is-number">
                    <label className="payroll-prep__matrix-amount">
                      <input className="payroll-prep__matrix-input" type="number" min="0" step="0.01" value={newAmount} onChange={(event) => setNewAmount(event.target.value)} aria-label="Importe del concepto" placeholder="0,00" />
                      <span>€</span>
                    </label>
                  </td>
                  <td className="payroll-prep__row-action">
                    <button type="button" className="is-add" onClick={handleAddLocalLine} disabled={!newConceptId || newAmount === ""}>Añadir</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <details className="payroll-prep__defaults">
            <summary>
              <span>Ver conceptos que se aplicarán por defecto</span>
              <strong>{baselineLines.length} líneas base</strong>
            </summary>
            <p>Estas líneas no necesitan copiarse al panel de ajustes. Se usarán automáticamente mientras no las sustituyas arriba.</p>
            <ReadOnlyBaseTable lines={baselineLines} />
          </details>

          <footer className="payroll-prep__actions payroll-prep__actions--overrides">
            <span className="payroll-prep__action-help">
              Visualizar recalcula el borrador con los ajustes actuales. Guardar conserva los cambios para generar la nómina más adelante.
            </span>
            <button type="button" className="payroll-s42__secondary" onClick={() => persistPreparation()} disabled={saving || !hasPendingChanges}>
              {saving ? "Guardando..." : "Guardar ajustes"}
            </button>
            <button type="button" className="payroll-s42__primary" onClick={handlePreview} disabled={saving}>
              {saving ? "Recalculando..." : "Visualizar nómina"}
            </button>
          </footer>
        </section>
      )}

      {previewOpen && <PreviewModal preparation={preparation} onClose={() => setPreviewOpen(false)} />}
      {receiptPayrollId && <PayrollReceiptModal payrollId={receiptPayrollId} onClose={() => setReceiptPayrollId(null)} />}
    </div>
  );
}
