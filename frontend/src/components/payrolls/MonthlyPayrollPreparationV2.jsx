import { useEffect, useMemo, useState } from "react";

import { fetchContracts } from "../../services/api";
import { fetchAllEmployees } from "../../services/employeeApi";
import {
  createPayrollItem,
  deletePayrollItem,
  ensurePayrollPreparation,
  fetchPayrollConcepts,
  previewPayrollPreparation,
  reopenPayrollPreparation,
  updatePayrollItem,
} from "../../services/payrollApi";
import PayrollReceiptModal from "./PayrollReceiptModal";
import "./payrollPreparationEditorV2.css";

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
  return "Configurado";
}

function conceptFamily(concept) {
  const type = String(concept?.concept_type || "").toUpperCase();
  const category = String(concept?.category || "").toUpperCase();
  const nature = String(concept?.salary_nature || "").toUpperCase();

  if (["IT", "PRESTACION_IT", "COMPLEMENTO_IT"].includes(category)) return "IT y prestaciones";
  if (category === "SEGURIDAD_SOCIAL") return "Cotización trabajador";
  if (category === "COSTE_EMPRESA") return "Coste empresa";
  if (["BASE_INFORMATIVA", "INFORMATIVO"].includes(type)) return "Bases e informativos";
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
    <section className="payroll-prep-v2__preview-section">
      <div className="payroll-prep-v2__preview-title">
        <h3>{title}</h3>
        <span>{lines.length} líneas</span>
      </div>
      <div className="payroll-prep-v2__table-scroll">
        <table className="payroll-prep-v2__preview-table">
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
                <td>{line.name}</td>
                <td>{sourceLabel(line)}</td>
                <td className="is-number">{Number(line.quantity || 0).toLocaleString("es-ES")}</td>
                <td className="is-number"><strong>{formatMoney(line.amount)} €</strong></td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan="5" className="is-empty">Sin líneas en este bloque.</td></tr>
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
  const bases = lines.filter((line) =>
    ["BASE_INFORMATIVA", "INFORMATIVO"].includes(String(line.concept_type).toUpperCase())
    && String(line.category).toUpperCase() !== "COSTE_EMPRESA"
  );
  const company = lines.filter((line) => String(line.category).toUpperCase() === "COSTE_EMPRESA");

  return (
    <div className="payroll-prep-v2__overlay" role="dialog" aria-modal="true" aria-label="Vista previa de nómina">
      <section className="payroll-prep-v2__preview-modal">
        <header>
          <div>
            <span>VISTA PREVIA · NO GENERADA</span>
            <h2>{preparation.employee_name}</h2>
            <p>
              {preparation.company_name}
              {preparation.center_name ? ` · ${preparation.center_name}` : ""}
              {` · ${String(preparation.period_month).padStart(2, "0")}/${preparation.period_year}`}
            </p>
          </div>
          <button type="button" className="payroll-prep-v2__close" onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <div className="payroll-prep-v2__preview-body">
          <div className="payroll-prep-v2__totals payroll-prep-v2__totals--preview">
            <div><span>Total devengado</span><strong>{formatMoney(preview.gross_salary)} €</strong></div>
            <div><span>Total deducciones</span><strong>{formatMoney(preview.total_deductions)} €</strong></div>
            <div className="is-primary"><span>Líquido a percibir</span><strong>{formatMoney(preview.net_salary)} €</strong></div>
            <div><span>Base CC</span><strong>{formatMoney(preview.contribution_base)} €</strong></div>
            <div><span>IRPF</span><strong>{formatMoney(preview.irpf)} €</strong></div>
            <div><span>Coste empresa</span><strong>{formatMoney(preview.company_total_cost)} €</strong></div>
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

export default function MonthlyPayrollPreparationV2({ companies = [], workCenters = [], onPrepared }) {
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
  const [restoreOverrideIds, setRestoreOverrideIds] = useState([]);
  const [newLines, setNewLines] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reopening, setReopening] = useState(false);
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

  const employeeContracts = useMemo(
    () => companyContracts.filter((contract) => String(contract.employee_id) === String(scope.employee_id)),
    [companyContracts, scope.employee_id]
  );

  const selectedContract = employeeContracts.find(
    (contract) => String(contract.id) === String(scope.contract_id)
  );
  const selectedCenter = workCenters.find(
    (center) => String(center.id) === String(selectedContract?.center_id)
  );

  const sortedConcepts = useMemo(
    () => [...concepts]
      .filter((concept) => concept.is_active)
      .sort((a, b) =>
        (Number(a.display_order || 0) - Number(b.display_order || 0))
        || String(a.code).localeCompare(String(b.code), "es")
      ),
    [concepts]
  );

  const families = useMemo(
    () => [...new Set(sortedConcepts.map(conceptFamily))],
    [sortedConcepts]
  );

  const filteredCatalog = useMemo(() => {
    const search = catalogSearch.trim().toLocaleLowerCase("es");
    return sortedConcepts.filter((concept) => {
      if (familyFilter !== "all" && conceptFamily(concept) !== familyFilter) return false;
      if (!search) return true;
      return [concept.code, concept.name, concept.category, concept.salary_nature]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("es").includes(search));
    });
  }, [sortedConcepts, catalogSearch, familyFilter]);

  const resetEditor = () => {
    setPreparation(null);
    setLineEdits({});
    setTouchedLineIds([]);
    setRestoreOverrideIds([]);
    setNewLines([]);
    setCatalogSearch("");
    setFamilyFilter("all");
    setCatalogOpen(false);
    setMessage("");
    setPreviewOpen(false);
    setReceiptPayrollId(null);
  };

  const handleScopeChange = (event) => {
    const { name, value } = event.target;
    setError("");
    resetEditor();

    setScope((previous) => {
      if (name === "company_id") {
        return { ...previous, company_id: value, employee_id: "", contract_id: "" };
      }
      if (name === "employee_id") {
        const candidates = contracts.filter(
          (contract) => String(contract.company_id) === String(previous.company_id)
            && String(contract.employee_id) === String(value)
            && contract.status === "active"
        );
        return {
          ...previous,
          employee_id: value,
          contract_id: candidates.length === 1 ? String(candidates[0].id) : "",
        };
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
    setRestoreOverrideIds([]);
    setNewLines([]);
  };

  useEffect(() => {
    if (!scope.employee_id || !scope.contract_id) return undefined;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const data = await ensurePayrollPreparation({
          employee_id: Number(scope.employee_id),
          contract_id: Number(scope.contract_id),
          period_month: Number(scope.period_month),
          period_year: Number(scope.period_year),
        });
        if (cancelled) return;
        hydratePreparation(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "No se pudo cargar la preparación del periodo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [scope.employee_id, scope.contract_id, scope.period_month, scope.period_year]);

  const existingLines = useMemo(
    () => [...(preparation?.lines || [])].sort((a, b) =>
      (Number(a.display_order || 0) - Number(b.display_order || 0))
      || String(a.code).localeCompare(String(b.code), "es")
    ),
    [preparation]
  );

  const includedConceptIds = useMemo(() => new Set([
    ...existingLines.map((line) => String(line.concept_id)),
    ...newLines.map((line) => String(line.concept_id)),
  ]), [existingLines, newLines]);

  const savedOverrideLines = useMemo(
    () => existingLines.filter((line) => isStoredOverride(line)),
    [existingLines]
  );

  const ensureEditable = async () => {
    if (!preparation) return null;
    if (!preparation.generated) return preparation;

    setReopening(true);
    setError("");
    try {
      const reopened = await reopenPayrollPreparation(preparation.payroll_id);
      hydratePreparation(reopened);
      setMessage("La nómina ha vuelto a borrador. Cuando termines los cambios tendrás que generarla de nuevo.");
      return reopened;
    } catch (err) {
      setError(err.message || "No se pudo reabrir la nómina para editarla");
      return null;
    } finally {
      setReopening(false);
    }
  };

  const handleLineChange = async (line, field, value) => {
    const editable = await ensureEditable();
    if (!editable) return;

    const currentLine = (editable.lines || []).find((candidate) => candidate.id === line.id) || line;
    if (!isStoredOverride(currentLine)) {
      setTouchedLineIds((previous) => previous.includes(line.id) ? previous : [...previous, line.id]);
    }
    setRestoreOverrideIds((previous) => previous.filter((id) => id !== line.id));
    setLineEdits((previous) => ({
      ...previous,
      [line.id]: {
        quantity: String(previous[line.id]?.quantity ?? currentLine.quantity ?? 1),
        amount: String(previous[line.id]?.amount ?? currentLine.amount ?? 0),
        [field]: value,
      },
    }));
  };

  const addConcept = async (concept) => {
    const editable = await ensureEditable();
    if (!editable) return;

    const alreadyExists = (editable.lines || []).some(
      (line) => String(line.concept_id) === String(concept.id)
    ) || newLines.some((line) => String(line.concept_id) === String(concept.id));

    if (alreadyExists) {
      setMessage("Ese concepto ya está incluido en la tabla. Edítalo directamente arriba.");
      return;
    }

    setNewLines((previous) => [
      ...previous,
      {
        tempId: `new-${Date.now()}-${previous.length}`,
        concept_id: concept.id,
        code: concept.code,
        name: concept.name,
        concept_type: concept.concept_type,
        category: concept.category,
        salary_nature: concept.salary_nature,
        source_type: "manual",
        quantity: "1",
        amount: "0",
      },
    ]);
    setCatalogOpen(false);
    setCatalogSearch("");
    setFamilyFilter("all");
    setMessage("Concepto añadido al borrador. Indica cantidad e importe y guarda los cambios.");
  };

  const handleNewLineChange = (tempId, field, value) => {
    setNewLines((previous) => previous.map((line) =>
      line.tempId === tempId ? { ...line, [field]: value } : line
    ));
  };

  const removeNewLine = (tempId) => {
    setNewLines((previous) => previous.filter((line) => line.tempId !== tempId));
  };

  const restoreLine = async (line) => {
    const editable = await ensureEditable();
    if (!editable) return;

    const currentLine = (editable.lines || []).find((candidate) => candidate.id === line.id) || line;
    const original = parseOverrideDescription(currentLine);

    if (original) {
      setLineEdits((previous) => ({
        ...previous,
        [line.id]: {
          quantity: String(original.quantity),
          amount: String(original.amount),
        },
      }));
      setRestoreOverrideIds((previous) => previous.includes(line.id) ? previous : [...previous, line.id]);
      setTouchedLineIds((previous) => previous.filter((id) => id !== line.id));
      return;
    }

    if (isStoredOverride(currentLine)) {
      setRestoreOverrideIds((previous) => previous.includes(line.id) ? previous : [...previous, line.id]);
      return;
    }

    setLineEdits((previous) => ({
      ...previous,
      [line.id]: {
        quantity: String(currentLine.quantity ?? 1),
        amount: String(currentLine.amount ?? 0),
      },
    }));
    setTouchedLineIds((previous) => previous.filter((id) => id !== line.id));
  };

  const hasPendingChanges = useMemo(() => {
    if (!preparation) return false;
    if (touchedLineIds.length || restoreOverrideIds.length || newLines.length) return true;

    return savedOverrideLines.some((line) => {
      const edit = lineEdits[line.id];
      if (!edit) return false;
      return Number(edit.amount) !== Number(line.amount)
        || Number(edit.quantity) !== Number(line.quantity);
    });
  }, [preparation, touchedLineIds, restoreOverrideIds, newLines, savedOverrideLines, lineEdits]);

  const persistPreparation = async ({ announce = true } = {}) => {
    let editable = preparation;
    if (!editable) return null;
    if (editable.generated) {
      editable = await ensureEditable();
      if (!editable) return null;
    }

    setSaving(true);
    setError("");
    if (announce) setMessage("");

    try {
      const currentLines = editable.lines || [];
      const currentOverrides = currentLines.filter((line) => isStoredOverride(line));

      const updates = currentLines
        .filter((line) => !restoreOverrideIds.includes(line.id))
        .filter((line) => {
          const edit = lineEdits[line.id];
          if (!edit) return false;
          return touchedLineIds.includes(line.id)
            || (isStoredOverride(line)
              && (Number(edit.amount) !== Number(line.amount)
                || Number(edit.quantity) !== Number(line.quantity)));
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

      const restores = restoreOverrideIds.map((itemId) => {
        const line = currentOverrides.find((candidate) => candidate.id === itemId);
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
        return createPayrollItem(editable.payroll_id, {
          concept_id: Number(line.concept_id),
          description: "Concepto mensual informado en preparación",
          quantity,
          unit_price: quantity > 0 ? amount / quantity : amount,
          amount,
          display_order: 700 + index,
          notes: OVERRIDE_MARKER,
        });
      });

      await Promise.all([...updates, ...restores, ...creates]);
      const refreshed = await previewPayrollPreparation(editable.payroll_id);
      hydratePreparation(refreshed);
      if (announce) setMessage("Cambios guardados. Esta nómina queda en borrador hasta que vuelvas a generarla.");
      if (onPrepared) await onPrepared(refreshed);
      return refreshed;
    } catch (err) {
      setError(err.message || "No se pudieron guardar los cambios de la nómina");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!preparation) return;

    if (preparation.generated && !hasPendingChanges) {
      setReceiptPayrollId(preparation.payroll_id);
      return;
    }

    let refreshed = preparation;
    if (hasPendingChanges || preparation.generated) {
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

  const preview = preparation?.preview || {};
  const ready = Boolean(scope.employee_id && scope.contract_id);
  const generated = Boolean(preparation?.generated);
  const modifiedCount = touchedLineIds.length + restoreOverrideIds.length + newLines.length;

  return (
    <div className="payroll-prep-v2">
      <section className="payroll-prep-v2__scope">
        <div className="payroll-prep-v2__section-head">
          <div>
            <span>PERIODO DE TRABAJO</span>
            <h2>Empresa, trabajador y periodo</h2>
            <p>Selecciona el contexto. La nómina se carga automáticamente para editarla o revisarla.</p>
          </div>
        </div>

        <div className="payroll-prep-v2__scope-grid">
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
          <label className="is-month">
            <span>Mes</span>
            <select name="period_month" value={scope.period_month} onChange={handleScopeChange}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>{String(month).padStart(2, "0")}</option>
              ))}
            </select>
          </label>
          <label className="is-year">
            <span>Año</span>
            <input name="period_year" type="number" value={scope.period_year} onChange={handleScopeChange} />
          </label>
        </div>

        {selectedContract && (
          <div className="payroll-prep-v2__context">
            <span>{selectedCenter?.name || "Sin centro asignado"}</span>
            <span>{selectedContract.professional_category || selectedContract.job_position || "Categoría sin informar"}</span>
          </div>
        )}
      </section>

      {error && <div className="payroll-prep-v2__alert is-error">{error}</div>}
      {message && <div className="payroll-prep-v2__alert is-info">{message}</div>}

      {!ready && (
        <section className="payroll-prep-v2__empty">
          <strong>Selecciona un trabajador y su contrato.</strong>
          <span>Después aparecerán todos los conceptos que forman la nómina y podrás modificarlos directamente.</span>
        </section>
      )}

      {ready && loading && !preparation && (
        <section className="payroll-prep-v2__empty">Cargando nómina del periodo...</section>
      )}

      {preparation && (
        <section className="payroll-prep-v2__editor">
          <header className="payroll-prep-v2__editor-head">
            <div>
              <span>EDITOR DE NÓMINA · {generated ? "GENERADA" : "BORRADOR"}</span>
              <h2>{preparation.employee_name}</h2>
              <p>
                {preparation.company_name}
                {preparation.center_name ? ` · ${preparation.center_name}` : ""}
                {` · ${String(preparation.period_month).padStart(2, "0")}/${preparation.period_year}`}
              </p>
            </div>
            <div className={`payroll-prep-v2__state ${generated ? "is-generated" : "is-draft"}`}>
              {generated ? "Generada" : hasPendingChanges ? "Cambios sin guardar" : "Borrador"}
            </div>
          </header>

          <div className={`payroll-prep-v2__rule ${generated ? "is-generated" : ""}`}>
            <strong>{generated ? "Puedes modificarla aunque ya esté generada o el mes haya pasado." : "Edita solo lo que necesites."}</strong>
            <span>
              {generated
                ? "Al cambiar cualquier cantidad, importe o concepto, AulaNomina la devolverá automáticamente a borrador. Después tendrás que generar la nómina de nuevo."
                : "Los conceptos que no toques mantienen su configuración. Guardar cambios no genera la nómina."}
            </span>
          </div>

          <div className="payroll-prep-v2__totals">
            <div><span>Bruto</span><strong>{formatMoney(preview.gross_salary)} €</strong></div>
            <div><span>Deducciones</span><strong>{formatMoney(preview.total_deductions)} €</strong></div>
            <div className="is-primary"><span>Líquido</span><strong>{formatMoney(preview.net_salary)} €</strong></div>
            <div><span>Base CC</span><strong>{formatMoney(preview.contribution_base)} €</strong></div>
            <div><span>IRPF</span><strong>{formatMoney(preview.irpf)} €</strong></div>
            <div><span>Coste empresa</span><strong>{formatMoney(preview.company_total_cost)} €</strong></div>
          </div>

          <div className="payroll-prep-v2__concept-head">
            <div>
              <h3>Conceptos de esta nómina</h3>
              <p>Cantidad e importe son editables directamente. Las filas no modificadas siguen usando su valor configurado.</p>
            </div>
            <button type="button" className="payroll-s42__primary" onClick={() => setCatalogOpen((open) => !open)} disabled={reopening}>
              + Añadir concepto
            </button>
          </div>

          {catalogOpen && (
            <div className="payroll-prep-v2__catalog">
              <div className="payroll-prep-v2__catalog-tools">
                <label>
                  <span>Buscar en catálogo</span>
                  <input
                    type="search"
                    value={catalogSearch}
                    onChange={(event) => setCatalogSearch(event.target.value)}
                    placeholder="Código, salario, nocturnidad, dieta, IT, IRPF, cotización..."
                    autoFocus
                  />
                </label>
                <label>
                  <span>Familia</span>
                  <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)}>
                    <option value="all">Todas las familias</option>
                    {families.map((family) => <option key={family} value={family}>{family}</option>)}
                  </select>
                </label>
                <button type="button" className="payroll-s42__secondary" onClick={() => setCatalogOpen(false)}>Cerrar</button>
              </div>

              <div className="payroll-prep-v2__catalog-list">
                {filteredCatalog.map((concept) => {
                  const included = includedConceptIds.has(String(concept.id));
                  return (
                    <button
                      key={concept.id}
                      type="button"
                      className="payroll-prep-v2__catalog-item"
                      disabled={included || reopening}
                      onClick={() => addConcept(concept)}
                    >
                      <span className="is-code">{concept.code}</span>
                      <span className="is-name">{concept.name}</span>
                      <span className="is-family">{conceptFamily(concept)}</span>
                      <strong>{included ? "Incluido" : "Añadir"}</strong>
                    </button>
                  );
                })}
                {filteredCatalog.length === 0 && <div className="payroll-prep-v2__catalog-empty">No hay conceptos que coincidan con el filtro.</div>}
              </div>
            </div>
          )}

          <div className="payroll-prep-v2__table-scroll">
            <table className="payroll-prep-v2__concept-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Concepto / descripción</th>
                  <th className="is-number">Cantidad</th>
                  <th className="is-number">Importe</th>
                  <th>Estado</th>
                  <th aria-label="Acciones"></th>
                </tr>
              </thead>
              <tbody>
                {existingLines.map((line) => {
                  const edit = lineEdits[line.id] || { quantity: String(line.quantity ?? 1), amount: String(line.amount ?? 0) };
                  const isOverride = isStoredOverride(line) && !restoreOverrideIds.includes(line.id);
                  const isTouched = touchedLineIds.includes(line.id);
                  const isRestoring = restoreOverrideIds.includes(line.id);
                  const changed = isOverride || isTouched || isRestoring;

                  return (
                    <tr key={line.id} className={changed ? "is-modified" : ""}>
                      <td className="is-code"><strong>{line.code}</strong></td>
                      <td className="is-concept">
                        <strong>{line.name}</strong>
                        <span>{conceptFamily(line)} · {sourceLabel(line)}</span>
                      </td>
                      <td className="is-number">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={edit.quantity}
                          onChange={(event) => handleLineChange(line, "quantity", event.target.value)}
                          disabled={reopening}
                          aria-label={`Cantidad de ${line.name}`}
                        />
                      </td>
                      <td className="is-number">
                        <label className="payroll-prep-v2__money-input">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={edit.amount}
                            onChange={(event) => handleLineChange(line, "amount", event.target.value)}
                            disabled={reopening}
                            aria-label={`Importe de ${line.name}`}
                          />
                          <span>€</span>
                        </label>
                      </td>
                      <td>
                        <span className={`payroll-prep-v2__row-state ${changed ? "is-modified" : ""}`}>
                          {isRestoring ? "Restablecer" : isOverride || isTouched ? "Modificado" : "Por defecto"}
                        </span>
                      </td>
                      <td className="is-action">
                        {changed && !isRestoring ? (
                          <button type="button" onClick={() => restoreLine(line)} disabled={reopening}>Restablecer</button>
                        ) : <span>—</span>}
                      </td>
                    </tr>
                  );
                })}

                {newLines.map((line) => (
                  <tr key={line.tempId} className="is-new">
                    <td className="is-code"><strong>{line.code}</strong></td>
                    <td className="is-concept">
                      <strong>{line.name}</strong>
                      <span>{conceptFamily(line)} · Manual</span>
                    </td>
                    <td className="is-number">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(event) => handleNewLineChange(line.tempId, "quantity", event.target.value)}
                      />
                    </td>
                    <td className="is-number">
                      <label className="payroll-prep-v2__money-input">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.amount}
                          onChange={(event) => handleNewLineChange(line.tempId, "amount", event.target.value)}
                        />
                        <span>€</span>
                      </label>
                    </td>
                    <td><span className="payroll-prep-v2__row-state is-new">Nuevo</span></td>
                    <td className="is-action"><button type="button" onClick={() => removeNewLine(line.tempId)}>Eliminar</button></td>
                  </tr>
                ))}

                {existingLines.length === 0 && newLines.length === 0 && (
                  <tr><td colSpan="6" className="payroll-prep-v2__table-empty">No hay líneas materializadas en este periodo. Añade un concepto si necesitas informar una excepción.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="payroll-prep-v2__actions">
            <div>
              <strong>{generated ? "Nómina generada" : hasPendingChanges ? `${modifiedCount} cambio(s) pendiente(s)` : "Sin cambios pendientes"}</strong>
              <span>
                {generated
                  ? "Puedes editar directamente. El primer cambio la devolverá a borrador y exigirá una nueva generación."
                  : "Guardar conserva el borrador. Visualizar recalcula sin generar definitivamente."}
              </span>
            </div>
            <div className="payroll-prep-v2__action-buttons">
              {generated && <button type="button" className="payroll-s42__secondary" onClick={openHistory}>Abrir histórico</button>}
              <button
                type="button"
                className="payroll-s42__secondary"
                onClick={() => persistPreparation()}
                disabled={saving || reopening || !hasPendingChanges}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button type="button" className="payroll-s42__primary" onClick={handlePreview} disabled={saving || reopening}>
                {generated && !hasPendingChanges ? "Visualizar nómina" : "Previsualizar nómina"}
              </button>
            </div>
          </footer>
        </section>
      )}

      {previewOpen && <PreviewModal preparation={preparation} onClose={() => setPreviewOpen(false)} />}
      {receiptPayrollId && <PayrollReceiptModal payrollId={receiptPayrollId} onClose={() => setReceiptPayrollId(null)} />}
    </div>
  );
}
