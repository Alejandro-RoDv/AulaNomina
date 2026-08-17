import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileCheck2, RefreshCw, Send, TriangleAlert } from "lucide-react";

import {
  createAffiliationBajaDraft,
  createEmploymentTermination,
  fetchBajaCandidates,
  fetchEmploymentTerminations,
  finalizeEmploymentTermination,
  previewEmploymentTermination,
  updateEmploymentTermination,
} from "../../services/employmentTerminationApi";
import "./employmentTerminationWorkspace.css";

const ACTIVE_CASE_CONTEXT_KEY = "aulanomina:active-case-context";

const REASONS = [
  { value: "voluntary_resignation", label: "Baja voluntaria" },
  { value: "temporary_expiry", label: "Fin de contrato temporal" },
  { value: "disciplinary_dismissal", label: "Despido disciplinario" },
  { value: "objective_dismissal", label: "Despido objetivo" },
  { value: "unfair_dismissal", label: "Despido improcedente" },
  { value: "other", label: "Otra causa" },
];

const ACTION_REASON = {
  review_voluntary_termination: "voluntary_resignation",
  review_temporary_expiry: "temporary_expiry",
  review_disciplinary_dismissal: "disciplinary_dismissal",
  review_objective_indemnity: "objective_dismissal",
  review_final_settlement_breakdown: "objective_dismissal",
  review_final_settlement_closed: "objective_dismissal",
  review_integrated_c06_termination: "objective_dismissal",
  review_integrated_c06_settlement: "objective_dismissal",
  review_integrated_c06_affiliation: "objective_dismissal",
};

