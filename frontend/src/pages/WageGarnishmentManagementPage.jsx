import { useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import WageGarnishmentContextSelector from "../components/wage-garnishments/WageGarnishmentContextSelector";
import WageGarnishmentHistory from "../components/wage-garnishments/WageGarnishmentHistory";
import WageGarnishmentRecordForm from "../components/wage-garnishments/WageGarnishmentRecordForm";
import {
  createWageGarnishment,
  deleteWageGarnishment,
  fetchWageGarnishments,
  updateWageGarnishment,
} from "../services/wageGarnishmentApi";
import { formatEuro } from "../utils/embargoCalculator";
import EmbargoCalculatorPage from "./EmbargoCalculatorPage";

const EMPTY_FORM = {
  contract_id: "",
  reference: "",
  issuing_body: "",
  creditor: "",
  status: "active",
  notification_date: "",
  start_date: "",
  end_date: "",
  total_debt: "",
  withheld_to_date: "0,00",
  notes: "",
};

const EMPTY_CALCULATION = {
  smiAnual: "17.094,00",
  liquido: "",
  porcentajeReduccion: "0",
  pagasExtrasProrrateadas: false,
  incluyePagaExtraCompleta: false,
  importePagaExtra: "",
  cargasFamiliares: false,
  reduccionCargas: "0",
};

const STATUS_LABELS = {
  active: "Activo",
  suspended: "Suspendido",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

function amountToInput(value) {
  if (value === null || value === undefined || value === "") return "";
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function amountToNumber(value) {
  if (typeof value === "number") return value;
  const normalized = String(value || "").trim().replace(/\./g, "").replace(",", ".");
  return normalized ? Number(normalized) : 0;
}

function recordToCalculationForm(record) {
  return {
    smiAnual: amountToInput(record.smi_annual),
    liquido: amountToInput(record.monthly_net),
    porcentajeReduccion: String(Number(record.reduction_percentage || 0)),
    pagasExtrasProrrateadas: Boolean(record.extra_pay_prorated),
    incluyePagaExtraCompleta: Boolean(record.includes_full_extra_pay),
    importePagaExtra: record.includes_full_extra_pay ? amountToInput(record.extra_pay_amount) : "",
    cargasFamiliares: Boolean(record.family_burdens),
    reduccionCargas: String(Number(record.reduction_percentage || 0)),
  };
}

function recordToForm(record) {
  return {
    contract_id: record.contract_id ? String(record.contract_id) : "",
    reference: record.reference || "",
    issuing_body: record.issuing_body || "",
    creditor: record.creditor || "",
    status: record.status || "active",
    notification_date: record.notification_date || "",
    start_date: record.start_date || "",
    end_date: record.end_date || "",
    total_debt: amountToInput(record.total_debt),
    withheld_to_date: amountToInput(record.withheld_to_date || 0),
    notes: record.notes || "",
  };
}

export default function WageGarnishmentManagementPage({ companies = [], employees = [], contracts = [] }) {
  const [records, setRecords] = useState([]);
  const [context, setContext] = useState({ companyId: "", employeeId: "" });
  const [activeTab, setActiveTab] = useState("new");
  const [workflowStep, setWorkflowStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [calculationInitialForm, setCalculationInitialForm] = useState(EMPTY_CALCULATION);
  const [calculationInitialResult, setCalculationInitialResult] = useState(null);
  const [calculationState, setCalculationState] = useState(null);
  const [calculatorKey, setCalculatorKey] = useState(0);
  const [mode, setMode] = useState("new");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const contextReady = Boolean(context.companyId && context.employeeId);
  const readOnly = mode === "view";
  const contextLocked = activeTab === "new" && Boolean(selectedId);

  const recordsForContext = useMemo(
    () => records.filter((record) => (
      String(record.company_id) === String(context.companyId)
      && String(record.employee_id) === String(context.employeeId)
    )),
    [records, context.companyId, context.employeeId]
  );

  const activeCount = useMemo(
    () => recordsForContext.filter((record) => record.status === "active").length,
    [recordsForContext]
  );

  const contractsForContext = useMemo(
    () => contracts.filter((contract) => (
      String(contract.company_id) === String(context.companyId)
      && String(contract.employee_id) === String(context.employeeId)
    )),
    [contracts, context.companyId, context.employeeId]
  );

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await fetchWageGarnishments();
      setRecords(data);
      return data;
    } catch (loadError) {
      setError(loadError.message || "No se han podido cargar los embargos");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchWageGarnishments()
      .then((data) => {
        if (active) setRecords(data);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "No se han podido cargar los embargos");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const clearDraft = (contractId = "") => {
    setForm({ ...EMPTY_FORM, contract_id: contractId });
    setCalculationInitialForm(EMPTY_CALCULATION);
    setCalculationInitialResult(null);
    setCalculationState(null);
    setSelectedId(null);
    setMode("new");
    setWorkflowStep(1);
    setError("");
    setCalculatorKey((value) => value + 1);
  };

  const defaultContractId = () => {
    const activeContract = contractsForContext.find((contract) => contract.status === "active") || contractsForContext[0];
    return activeContract ? String(activeContract.id) : "";
  };

  const handleCompanyChange = (companyId) => {
    setContext({ companyId, employeeId: "" });
    setActiveTab("new");
    setMessage("");
    clearDraft();
  };

  const handleEmployeeChange = (employeeId) => {
    const employeeContracts = contracts.filter((contract) => (
      String(contract.company_id) === String(context.companyId)
      && String(contract.employee_id) === String(employeeId)
    ));
    const activeContract = employeeContracts.find((contract) => contract.status === "active") || employeeContracts[0];
    setContext((previous) => ({ ...previous, employeeId }));
    clearDraft(activeContract ? String(activeContract.id) : "");
    setActiveTab("new");
    setMessage("");
  };

  const releaseContext = () => {
    setContext({ companyId: "", employeeId: "" });
    setActiveTab("new");
    setMessage("");
    clearDraft();
  };

  const startNew = () => {
    clearDraft(defaultContractId());
    setActiveTab("new");
    setMessage("");
  };

  const setField = (name, value) => {
    if (readOnly) return;
    setMessage("");
    setError("");
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const openRecord = (record, nextMode) => {
    setContext({ companyId: String(record.company_id), employeeId: String(record.employee_id) });
    setForm(recordToForm(record));
    const calculationForm = recordToCalculationForm(record);
    setCalculationInitialForm(calculationForm);
    setCalculationInitialResult(record.calculation_snapshot || null);
    setCalculationState({ form: calculationForm, result: record.calculation_snapshot || null });
    setSelectedId(record.id);
    setMode(nextMode);
    setWorkflowStep(1);
    setActiveTab("new");
    setMessage("");
    setError("");
    setCalculatorKey((value) => value + 1);
  };

  const goToCalculation = () => {
    if (!form.reference.trim() || !form.issuing_body.trim() || !form.start_date) {
      setError("Completa la referencia, el órgano emisor y la fecha de inicio antes de continuar.");
      return;
    }
    setError("");
    setWorkflowStep(2);
  };

  const buildPayload = () => {
    if (!contextReady) throw new Error("Selecciona una empresa y un trabajador.");
    if (!form.reference.trim() || !form.issuing_body.trim() || !form.start_date) {
      throw new Error("Referencia, órgano emisor y fecha de inicio son obligatorios.");
    }
    if (!calculationState?.result) throw new Error("Realiza el cálculo antes de grabar el embargo.");

    const calculationForm = calculationState.form;
    const calculation = calculationState.result;
    const reduction = calculationForm.cargasFamiliares
      ? Number(calculationForm.reduccionCargas)
      : Number(calculationForm.porcentajeReduccion || 0);

    return {
      company_id: Number(context.companyId),
      employee_id: Number(context.employeeId),
      contract_id: form.contract_id ? Number(form.contract_id) : null,
      reference: form.reference.trim(),
      issuing_body: form.issuing_body.trim(),
      creditor: form.creditor.trim() || null,
      status: form.status,
      notification_date: form.notification_date || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      total_debt: form.total_debt ? amountToNumber(form.total_debt) : null,
      withheld_to_date: amountToNumber(form.withheld_to_date),
      monthly_net: amountToNumber(calculationForm.liquido),
      smi_annual: amountToNumber(calculationForm.smiAnual),
      reduction_percentage: reduction,
      extra_pay_prorated: calculationForm.pagasExtrasProrrateadas,
      includes_full_extra_pay: calculationForm.incluyePagaExtraCompleta,
      extra_pay_amount: calculationForm.incluyePagaExtraCompleta ? amountToNumber(calculationForm.importePagaExtra) : 0,
      family_burdens: calculationForm.cargasFamiliares,
      monthly_garnishable: calculation.totalEmbargable,
      calculation_snapshot: calculation,
      notes: form.notes.trim() || null,
    };
  };

  const saveRecord = async () => {
    setMessage("");
    setError("");
    try {
      const payload = buildPayload();
      setSubmitting(true);
      const wasEditing = Boolean(selectedId);
      if (selectedId) await updateWageGarnishment(selectedId, payload);
      else await createWageGarnishment(payload);
      await loadRecords();
      clearDraft(defaultContractId());
      setActiveTab("history");
      setMessage(wasEditing ? "Embargo actualizado correctamente." : "Embargo grabado correctamente.");
    } catch (saveError) {
      setError(saveError.message || "No se ha podido guardar el embargo");
    } finally {
      setSubmitting(false);
    }
  };

  const removeRecord = async (record) => {
    if (!window.confirm(`¿Eliminar el embargo ${record.reference}?`)) return;
    setMessage("");
    setError("");
    try {
      setSubmitting(true);
      await deleteWageGarnishment(record.id);
      await loadRecords();
      setMessage("Embargo eliminado correctamente.");
    } catch (deleteError) {
      setError(deleteError.message || "No se ha podido eliminar el embargo");
    } finally {
      setSubmitting(false);
    }
  };

  const remainingDebt = form.total_debt
    ? Math.max(0, amountToNumber(form.total_debt) - amountToNumber(form.withheld_to_date))
    : null;

  return (
    <div style={styles.wrapper}>
      <PageCard title="Embargos judiciales" subtitle="Gestiona cada expediente desde el trabajador, con cálculo y seguimiento económico.">
        <WageGarnishmentContextSelector
          companies={companies}
          employees={employees}
          companyId={context.companyId}
          employeeId={context.employeeId}
          onCompanyChange={handleCompanyChange}
          onEmployeeChange={handleEmployeeChange}
          disabled={contextLocked}
          activeCount={activeCount}
          onReleaseContext={releaseContext}
        />

        <div style={styles.operationGrid}>
          <button type="button" disabled={!contextReady} onClick={startNew} style={{ ...styles.operationCard, ...(activeTab === "new" ? styles.operationCardActive : {}), ...(!contextReady ? styles.operationCardDisabled : {}) }}>
            <span style={styles.operationIcon}>＋</span>
            <span style={styles.operationText}>
              <strong>Nuevo embargo</strong>
              <small>Registrar orden, calcular retención y grabar.</small>
            </span>
          </button>
          <button type="button" disabled={!contextReady} onClick={() => setActiveTab("history")} style={{ ...styles.operationCard, ...(activeTab === "history" ? styles.operationCardActive : {}), ...(!contextReady ? styles.operationCardDisabled : {}) }}>
            <span style={styles.operationIcon}>↺</span>
            <span style={styles.operationText}>
              <strong>Historial del trabajador</strong>
              <small>Consultar y mantener expedientes registrados.</small>
            </span>
            {contextReady && <span style={styles.operationCount}>{recordsForContext.length}</span>}
          </button>
        </div>
      </PageCard>

      {!contextReady && (
        <section style={styles.emptyState}>
          <div style={styles.emptyHeader}>
            <span style={styles.emptyIcon}>1</span>
            <div>
              <strong>Selecciona empresa y trabajador</strong>
              <p>Después podrás crear un embargo o consultar el historial del trabajador.</p>
            </div>
          </div>
          <div style={styles.emptySteps}>
            <div><span>1</span><strong>Seleccionar contexto</strong></div>
            <div><span>2</span><strong>Completar expediente</strong></div>
            <div><span>3</span><strong>Calcular y grabar</strong></div>
          </div>
        </section>
      )}

      {contextReady && activeTab === "history" && (
        <PageCard title="Historial de embargos" subtitle="Expedientes asociados al trabajador seleccionado.">
          {message && <div style={styles.success}>{message}</div>}
          {error && <div style={styles.error}>{error}</div>}
          <WageGarnishmentHistory records={recordsForContext} loading={loading} onView={(record) => openRecord(record, "view")} onEdit={(record) => openRecord(record, "edit")} onDelete={removeRecord} />
        </PageCard>
      )}

      {contextReady && activeTab === "new" && (
        <>
          <PageCard title={mode === "new" ? "Nuevo embargo" : mode === "edit" ? "Editar embargo" : "Consulta de embargo"} subtitle={mode === "view" ? "Expediente en modo consulta." : "Completa el expediente y calcula la retención antes de grabar."}>
            <div style={styles.workflowHeader}>
              <div style={{ ...styles.workflowStep, ...(workflowStep === 1 ? styles.workflowStepActive : {}) }}>
                <span>1</span>
                <div><strong>Expediente</strong><small>Orden, fechas y deuda</small></div>
              </div>
              <div style={styles.workflowConnector} />
              <div style={{ ...styles.workflowStep, ...(workflowStep === 2 ? styles.workflowStepActive : {}) }}>
                <span>2</span>
                <div><strong>Cálculo</strong><small>Tramos y grabación</small></div>
              </div>
              <span style={styles.modeBadge}>{mode === "new" ? "Alta" : mode === "edit" ? "Edición" : "Consulta"}</span>
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {message && <div style={styles.success}>{message}</div>}

            {workflowStep === 1 && (
              <>
                <WageGarnishmentRecordForm form={form} contracts={contractsForContext} readOnly={readOnly} onChange={setField} />
                <div style={styles.footerActions}>
                  <button type="button" onClick={() => setActiveTab("history")} style={styles.secondaryButton}>Volver al historial</button>
                  {readOnly && <button type="button" onClick={() => setMode("edit")} style={styles.secondaryButton}>Editar expediente</button>}
                  <button type="button" onClick={goToCalculation} style={styles.primaryButton}>{readOnly ? "Ver cálculo" : "Continuar al cálculo"}</button>
                </div>
              </>
            )}
          </PageCard>

          {workflowStep === 2 && (
            <>
              <EmbargoCalculatorPage key={calculatorKey} initialForm={calculationInitialForm} initialResult={calculationInitialResult} readOnly={readOnly} onDirty={() => setCalculationState(null)} onCalculated={(state) => setCalculationState(state)} />

              <section style={styles.savePanel}>
                <div style={styles.saveHeader}>
                  <div>
                    <h3>Resumen antes de grabar</h3>
                    <p>Comprueba los datos principales del embargo.</p>
                  </div>
                  <span style={styles.readyBadge}>{calculationState?.result ? "Cálculo preparado" : "Cálculo pendiente"}</span>
                </div>
                <div style={styles.summaryGrid}>
                  <div style={styles.summaryItem}><span>Líquido calculado</span><strong>{calculationState?.result ? formatEuro(calculationState.result.liquidoFinalCalculado) : "Pendiente"}</strong></div>
                  <div style={styles.summaryItemAccent}><span>Embargo mensual</span><strong>{calculationState?.result ? formatEuro(calculationState.result.totalEmbargable) : "Pendiente"}</strong></div>
                  <div style={styles.summaryItem}><span>Deuda pendiente</span><strong>{remainingDebt === null ? "Sin informar" : formatEuro(remainingDebt)}</strong></div>
                  <div style={styles.summaryItem}><span>Estado</span><strong>{STATUS_LABELS[form.status] || form.status}</strong></div>
                </div>

                <div style={styles.footerActions}>
                  <button type="button" onClick={() => setWorkflowStep(1)} style={styles.secondaryButton}>Volver al expediente</button>
                  {!readOnly && (
                    <button type="button" disabled={submitting || !calculationState?.result} onClick={saveRecord} style={{ ...styles.primaryButton, ...((submitting || !calculationState?.result) ? styles.disabledButton : {}) }}>
                      {submitting ? "Guardando…" : selectedId ? "Guardar cambios" : "Grabar embargo"}
                    </button>
                  )}
                  {readOnly && <button type="button" onClick={() => setMode("edit")} style={styles.primaryButton}>Editar expediente</button>}
                  <button type="button" onClick={() => setActiveTab("history")} style={styles.secondaryButton}>Volver al historial</button>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  operationGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px", marginTop: "16px" },
  operationCard: { display: "grid", gridTemplateColumns: "44px 1fr auto", gap: "12px", alignItems: "center", border: "1px solid #d4d4d8", borderRadius: "11px", backgroundColor: "#ffffff", color: "#111827", padding: "15px", textAlign: "left", cursor: "pointer", boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)" },
  operationCardActive: { borderColor: "#c3b526", backgroundColor: "#fffbea", boxShadow: "0 8px 20px rgba(195, 181, 38, 0.15)" },
  operationCardDisabled: { opacity: 0.45, cursor: "not-allowed", boxShadow: "none" },
  operationIcon: { width: "42px", height: "42px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "10px", backgroundColor: "#111827", color: "#ffffff", fontSize: "20px", fontWeight: 900 },
  operationText: { display: "flex", flexDirection: "column", gap: "3px" },
  operationCount: { minWidth: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", backgroundColor: "#f4e96b", fontSize: "11px", fontWeight: 900 },
  emptyState: { border: "1px solid #d4d4d8", borderRadius: "12px", backgroundColor: "#f8fafc", padding: "22px", color: "#475569" },
  emptyHeader: { display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", textAlign: "left" },
  emptyIcon: { width: "42px", height: "42px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", backgroundColor: "#f4e96b", color: "#111827", fontWeight: 900 },
  emptySteps: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginTop: "20px" },
  workflowHeader: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", marginBottom: "20px", padding: "14px 16px", border: "1px solid #d4d4d8", borderRadius: "11px", backgroundColor: "#f8fafc" },
  workflowStep: { display: "flex", alignItems: "center", gap: "9px", color: "#94a3b8" },
  workflowStepActive: { color: "#111827" },
  workflowConnector: { width: "56px", height: "2px", backgroundColor: "#cbd5e1" },
  modeBadge: { marginLeft: "auto", borderRadius: "999px", backgroundColor: "#111827", color: "#ffffff", padding: "7px 11px", fontSize: "10px", fontWeight: 850, textTransform: "uppercase" },
  footerActions: { display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "10px", marginTop: "18px" },
  primaryButton: { border: "1px solid #111827", borderRadius: "8px", backgroundColor: "#f4e96b", color: "#111827", boxShadow: "0 5px 0 #111827", padding: "11px 18px", fontSize: "11px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "1px solid #94a3b8", borderRadius: "8px", backgroundColor: "#ffffff", color: "#334155", padding: "11px 16px", fontSize: "11px", fontWeight: 800, cursor: "pointer" },
  disabledButton: { opacity: 0.45, cursor: "not-allowed", boxShadow: "none" },
  error: { border: "1px solid #fecaca", borderRadius: "8px", backgroundColor: "#fff1f2", color: "#991b1b", padding: "11px 13px", fontSize: "12px", fontWeight: 750, marginBottom: "14px" },
  success: { border: "1px solid #bbf7d0", borderRadius: "8px", backgroundColor: "#f0fdf4", color: "#166534", padding: "11px 13px", fontSize: "12px", fontWeight: 750, marginBottom: "14px" },
  savePanel: { border: "1px solid #d4d4d8", borderRadius: "12px", backgroundColor: "#ffffff", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)", padding: "18px" },
  saveHeader: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "14px" },
  readyBadge: { borderRadius: "999px", backgroundColor: "#fffbea", color: "#665c00", padding: "7px 11px", fontSize: "10px", fontWeight: 850 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" },
  summaryItem: { border: "1px solid #e2e8f0", borderRadius: "9px", backgroundColor: "#f8fafc", padding: "12px", display: "flex", flexDirection: "column", gap: "5px", color: "#64748b", fontSize: "10px" },
  summaryItemAccent: { border: "1px solid #d8ca3f", borderRadius: "9px", backgroundColor: "#fffbea", padding: "12px", display: "flex", flexDirection: "column", gap: "5px", color: "#64748b", fontSize: "10px" },
};
