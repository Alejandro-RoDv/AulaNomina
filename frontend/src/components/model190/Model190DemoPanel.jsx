import { useEffect, useMemo, useState } from "react";

import {
  correctModel190Demo,
  fetchModel190DemoStatus,
  seedModel190Demo,
} from "../../services/model190Service";
import {
  model190DemoCanCorrect,
  model190DemoCanPrepare,
  model190DemoCompletion,
  model190DemoStageMeta,
} from "../../utils/model190Demo";

const DEMO_COMPANY_NIF = "B19000026";

function money(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function statusStyle(tone) {
  if (tone === "warning") return styles.stageWarning;
  if (tone === "success") return styles.stageSuccess;
  return styles.stageNeutral;
}

export default function Model190DemoPanel({ companies = [] }) {
  const activeCompanies = useMemo(
    () => companies.filter((company) => company.is_active),
    [companies]
  );
  const existingDemo = useMemo(
    () => activeCompanies.find((company) => company.cif === DEMO_COMPANY_NIF),
    [activeCompanies]
  );
  const [companyId, setCompanyId] = useState("");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!companyId && existingDemo) setCompanyId(String(existingDemo.id));
  }, [companyId, existingDemo]);

  useEffect(() => {
    let active = true;
    async function loadStatus() {
      if (!companyId) {
        setStatus(null);
        return;
      }
      setBusy(true);
      setError("");
      try {
        const result = await fetchModel190DemoStatus(companyId);
        if (active) setStatus(result);
      } catch (requestError) {
        if (active) setError(requestError?.message || "No se ha podido consultar el caso demo");
      } finally {
        if (active) setBusy(false);
      }
    }
    loadStatus();
    return () => { active = false; };
  }, [companyId]);

  async function prepare() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await seedModel190Demo(companyId || null);
      setCompanyId(String(result.company_id));
      setStatus(result);
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError?.message || "No se ha podido preparar el caso demo");
    } finally {
      setBusy(false);
    }
  }

  async function correct() {
    if (!status?.company_id) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await correctModel190Demo(status.company_id);
      setStatus(result);
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError?.message || "No se ha podido corregir el escenario");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (!companyId) return;
    setBusy(true);
    setError("");
    try {
      setStatus(await fetchModel190DemoStatus(companyId));
    } catch (requestError) {
      setError(requestError?.message || "No se ha podido actualizar el progreso");
    } finally {
      setBusy(false);
    }
  }

  const meta = model190DemoStageMeta(status);
  const completion = model190DemoCompletion(status);
  const canPrepare = !status || model190DemoCanPrepare(status);
  const canCorrect = model190DemoCanCorrect(status);
  const company = status?.company;

  return (
    <section style={styles.panel}>
      <header style={styles.header}>
        <div>
          <span style={styles.eyebrow}>CASO PRÁCTICO INTEGRAL · PASO 39.8</span>
          <h2 style={styles.title}>Cierre anual guiado del Modelo 190</h2>
          <p style={styles.description}>
            Escenario reproducible con nóminas, dos contratos, profesional, atrasos,
            regularización negativa, diferencia 111/190, corrección y presentación final.
          </p>
        </div>
        <span style={{ ...styles.stage, ...statusStyle(meta.tone) }}>{meta.label}</span>
      </header>

      <div style={styles.selectorRow}>
        <label style={styles.control}>
          Empresa del caso
          <select
            style={styles.select}
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.target.value);
              setMessage("");
            }}
          >
            <option value="">Crear o reutilizar empresa demo independiente</option>
            {activeCompanies.map((item) => (
              <option key={item.id} value={item.id}>{item.name} · {item.cif}</option>
            ))}
          </select>
        </label>
        <button type="button" style={styles.secondary} disabled={busy || !companyId} onClick={refresh}>
          {busy ? "Actualizando…" : "Actualizar progreso"}
        </button>
        {canPrepare ? (
          <button type="button" style={styles.primary} disabled={busy} onClick={prepare}>
            {busy ? "Preparando…" : "Preparar caso demo completo"}
          </button>
        ) : null}
        {canCorrect ? (
          <button type="button" style={styles.correctButton} disabled={busy} onClick={correct}>
            {busy ? "Corrigiendo…" : "Corregir error y conciliar 2T"}
          </button>
        ) : null}
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}
      {message ? <div style={styles.success}>{message}</div> : null}

      <div style={styles.explanation}>
        <div>
          <b>{meta.description}</b>
          <span>{status?.next_action || "Prepara el escenario para comenzar la práctica."}</span>
        </div>
        <strong>{completion.total ? `${completion.completed}/${completion.total}` : "0/8"}</strong>
      </div>

      {company ? (
        <div style={styles.companyBanner}>
          <span>Empresa del escenario</span>
          <b>{company.name} · {company.cif}</b>
          <small>
            Selecciona esta misma empresa y el ejercicio 2026 en los espacios de cierre anual situados debajo.
          </small>
        </div>
      ) : null}

      {status?.checks?.length ? (
        <div style={styles.checkGrid}>
          {status.checks.map((check) => (
            <article key={check.id} style={check.completed ? styles.checkDone : styles.checkPending}>
              <span style={styles.checkMark}>{check.completed ? "✓" : "!"}</span>
              <div>
                <b>{check.label}</b>
                {check.state ? <small>{check.state === "pending" ? "Pendiente de corrección" : "Corregido"}</small> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div style={styles.empty}>
          La preparación crea una empresa didáctica independiente y no altera declaraciones existentes.
        </div>
      )}

      {status?.preview ? (
        <div style={styles.metrics}>
          <article><span>Líneas anuales</span><strong>{status.preview.recipients}</strong></article>
          <article><span>NIF únicos</span><strong>{status.preview.unique_nifs}</strong></article>
          <article><span>Percepciones</span><strong>{money(status.preview.cash_income)}</strong></article>
          <article><span>Retenciones</span><strong>{money(status.preview.withholding)}</strong></article>
        </div>
      ) : null}

      {status?.validation ? (
        <div style={styles.diagnosticGrid}>
          <div style={status.validation.is_valid ? styles.diagnosticOk : styles.diagnosticError}>
            <b>{status.validation.is_valid ? "Validación superada" : "Generación bloqueada"}</b>
            <span>
              {status.validation.counts.error} errores · {status.validation.counts.warning} avisos · {status.validation.counts.information} informaciones
            </span>
            {!status.validation.is_valid ? <small>{status.validation.codes.join(" · ")}</small> : null}
          </div>
          <div style={status.reconciliation?.is_balanced ? styles.diagnosticOk : styles.diagnosticError}>
            <b>{status.reconciliation?.is_balanced ? "111/190 conciliados" : "Diferencia anual detectada"}</b>
            <span>
              {Object.entries(status.reconciliation?.quarter_status || {})
                .map(([quarter, balanced]) => `${quarter}: ${balanced ? "OK" : "diferencia"}`)
                .join(" · ")}
            </span>
          </div>
        </div>
      ) : null}

      {status?.stage === "ready_to_generate" ? (
        <div style={styles.nextStep}>
          <b>Siguiente acción:</b> genera y congela la ordinaria en el panel inferior. Después completa la importación, firma y presentación simulada.
        </div>
      ) : null}
      {status?.stage === "generated" ? (
        <div style={styles.nextStep}>
          <b>Siguiente acción:</b> abre “Presentar fichero” en el histórico y completa el asistente AEAT.
        </div>
      ) : null}
      {status?.stage === "presented" ? (
        <div style={styles.completed}>
          Caso finalizado. Ya están disponibles justificante, resumen anual, relación nominativa y certificados.
        </div>
      ) : null}
    </section>
  );
}

const border = "2px solid #111111";
const styles = {
  panel: { display: "grid", gap: "15px", marginBottom: "26px", padding: "20px", border, background: "#ffffff", boxShadow: "4px 4px 0 #111111" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" },
  eyebrow: { display: "block", marginBottom: "5px", fontSize: "10px", fontWeight: 950, letterSpacing: ".12em" },
  title: { margin: 0, fontSize: "23px" },
  description: { maxWidth: "780px", margin: "7px 0 0", color: "#4b5563", lineHeight: 1.45 },
  stage: { padding: "8px 11px", border, fontSize: "10px", fontWeight: 950, textTransform: "uppercase", whiteSpace: "nowrap" },
  stageNeutral: { background: "#f3f4f6" },
  stageWarning: { background: "#fed7aa", color: "#7c2d12" },
  stageSuccess: { background: "#d9f99d", color: "#365314" },
  selectorRow: { display: "flex", flexWrap: "wrap", alignItems: "end", gap: "10px", padding: "13px", border, background: "#fff8a6" },
  control: { display: "grid", flex: "1 1 330px", gap: "5px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  select: { height: "39px", padding: "0 10px", border, background: "#fff", fontWeight: 750 },
  primary: { height: "39px", padding: "0 14px", border, background: "#111", color: "#fff37a", fontWeight: 950, cursor: "pointer" },
  correctButton: { height: "39px", padding: "0 14px", border, background: "#f97316", color: "#111", fontWeight: 950, cursor: "pointer" },
  secondary: { height: "39px", padding: "0 13px", border, background: "#fff", fontWeight: 900, cursor: "pointer" },
  error: { padding: "11px 13px", border: "1px solid #991b1b", background: "#fee2e2", color: "#991b1b", fontWeight: 800 },
  success: { padding: "11px 13px", border: "1px solid #3f6212", background: "#ecfccb", color: "#365314", fontWeight: 800 },
  explanation: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", padding: "13px", border, background: "#f9fafb" },
  companyBanner: { display: "grid", gridTemplateColumns: "150px 1fr", gap: "3px 12px", padding: "12px", border: "1px solid #a16207", background: "#fef3c7" },
  checkGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "9px" },
  checkDone: { display: "flex", gap: "9px", alignItems: "center", padding: "10px", border: "1px solid #65a30d", background: "#f7fee7" },
  checkPending: { display: "flex", gap: "9px", alignItems: "center", padding: "10px", border: "1px solid #ea580c", background: "#fff7ed" },
  checkMark: { display: "grid", placeItems: "center", width: "24px", height: "24px", border: "1px solid #111", fontWeight: 950 },
  empty: { padding: "16px", border: "2px dashed #9ca3af", color: "#4b5563", textAlign: "center" },
  metrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "9px" },
  diagnosticGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "10px" },
  diagnosticOk: { display: "grid", gap: "4px", padding: "12px", border: "1px solid #65a30d", background: "#f7fee7" },
  diagnosticError: { display: "grid", gap: "4px", padding: "12px", border: "1px solid #dc2626", background: "#fef2f2" },
  nextStep: { padding: "12px", border, background: "#dbeafe" },
  completed: { padding: "13px", border, background: "#d9f99d", color: "#365314", fontWeight: 900 },
};
