import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchModel190Declarations,
  fetchModel190Validations,
  generateModel190Declaration,
  model190FileUrl,
} from "../../services/model190Service";

function money(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function dateText(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function typeText(value) {
  return { ordinary: "Ordinaria", complementary: "Complementaria", substitutive: "Sustitutiva" }[value] || value;
}

function openFile(declarationId, format) {
  window.open(model190FileUrl(declarationId, format), "_blank", "noopener,noreferrer");
}

export default function Model190DeclarationsPanel({ companies = [] }) {
  const activeCompanies = useMemo(() => companies.filter((company) => company.is_active), [companies]);
  const [companyId, setCompanyId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [declarationType, setDeclarationType] = useState("ordinary");
  const [originalId, setOriginalId] = useState("");
  const [declarations, setDeclarations] = useState([]);
  const [validations, setValidations] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!companyId && activeCompanies.length) setCompanyId(String(activeCompanies[0].id));
  }, [activeCompanies, companyId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setBusy(true);
    setError("");
    try {
      const request = { companyId, year };
      const [nextDeclarations, nextValidations] = await Promise.all([
        fetchModel190Declarations(request),
        fetchModel190Validations(request),
      ]);
      setDeclarations(nextDeclarations);
      setValidations(nextValidations);
    } catch (requestError) {
      setError(requestError?.message || "No se han podido cargar las declaraciones del Modelo 190");
    } finally {
      setBusy(false);
    }
  }, [companyId, year]);

  useEffect(() => { load(); }, [load]);

  const ordinary = declarations.find((item) => item.declaration_type === "ordinary" && item.status !== "cancelled");
  const availableOriginals = declarations.filter((item) => item.locked && item.status !== "cancelled");

  useEffect(() => {
    if (declarationType === "ordinary") {
      setOriginalId("");
      return;
    }
    if (!originalId && availableOriginals.length) setOriginalId(String(availableOriginals[0].id));
  }, [availableOriginals, declarationType, originalId]);

  async function generate() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await generateModel190Declaration({
        company_id: Number(companyId),
        year: Number(year),
        declaration_type: declarationType,
        original_declaration_id: declarationType === "ordinary" ? null : Number(originalId),
      });
      setMessage(`Declaración ${typeText(result.declaration_type).toLowerCase()} congelada con ${result.total_recipients} líneas de perceptor.`);
      await load();
    } catch (requestError) {
      setError(requestError?.message || "No se ha podido generar la declaración anual");
    } finally {
      setBusy(false);
    }
  }

  const hasBlockingErrors = Number(validations?.counts?.error || 0) > 0;
  const canGenerate = Boolean(
    companyId
      && !busy
      && validations?.is_valid
      && (declarationType !== "ordinary" || !ordinary)
      && (declarationType === "ordinary" || originalId)
  );

  return (
    <section style={styles.workspace}>
      <header style={styles.header}>
        <div>
          <span style={styles.eyebrow}>DECLARACIONES Y FICHEROS</span>
          <h2 style={styles.title}>Congelación anual del Modelo 190</h2>
          <p style={styles.description}>Cada generación conserva sus perceptores, líneas, validaciones, conciliación y ficheros aunque cambien después las operaciones originales.</p>
        </div>
        <span style={styles.simulation}>SIMULACIÓN EDUCATIVA · NO PRESENTABLE</span>
      </header>

      <div style={styles.toolbar}>
        <label style={styles.control}>Empresa
          <select style={styles.input} value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
            <option value="">Selecciona</option>
            {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name} · {company.cif}</option>)}
          </select>
        </label>
        <label style={styles.control}>Ejercicio
          <input style={styles.yearInput} type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} />
        </label>
        <label style={styles.control}>Tipo
          <select style={styles.input} value={declarationType} onChange={(event) => setDeclarationType(event.target.value)}>
            <option value="ordinary">Ordinaria</option>
            <option value="complementary">Complementaria</option>
            <option value="substitutive">Sustitutiva</option>
          </select>
        </label>
        {declarationType !== "ordinary" ? (
          <label style={styles.control}>Declaración original
            <select style={styles.input} value={originalId} onChange={(event) => setOriginalId(event.target.value)}>
              <option value="">Selecciona</option>
              {availableOriginals.map((item) => <option key={item.id} value={item.id}>#{item.id} · {typeText(item.declaration_type)} · {dateText(item.generated_at)}</option>)}
            </select>
          </label>
        ) : null}
        <button type="button" style={styles.secondary} disabled={busy || !companyId} onClick={load}>{busy ? "Revisando…" : "Revisar"}</button>
        <button type="button" style={{ ...styles.primary, opacity: canGenerate ? 1 : 0.45 }} disabled={!canGenerate} onClick={generate}>Generar y congelar</button>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}
      {message ? <div style={styles.success}>{message}</div> : null}

      <div style={hasBlockingErrors ? styles.validationError : styles.validationOk}>
        <b>{hasBlockingErrors ? "Generación bloqueada" : "Validación estructural superada"}</b>
        <span>{validations ? `${validations.counts.error} errores · ${validations.counts.warning} avisos · ${validations.counts.information} informaciones` : "Pendiente de revisión"}</span>
        {ordinary && declarationType === "ordinary" ? <small>Ya existe una ordinaria no cancelada para este ejercicio. Genera una complementaria o sustitutiva.</small> : null}
      </div>

      <div style={styles.tableScroll}>
        <table style={styles.table}>
          <thead>
            <tr><th>ID</th><th>Tipo</th><th>Estado</th><th>Generada</th><th>Perceptores</th><th>Percepciones</th><th>Retenciones</th><th>Ficheros congelados</th></tr>
          </thead>
          <tbody>
            {declarations.length ? declarations.map((item) => {
              const fixed = item.file_metadata?.fixed_width;
              const readable = item.file_metadata?.readable;
              return (
                <tr key={item.id}>
                  <td><b>#{item.id}</b>{item.original_declaration_id ? <small style={styles.note}>Original #{item.original_declaration_id}</small> : null}</td>
                  <td>{typeText(item.declaration_type)}</td>
                  <td><span style={styles.status}>{item.status}</span></td>
                  <td>{dateText(item.generated_at)}</td>
                  <td>{item.total_recipients}</td>
                  <td>{money(item.total_cash_income)}</td>
                  <td>{money(item.total_withholding)}</td>
                  <td>
                    <div style={styles.fileActions}>
                      <button type="button" style={styles.fileButton} onClick={() => openFile(item.id, "readable")}>TXT legible</button>
                      <button type="button" style={styles.fileButton} onClick={() => openFile(item.id, "fixed_width")}>Registro fijo</button>
                    </div>
                    <small style={styles.note}>{fixed?.record_count || 0} registros · {fixed?.record_length || 250} posiciones · {fixed?.validation_errors?.length || 0} errores de fichero</small>
                    <small style={styles.hash}>SHA {String(fixed?.sha256 || readable?.sha256 || "—").slice(0, 16)}…</small>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan="8" style={styles.empty}>No hay declaraciones congeladas para la empresa y el ejercicio.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const border = "2px solid #111111";
const styles = {
  workspace: { display: "grid", gap: "16px", marginBottom: "26px", padding: "20px", border, background: "#fffcde", boxShadow: "4px 4px 0 #111111" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" },
  eyebrow: { display: "block", marginBottom: "5px", fontSize: "10px", fontWeight: 950, letterSpacing: "0.12em" },
  title: { margin: 0, fontSize: "22px" },
  description: { maxWidth: "760px", margin: "7px 0 0", color: "#4b5563", fontSize: "13px", lineHeight: 1.45 },
  simulation: { padding: "7px 10px", border, background: "#111111", color: "#fff37a", fontSize: "10px", fontWeight: 950, letterSpacing: "0.06em", whiteSpace: "nowrap" },
  toolbar: { display: "flex", flexWrap: "wrap", alignItems: "end", gap: "12px", padding: "14px", border, background: "#fff8a6" },
  control: { display: "grid", gap: "5px", minWidth: "170px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  input: { height: "38px", padding: "0 10px", border, background: "#ffffff", fontSize: "13px", fontWeight: 700 },
  yearInput: { width: "110px", height: "38px", padding: "0 10px", border, fontSize: "13px", fontWeight: 750 },
  primary: { height: "38px", padding: "0 15px", border, background: "#111111", color: "#fff37a", fontWeight: 950, cursor: "pointer" },
  secondary: { height: "38px", padding: "0 14px", border, background: "#ffffff", fontWeight: 900, cursor: "pointer" },
  error: { padding: "11px 13px", border: "1px solid #991b1b", background: "#fee2e2", color: "#991b1b", fontWeight: 800 },
  success: { padding: "11px 13px", border: "1px solid #3f6212", background: "#ecfccb", color: "#365314", fontWeight: 800 },
  validationOk: { display: "grid", gap: "3px", padding: "11px 13px", border: "1px solid #3f6212", background: "#ecfccb" },
  validationError: { display: "grid", gap: "3px", padding: "11px 13px", border: "1px solid #991b1b", background: "#fee2e2" },
  tableScroll: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", background: "#ffffff", fontSize: "12px" },
  note: { display: "block", marginTop: "4px", color: "#6b7280", fontSize: "10px" },
  hash: { display: "block", marginTop: "3px", color: "#4b5563", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "9px" },
  status: { display: "inline-block", padding: "4px 7px", border: "1px solid #111111", background: "#f8f3b5", fontWeight: 900, textTransform: "uppercase", fontSize: "9px" },
  fileActions: { display: "flex", flexWrap: "wrap", gap: "6px" },
  fileButton: { padding: "5px 8px", border: "1px solid #111111", background: "#fff8a6", fontWeight: 850, cursor: "pointer", fontSize: "11px" },
  empty: { padding: "24px", textAlign: "center", color: "#6b7280" },
};
