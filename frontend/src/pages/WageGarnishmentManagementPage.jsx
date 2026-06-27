import { useEffect, useMemo, useState } from "react";

import WageGarnishmentContextSelector from "../components/wage-garnishments/WageGarnishmentContextSelector";
import WageGarnishmentHistory from "../components/wage-garnishments/WageGarnishmentHistory";
import WageGarnishmentRecordForm from "../components/wage-garnishments/WageGarnishmentRecordForm";
import PageCard from "../components/layout/PageCard";
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

  const resetDraft = () => {
    const activeContract = contractsForContext.find((contract) => contract.status === "active") || contractsForContext[0];
    setForm({ ...EMPTY_FORM, contract_id: activeContract ? String(activeContract.id) : "" });
    setCalculationInitialForm(EMPTY_CALCULATION);
    setCalculationInitialResult(null);
    setCalculationState(null);
    setSelectedId(null);
    setMode("new");
    setWorkflowStep(1);
    setError("");
    setCalculatorKey((value) => value + 1);
  };

  const handleCompanyChange = (companyId) => {
    setContext({ companyId, employeeId: "" });
    setActiveTab("new");
    setMessage("");
    resetDraft();
  };

  const handleEmployeeChange = (employeeId) => {
    const employeeContracts = contracts.filter((contract) => (
      String(contract.company_id) === String(context.companyId)
      && String(contract.employee_id) === String(employeeId)
    ));
    const activeContract = employeeContracts.find((contract) => contract.status === "active") || employeeContracts[0];
    setContext((previous) => ({ ...previous, employeeId }));
    setForm({ ...EMPTY_FORM, contract_id: activeContract ? String(activeContract.id) : "" });
    setCalculationInitialForm(EMPTY_CALCULATION);
    setCalculationInitialResult(null);
    setCalculationState(null);
    setSelectedId(null);
    setMode("new");
    setWorkflowStep(1);
    setActiveTab("new");
    setMessage("");
    setError("");
    setCalculatorKey((value) => value + 1);
  };

  const releaseContext = () => {
    setContext({ companyId: "", employeeId: "" });
    setActiveTab("new");
    setMessage("");
    resetDraft();
  };

  const startNew = () => {
    resetDraft();
    setActiveTab("new");
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
      resetDraft();
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
      <PageCard title="Gestión de embargos judiciales" subtitle="Selecciona un trabajador y gestiona sus expedientes desde un flujo único y ordenado.">
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

        <div style={styles.tabs}>
          <button
            type="button"
            disabled={!contextReady}
            onClick={startNew}
            style={{ ...styles.tab, ...(activeTab === "new" ? styles.activeTab : {}), ...(!contextReady ? styles.disabledTab : {}) }}
          >
            Nuevo embargo
          </button>
          <button
            type="button"
            disabled={!contextReady}
            onClick={() => setActiveTab("history")}
            style={{ ...styles.tab, ...(activeTab === "history" ? styles.activeTab : {}), ...(!contextReady ? styles.disabledTab : {}) }}
          >
            Historial del trabajador
            {contextReady && <span style={styles.tabCount}>{recordsForContext.length}</span>}
          </button>
        </div>
      </PageCard>

      {!contextReady && (
        <div style={styles.contextGate}>
          <strong>Selecciona empresa y trabajador para continuar</strong>
          <span>El formulario de alta y el historial permanecen ocultos hasta establecer el contexto.</span>
        </div>
      )}

      {contextReady && activeTab === "history" && (
        <PageCard title="Historial de embargos" subtitle="Expedientes asociados al trabajador seleccionado.">
          {message && <div style={styles.success}>{message}</div>}
          {error && <div style={styles.error}>{error}</div>}
          <WageGarnishmentHistory
            records={recordsForContext}
            loading={loading}
            onView={(record) => openRecord(record, "view")}
            onEdit={(record) => openRecord(record, "edit")}
            onDelete={removeRecord}
          />
        </PageCard>
      )}

      {contextReady && activeTab === "new" && (
        <>
          <PageCard
            title={mode === "new" ? "Nuevo embargo" : mode === "edit" ? "Editar embargo" : "Consulta de embargo"}
            subtitle={mode === "view" ? "Expediente en modo consulta." : "Completa el expediente y calcula la retención antes de grabar."}
          >
            <div style={styles.workflowHeader}>
              <button type="button" onClick={() => setWorkflowStep(1)} style={{ ...styles.stepButton, ...(workflowStep === 1 ? styles.activeStep : {}) }}>
                <span style={styles.stepNumber}>1</span>
                Datos del expediente
              </button>
              <div style={styles.stepLine} />
              <button type="button" onClick={goToCalculation} style={{ ...styles.stepButton, ...(workflowStep === 2 ? styles.activeStep : {}) }}>
                <span style={styles.stepNumber}>2</span>
                Cálculo y grabación
              </button>
              <span style={styles.modeBadge}>{mode === "new" ? "ALTA" : mode === "edit" ? "EDICIÓN" : "CONSULTA"}</span>
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {message && <div style={styles.success}>{message}</div>}

            {workflowStep === 1 && (
              <>
                <WageGarnishmentRecordForm
                  form={form}
                  contracts={contractsForContext}
                  readOnly={readOnly}
                  onChange={setField}
                />
                <div style={styles.footerActions}>
                  {readOnly && <button type="button" onClick={() => setMode("edit")} style={styles.secondaryButton}>Editar expediente</button>}
                  <button type="button" onClick={goToCalculation} style={styles.primaryButton}>
                    {readOnly ? "Ver cálculo" : "Continuar al cálculo"}
                  </button>
                  <button type="button" onClick={() => setActiveTab("history")} style={styles.secondaryButton}>Volver al historial</button>
                </div>
              </>
            )}
          </PageCard>

          {workflowStep === 2 && (
            <>
              <EmbargoCalculatorPage
                key={calculatorKey}
                initialForm={calculationInitialForm}
                initialResult={calculationInitialResult}
                readOnly={readOnly}
                onDirty={() => setCalculationState(null)}
                onCalculated={(state) => setCalculationState(state)}
              />

              <section style={styles.savePanel}>
                <div style={styles.summaryGrid}>
                  <div style={styles.summaryItem}><span>Líquido calculado</span><strong>{calculationState?.result ? formatEuro(calculationState.result.liquidoFinalCalculado) : "Pendiente"}</strong></div>
                  <div style={styles.summaryItem}><span>Embargo mensual</span><strong>{calculationState?.result ? formatEuro(calculationState.result.totalEmbargable) : "Pendiente"}</strong></div>
                  <div style={styles.summaryItem}><span>Deuda pendiente</span><strong>{remainingDebt === null ? "Sin informar" : formatEuro(remainingDebt)}</strong></div>
                  <div style={styles.summaryItem}><span>Estado</span><strong>{form.status.toUpperCase()}</strong></div>
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
  wrapper: { display: "flex", flexDirection: "column", gap: "18px" },
  tabs: { display: "flex", gap: "8px", marginTop: "14px", borderBottom: "3px solid #111111" },
  tab: { display: "inline-flex", alignItems: "center", gap: "8px", border: "2px solid #111111", borderBottom: "none", backgroundColor: "#ffffff", padding: "10px 16px", fontSize: "12px", fontWeight: 950, textTransform: "uppercase", cursor: "pointer", transform: "translateY(3px)" },
  activeTab: { backgroundColor: "#f5ef9c", boxShadow: "3px -2px 0 #111111" },
  disabledTab: { opacity: 0.45, cursor: "not-allowed", boxShadow: "none" },
  tabCount: { display: "inline-flex", minWidth: "20px", height: "20px", alignItems: "center", justifyContent: "center", border: "1px solid #111111", backgroundColor: "#ffffff", fontSize: "10px" },
  contextGate: { minHeight: "150px", border: "2px dashed #9ca3af", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: "#4b5563", textAlign: "center", padding: "24px" },
  workflowHeader: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px", padding: "10px", border: "2px solid #111111", backgroundColor: "#f3f4f6" },
  stepButton: { display: "inline-flex", alignItems: "center", gap: "8px", border: "none", backgroundColor: "transparent", padding: "6px 8px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", cursor: "pointer" },
  activeStep: { backgroundColor: "#f5ef9c", outline: "2px solid #111111" },
  stepNumber: { width: "24px", height: "24px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px solid #111111", backgroundColor: "#ffffff", fontSize: "11px", fontWeight: 950 },
  stepLine: { flex: 1, maxWidth: "70px", height: "2px", backgroundColor: "#111111" },
  modeBadge: { marginLeft: "auto", border: "2px solid #111111", backgroundColor: "#ffffff", padding: "7px 10px", fontSize: "10px", fontWeight: 950 },
  footerActions: { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "10px", marginTop: "18px" },
  primaryButton: { border: "3px solid #111111", backgroundColor: "#f5ef9c", boxShadow: "3px 3px 0 #111111", padding: "10px 18px", fontSize: "11px", fontWeight: 950, textTransform: "uppercase", cursor: "pointer" },
  secondaryButton: { border: "2px solid #111111", backgroundColor: "#ffffff", padding: "10px 16px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", cursor: "pointer" },
  disabledButton: { opacity: 0.45, cursor: "not-allowed", boxShadow: "none" },
  error: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "10px 12px", fontSize: "12px", fontWeight: 800, marginBottom: "14px" },
  success: { border: "2px solid #166534", backgroundColor: "#dcfce7", color: "#14532d", padding: "10px 12px", fontSize: "12px", fontWeight: 800, marginBottom: "14px" },
  savePanel: { border: "3px solid #111111", backgroundColor: "#fffef2", padding: "16px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" },
  summaryItem: { border: "1px solid #111111", backgroundColor: "#ffffff", padding: "10px", display: "flex", flexDirection: "column", gap: "4px" },
};
