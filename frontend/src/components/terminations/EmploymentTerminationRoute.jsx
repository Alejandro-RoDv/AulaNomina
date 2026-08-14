import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  createAffiliationBajaDraft,
  createEmploymentTermination,
  fetchBajaCandidates,
  fetchEmploymentTerminations,
  fetchTerminationContracts,
  fetchTerminationEmployees,
  finalizeEmploymentTermination,
  previewEmploymentTermination,
  updateEmploymentTermination,
} from "../../services/employmentTerminationApi";
import "./employmentTermination.css";

const TRAINING_CODES = new Set(["A46", "A47", "A48", "A49", "A50"]);

const REASONS = [
  ["voluntary_resignation", "Baja voluntaria / dimisión"],
  ["temporary_expiry", "Fin de contrato temporal"],
  ["disciplinary_dismissal", "Despido disciplinario"],
  ["objective_dismissal", "Extinción por causas objetivas"],
  ["unfair_dismissal", "Despido improcedente"],
  ["other", "Otra causa"],
];

const CODE_DEFAULTS = {
  A46: { reason_code: "voluntary_resignation" },
  A47: { reason_code: "temporary_expiry" },
  A48: { reason_code: "disciplinary_dismissal" },
  A49: { reason_code: "objective_dismissal" },
  A50: { reason_code: "objective_dismissal" },
};

const EMPTY_FORM = {
  contract_id: "",
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
    .trim();
}

