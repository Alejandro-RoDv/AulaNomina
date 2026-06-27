import { useState } from "react";

import PageCard from "../components/layout/PageCard";
import {
  calcularEmbargo,
  formatEuro,
  parseEuropeanAmount,
} from "../utils/embargoCalculator";

const TRAMO_NAMES = ["1º tramo", "2º tramo", "3º tramo", "4º tramo", "5º tramo", "Exceso"];

const INITIAL_FORM = {
  smi: "1.221,00",
  liquido: "",
  porcentajeReduccion: "0",
  pagasExtrasProrrateadas: false,
  smiProrrateado: "1.221,00",
  incluyePagaExtraCompleta: false,
  importePagaExtra: "1.221,00",
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
        style={{
          ...styles.input,
          ...(readOnly ? styles.readOnlyInput : {}),
          ...(disabled ? styles.disabledInput : {}),
        }}
      />
    </label>
  );
}

function OptionRow({ checked, onChange, label, children }) {
  return (
    <div style={styles.optionRow}>
      <label style={styles.checkboxLabel}>
        <input type="checkbox" checked={checked} onChange={onChange} style={styles.checkbox} />
        <span>{label}</span>
      </label>
      {checked && <div style={styles.optionControl}>{children}</div>}
    </div>
  );
}

export default function EmbargoCalculatorPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const formatField = (field) => {
    const value = parseEuropeanAmount(form[field]);
    if (Number.isFinite(value) && value >= 0) setField(field, formatAmountInput(value));
  };

  const handleCalculate = () => {
    setError("");

    try {
      const porcentajeReduccion = form.cargasFamiliares
        ? Number(form.reduccionCargas)
        : Number(form.porcentajeReduccion);

      const calculation = calcularEmbargo({
        liquido: parseEuropeanAmount(form.liquido),
        smi: parseEuropeanAmount(form.smi),
        porcentajeReduccion,
        pagasExtrasProrrateadas: form.pagasExtrasProrrateadas,
        smiProrrateado: parseEuropeanAmount(form.smiProrrateado),
        incluyePagaExtraCompleta: form.incluyePagaExtraCompleta,
        importePagaExtra: parseEuropeanAmount(form.importePagaExtra),
        cargasFamiliares: form.cargasFamiliares,
      });

      setResult(calculation);
    } catch (calculationError) {
      setResult(null);
      setError(calculationError instanceof Error ? calculationError.message : "No se ha podido realizar el cálculo.");
    }
  };

  const tramos = result?.tramos || TRAMO_NAMES.map((nombre) => ({ nombre }));

  return (
    <div style={styles.wrapper}>
      <PageCard title="Calculadora de embargos judiciales">
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Datos principales</h3>
          <div style={styles.fieldsGrid}>
            <AmountField
              label="S.M.I."
              value={form.smi}
              onChange={(event) => setField("smi", event.target.value)}
              onBlur={() => formatField("smi")}
            />
            <AmountField
              label="Cantidad líquida"
              value={form.liquido}
              onChange={(event) => setField("liquido", event.target.value)}
              onBlur={() => formatField("liquido")}
            />
            <label style={styles.field}>
              <span style={styles.label}>% Reducción</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.cargasFamiliares ? form.reduccionCargas : form.porcentajeReduccion}
                onChange={(event) => setField("porcentajeReduccion", event.target.value)}
                disabled={form.cargasFamiliares}
                style={{ ...styles.input, ...(form.cargasFamiliares ? styles.disabledInput : {}) }}
              />
            </label>
            <AmountField
              label="Total embargable"
              value={formatEuro(result?.totalEmbargable || 0)}
              onChange={() => {}}
              readOnly
            />
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Opciones</h3>
          <div style={styles.optionsGrid}>
            <OptionRow
              checked={form.pagasExtrasProrrateadas}
              onChange={(event) => setField("pagasExtrasProrrateadas", event.target.checked)}
              label="Pagas extras prorrateadas"
            >
              <AmountField
                label="S.M.I. prorrateado"
                value={form.smiProrrateado}
                onChange={(event) => setField("smiProrrateado", event.target.value)}
                onBlur={() => formatField("smiProrrateado")}
              />
            </OptionRow>

            <OptionRow
              checked={form.incluyePagaExtraCompleta}
              onChange={(event) => setField("incluyePagaExtraCompleta", event.target.checked)}
              label="Incluye paga extra completa"
            >
              <AmountField
                label="Importe paga extra"
                value={form.importePagaExtra}
                onChange={(event) => setField("importePagaExtra", event.target.value)}
                onBlur={() => formatField("importePagaExtra")}
              />
            </OptionRow>

            <OptionRow
              checked={form.cargasFamiliares}
              onChange={(event) => setField("cargasFamiliares", event.target.checked)}
              label="Cargas familiares"
            >
              <label style={styles.field}>
                <span style={styles.label}>Reducción</span>
                <select
                  value={form.reduccionCargas}
                  onChange={(event) => setField("reduccionCargas", event.target.value)}
                  style={styles.input}
                >
                  <option value="0">0 %</option>
                  <option value="10">10 %</option>
                  <option value="15">15 %</option>
                </select>
              </label>
            </OptionRow>
          </div>
        </section>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.buttonRow}>
          <button type="button" onClick={handleCalculate} style={styles.calculateButton}>
            Realizar cálculo
          </button>
        </div>

        <section style={styles.tableSection}>
          <h3 style={styles.sectionTitle}>Desglose por tramos</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.rowHeader}>Concepto</th>
                  {TRAMO_NAMES.map((column) => (
                    <th key={column} style={styles.columnHeader}>{column}</th>
                  ))}
                  <th style={styles.totalHeader}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" style={styles.rowHeader}>Líquido</th>
                  {tramos.map((tramo) => <td key={`liquido-${tramo.nombre}`} style={styles.cell}>{result ? formatEuro(tramo.baseTramo) : "—"}</td>)}
                  <td style={styles.totalCell}>{result ? formatEuro(result.liquidoFinalCalculado) : "—"}</td>
                </tr>
                <tr>
                  <th scope="row" style={styles.rowHeader}>S.M.I.</th>
                  {tramos.map((tramo) => <td key={`smi-${tramo.nombre}`} style={styles.cell}>{result ? formatEuro(tramo.smiReferencia) : "—"}</td>)}
                  <td style={styles.totalCell}>{result ? formatEuro(tramos[0]?.smiReferencia) : "—"}</td>
                </tr>
                <tr>
                  <th scope="row" style={styles.rowHeader}>%</th>
                  {tramos.map((tramo) => <td key={`porcentaje-${tramo.nombre}`} style={styles.cell}>{result ? formatPercentage(tramo.porcentajeAplicado) : "—"}</td>)}
                  <td style={styles.totalCell}>—</td>
                </tr>
                <tr>
                  <th scope="row" style={styles.rowHeader}>Importe</th>
                  {tramos.map((tramo) => <td key={`importe-${tramo.nombre}`} style={styles.cell}>{result ? formatEuro(tramo.importeEmbargable) : "—"}</td>)}
                  <td style={styles.totalCell}>{result ? formatEuro(result.totalEmbargable) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <p style={styles.notice}>
          Cálculo orientativo conforme a la regla general del art. 607 LEC. Puede variar en casos especiales como pensión de alimentos, varios ingresos, embargos previos o instrucciones específicas del órgano ejecutante.
        </p>
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  section: { border: "2px solid #111111", marginBottom: "18px", backgroundColor: "#ffffff" },
  sectionTitle: { margin: 0, padding: "9px 12px", backgroundColor: "#f5ef9c", borderBottom: "2px solid #111111", fontSize: "14px", fontWeight: 950, color: "#111111", textTransform: "uppercase", letterSpacing: "0.04em" },
  fieldsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px 18px", padding: "18px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 },
  label: { fontSize: "12px", fontWeight: 900, color: "#111111", textTransform: "uppercase", letterSpacing: "0.03em" },
  input: { width: "100%", minHeight: "38px", border: "2px solid #111111", borderRadius: 0, backgroundColor: "#ffffff", color: "#111111", padding: "8px 10px", boxSizing: "border-box", fontSize: "14px", fontWeight: 700, fontFamily: "inherit" },
  readOnlyInput: { backgroundColor: "#f3f4f6", fontWeight: 900 },
  disabledInput: { backgroundColor: "#e5e7eb", color: "#6b7280", cursor: "not-allowed" },
  optionsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "12px", padding: "18px" },
  optionRow: { border: "2px solid #111111", padding: "12px", minHeight: "76px", boxSizing: "border-box", backgroundColor: "#fffef2" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "9px", fontSize: "13px", fontWeight: 900, color: "#111111", cursor: "pointer" },
  checkbox: { width: "18px", height: "18px", accentColor: "#111111" },
  optionControl: { marginTop: "12px" },
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
