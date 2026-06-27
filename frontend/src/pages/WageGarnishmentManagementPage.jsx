import { useEffect, useMemo, useState } from "react";

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
  company_id: "",
  employee_id: "",
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
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

function amountToNumber(value) {
  if (typeof value === "number") return value;
  const normalized = String(value || "").trim().replace(/\./g, "").replace(",", ".");
  return normalized ? Number(normalized) : 0;
}

function employeeLabel(employee) {
  return `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || `Trabajador ${employee.id}`;
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

export default function WageGarnishmentManagementPage({ companies = [], employees = [], contracts = [] }) {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [calculationInitialForm, setCalculationInitialForm] = useState(EMPTY_CALCULATION);
  const [calculationInitialResult, setCalculationInitialResult] = useState(null);
  const [calculationState, setCalculationState] = useState(null);
  const [calculatorKey, setCalculatorKey] = useState(0);
  const [mode, setMode] = useState("new");
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState({ company: "", employee: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const readOnly = mode === "view";

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
    loadRecords();
  }, []);

  const availableEmployees = useMemo(
    () => employees.filter((employee) => !form.company_id || String(employee.company_id) === String(form.company_id)),
    [employees, form.company_id]
  );

  const availableContracts = useMemo(
    () => contracts.filter((contract) => (
      (!form.employee_id || String(contract.employee_id) === String(form.employee_id))
      && (!form.company_id || String(contract.company_id) === String(form.company_id))
    )),
    [contracts, form.employee_id, form.company_id]
  );

  const filteredRecords = useMemo(() => records.filter((record) => (
    (!filters.company || String(record.company_id) === filters.company)
    && (!filters.employee || String(record.employee_id) === filters.employee)
    && (!filters.status || record.status === filters.status)
  )), [records, filters]);

  const setField = (name, value) => {
    if (readOnly) return;
    setMessage("");
    setError("");
    setForm((previous) => {
      if (name === "company_id") {
        return { ...previous, company_id: value, employee_id: "", contract_id: "" };
      }
      if (name === "employee_id") {
        const activeContract = contracts.find((contract) => (
          String(contract.employee_id) === String(value)
          && String(contract.company_id) === String(previous.company_id)
          && contract.status === "active"
        ));
        return { ...previous, employee_id: value, contract_id: activeContract ? String(activeContract.id) : "" };
      }
      return { ...previous, [name]: value };
    });
  };

  const resetWorkspace = () => {
    setForm(EMPTY_FORM);
    setCalculationInitialForm(EMPTY_CALCULATION);
    setCalculationInitialResult(null);
    setCalculationState(null);
    setSelectedId(null);
    setMode("new");
    setMessage("");
    setError("");
    setCalculatorKey((value) => value + 1);
  };

  const openRecord = (record, nextMode) => {
    if (!record) return;
    setSelectedId(record.id);
    setMode(nextMode);
    setForm({
      company_id: String(record.company_id),
      employee_id: String(record.employee_id),
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
    });
    const calculationForm = recordToCalculationForm(record);
    setCalculationInitialForm(calculationForm);
    setCalculationInitialResult(record.calculation_snapshot || null);
    setCalculationState({ form: calculationForm, result: record.calculation_snapshot || null });
    setMessage("");
    setError("");
    setCalculatorKey((value) => value + 1);
  };

  const buildPayload = () => {
    if (!form.company_id || !form.employee_id || !form.reference.trim() || !form.issuing_body.trim() || !form.start_date) {
      throw new Error("Empresa, trabajador, referencia, órgano emisor y fecha de inicio son obligatorios.");
    }
    if (!calculationState?.result) throw new Error("Debes realizar el cálculo antes de guardar el embargo.");

    const calculationForm = calculationState.form;
    const calculation = calculationState.result;
    const reduction = calculationForm.cargasFamiliares
      ? Number(calculationForm.reduccionCargas)
      : Number(calculationForm.porcentajeReduccion || 0);

    return {
      company_id: Number(form.company_id),
      employee_id: Number(form.employee_id),
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
      const savedRecord = selectedId
        ? await updateWageGarnishment(selectedId, payload)
        : await createWageGarnishment(payload);
      await loadRecords();
      openRecord(savedRecord, "view");
      setMessage(selectedId ? "Embargo actualizado correctamente." : "Embargo grabado correctamente.");
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
      if (selectedId === record.id) resetWorkspace();
      await loadRecords();
      setMessage("Embargo eliminado correctamente.");
    } catch (deleteError) {
      setError(deleteError.message || "No se ha podido eliminar el embargo");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <PageCard title="Gestión de embargos judiciales" subtitle="Alta, consulta, modificación y seguimiento de embargos por trabajador.">
        <div style={styles.toolbar}>
          <button type="button" style={styles.primaryButton} onClick={resetWorkspace}>Nuevo embargo</button>
          {mode === "view" && selectedId && <button type="button" style={styles.secondaryButton} onClick={() => setMode("edit")}>Editar registro</button>}
          <span style={styles.modeBadge}>{mode === "new" ? "ALTA" : mode === "edit" ? "EDICIÓN" : "CONSULTA"}</span>
        </div>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Identificación y expediente</h3>
          <div style={styles.grid}>
            <label style={styles.field}><span style={styles.label}>Empresa *</span><select value={form.company_id} disabled={readOnly} onChange={(event) => setField("company_id", event.target.value)} style={styles.input}><option value="">Selecciona empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
            <label style={styles.field}><span style={styles.label}>Trabajador *</span><select value={form.employee_id} disabled={readOnly || !form.company_id} onChange={(event) => setField("employee_id", event.target.value)} style={styles.input}><option value="">Selecciona trabajador</option>{availableEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>)}</select></label>
            <label style={styles.field}><span style={styles.label}>Contrato</span><select value={form.contract_id} disabled={readOnly || !form.employee_id} onChange={(event) => setField("contract_id", event.target.value)} style={styles.input}><option value="">Sin contrato vinculado</option>{availableContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.contract_code || contract.contract_type || `Contrato ${contract.id}`}</option>)}</select></label>
            <label style={styles.field}><span style={styles.label}>Estado</span><select value={form.status} disabled={readOnly} onChange={(event) => setField("status", event.target.value)} style={styles.input}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={styles.field}><span style={styles.label}>Referencia / autos *</span><input value={form.reference} disabled={readOnly} onChange={(event) => setField("reference", event.target.value)} style={styles.input} /></label>
            <label style={styles.field}><span style={styles.label}>Órgano emisor *</span><input value={form.issuing_body} disabled={readOnly} onChange={(event) => setField("issuing_body", event.target.value)} style={styles.input} /></label>
            <label style={styles.field}><span style={styles.label}>Acreedor</span><input value={form.creditor} disabled={readOnly} onChange={(event) => setField("creditor", event.target.value)} style={styles.input} /></label>
            <label style={styles.field}><span style={styles.label}>Fecha notificación</span><input type="date" value={form.notification_date} disabled={readOnly} onChange={(event) => setField("notification_date", event.target.value)} style={styles.input} /></label>
            <label style={styles.field}><span style={styles.label}>Fecha inicio *</span><input type="date" value={form.start_date} disabled={readOnly} onChange={(event) => setField("start_date", event.target.value)} style={styles.input} /></label>
            <label style={styles.field}><span style={styles.label}>Fecha fin</span><input type="date" value={form.end_date} disabled={readOnly} onChange={(event) => setField("end_date", event.target.value)} style={styles.input} /></label>
            <label style={styles.field}><span style={styles.label}>Deuda total</span><input value={form.total_debt} disabled={readOnly} inputMode="decimal" onChange={(event) => setField("total_debt", event.target.value)} style={styles.input} /></label>
            <label style={styles.field}><span style={styles.label}>Retenido hasta la fecha</span><input value={form.withheld_to_date} disabled={readOnly} inputMode="decimal" onChange={(event) => setField("withheld_to_date", event.target.value)} style={styles.input} /></label>
          </div>
          <label style={{ ...styles.field, padding: "0 18px 18px" }}><span style={styles.label}>Observaciones</span><textarea value={form.notes} disabled={readOnly} onChange={(event) => setField("notes", event.target.value)} style={styles.textarea} /></label>
        </section>
      </PageCard>

      <EmbargoCalculatorPage
        key={calculatorKey}
        initialForm={calculationInitialForm}
        initialResult={calculationInitialResult}
        readOnly={readOnly}
        onDirty={() => setCalculationState(null)}
        onCalculated={(state) => setCalculationState(state)}
      />

      {(error || message) && <div style={error ? styles.error : styles.success}>{error || message}</div>}

      {!readOnly && (
        <div style={styles.saveRow}>
          <button type="button" disabled={submitting} onClick={saveRecord} style={styles.saveButton}>{submitting ? "Guardando…" : selectedId ? "Guardar cambios" : "Grabar embargo"}</button>
          {selectedId && <button type="button" onClick={() => openRecord(records.find((record) => record.id === selectedId), "view")} style={styles.secondaryButton}>Cancelar edición</button>}
        </div>
      )}

      <PageCard title="Embargos registrados" subtitle="Consulta y mantenimiento del histórico de embargos judiciales.">
        <div style={styles.filters}>
          <select value={filters.company} onChange={(event) => setFilters((previous) => ({ ...previous, company: event.target.value, employee: "" }))} style={styles.input}><option value="">Todas las empresas</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
          <select value={filters.employee} onChange={(event) => setFilters((previous) => ({ ...previous, employee: event.target.value }))} style={styles.input}><option value="">Todos los trabajadores</option>{employees.filter((employee) => !filters.company || String(employee.company_id) === filters.company).map((employee) => <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>)}</select>
          <select value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))} style={styles.input}><option value="">Todos los estados</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Empresa</th><th style={styles.th}>Trabajador</th><th style={styles.th}>Referencia</th><th style={styles.th}>Inicio</th><th style={styles.th}>Estado</th><th style={styles.th}>Embargo mensual</th><th style={styles.th}>Pendiente</th><th style={styles.th}>Acciones</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="8" style={styles.emptyCell}>Cargando embargos…</td></tr>}
              {!loading && filteredRecords.length === 0 && <tr><td colSpan="8" style={styles.emptyCell}>No hay embargos registrados.</td></tr>}
              {!loading && filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td style={styles.td}>{record.company_name}</td><td style={styles.td}>{record.employee_name}</td><td style={styles.td}>{record.reference}</td><td style={styles.td}>{record.start_date}</td><td style={styles.td}>{STATUS_LABELS[record.status] || record.status}</td><td style={styles.moneyCell}>{formatEuro(record.monthly_garnishable)}</td><td style={styles.moneyCell}>{record.remaining_debt === null ? "—" : formatEuro(record.remaining_debt)}</td>
                  <td style={styles.actions}><button type="button" style={styles.smallButton} onClick={() => openRecord(record, "view")}>Consultar</button><button type="button" style={styles.smallButton} onClick={() => openRecord(record, "edit")}>Editar</button><button type="button" style={styles.deleteButton} onClick={() => removeRecord(record)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  toolbar: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" },
  modeBadge: { marginLeft: "auto", border: "2px solid #111111", backgroundColor: "#f5ef9c", padding: "7px 12px", fontSize: "12px", fontWeight: 950 },
  section: { border: "2px solid #111111", backgroundColor: "#ffffff" },
  sectionTitle: { margin: 0, padding: "9px 12px", backgroundColor: "#f5ef9c", borderBottom: "2px solid #111111", fontSize: "14px", fontWeight: 950, textTransform: "uppercase" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px 18px", padding: "18px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 },
  label: { fontSize: "12px", fontWeight: 900, color: "#111111", textTransform: "uppercase" },
  input: { width: "100%", minHeight: "38px", border: "2px solid #111111", borderRadius: 0, backgroundColor: "#ffffff", color: "#111111", padding: "8px 10px", boxSizing: "border-box", fontSize: "13px", fontWeight: 700 },
  textarea: { minHeight: "82px", resize: "vertical", border: "2px solid #111111", padding: "9px", fontFamily: "inherit", fontSize: "13px" },
  primaryButton: { border: "2px solid #111111", backgroundColor: "#f5ef9c", boxShadow: "3px 3px 0 #111111", padding: "9px 14px", fontWeight: 950, cursor: "pointer", textTransform: "uppercase" },
  secondaryButton: { border: "2px solid #111111", backgroundColor: "#ffffff", padding: "9px 14px", fontWeight: 900, cursor: "pointer", textTransform: "uppercase" },
  saveRow: { display: "flex", justifyContent: "center", gap: "12px" },
  saveButton: { border: "3px solid #111111", backgroundColor: "#f5ef9c", boxShadow: "4px 4px 0 #111111", padding: "12px 26px", fontWeight: 950, cursor: "pointer", textTransform: "uppercase" },
  error: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "10px 12px", fontWeight: 800 },
  success: { border: "2px solid #166534", backgroundColor: "#dcfce7", color: "#14532d", padding: "10px 12px", fontWeight: 800 },
  filters: { display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" },
  tableWrapper: { overflowX: "auto", border: "2px solid #111111" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "1050px" },
  th: { backgroundColor: "#f5ef9c", borderBottom: "2px solid #111111", borderRight: "1px solid #111111", padding: "10px", fontSize: "12px", textAlign: "left", textTransform: "uppercase" },
  td: { borderBottom: "1px solid #111111", borderRight: "1px solid #111111", padding: "9px", fontSize: "12px", fontWeight: 650 },
  moneyCell: { borderBottom: "1px solid #111111", borderRight: "1px solid #111111", padding: "9px", fontSize: "12px", fontWeight: 900, textAlign: "right" },
  actions: { borderBottom: "1px solid #111111", padding: "7px", display: "flex", gap: "6px", whiteSpace: "nowrap" },
  smallButton: { border: "1px solid #111111", backgroundColor: "#ffffff", padding: "6px 8px", fontSize: "11px", fontWeight: 850, cursor: "pointer" },
  deleteButton: { border: "1px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "6px 8px", fontSize: "11px", fontWeight: 850, cursor: "pointer" },
  emptyCell: { padding: "28px", textAlign: "center", color: "#6b7280", fontWeight: 700 },
};
