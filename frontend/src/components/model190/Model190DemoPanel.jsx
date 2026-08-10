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
          <button type="button" style={styles.secondary} disabled={busy} onClick={correct}>
            {busy ? "Corrigiendo…" : "Corregir error y conciliar 2T"}
          </button>
        ) : null}
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}
      {message ? <div style={styles.success}>{message}</div> : null}

      <div style={styles.explanation}>
        <div style={styles.explanationCopy}>
          <b>{meta.description}</b>
          <span>{status?.next_action || "Prepara el escenario para comenzar la práctica."}</span>
        </div>
        <strong style={styles.progress}>{completion.total ? `${completion.completed}/${completion.total}` : "0/8"}</strong>
      </div>

      {company ? (
        <div style={styles.companyBanner}>
          <div style={styles.companyLabel}>
            <span>Empresa del escenario</span>
            <small>Utiliza esta empresa y el ejercicio 2026 en los espacios de cierre anual.</small>
          </div>
          <b>{company.name} · {company.cif}</b>
        </div>
      ) : null}

      {status?.checks?.length ? (
        <div style={styles.checkGrid}>
          {status.checks.map((check) => (
            <article key={check.id} style={check.completed ? styles.checkDone : styles.checkPending}>
              <span
                style={{
                  ...styles.checkMark,
                  ...(check.completed ? styles.checkMarkDone : styles.checkMarkPending),
                }}
              >
                {check.completed ? "✓" : "!"}
              </span>
              <div style={styles.checkCopy}>
                <b>{check.label}</b>
                {check.state ? (
                  <small style={styles.checkState}>
                    {check.state === "pending" ? "Pendiente de corrección" : "Corregido"}
                  </small>
                ) : null}
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
          <article style={styles.metric}><span>Líneas anuales</span><strong>{status.preview.recipients}</strong></article>
          <article style={styles.metric}><span>NIF únicos</span><strong>{status.preview.unique_nifs}</strong></article>
          <article style={styles.metric}><span>Percepciones</span><strong>{money(status.preview.cash_income)}</strong></article>
          <article style={styles.metric}><span>Retenciones</span><strong>{money(status.preview.withholding)}</strong></article>
        </div>
      ) : null}

      {status?.validation ? (
        <div style={styles.diagnosticGrid}>
          <div style={status.validation.is_valid ? styles.diagnosticOk : styles.diagnosticError}>
            <div style={styles.diagnosticHeading}>
              <b>{status.validation.is_valid ? "Validación superada" : "Generación bloqueada"}</b>
              <span aria-hidden="true">›</span>
            </div>
            <span>
              {status.validation.counts.error} errores · {status.validation.counts.warning} avisos · {status.validation.counts.information} informaciones
            </span>
            {!status.validation.is_valid ? <small>{status.validation.codes.join(" · ")}</small> : null}
          </div>
          <div style={status.reconciliation?.is_balanced ? styles.diagnosticOk : styles.diagnosticError}>
            <div style={styles.diagnosticHeading}>
              <b>{status.reconciliation?.is_balanced ? "111/190 conciliados" : "Diferencia anual detectada"}</b>
              <span aria-hidden="true">›</span>
            </div>
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

const border = "1px solid #dbe3ee";
const styles = {
  panel: {
    display: "grid",
    gap: "14px",
    marginBottom: "26px",
    padding: "20px",
    border,
    borderRadius: "11px",
    background: "#ffffff",
    boxShadow: "none",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    paddingBottom: "14px",
    borderBottom: "1px solid #e5ebf2",
  },
  eyebrow: {
    display: "block",
    marginBottom: "6px",
    color: "#64748b",
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: ".08em",
  },
  title: { margin: 0, color: "#172033", fontSize: "23px", letterSpacing: "-.02em" },
  description: { maxWidth: "780px", margin: "7px 0 0", color: "#64748b", lineHeight: 1.45 },
  stage: {
    padding: "6px 9px",
    border,
    borderRadius: "6px",
    fontSize: "9px",
    fontWeight: 900,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  stageNeutral: { background: "#f8fafc", color: "#475569" },
  stageWarning: { borderColor: "#f3d19b", background: "#fffaf1", color: "#9a5b00" },
  stageSuccess: { borderColor: "#b7dfc7", background: "#f7fcf8", color: "#167044" },
  selectorRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "end",
    gap: "10px",
    padding: "14px 16px",
    border,
    borderRadius: "9px",
    background: "#f8fafc",
  },
  control: {
    display: "grid",
    flex: "1 1 330px",
    gap: "5px",
    color: "#475569",
    fontSize: "10px",
    fontWeight: 850,
    textTransform: "uppercase",
  },
  select: {
    height: "39px",
    padding: "0 10px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    background: "#ffffff",
    color: "#172033",
    fontWeight: 700,
  },
  primary: {
    height: "39px",
    padding: "0 14px",
    border: "1px solid #2563eb",
    borderRadius: "7px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 850,
    cursor: "pointer",
  },
  secondary: {
    height: "39px",
    padding: "0 13px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 800,
    cursor: "pointer",
  },
  error: {
    padding: "10px 12px",
    border: "1px solid #f1c2c2",
    borderRadius: "7px",
    background: "#fff8f8",
    color: "#991b1b",
    fontWeight: 750,
  },
  success: {
    padding: "10px 12px",
    border: "1px solid #b7dfc7",
    borderRadius: "7px",
    background: "#f7fcf8",
    color: "#167044",
    fontWeight: 750,
  },
  explanation: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    padding: "12px 14px",
    border,
    borderRadius: "8px",
    background: "#ffffff",
  },
  explanationCopy: { display: "flex", flexWrap: "wrap", gap: "4px" },
  progress: { color: "#172033", whiteSpace: "nowrap" },
  companyBanner: {
    display: "grid",
    gridTemplateColumns: "minmax(150px, 220px) 1fr",
    gap: "10px 16px",
    alignItems: "start",
    padding: "14px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    background: "#fafaf9",
    color: "#334155",
  },
  companyLabel: { display: "grid", gap: "5px", color: "#475569" },
  checkGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "9px" },
  checkDone: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    minHeight: "58px",
    padding: "10px 11px",
    border: "1px solid #cfe6d7",
    borderRadius: "7px",
    background: "#fbfefc",
  },
  checkPending: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    minHeight: "58px",
    padding: "10px 11px",
    border: "1px solid #f3d19b",
    borderRadius: "7px",
    background: "#fffaf3",
  },
  checkMark: {
    display: "grid",
    flex: "0 0 22px",
    placeItems: "center",
    width: "22px",
    height: "22px",
    border: "1px solid #cbd5e1",
    borderRadius: "5px",
    background: "#ffffff",
    fontSize: "13px",
    fontWeight: 900,
  },
  checkMarkDone: { borderColor: "#9ecdb0", color: "#167044" },
  checkMarkPending: { borderColor: "#efbf73", color: "#b56c00" },
  checkCopy: { display: "grid", gap: "3px", minWidth: 0, color: "#172033" },
  checkState: { color: "#64748b", fontSize: "10px", fontWeight: 500 },
  empty: {
    padding: "16px",
    border: "1px dashed #cbd5e1",
    borderRadius: "8px",
    background: "#f8fafc",
    color: "#64748b",
    textAlign: "center",
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
    gap: "0",
    paddingTop: "2px",
  },
  metric: {
    display: "flex",
    alignItems: "baseline",
    gap: "4px",
    padding: "8px 14px 8px 0",
    color: "#334155",
  },
  diagnosticGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "10px" },
  diagnosticHeading: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" },
  diagnosticOk: {
    display: "grid",
    gap: "4px",
    padding: "12px 14px",
    border: "1px solid #b7dfc7",
    borderRadius: "8px",
    background: "#f7fcf8",
    color: "#334155",
  },
  diagnosticError: {
    display: "grid",
    gap: "4px",
    padding: "12px 14px",
    border: "1px solid #f1c2c2",
    borderRadius: "8px",
    background: "#fff8f8",
    color: "#334155",
  },
  nextStep: {
    padding: "11px 13px",
    border: "1px solid #cfe0fb",
    borderRadius: "8px",
    background: "#f5f9ff",
    color: "#334155",
  },
  completed: {
    padding: "12px 13px",
    border: "1px solid #b7dfc7",
    borderRadius: "8px",
    background: "#f7fcf8",
    color: "#167044",
    fontWeight: 800,
  },
};