const EMPTY_FORM = {
  reason_code: "voluntary_resignation",
  effective_date: "",
  communication_date: "",
  document_reference: "",
  annual_salary_reference: "",
  monthly_salary_reference: "",
  pending_salary_days: "0",
  unused_vacation_days: "0",
  extra_pay_amount: "0",
  other_amount: "0",
  notes: "",
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function employeeName(employee) {
  return [employee?.first_name, employee?.last_name, employee?.second_last_name]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function readCaseContext() {
  try {
    return JSON.parse(window.localStorage.getItem(ACTIVE_CASE_CONTEXT_KEY) || "null");
  } catch {
    return null;
  }
}

function money(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function listFromResponse(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.candidates)) return value.candidates;
  return [];
}

export default function EmploymentTerminationWorkspace({ contracts = [], employees = [] }) {
  const [caseContext, setCaseContext] = useState(() => readCaseContext());
  const [contractId, setContractId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [preview, setPreview] = useState(null);
  const [record, setRecord] = useState(null);
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [String(employee.id), employee])),
    [employees]
  );

  const selectedContract = useMemo(
    () => contracts.find((contract) => String(contract.id) === String(contractId)) || null,
    [contracts, contractId]
  );
  const selectedEmployee = selectedContract
    ? employeesById.get(String(selectedContract.employee_id)) || null
    : null;

  useEffect(() => {
    const sync = (event) => setCaseContext(event?.detail || readCaseContext());
    window.addEventListener("aulanomina-case-context", sync);
    return () => window.removeEventListener("aulanomina-case-context", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchEmploymentTerminations()
      .then((data) => {
        if (!cancelled) setRecords(listFromResponse(data));
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!contracts.length) {
      setContractId("");
      return;
    }
    if (contractId && contracts.some((contract) => String(contract.id) === String(contractId))) return;

    const expectedName = normalize(caseContext?.employeeName);
    const caseEmployee = expectedName
      ? employees.find((employee) => normalize(employeeName(employee)) === expectedName)
      : null;
    const candidate = caseEmployee
      ? contracts.find((contract) => String(contract.employee_id) === String(caseEmployee.id) && contract.status !== "deleted")
      : null;
    const fallback = contracts.find((contract) => contract.status === "active") || contracts[0];
    setContractId(String((candidate || fallback)?.id || ""));
  }, [contracts, employees, caseContext, contractId]);

  useEffect(() => {
    if (!selectedContract) return;
    const existing = records.find((item) => String(item.contract_id) === String(selectedContract.id)) || null;
    setRecord(existing);
    setPreview(existing);

    const actionReason = ACTION_REASON[caseContext?.actionCode];
    setForm((current) => ({
      ...current,
      reason_code: existing?.reason_code || actionReason || current.reason_code || "voluntary_resignation",
      effective_date: existing?.effective_date || caseContext?.startDate || selectedContract.end_date || current.effective_date,
      communication_date: existing?.communication_date || current.communication_date,
      document_reference: existing?.document_reference || current.document_reference,
      annual_salary_reference: existing?.annual_salary_reference ?? selectedContract.gross_annual_salary ?? current.annual_salary_reference,
      monthly_salary_reference: existing?.monthly_salary_reference ?? selectedContract.salary_base ?? current.monthly_salary_reference,
      pending_salary_days: existing?.pending_salary_days ?? current.pending_salary_days,
      unused_vacation_days: existing?.unused_vacation_days ?? current.unused_vacation_days,
      extra_pay_amount: existing?.extra_pay_amount ?? current.extra_pay_amount,
      other_amount: existing?.other_amount ?? current.other_amount,
      notes: existing?.notes || current.notes,
    }));
  }, [selectedContract?.id, records, caseContext?.actionCode, caseContext?.startDate]);

  const payload = () => ({
    contract_id: Number(selectedContract.id),
    reason_code: form.reason_code,
    effective_date: form.effective_date,
    communication_date: form.communication_date || null,
    document_reference: form.document_reference || null,
    annual_salary_reference: nullableNumber(form.annual_salary_reference),
    monthly_salary_reference: nullableNumber(form.monthly_salary_reference),
    pending_salary_days: nullableNumber(form.pending_salary_days) || 0,
    unused_vacation_days: nullableNumber(form.unused_vacation_days) || 0,
    extra_pay_amount: nullableNumber(form.extra_pay_amount) || 0,
    other_amount: nullableNumber(form.other_amount) || 0,
    notes: form.notes || null,
    created_by: null,
  });

  const updatePayload = () => {
    const { contract_id: _contractId, created_by: _createdBy, ...rest } = payload();
    return rest;
  };

  const ensureReady = () => {
    setMessage("");
    setError("");
    if (!selectedContract) {
      setError("Selecciona un contrato antes de tramitar la extinción.");
      return false;
    }
    if (!form.effective_date) {
      setError("Indica la fecha de efectos del cese.");
      return false;
    }
    return true;
  };

  const handlePreview = async () => {
    if (!ensureReady()) return;
    try {
      setBusy("preview");
      const result = await previewEmploymentTermination(payload());
      setPreview(result);
      setMessage("Previsualización calculada con el motor de extinciones.");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido calcular la liquidación.");
    } finally {
      setBusy("");
    }
  };

  const handleRegister = async () => {
    if (!ensureReady()) return;
    try {
      setBusy("register");
      const result = record
        ? await updateEmploymentTermination(record.id, updatePayload())
        : await createEmploymentTermination(payload());
      setRecord(result);
      setPreview(result);
      setRecords((current) => [
        ...current.filter((item) => String(item.contract_id) !== String(result.contract_id)),
        result,
      ]);
      setMessage(record ? "Expediente de extinción actualizado." : "Extinción registrada y contrato finalizado.");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido registrar la extinción.");
    } finally {
      setBusy("");
    }
  };

  const handleFinalize = async () => {
    if (!record?.id) {
      setError("Registra primero la extinción.");
      return;
    }
    try {
      setBusy("finalize");
      setError("");
      const result = await finalizeEmploymentTermination(record.id);
      setRecord(result);
      setPreview(result);
      setRecords((current) => current.map((item) => item.id === result.id ? result : item));
      setMessage("Finiquito cerrado. El expediente conserva el desglose y la traza del cálculo.");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido cerrar el finiquito.");
    } finally {
      setBusy("");
    }
  };

  const handlePrepareBaja = async () => {
    if (!record?.id || !selectedContract || !form.effective_date) {
      setError("Registra primero la extinción con una fecha de efectos válida.");
      return;
    }
    try {
      setBusy("afi");
      setError("");
      const response = await fetchBajaCandidates({
        date: form.effective_date,
        employeeId: selectedContract.employee_id,
      });
      const candidates = listFromResponse(response);
      const candidate = candidates.find((item) => String(item.contract_id) === String(selectedContract.id)) || candidates[0];
      if (!candidate?.movement_key) {
        throw new Error("No existe un movimiento BAJA candidato para el contrato y la fecha seleccionados.");
      }
      await createAffiliationBajaDraft(candidate.movement_key);
      setMessage("Borrador AFI de baja preparado desde el contrato extinguido.");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido preparar la baja de afiliación.");
    } finally {
      setBusy("");
    }
  };

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setPreview(null);
    setMessage("");
    setError("");
  };

  return (
    <section className="termination-workspace" aria-label="Extinción y liquidación final">
      <div className="termination-workspace__heading">
        <div>
          <span className="termination-workspace__eyebrow">Proceso contractual</span>
          <h3>Extinción y liquidación final</h3>
          <p>Registra el cese, revisa el cálculo generado por backend y prepara la baja de afiliación desde el mismo expediente.</p>
        </div>
        {record && (
          <span className={`termination-workspace__status is-${record.status || "registered"}`}>
            {record.status === "settled" ? <CheckCircle2 size={15} aria-hidden="true" /> : <FileCheck2 size={15} aria-hidden="true" />}
            {record.status === "settled" ? "Finiquito cerrado" : "Extinción registrada"}
          </span>
        )}
      </div>

      <div className="termination-workspace__grid">
        <label className="termination-workspace__field termination-workspace__field--wide">
          <span>Contrato</span>
          <select value={contractId} onChange={(event) => setContractId(event.target.value)}>
            {contracts.map((contract) => {
              const employee = employeesById.get(String(contract.employee_id));
              return (
                <option key={contract.id} value={contract.id}>
                  {employeeName(employee) || `Trabajador ${contract.employee_id}`} · {contract.contract_type || contract.contract_code || "Contrato"} · {contract.start_date || "sin fecha"}
                </option>
              );
            })}
          </select>
        </label>

        <label className="termination-workspace__field">
          <span>Causa</span>
          <select value={form.reason_code} onChange={(event) => setField("reason_code", event.target.value)}>
            {REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
          </select>
        </label>

        <label className="termination-workspace__field">
          <span>Fecha de efectos</span>
          <input type="date" value={form.effective_date} onChange={(event) => setField("effective_date", event.target.value)} />
        </label>

        <label className="termination-workspace__field">
          <span>Fecha de comunicación</span>
          <input type="date" value={form.communication_date || ""} onChange={(event) => setField("communication_date", event.target.value)} />
        </label>

        <label className="termination-workspace__field">
          <span>Referencia documental</span>
          <input value={form.document_reference || ""} onChange={(event) => setField("document_reference", event.target.value)} placeholder="Carta, comunicación o referencia" />
        </label>

        <label className="termination-workspace__field">
          <span>Salario anual de referencia</span>
          <input type="number" min="0" step="0.01" value={form.annual_salary_reference ?? ""} onChange={(event) => setField("annual_salary_reference", event.target.value)} />
        </label>

        <label className="termination-workspace__field">
          <span>Salario mensual de referencia</span>
          <input type="number" min="0" step="0.01" value={form.monthly_salary_reference ?? ""} onChange={(event) => setField("monthly_salary_reference", event.target.value)} />
        </label>

        <label className="termination-workspace__field">
          <span>Días de salario pendientes</span>
          <input type="number" min="0" step="0.01" value={form.pending_salary_days} onChange={(event) => setField("pending_salary_days", event.target.value)} />
        </label>

        <label className="termination-workspace__field">
          <span>Días de vacaciones pendientes</span>
          <input type="number" min="0" step="0.01" value={form.unused_vacation_days} onChange={(event) => setField("unused_vacation_days", event.target.value)} />
        </label>

        <label className="termination-workspace__field">
          <span>Pagas devengadas pendientes</span>
          <input type="number" min="0" step="0.01" value={form.extra_pay_amount} onChange={(event) => setField("extra_pay_amount", event.target.value)} />
        </label>

        <label className="termination-workspace__field">
          <span>Otros conceptos</span>
          <input type="number" step="0.01" value={form.other_amount} onChange={(event) => setField("other_amount", event.target.value)} />
        </label>
      </div>

      <label className="termination-workspace__field termination-workspace__notes">
        <span>Observaciones</span>
        <textarea rows="2" value={form.notes || ""} onChange={(event) => setField("notes", event.target.value)} placeholder="Anotaciones del expediente" />
      </label>

      {preview && (
        <div className="termination-workspace__result">
          <div><span>Código RED</span><strong>{preview.ss_situation_code || "—"}</strong></div>
          <div><span>Antigüedad computada</span><strong>{preview.service_months ?? 0} meses</strong></div>
          <div><span>Días indemnizatorios</span><strong>{preview.indemnity_days ?? 0}</strong></div>
          <div><span>Indemnización</span><strong>{money(preview.indemnity_amount)}</strong></div>
          <div><span>Salario pendiente</span><strong>{money(preview.pending_salary_amount)}</strong></div>
          <div><span>Vacaciones</span><strong>{money(preview.vacation_amount)}</strong></div>
          <div><span>Pagas / otros</span><strong>{money(Number(preview.extra_pay_amount || 0) + Number(preview.other_amount || 0))}</strong></div>
          <div className="termination-workspace__total"><span>Total liquidación</span><strong>{money(preview.total_settlement)}</strong></div>
        </div>
      )}

      {preview?.warnings?.length > 0 && (
        <div className="termination-workspace__warning">
          <TriangleAlert size={16} aria-hidden="true" />
          <div>{preview.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>
        </div>
      )}

      {error && <div className="termination-workspace__notice is-error" role="alert">{error}</div>}
      {message && <div className="termination-workspace__notice is-success">{message}</div>}

      <div className="termination-workspace__actions">
        <button type="button" className="button secondary" onClick={handlePreview} disabled={Boolean(busy)}>
          <RefreshCw size={15} className={busy === "preview" ? "is-spinning" : ""} aria-hidden="true" />
          Previsualizar liquidación
        </button>
        <button type="button" className="button primary" onClick={handleRegister} disabled={Boolean(busy)}>
          <FileCheck2 size={15} aria-hidden="true" />
          {record ? "Actualizar expediente" : "Registrar extinción"}
        </button>
        <button type="button" className="button secondary" onClick={handleFinalize} disabled={Boolean(busy) || !record || record.status === "settled"}>
          <CheckCircle2 size={15} aria-hidden="true" />
          Cerrar finiquito
        </button>
        <button type="button" className="button secondary" onClick={handlePrepareBaja} disabled={Boolean(busy) || !record}>
          <Send size={15} aria-hidden="true" />
          Preparar baja AFI
        </button>
      </div>

      {selectedEmployee && (
        <small className="termination-workspace__footnote">
          Expediente seleccionado: {employeeName(selectedEmployee)} · contrato #{selectedContract?.id}. Los importes mostrados proceden del cálculo persistido por backend.
        </small>
      )}
    </section>
  );
}
