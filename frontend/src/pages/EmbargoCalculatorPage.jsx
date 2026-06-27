import { useEffect, useState } from "react";

import PageCard from "../components/layout/PageCard";
import { fetchCurrentSmi } from "../services/wageGarnishmentApi";
import {
  calcularEmbargo,
  formatEuro,
  obtenerReferenciasSmi,
  parseEuropeanAmount,
} from "../utils/embargoCalculator";

const TRAMO_NAMES = ["1º tramo", "2º tramo", "3º tramo", "4º tramo", "5º tramo", "Exceso"];

const DEFAULT_FORM = {
  smiAnual: "",
  liquido: "",
  porcentajeReduccion: "0",
  pagasExtrasProrrateadas: false,
  incluyePagaExtraCompleta: false,
  importePagaExtra: "",
  cargasFamiliares: false,
  reduccionCargas: "0",
};

function formatAmountInput(value) {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercentage(value) {
  return `${new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} %`;
}

function AmountField({ label, value, onChange, onBlur, readOnly = false, disabled = false }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        readOnly={readOnly}
        disabled={disabled}
        style={{ ...styles.input, ...(readOnly ? styles.readOnlyInput : {}), ...(disabled ? styles.disabledInput : {}) }}
      />
    </label>
  );
}

function OptionRow({ checked, onChange, label, children, disabled = false }) {
  return (
    <div style={styles.optionRow}>
      <label style={{ ...styles.checkboxLabel, ...(disabled ? styles.disabledLabel : {}) }}>
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={styles.checkbox} />
        <span>{label}</span>
      </label>
      {checked && <div style={styles.optionControl}>{children}</div>}
    </div>
  );
}

function getLiveReferences(form) {
  try {
    return obtenerReferenciasSmi({
      smiAnual: parseEuropeanAmount(form.smiAnual),
      pagasExtrasProrrateadas: form.pagasExtrasProrrateadas,
      incluyePagaExtraCompleta: form.incluyePagaExtraCompleta,
    });
  } catch {
    return { smiAnual: 0, smiMensual: 0, minimoInembargable: 0 };
  }
}

