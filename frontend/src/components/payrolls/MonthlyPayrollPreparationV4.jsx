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
import "./payrollPreparationSpreadsheet.css";
import "./payrollPreparationSpreadsheetV4.css";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const EMPTY_ROWS = 6;
const OVERRIDE_MARKER = "[PREPARATION_OVERRIDE] Edición desde preparación mensual";
const OVERRIDE_DESCRIPTION_PREFIX = "[AULANOMINA_MONTHLY_OVERRIDE]";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundMoney(value) {
  const number = Number(value || 0);
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

function employeeName(employee) {
  return [employee?.first_name, employee?.last_name, employee?.second_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function functionalCode(conceptOrLine) {
  const value = Number(conceptOrLine?.concept_id ?? conceptOrLine?.id);
  return Number.isFinite(value) && value > 0 ? String(value) : "";
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

function lineEditor(line) {
  const quantity = Number(line?.quantity ?? 1);
  const amount = Number(line?.amount ?? 0);
  const explicitUnit = Number(line?.unit_price ?? 0);
  const unitPrice = explicitUnit || (quantity ? amount / quantity : amount);
  return {
    quantity: String(quantity),
    unit_price: String(roundMoney(unitPrice)),
    amount: String(roundMoney(amount)),
  };
}

function makeBlankRow(index) {
  return {
    tempId: `blank-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    codeInput: "",
    concept_id: null,
    technical_code: "",
    name: "",
    category: "",
    concept_type: "",
    salary_nature: "",
    source_type: "manual",
    quantity: "1",
    unit_price: "",
    amount: "",
    error: "",
  };
}

function initialBlankRows() {
  return Array.from({ length: EMPTY_ROWS }, (_, index) => makeBlankRow(index));
}

function PreviewTable({ title, lines }) {
  return (
    <section className="payroll-sheet__preview-section">
      <div className="payroll-sheet__preview-title">
        <h3>{title}</h3>
        <span>{lines.length} líneas</span>
      </div>
      <div className="payroll-sheet__table-scroll">
        <table className="payroll-sheet__preview-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Concepto</th>
              <th>Cantidad</th>
              <th>Precio unitario</th>
              <th>Precio total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const quantity = Number(line.quantity || 0);
              const unitPrice = Number(line.unit_price || 0)
                || (quantity ? Number(line.amount || 0) / quantity : Number(line.amount || 0));
              return (
                <tr key={`${title}-${line.id}-${line.concept_id}`}>
                  <td className="is-code is-functional-code">{functionalCode(line)}</td>
                  <td>{line.name}</td>
                  <td className="is-number">{quantity.toLocaleString("es-ES")}</td>
                  <td className="is-number">{formatMoney(unitPrice)} €</td>
                  <td className="is-number"><strong>{formatMoney(line.amount)} €</strong></td>
                </tr>
              );
            })}
            {lines.length === 0 && <tr><td colSpan="5" className="is-empty">Sin líneas en este bloque.</td></tr>}
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
    <div className="payroll-sheet__overlay" role="dialog" aria-modal="true" aria-label="Vista previa de nómina">
      <section className="payroll-sheet__preview-modal">
        <header>
          <div>
            <span>VISTA PREVIA · NO GENERADA</span>
            <h2>{preparation.employee_name}</h2>
            <p>{preparation.company_name} · {String(preparation.period_month).padStart(2, "0")}/{preparation.period_year}</p>
          </div>
          <button type="button" className="payroll-sheet__close" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="payroll-sheet__preview-body">
          <div className="payroll-sheet__totals">
            <div><span>Bruto</span><strong>{formatMoney(preview.gross_salary)} €</strong></div>
            <div><span>Deducciones</span><strong>{formatMoney(preview.total_deductions)} €</strong></div>
            <div className="is-primary"><span>Líquido</span><strong>{formatMoney(preview.net_salary)} €</strong></div>
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

function CatalogModal({ concepts, families, includedConceptIds, targetRowId, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("all");

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es");
    return concepts.filter((concept) => {
      if (family !== "all" && conceptFamily(concept) !== family) return false;
      if (!needle) return true;
      return [
        functionalCode(concept),
        concept.name,
        concept.category,
        concept.salary_nature,
        conceptFamily(concept),
        concept.code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("es").includes(needle));
    });
  }, [concepts, family, search]);

  return (
    <div className="payroll-sheet__overlay" role="dialog" aria-modal="true" aria-label="Catálogo de conceptos">
      <section className="payroll-sheet__catalog-modal payroll-sheet__catalog-modal--numeric">
        <header>
          <div>
            <span>CATÁLOGO DE CÓDIGOS</span>
            <h2>Buscar concepto de nómina</h2>
            <p>Los códigos visibles son numéricos. Busca por número, concepto o familia.</p>
          </div>
          <button type="button" className="payroll-sheet__close" onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <div className="payroll-sheet__catalog-filters">
          <label>
            <span>Buscar</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ej. 40, vacaciones, nocturnidad, dieta..."
              autoFocus
            />
          </label>
          <label>
            <span>Familia</span>
            <select value={family} onChange={(event) => setFamily(event.target.value)}>
              <option value="all">Todas las familias</option>
              {families.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>

        <div className="payroll-sheet__catalog-table-wrap">
          <table className="payroll-sheet__catalog-table payroll-sheet__catalog-table--numeric">
            <thead>
              <tr>
                <th>Código</th>
                <th>Concepto</th>
                <th>Familia</th>
                <th>Tipo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((concept) => {
                const included = includedConceptIds.has(String(concept.id));
                return (
                  <tr key={concept.id}>
                    <td className="is-code is-functional-code"><strong>{functionalCode(concept)}</strong></td>
                    <td><strong>{concept.name}</strong></td>
                    <td>{conceptFamily(concept)}</td>
                    <td>{concept.concept_type || "-"}</td>
                    <td className="is-action">
                      <button type="button" disabled={included} onClick={() => onSelect(targetRowId, concept)}>
                        {included ? "Ya incluido" : "Seleccionar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan="5" className="is-empty">No hay conceptos con esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function MonthlyPayrollPreparationV4({ companies = [], workCenters = [], onPrepared }) {
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
  const [draftRows, setDraftRows] = useState(initialBlankRows);
  const [catalogTargetRowId, setCatalogTargetRowId] = useState(null);
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

  const activeCompanies = useMemo(() => companies.filter((company) => company.is_active), [companies]);

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

  const selectedContract = employeeContracts.find((contract) => String(contract.id) === String(scope.contract_id));
  const selectedCenter = workCenters.find((center) => String(center.id) === String(selectedContract?.center_id));

  const sortedConcepts = useMemo(
    () => [...concepts]
      .filter((concept) => concept.is_active)
      .sort((a, b) => Number(a.id) - Number(b.id)),
    [concepts]
  );

  const families = useMemo(() => [...new Set(sortedConcepts.map(conceptFamily))], [sortedConcepts]);

  const conceptByNumericCode = useMemo(() => {
    const map = new Map();
    sortedConcepts.forEach((concept) => map.set(String(Number(concept.id)), concept));
    return map;
  }, [sortedConcepts]);

  const existingLines = useMemo(
    () => [...(preparation?.lines || [])].sort((a, b) =>
      Number(a.display_order || 0) - Number(b.display_order || 0)
      || Number(a.concept_id || 0) - Number(b.concept_id || 0)
    ),
    [preparation]
  );

  const includedConceptIds = useMemo(() => new Set([
    ...existingLines.map((line) => String(line.concept_id)),
    ...draftRows.filter((row) => row.concept_id).map((row) => String(row.concept_id)),
  ]), [existingLines, draftRows]);

  const savedOverrideLines = useMemo(() => existingLines.filter(isStoredOverride), [existingLines]);

  const resetEditor = () => {
    setPreparation(null);
    setLineEdits({});
    setTouchedLineIds([]);
    setRestoreOverrideIds([]);
    setDraftRows(initialBlankRows());
    setCatalogTargetRowId(null);
    setMessage("");
    setPreviewOpen(false);
    setReceiptPayrollId(null);
  };

  const handleScopeChange = (event) => {
    const { name, value } = event.target;
    setError("");
    resetEditor();
    setScope((previous) => {
      if (name === "company_id") return { ...previous, company_id: value, employee_id: "", contract_id: "" };
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
    setLineEdits(Object.fromEntries((data.lines || []).map((line) => [line.id, lineEditor(line)])));
    setTouchedLineIds([]);
    setRestoreOverrideIds([]);
    setDraftRows(initialBlankRows());
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
        if (!cancelled) hydratePreparation(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "No se pudo cargar la preparación del periodo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [scope.employee_id, scope.contract_id, scope.period_month, scope.period_year]);

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

  const markTouched = (line) => {
    if (!isStoredOverride(line)) {
      setTouchedLineIds((previous) => previous.includes(line.id) ? previous : [...previous, line.id]);
    }
    setRestoreOverrideIds((previous) => previous.filter((id) => id !== line.id));
  };

  const handleExistingCell = async (line, field, value) => {
    const editable = await ensureEditable();
    if (!editable) return;
    const currentLine = (editable.lines || []).find((candidate) => candidate.id === line.id) || line;
    const current = lineEdits[line.id] || lineEditor(currentLine);
    const next = { ...current, [field]: value };

    if (field === "quantity" || field === "unit_price") {
      const quantity = Number(field === "quantity" ? value : next.quantity || 0);
      const unitPrice = Number(field === "unit_price" ? value : next.unit_price || 0);
      next.amount = String(roundMoney(quantity * unitPrice));
    }
    if (field === "amount") {
      const quantity = Number(next.quantity || 0);
      const amount = Number(value || 0);
      if (quantity > 0) next.unit_price = String(roundMoney(amount / quantity));
    }

    markTouched(currentLine);
    setLineEdits((previous) => ({ ...previous, [line.id]: next }));
  };

  const fillDraftRow = async (rowId, concept) => {
    const editable = await ensureEditable();
    if (!editable) return;

    const alreadyIncluded = (editable.lines || []).some((line) => String(line.concept_id) === String(concept.id))
      || draftRows.some((row) => row.tempId !== rowId && String(row.concept_id) === String(concept.id));
    if (alreadyIncluded) {
      setMessage("Ese concepto ya está incluido en la nómina. Edítalo en su fila actual.");
      setCatalogTargetRowId(null);
      return;
    }

    setDraftRows((previous) => previous.map((row) => row.tempId === rowId ? {
      ...row,
      concept_id: concept.id,
      codeInput: functionalCode(concept),
      technical_code: concept.code,
      name: concept.name,
      category: concept.category,
      concept_type: concept.concept_type,
      salary_nature: concept.salary_nature,
      quantity: row.quantity || "1",
      unit_price: row.unit_price || "",
      amount: row.amount || "",
      error: "",
    } : row));
    setCatalogTargetRowId(null);
  };

  const resolveCode = async (rowId, rawCode) => {
    const input = String(rawCode || "").trim();
    setDraftRows((previous) => previous.map((row) => row.tempId === rowId ? { ...row, codeInput: input, error: "" } : row));

    if (!input) {
      setDraftRows((previous) => previous.map((row) => row.tempId === rowId ? {
        ...makeBlankRow(0),
        tempId: row.tempId,
      } : row));
      return;
    }

    if (!/^\d+$/.test(input)) {
      setDraftRows((previous) => previous.map((row) => row.tempId === rowId ? {
        ...row,
        concept_id: null,
        name: "",
        technical_code: "",
        error: "El código debe ser numérico",
      } : row));
      return;
    }

    const normalized = String(Number(input));
    const concept = conceptByNumericCode.get(normalized);
    if (!concept) {
      setDraftRows((previous) => previous.map((row) => row.tempId === rowId ? {
        ...row,
        concept_id: null,
        name: "",
        technical_code: "",
        error: "Código no encontrado",
      } : row));
      return;
    }
    await fillDraftRow(rowId, concept);
  };

  const handleDraftCell = (rowId, field, value) => {
    setDraftRows((previous) => previous.map((row) => {
      if (row.tempId !== rowId) return row;
      const next = { ...row, [field]: value };
      if (field === "quantity" || field === "unit_price") {
        const quantity = Number(field === "quantity" ? value : next.quantity || 0);
        const unitPrice = Number(field === "unit_price" ? value : next.unit_price || 0);
        if (next.concept_id && next.unit_price !== "") next.amount = String(roundMoney(quantity * unitPrice));
      }
      if (field === "amount") {
        const quantity = Number(next.quantity || 0);
        const amount = Number(value || 0);
        if (quantity > 0 && value !== "") next.unit_price = String(roundMoney(amount / quantity));
      }
      return next;
    }));
  };

  const clearDraftRow = (rowId) => {
    setDraftRows((previous) => previous.map((row) => row.tempId === rowId ? {
      ...makeBlankRow(0),
      tempId: row.tempId,
    } : row));
  };

  const addBlankRows = () => {
    setDraftRows((previous) => [
      ...previous,
      ...Array.from({ length: 4 }, (_, index) => makeBlankRow(previous.length + index)),
    ]);
  };

  const restoreLine = async (line) => {
    const editable = await ensureEditable();
    if (!editable) return;
    const currentLine = (editable.lines || []).find((candidate) => candidate.id === line.id) || line;
    const original = parseOverrideDescription(currentLine);

    if (original) {
      const quantity = Number(original.quantity || 0);
      const amount = Number(original.amount || 0);
      setLineEdits((previous) => ({
        ...previous,
        [line.id]: {
          quantity: String(quantity),
          unit_price: String(roundMoney(quantity ? amount / quantity : amount)),
          amount: String(roundMoney(amount)),
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

    setLineEdits((previous) => ({ ...previous, [line.id]: lineEditor(currentLine) }));
    setTouchedLineIds((previous) => previous.filter((id) => id !== line.id));
  };

  const activeDraftRows = useMemo(() => draftRows.filter((row) => row.concept_id), [draftRows]);

  const hasPendingChanges = useMemo(() => {
    if (!preparation) return false;
    if (touchedLineIds.length || restoreOverrideIds.length || activeDraftRows.length) return true;
    return savedOverrideLines.some((line) => {
      const edit = lineEdits[line.id];
      if (!edit) return false;
      return Number(edit.amount) !== Number(line.amount)
        || Number(edit.quantity) !== Number(line.quantity)
        || Number(edit.unit_price) !== Number(line.unit_price);
    });
  }, [preparation, touchedLineIds, restoreOverrideIds, activeDraftRows, savedOverrideLines, lineEdits]);

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
      const currentOverrides = currentLines.filter(isStoredOverride);

      const updates = currentLines
        .filter((line) => !restoreOverrideIds.includes(line.id))
        .filter((line) => {
          const edit = lineEdits[line.id];
          if (!edit) return false;
          return touchedLineIds.includes(line.id)
            || (isStoredOverride(line)
              && (Number(edit.amount) !== Number(line.amount)
                || Number(edit.quantity) !== Number(line.quantity)
                || Number(edit.unit_price) !== Number(line.unit_price)));
        })
        .map((line) => {
          const edit = lineEdits[line.id];
          const alreadyMarked = parseOverrideDescription(line);
          return updatePayrollItem(line.id, {
            quantity: Number(edit.quantity || 0),
            unit_price: Number(edit.unit_price || 0),
            amount: Number(edit.amount || 0),
            description: alreadyMarked ? line.description : serializeOverrideDescription(line),
            notes: OVERRIDE_MARKER,
          });
        });

      const restores = restoreOverrideIds.map((itemId) => {
        const line = currentOverrides.find((candidate) => candidate.id === itemId);
        if (!line) return Promise.resolve();
        const original = parseOverrideDescription(line);
        if (!original) return deletePayrollItem(itemId);
        const quantity = Number(original.quantity || 0);
        const amount = Number(original.amount || 0);
        return updatePayrollItem(itemId, {
          quantity,
          unit_price: quantity ? amount / quantity : amount,
          amount,
          description: original.description,
          notes: null,
        });
      });

      const creates = activeDraftRows.map((line, index) => {
        const quantity = Number(line.quantity || 0);
        const amount = Number(line.amount || 0);
        const unitPrice = Number(line.unit_price || 0) || (quantity ? amount / quantity : amount);
        return createPayrollItem(editable.payroll_id, {
          concept_id: Number(line.concept_id),
          description: "Concepto mensual informado en preparación",
          quantity,
          unit_price: unitPrice,
          amount,
          display_order: 700 + index,
          notes: OVERRIDE_MARKER,
        });
      });

      await Promise.all([...updates, ...restores, ...creates]);
      const refreshed = await previewPayrollPreparation(editable.payroll_id);
      hydratePreparation(refreshed);
      if (announce) setMessage("Cambios guardados. La nómina queda en borrador hasta que vuelvas a generarla.");
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

  return (
    <div className="payroll-sheet payroll-sheet--numeric-codes">
      <section className="payroll-sheet__scope">
        <div className="payroll-sheet__scope-grid">
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
          <div className="payroll-sheet__context">
            <span>{selectedCenter?.name || "Sin centro asignado"}</span>
            <span>{selectedContract.professional_category || selectedContract.job_position || "Categoría sin informar"}</span>
          </div>
        )}
      </section>

      {error && <div className="payroll-sheet__alert is-error">{error}</div>}
      {message && <div className="payroll-sheet__alert is-info">{message}</div>}

      {!ready && (
        <section className="payroll-sheet__empty">
          <strong>Selecciona empresa, trabajador y contrato.</strong>
          <span>La hoja de conceptos aparecerá debajo y podrás trabajar con códigos numéricos.</span>
        </section>
      )}

      {ready && loading && !preparation && <section className="payroll-sheet__empty">Cargando nómina del periodo...</section>}

      {preparation && (
        <section className="payroll-sheet__workspace">
          <header className="payroll-sheet__workspace-head">
            <div>
              <span>HOJA DE CONCEPTOS · {generated ? "GENERADA" : "BORRADOR"}</span>
              <h2>{preparation.employee_name}</h2>
              <p>{preparation.company_name}{preparation.center_name ? ` · ${preparation.center_name}` : ""} · {String(preparation.period_month).padStart(2, "0")}/{preparation.period_year}</p>
            </div>
            <div className={`payroll-sheet__state ${generated ? "is-generated" : "is-draft"}`}>
              {generated ? "Generada" : hasPendingChanges ? "Cambios sin guardar" : "Borrador"}
            </div>
          </header>

          <div className="payroll-sheet__rule">
            <strong>Escribe directamente el número del concepto o búscalo en el catálogo.</strong>
            <span>Cantidad × precio unitario calcula el total. También puedes escribir el precio total y AulaNomina recalculará el unitario.</span>
          </div>

          <div className="payroll-sheet__totals">
            <div><span>Bruto</span><strong>{formatMoney(preview.gross_salary)} €</strong></div>
            <div><span>Deducciones</span><strong>{formatMoney(preview.total_deductions)} €</strong></div>
            <div className="is-primary"><span>Líquido</span><strong>{formatMoney(preview.net_salary)} €</strong></div>
            <div><span>Base CC</span><strong>{formatMoney(preview.contribution_base)} €</strong></div>
            <div><span>IRPF</span><strong>{formatMoney(preview.irpf)} €</strong></div>
            <div><span>Coste empresa</span><strong>{formatMoney(preview.company_total_cost)} €</strong></div>
          </div>

          <div className="payroll-sheet__grid-head">
            <div>
              <h3>Conceptos del periodo</h3>
              <p>Los códigos son números simples. Las filas vacías sirven para introducir cualquier variación del mes sin abrir formularios separados.</p>
            </div>
            <button
              type="button"
              className="payroll-s42__secondary"
              onClick={() => setCatalogTargetRowId(draftRows.find((row) => !row.concept_id)?.tempId || draftRows[0]?.tempId)}
              disabled={reopening}
            >
              Buscar código
            </button>
          </div>

          <div className="payroll-sheet__table-scroll">
            <table className="payroll-sheet__grid">
              <thead>
                <tr>
                  <th className="col-code">Código</th>
                  <th className="col-concept">Concepto</th>
                  <th className="col-quantity">Cantidad</th>
                  <th className="col-unit">Precio unitario</th>
                  <th className="col-total">Precio total</th>
                  <th className="col-action"></th>
                </tr>
              </thead>
              <tbody>
                {existingLines.map((line) => {
                  const edit = lineEdits[line.id] || lineEditor(line);
                  const isOverride = isStoredOverride(line) && !restoreOverrideIds.includes(line.id);
                  const isTouched = touchedLineIds.includes(line.id);
                  const isRestoring = restoreOverrideIds.includes(line.id);
                  const changed = isOverride || isTouched || isRestoring;
                  return (
                    <tr key={line.id} className={changed ? "is-modified" : "is-existing"}>
                      <td className="cell-code cell-code--numeric" title={`Código técnico interno: ${line.code}`}>
                        <strong>{functionalCode(line)}</strong>
                        <small>{sourceLabel(line)}</small>
                      </td>
                      <td className="cell-concept">
                        <strong>{line.name}</strong>
                        <small>{conceptFamily(line)}</small>
                      </td>
                      <td><input type="number" min="0" step="0.01" value={edit.quantity} onChange={(event) => handleExistingCell(line, "quantity", event.target.value)} disabled={reopening} /></td>
                      <td><div className="payroll-sheet__money"><input type="number" min="0" step="0.01" value={edit.unit_price} onChange={(event) => handleExistingCell(line, "unit_price", event.target.value)} disabled={reopening} /><span>€</span></div></td>
                      <td><div className="payroll-sheet__money"><input type="number" min="0" step="0.01" value={edit.amount} onChange={(event) => handleExistingCell(line, "amount", event.target.value)} disabled={reopening} /><span>€</span></div></td>
                      <td className="cell-action">
                        {changed && !isRestoring
                          ? <button type="button" title="Restablecer valor" onClick={() => restoreLine(line)} disabled={reopening}>↺</button>
                          : <span>—</span>}
                      </td>
                    </tr>
                  );
                })}

                {draftRows.map((row) => (
                  <tr key={row.tempId} className={row.concept_id ? "is-new" : "is-blank"}>
                    <td className={`cell-code-input ${row.error ? "has-error" : ""}`}>
                      <div className="payroll-sheet__code-entry">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={row.codeInput}
                          placeholder="Nº"
                          onChange={(event) => {
                            const numericOnly = event.target.value.replace(/\D/g, "");
                            setDraftRows((previous) => previous.map((item) => item.tempId === row.tempId ? { ...item, codeInput: numericOnly, error: "" } : item));
                          }}
                          onBlur={(event) => resolveCode(row.tempId, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              resolveCode(row.tempId, event.currentTarget.value);
                            }
                          }}
                          disabled={reopening}
                          aria-label="Código numérico de concepto"
                        />
                        <button type="button" title="Buscar código" onMouseDown={(event) => event.preventDefault()} onClick={() => setCatalogTargetRowId(row.tempId)} disabled={reopening}>⌕</button>
                      </div>
                      {row.error && <small>{row.error}</small>}
                    </td>
                    <td className="cell-concept">
                      {row.concept_id ? (
                        <><strong>{row.name}</strong><small>{conceptFamily(row)} · Manual</small></>
                      ) : <span className="payroll-sheet__placeholder">Escribe el número o usa el buscador</span>}
                    </td>
                    <td><input type="number" min="0" step="0.01" value={row.quantity} onChange={(event) => handleDraftCell(row.tempId, "quantity", event.target.value)} disabled={!row.concept_id || reopening} /></td>
                    <td><div className="payroll-sheet__money"><input type="number" min="0" step="0.01" value={row.unit_price} placeholder="0,00" onChange={(event) => handleDraftCell(row.tempId, "unit_price", event.target.value)} disabled={!row.concept_id || reopening} /><span>€</span></div></td>
                    <td><div className="payroll-sheet__money"><input type="number" min="0" step="0.01" value={row.amount} placeholder="0,00" onChange={(event) => handleDraftCell(row.tempId, "amount", event.target.value)} disabled={!row.concept_id || reopening} /><span>€</span></div></td>
                    <td className="cell-action">
                      {row.concept_id ? <button type="button" title="Vaciar fila" onClick={() => clearDraftRow(row.tempId)}>×</button> : <span></span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="payroll-sheet__row-tools">
            <button type="button" onClick={addBlankRows}>+ Añadir filas</button>
            <span>{sortedConcepts.length} códigos numéricos disponibles</span>
          </div>

          <footer className="payroll-sheet__actions">
            <div>
              <strong>{generated ? "Nómina generada" : hasPendingChanges ? "Hay cambios pendientes" : "Sin cambios pendientes"}</strong>
              <span>{generated ? "El primer cambio la devolverá automáticamente a borrador." : "Guardar conserva el borrador. Visualizar recalcula sin generar definitivamente."}</span>
            </div>
            <div className="payroll-sheet__action-buttons">
              {generated && <button type="button" className="payroll-s42__secondary" onClick={openHistory}>Abrir histórico</button>}
              <button type="button" className="payroll-s42__secondary" onClick={() => persistPreparation()} disabled={saving || reopening || !hasPendingChanges}>{saving ? "Guardando..." : "Guardar cambios"}</button>
              <button type="button" className="payroll-s42__primary" onClick={handlePreview} disabled={saving || reopening}>{generated && !hasPendingChanges ? "Visualizar nómina" : "Previsualizar nómina"}</button>
            </div>
          </footer>
        </section>
      )}

      {catalogTargetRowId && (
        <CatalogModal
          concepts={sortedConcepts}
          families={families}
          includedConceptIds={includedConceptIds}
          targetRowId={catalogTargetRowId}
          onSelect={fillDraftRow}
          onClose={() => setCatalogTargetRowId(null)}
        />
      )}
      {previewOpen && <PreviewModal preparation={preparation} onClose={() => setPreviewOpen(false)} />}
      {receiptPayrollId && <PayrollReceiptModal payrollId={receiptPayrollId} onClose={() => setReceiptPayrollId(null)} />}
    </div>
  );
}