function money(value) {
  return `${Number(value || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function readStoredContext() {
  try {
    return JSON.parse(window.localStorage.getItem("aulanomina:active-case-context") || "null");
  } catch {
    return null;
  }
}

function contextTrainingCode(context) {
  const code = String(context?.trainingCode || "").toUpperCase();
  return TRAINING_CODES.has(code) ? code : null;
}

export default function EmploymentTerminationRoute() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [terminations, setTerminations] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [preview, setPreview] = useState(null);
  const [record, setRecord] = useState(null);
  const [afiDraft, setAfiDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    const [nextContracts, nextEmployees, nextTerminations] = await Promise.all([
      fetchTerminationContracts(),
      fetchTerminationEmployees(),
      fetchEmploymentTerminations(),
    ]);
    setContracts(nextContracts || []);
    setEmployees(nextEmployees || []);
    setTerminations(nextTerminations || []);
    return { contracts: nextContracts || [], employees: nextEmployees || [], terminations: nextTerminations || [] };
  }, []);

  const applyContext = useCallback(async (nextContext) => {
    const trainingCode = contextTrainingCode(nextContext);
    if (!trainingCode) return;
    setContext(nextContext);
    setOpen(true);
    setError("");
    setSuccess("");
    setPreview(null);
    setAfiDraft(null);
    try {
      setLoading(true);
      const data = await loadData();
      const expectedEmployee = normalize(nextContext.employeeName);
      const employee = data.employees.find((item) => (
        expectedEmployee
        && normalize(`${item.first_name || ""} ${item.last_name || ""} ${item.second_last_name || ""}`) === expectedEmployee
      ));
      const employeeContracts = data.contracts
        .filter((item) => !employee || String(item.employee_id) === String(employee.id))
        .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")));
      const contract = employeeContracts.find((item) => item.status === "active") || employeeContracts[0];
      const existing = contract
        ? data.terminations.find((item) => String(item.contract_id) === String(contract.id))
        : null;
      const defaults = CODE_DEFAULTS[trainingCode] || {};
      setRecord(existing || null);
      setForm({
        ...EMPTY_FORM,
        ...defaults,
        contract_id: contract?.id ? String(contract.id) : "",
        effective_date: existing?.effective_date || nextContext.startDate || "",
        communication_date: existing?.communication_date || nextContext.startDate || "",
        document_reference: existing?.document_reference || "",
        annual_salary_reference: existing?.annual_salary_reference ?? contract?.gross_annual_salary ?? "",
        monthly_salary_reference: existing?.monthly_salary_reference ?? contract?.salary_base ?? "",
        pending_salary_days: existing?.pending_salary_days ?? "0",
        unused_vacation_days: existing?.unused_vacation_days ?? "0",
        extra_pay_amount: existing?.extra_pay_amount ?? "0",
        other_amount: existing?.other_amount ?? "0",
        notes: existing?.notes || "",
        reason_code: existing?.reason_code || defaults.reason_code || EMPTY_FORM.reason_code,
      });
    } catch (requestError) {
      setError(requestError.message || "No se ha podido abrir el expediente de extinción.");
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  useEffect(() => {
    const stored = readStoredContext();
    if (contextTrainingCode(stored)) applyContext(stored);
    const handleCaseContext = (event) => applyContext(event.detail);
    const handleOpen = (event) => {
      const detail = event.detail || readStoredContext() || {};
      applyContext({ ...detail, trainingCode: detail.trainingCode || "A46" });
    };
    window.addEventListener("aulanomina-case-context", handleCaseContext);
    window.addEventListener("aulanomina-open-employment-terminations", handleOpen);
    return () => {
      window.removeEventListener("aulanomina-case-context", handleCaseContext);
      window.removeEventListener("aulanomina-open-employment-terminations", handleOpen);
    };
  }, [applyContext]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
    };
  }, [open]);

  const trainingCode = contextTrainingCode(context);

  const payload = useCallback(() => ({
    contract_id: Number(form.contract_id),
    reason_code: form.reason_code,
    effective_date: form.effective_date,
    communication_date: form.communication_date || null,
    document_reference: form.document_reference || null,
    annual_salary_reference: form.annual_salary_reference === "" ? null : Number(form.annual_salary_reference),
    monthly_salary_reference: form.monthly_salary_reference === "" ? null : Number(form.monthly_salary_reference),
    pending_salary_days: Number(form.pending_salary_days || 0),
    unused_vacation_days: Number(form.unused_vacation_days || 0),
    extra_pay_amount: Number(form.extra_pay_amount || 0),
    other_amount: Number(form.other_amount || 0),
    notes: form.notes || null,
    created_by: "alumno-demo",
  }), [form]);

  const runPreview = async () => {
    if (!form.contract_id || !form.effective_date) return;
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setPreview(await previewEmploymentTermination(payload()));
    } catch (requestError) {
      setError(requestError.message || "No se ha podido calcular la liquidación.");
    } finally {
      setLoading(false);
    }
  };

  const saveTermination = async () => {
    if (!form.contract_id || !form.effective_date) return;
    try {
      setLoading(true);
      setError("");
      const saved = record
        ? await updateEmploymentTermination(record.id, payload())
        : await createEmploymentTermination(payload());
      setRecord(saved);
      setPreview(saved);
      setSuccess("Extinción registrada. El contrato queda finalizado con la causa y fecha indicadas.");
      await loadData();
      window.dispatchEvent(new Event("aulanomina-activities-refresh"));
    } catch (requestError) {
      setError(requestError.message || "No se ha podido registrar la extinción.");
    } finally {
      setLoading(false);
    }
  };

  const prepareBaja = async () => {
    if (!record) return;
    try {
      setLoading(true);
      setError("");
      const candidates = await fetchBajaCandidates({ date: record.effective_date, employeeId: record.employee_id });
      const candidate = (candidates?.items || []).find((item) => (
        item.movement_type === "BAJA" && String(item.contract_id) === String(record.contract_id)
      ));
      if (!candidate) throw new Error("No existe una baja de afiliación coherente con el contrato finalizado.");
      const draft = await createAffiliationBajaDraft(candidate.movement_key);
      setAfiDraft(draft);
      setSuccess(`Baja AFI preparada en el borrador ${draft.id}.`);
      window.dispatchEvent(new Event("aulanomina-activities-refresh"));
    } catch (requestError) {
      setError(requestError.message || "No se ha podido preparar la baja AFI.");
    } finally {
      setLoading(false);
    }
  };

  const finalize = async () => {
    if (!record) return;
    try {
      setLoading(true);
      setError("");
      const finalized = await finalizeEmploymentTermination(record.id);
      setRecord(finalized);
      setPreview(finalized);
      setSuccess("Finiquito cerrado. El desglose y la traza quedan conservados en el expediente.");
      await loadData();
      window.dispatchEvent(new Event("aulanomina-activities-refresh"));
    } catch (requestError) {
      setError(requestError.message || "No se ha podido cerrar el finiquito.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="termination-route__backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section className="termination-route" role="dialog" aria-modal="true" aria-labelledby="termination-route-title">
        <header className="termination-route__header">
          <div>
            <span className="termination-route__eyebrow">Gestión laboral · Extinciones</span>
            <h2 id="termination-route-title">Extinción y liquidación final</h2>
            <p>Registra la causa, calcula sus efectos económicos y coordina la baja de afiliación.</p>
          </div>
          <button type="button" className="termination-route__close" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
        </header>

        <div className="termination-route__body">
          {trainingCode && (
            <div className="termination-route__case">
              <strong>{trainingCode} · Práctica del Temario Maestro</strong>
              <span>{context?.employeeName || "Trabajador del caso"} · {context?.scenarioCode || "Caso formativo"}</span>
            </div>
          )}

          {error && <div className="termination-route__notice termination-route__notice--error">{error}</div>}
          {success && <div className="termination-route__notice termination-route__notice--success">{success}</div>}

          <section className="termination-route__section">
            <h3>1. Datos de la extinción</h3>
            <div className="termination-route__grid">
              <div className="termination-route__field termination-route__field--wide">
                <label>Contrato</label>
                <select value={form.contract_id} onChange={(event) => setForm((prev) => ({ ...prev, contract_id: event.target.value }))}>
                  <option value="">Selecciona contrato</option>
                  {contracts.map((contract) => {
                    const employee = employees.find((item) => item.id === contract.employee_id);
                    return <option key={contract.id} value={contract.id}>{employee ? `${employee.first_name} ${employee.last_name}` : `Trabajador ${contract.employee_id}`} · {contract.contract_code || contract.contract_type} · {contract.start_date}</option>;
                  })}
                </select>
              </div>
              <div className="termination-route__field">
                <label>Causa</label>
                <select value={form.reason_code} onChange={(event) => setForm((prev) => ({ ...prev, reason_code: event.target.value }))}>
                  {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="termination-route__field">
                <label>Fecha de efectos</label>
                <input type="date" value={form.effective_date} onChange={(event) => setForm((prev) => ({ ...prev, effective_date: event.target.value }))} />
              </div>
              <div className="termination-route__field">
                <label>Fecha comunicación</label>
                <input type="date" value={form.communication_date} onChange={(event) => setForm((prev) => ({ ...prev, communication_date: event.target.value }))} />
              </div>
              <div className="termination-route__field termination-route__field--wide">
                <label>Referencia documental</label>
                <input value={form.document_reference} onChange={(event) => setForm((prev) => ({ ...prev, document_reference: event.target.value }))} placeholder="Carta, comunicación o referencia del expediente" />
              </div>
              <div className="termination-route__field">
                <label>Situación</label>
                <input readOnly value={record ? `Código RED ${record.ss_situation_code}` : "Pendiente de cálculo"} />
              </div>
            </div>
            <div className="termination-route__actions">
              <button type="button" className="termination-route__button" onClick={runPreview} disabled={loading || !form.contract_id || !form.effective_date}>Previsualizar</button>
              <button type="button" className="termination-route__button termination-route__button--primary" onClick={saveTermination} disabled={loading || !form.contract_id || !form.effective_date}>{record ? "Actualizar expediente" : "Registrar extinción"}</button>
            </div>
          </section>

          <section className="termination-route__section">
            <h3>2. Indemnización y liquidación</h3>
            <div className="termination-route__grid">
              <div className="termination-route__field">
                <label>Salario anual de referencia</label>
                <input type="number" step="0.01" value={form.annual_salary_reference} onChange={(event) => setForm((prev) => ({ ...prev, annual_salary_reference: event.target.value }))} />
              </div>
              <div className="termination-route__field">
                <label>Salario mensual de referencia</label>
                <input type="number" step="0.01" value={form.monthly_salary_reference} onChange={(event) => setForm((prev) => ({ ...prev, monthly_salary_reference: event.target.value }))} />
              </div>
              <div className="termination-route__field">
                <label>Días salario pendiente</label>
                <input type="number" step="0.01" value={form.pending_salary_days} onChange={(event) => setForm((prev) => ({ ...prev, pending_salary_days: event.target.value }))} />
              </div>
              <div className="termination-route__field">
                <label>Días vacaciones pendientes</label>
                <input type="number" step="0.01" value={form.unused_vacation_days} onChange={(event) => setForm((prev) => ({ ...prev, unused_vacation_days: event.target.value }))} />
              </div>
              <div className="termination-route__field">
                <label>Pagas extra devengadas</label>
                <input type="number" step="0.01" value={form.extra_pay_amount} onChange={(event) => setForm((prev) => ({ ...prev, extra_pay_amount: event.target.value }))} />
              </div>
              <div className="termination-route__field">
                <label>Otros conceptos</label>
                <input type="number" step="0.01" value={form.other_amount} onChange={(event) => setForm((prev) => ({ ...prev, other_amount: event.target.value }))} />
              </div>
            </div>

            {preview && (
              <>
                <div className="termination-route__summary">
                  <div className="termination-route__metric"><span>Servicio</span><strong>{preview.service_months} meses</strong></div>
                  <div className="termination-route__metric"><span>Días indemnización</span><strong>{Number(preview.indemnity_days || 0).toLocaleString("es-ES")}</strong></div>
                  <div className="termination-route__metric"><span>Indemnización</span><strong>{money(preview.indemnity_amount)}</strong></div>
                  <div className="termination-route__metric"><span>Total finiquito</span><strong>{money(preview.total_settlement)}</strong></div>
                </div>
                <ul className="termination-route__breakdown">
                  <li><span>Salario pendiente</span><strong>{money(preview.pending_salary_amount)}</strong></li>
                  <li><span>Vacaciones no disfrutadas</span><strong>{money(preview.vacation_amount)}</strong></li>
                  <li><span>Pagas extraordinarias</span><strong>{money(preview.extra_pay_amount)}</strong></li>
                  <li><span>Indemnización</span><strong>{money(preview.indemnity_amount)}</strong></li>
                  <li><span>Otros</span><strong>{money(preview.other_amount)}</strong></li>
                </ul>
                {(preview.warnings || []).length > 0 && <ul className="termination-route__warnings">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
              </>
            )}
          </section>

          <section className="termination-route__section">
            <h3>3. Cierre administrativo</h3>
            {record && <span className={`termination-route__status${record.status === "settled" ? " is-settled" : ""}`}>{record.status === "settled" ? "Finiquito cerrado" : "Extinción registrada"}</span>}
            <div className="termination-route__actions">
              <button type="button" className="termination-route__button" onClick={prepareBaja} disabled={loading || !record}>Preparar baja AFI</button>
              <button type="button" className="termination-route__button termination-route__button--primary" onClick={finalize} disabled={loading || !record || record.status === "settled"}>Cerrar finiquito</button>
            </div>
            {afiDraft && <p>Remesa AFI en borrador: <strong>#{afiDraft.id}</strong> · {afiDraft.status}</p>}
          </section>
        </div>
      </section>
    </div>,
    document.body
  );
}