export default function EmbargoCalculatorPage({
  initialForm = DEFAULT_FORM,
  initialResult = null,
  readOnly = false,
  smiDate = "",
  onCalculated,
  onDirty,
}) {
  const [form, setForm] = useState(() => ({ ...DEFAULT_FORM, ...initialForm }));
  const [result, setResult] = useState(initialResult);
  const [error, setError] = useState("");
  const [smiSource, setSmiSource] = useState("");
  const liveReferences = getLiveReferences(form);

  useEffect(() => {
    if (readOnly || form.smiAnual) return;
    let active = true;
    fetchCurrentSmi(smiDate || undefined)
      .then((parameter) => {
        if (!active) return;
        setForm((previous) => ({ ...previous, smiAnual: formatAmountInput(Number(parameter.annual_amount)) }));
        setSmiSource(parameter.source_reference || "Parámetro SMI vigente");
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "No se ha podido cargar el SMI vigente.");
      });
    return () => {
      active = false;
    };
  }, [readOnly, smiDate, form.smiAnual]);

  const markDirty = () => {
    setResult(null);
    setError("");
    onDirty?.();
  };

  const setField = (field, value) => {
    if (readOnly) return;
    setForm((previous) => ({ ...previous, [field]: value }));
    markDirty();
  };

  const formatField = (field) => {
    if (readOnly) return;
    const value = parseEuropeanAmount(form[field]);
    if (Number.isFinite(value) && value >= 0) {
      setForm((previous) => ({ ...previous, [field]: formatAmountInput(value) }));
    }
  };

  const toggleProrratedPayments = (checked) => {
    if (readOnly) return;
    setForm((previous) => ({
      ...previous,
      pagasExtrasProrrateadas: checked,
      incluyePagaExtraCompleta: checked ? false : previous.incluyePagaExtraCompleta,
      importePagaExtra: checked ? "" : previous.importePagaExtra,
    }));
    markDirty();
  };

  const toggleFullExtraPayment = (checked) => {
    if (readOnly) return;
    setForm((previous) => ({
      ...previous,
      incluyePagaExtraCompleta: checked,
      pagasExtrasProrrateadas: checked ? false : previous.pagasExtrasProrrateadas,
    }));
    markDirty();
  };

  const toggleAuthorizedReduction = (checked) => {
    if (readOnly) return;
    setForm((previous) => ({
      ...previous,
      cargasFamiliares: checked,
      reduccionCargas: checked ? (previous.reduccionCargas === "0" ? "10" : previous.reduccionCargas) : "0",
      porcentajeReduccion: "0",
    }));
    markDirty();
  };

  const handleCalculate = () => {
    setError("");
    try {
      const porcentajeReduccion = form.cargasFamiliares ? Number(form.reduccionCargas) : 0;
      const calculation = calcularEmbargo({
        liquido: parseEuropeanAmount(form.liquido),
        smiAnual: parseEuropeanAmount(form.smiAnual),
        porcentajeReduccion,
        pagasExtrasProrrateadas: form.pagasExtrasProrrateadas,
        incluyePagaExtraCompleta: form.incluyePagaExtraCompleta,
        importePagaExtra: form.incluyePagaExtraCompleta ? parseEuropeanAmount(form.importePagaExtra) : 0,
        cargasFamiliares: form.cargasFamiliares,
      });
      setResult(calculation);
      onCalculated?.({ form: { ...form }, result: calculation });
    } catch (calculationError) {
      setResult(null);
      onDirty?.();
      setError(calculationError instanceof Error ? calculationError.message : "No se ha podido realizar el cálculo.");
    }
  };

  const tramos = result?.tramos || TRAMO_NAMES.map((nombre) => ({ nombre }));

  return (
    <div style={styles.wrapper}>
      <PageCard title="Calculadora de embargos judiciales" subtitle={smiSource || "El SMI se obtiene del parámetro vigente para la fecha del expediente."}>
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Datos principales</h3>
          <div style={styles.fieldsGrid}>
            <AmountField label="S.M.I. anual" value={form.smiAnual} onChange={(event) => setField("smiAnual", event.target.value)} onBlur={() => formatField("smiAnual")} readOnly={readOnly} />
            <AmountField label="Cantidad líquida mensual" value={form.liquido} onChange={(event) => setField("liquido", event.target.value)} onBlur={() => formatField("liquido")} readOnly={readOnly} />
            <AmountField label="Reducción autorizada" value={formatPercentage(form.cargasFamiliares ? Number(form.reduccionCargas) : 0)} onChange={() => {}} readOnly />
            <AmountField label="Total embargable" value={formatEuro(result?.totalEmbargable || 0)} onChange={() => {}} readOnly />
          </div>
          <div style={styles.referenceStrip}>
            <div style={styles.referenceBox}><span style={styles.referenceLabel}>S.M.I. mensual · 14 pagas</span><strong style={styles.referenceValue}>{formatEuro(liveReferences.smiMensual)}</strong></div>
            <div style={styles.referenceBox}><span style={styles.referenceLabel}>Mínimo inembargable aplicado</span><strong style={styles.referenceValue}>{formatEuro(liveReferences.minimoInembargable)}</strong></div>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Opciones</h3>
          <div style={styles.optionsGrid}>
            <OptionRow checked={form.pagasExtrasProrrateadas} onChange={(event) => toggleProrratedPayments(event.target.checked)} label="Pagas extras prorrateadas" disabled={readOnly}>
              <AmountField label="Mínimo inembargable mensual" value={formatEuro(liveReferences.minimoInembargable)} onChange={() => {}} readOnly />
            </OptionRow>

            <OptionRow checked={form.incluyePagaExtraCompleta} onChange={(event) => toggleFullExtraPayment(event.target.checked)} label="Incluye paga extra completa" disabled={readOnly}>
              <div style={styles.optionFields}>
                <AmountField label="Importe líquido paga extra" value={form.importePagaExtra} onChange={(event) => setField("importePagaExtra", event.target.value)} onBlur={() => formatField("importePagaExtra")} readOnly={readOnly} />
                <AmountField label="Mínimo inembargable del mes" value={formatEuro(liveReferences.minimoInembargable)} onChange={() => {}} readOnly />
              </div>
            </OptionRow>

            <OptionRow checked={form.cargasFamiliares} onChange={(event) => toggleAuthorizedReduction(event.target.checked)} label="Reducción autorizada por el órgano ejecutante" disabled={readOnly}>
              <label style={styles.field}>
                <span style={styles.label}>Porcentaje autorizado</span>
                <select value={form.reduccionCargas} onChange={(event) => setField("reduccionCargas", event.target.value)} disabled={readOnly} style={styles.input}>
                  <option value="10">10 %</option>
                  <option value="15">15 %</option>
                </select>
              </label>
            </OptionRow>
          </div>
        </section>

        {error && <div style={styles.error}>{error}</div>}
        {!readOnly && <div style={styles.buttonRow}><button type="button" onClick={handleCalculate} style={styles.calculateButton}>Realizar cálculo</button></div>}

        <section style={styles.tableSection}>
          <h3 style={styles.sectionTitle}>Desglose por tramos</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead><tr><th style={styles.rowHeader}>Concepto</th>{TRAMO_NAMES.map((column) => <th key={column} style={styles.columnHeader}>{column}</th>)}<th style={styles.totalHeader}>Total</th></tr></thead>
              <tbody>
                <tr><th scope="row" style={styles.rowHeader}>Líquido</th>{tramos.map((tramo) => <td key={`liquido-${tramo.nombre}`} style={styles.cell}>{result ? formatEuro(tramo.baseTramo) : "—"}</td>)}<td style={styles.totalCell}>{result ? formatEuro(result.liquidoFinalCalculado) : "—"}</td></tr>
                <tr><th scope="row" style={styles.rowHeader}>S.M.I.</th>{tramos.map((tramo) => <td key={`smi-${tramo.nombre}`} style={styles.cell}>{result ? formatEuro(tramo.smiReferencia) : "—"}</td>)}<td style={styles.totalCell}>{result ? formatEuro(result.smiAnual) : "—"}</td></tr>
                <tr><th scope="row" style={styles.rowHeader}>%</th>{tramos.map((tramo) => <td key={`porcentaje-${tramo.nombre}`} style={styles.cell}>{result ? formatPercentage(tramo.porcentajeAplicado) : "—"}</td>)}<td style={styles.totalCell}>—</td></tr>
                <tr><th scope="row" style={styles.rowHeader}>Importe</th>{tramos.map((tramo) => <td key={`importe-${tramo.nombre}`} style={styles.cell}>{result ? formatEuro(tramo.importeEmbargable) : "—"}</td>)}<td style={styles.totalCell}>{result ? formatEuro(result.totalEmbargable) : "—"}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <p style={styles.notice}>Cálculo orientativo conforme a la regla general del art. 607 LEC. El servidor recalcula el resultado al grabar. Puede variar en supuestos especiales o por instrucciones del órgano ejecutante.</p>
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  section: { border: "2px solid #111111", marginBottom: "18px", backgroundColor: "#ffffff" },
  sectionTitle: { margin: 0, padding: "9px 12px", backgroundColor: "#f5ef9c", borderBottom: "2px solid #111111", fontSize: "14px", fontWeight: 950, color: "#111111", textTransform: "uppercase", letterSpacing: "0.04em" },
  fieldsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px 18px", padding: "18px 18px 12px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 },
  label: { fontSize: "12px", fontWeight: 900, color: "#111111", textTransform: "uppercase", letterSpacing: "0.03em" },
  input: { width: "100%", minHeight: "38px", border: "2px solid #111111", borderRadius: 0, backgroundColor: "#ffffff", color: "#111111", padding: "8px 10px", boxSizing: "border-box", fontSize: "14px", fontWeight: 700, fontFamily: "inherit" },
  readOnlyInput: { backgroundColor: "#f3f4f6", fontWeight: 900 },
  disabledInput: { backgroundColor: "#e5e7eb", color: "#6b7280", cursor: "not-allowed" },
  disabledLabel: { opacity: 0.65, cursor: "default" },
  referenceStrip: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", padding: "0 18px 18px" },
  referenceBox: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", border: "1px solid #111111", backgroundColor: "#fffef2", padding: "9px 10px" },
  referenceLabel: { fontSize: "11px", fontWeight: 900, color: "#374151", textTransform: "uppercase" },
  referenceValue: { fontSize: "13px", color: "#111111", whiteSpace: "nowrap" },
  optionsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "12px", padding: "18px" },
  optionRow: { border: "2px solid #111111", padding: "12px", minHeight: "76px", boxSizing: "border-box", backgroundColor: "#fffef2" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "9px", fontSize: "13px", fontWeight: 900, color: "#111111", cursor: "pointer" },
  checkbox: { width: "18px", height: "18px", accentColor: "#111111" },
  optionControl: { marginTop: "12px" },
  optionFields: { display: "grid", gap: "10px" },
  error: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "10px 12px", fontSize: "13px", fontWeight: 800, marginBottom: "16px" },
  buttonRow: { display: "flex", justifyContent: "center", margin: "20px 0 24px" },
  calculateButton: { border: "3px solid #111111", borderRadius: 0, backgroundColor: "#f5ef9c", color: "#111111", boxShadow: "4px 4px 0 #111111", padding: "11px 28px", fontSize: "14px", fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" },
  tableSection: { border: "2px solid #111111", backgroundColor: "#ffffff" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", minWidth: "900px", borderCollapse: "collapse", tableLayout: "fixed" },
  columnHeader: { borderRight: "1px solid #111111", borderBottom: "2px solid #111111", backgroundColor: "#fffef2", padding: "10px 8px", fontSize: "12px", fontWeight: 900, color: "#111111", textAlign: "center" },
  totalHeader: { borderBottom: "2px solid #111111", backgroundColor: "#f5ef9c", padding: "10px 8px", fontSize: "12px", fontWeight: 950, color: "#111111", textAlign: "center" },
  rowHeader: { width: "120px", borderRight: "2px solid #111111", borderBottom: "1px solid #111111", backgroundColor: "#f3f4f6", padding: "10px", fontSize: "12px", fontWeight: 950, color: "#111111", textAlign: "left" },
  cell: { borderRight: "1px solid #111111", borderBottom: "1px solid #111111", padding: "10px 8px", fontSize: "12px", fontWeight: 700, color: "#111111", textAlign: "right", whiteSpace: "nowrap" },
  totalCell: { borderBottom: "1px solid #111111", backgroundColor: "#fffef2", padding: "10px 8px", fontSize: "12px", fontWeight: 950, color: "#111111", textAlign: "right", whiteSpace: "nowrap" },
  notice: { margin: "14px 0 0", padding: "10px 12px", borderLeft: "4px solid #111111", backgroundColor: "#f3f4f6", color: "#4b5563", fontSize: "11px", fontWeight: 600, lineHeight: 1.5 },
};
