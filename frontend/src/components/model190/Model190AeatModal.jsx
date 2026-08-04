import { useEffect, useMemo, useState } from "react";

import {
  fetchModel190ImportValidation,
  model190ErrorReportUrl,
  model190FileUrl,
  model190ReceiptUrl,
  presentModel190Declaration,
} from "../../services/model190Service";
import {
  canSignModel190,
  MODEL190_PRESENTATION_STEPS,
  model190ImportSummary,
  model190PresentationStartStep,
} from "../../utils/model190Presentation";

function openExternal(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function dateText(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function typeText(value) {
  return {
    ordinary: "Ordinaria",
    complementary: "Complementaria",
    substitutive: "Sustitutiva",
  }[value] || value;
}

export default function Model190AeatModal({ declaration, onClose, onPresented }) {
  const [current, setCurrent] = useState(declaration);
  const [step, setStep] = useState(() => model190PresentationStartStep(declaration));
  const [report, setReport] = useState(null);
  const [signerName, setSignerName] = useState("");
  const [certificateAlias, setCertificateAlias] = useState("Certificado AulaNomina Demo");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadValidation() {
      setBusy(true);
      setError("");
      try {
        const result = await fetchModel190ImportValidation(declaration.id);
        if (active) setReport(result);
      } catch (requestError) {
        if (active) setError(requestError?.message || "No se ha podido analizar el fichero");
      } finally {
        if (active) setBusy(false);
      }
    }
    loadValidation();
    return () => { active = false; };
  }, [declaration.id]);

  const summary = useMemo(() => model190ImportSummary(report), [report]);
  const canSign = canSignModel190(report, { signerName, confirmed });
  const fixedFile = current.file_metadata?.fixed_width || declaration.file_metadata?.fixed_width || {};

  async function refreshValidation() {
    setBusy(true);
    setError("");
    try {
      const result = await fetchModel190ImportValidation(current.id);
      setReport(result);
      return result;
    } catch (requestError) {
      setError(requestError?.message || "No se ha podido validar el fichero");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function importFile() {
    const result = await refreshValidation();
    if (result) setStep(2);
  }

  async function present() {
    setBusy(true);
    setError("");
    try {
      const result = await presentModel190Declaration(current.id, {
        file_sha256: report.sha256,
        signer_name: signerName.trim(),
        certificate_alias: certificateAlias.trim(),
        confirm_information: confirmed,
      });
      setCurrent(result);
      setStep(5);
      onPresented?.(result);
    } catch (requestError) {
      setError(requestError?.message || "No se ha podido completar el envío simulado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <section
        style={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Sede AEAT simulada del Modelo 190"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header style={styles.header}>
          <div>
            <span style={styles.simulation}>SIMULACIÓN EDUCATIVA · SIN VALIDEZ FISCAL</span>
            <h2 style={styles.title}>Sede AEAT simulada · Modelo 190</h2>
            <p style={styles.subtitle}>Declaración #{current.id} · {typeText(current.declaration_type)} · {current.year}</p>
          </div>
          <button type="button" style={styles.close} onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <nav style={styles.steps}>
          {MODEL190_PRESENTATION_STEPS.map((label, index) => (
            <span key={label} style={index <= step ? styles.stepActive : styles.step}>
              {index + 1}. {label}
            </span>
          ))}
        </nav>

        <main style={styles.body}>
          {error ? <div style={styles.error}>{error}</div> : null}

          {step === 0 ? (
            <section style={styles.section}>
              <span style={styles.eyebrow}>ACCESO</span>
              <h3>Identificación con certificado</h3>
              <p>Se utilizará un certificado ficticio para acceder al entorno formativo.</p>
              <div style={styles.certificate}>
                <b>Certificado AulaNomina Demo</b>
                <span>{current.company_name} · {current.company_nif}</span>
                <small>Representante autorizado en simulación educativa</small>
              </div>
              <button type="button" style={styles.primary} onClick={() => setStep(1)}>Acceder a la presentación</button>
            </section>
          ) : null}

          {step === 1 ? (
            <section style={styles.section}>
              <span style={styles.eyebrow}>IMPORTACIÓN</span>
              <h3>Cargar fichero del Modelo 190</h3>
              <p>La simulación importará el registro fijo congelado. No se recalculan datos vivos durante la presentación.</p>
              <div style={styles.fileCard}>
                <div><b>{report?.filename || fixedFile.filename || "Fichero pendiente"}</b><small>{fixedFile.record_count || report?.expected_records || 0} registros · {fixedFile.record_length || report?.record_length || 250} posiciones</small></div>
                <button type="button" style={styles.secondary} onClick={() => openExternal(model190FileUrl(current.id, "fixed_width"))}>Descargar fichero</button>
              </div>
              <p style={styles.hash}>SHA-256: {report?.sha256 || fixedFile.sha256 || "Calculando…"}</p>
              <button type="button" style={styles.primary} disabled={busy || !report} onClick={importFile}>{busy ? "Importando…" : "Importar fichero"}</button>
            </section>
          ) : null}

          {step === 2 ? (
            <section style={styles.section}>
              <span style={styles.eyebrow}>VALIDACIÓN</span>
              <h3>Resultado de lectura de registros</h3>
              <div style={styles.metrics}>
                <article><span>Leídos</span><strong>{summary.recordsRead}</strong></article>
                <article style={styles.metricOk}><span>Correctos</span><strong>{summary.correctRecords}</strong></article>
                <article style={summary.errorRecords ? styles.metricError : styles.metricOk}><span>Con errores</span><strong>{summary.errorRecords}</strong></article>
              </div>
              <div style={summary.errorRecords ? styles.invalid : styles.valid}>
                <b>{summary.errorRecords ? "El fichero contiene registros rechazados" : "Validación superada"}</b>
                <span>{summary.errorRecords ? "Revisa el detalle antes de volver a AulaNomina." : "El fichero puede pasar a firma y envío simulado."}</span>
              </div>
              <button type="button" style={styles.primary} onClick={() => setStep(3)}>Revisar resultado</button>
            </section>
          ) : null}

          {step === 3 ? (
            <section style={styles.section}>
              <span style={styles.eyebrow}>REVISIÓN DE ERRORES</span>
              <h3>{summary.errorRecords ? `${summary.errorRecords} registros requieren corrección` : "No se han detectado errores"}</h3>
              {report?.errors?.length ? (
                <div style={styles.errorList}>
                  {report.errors.map((item, index) => (
                    <div key={`${item.record}-${item.code}-${index}`} style={styles.errorRow}>
                      <b>Registro {item.record} · {item.code}</b>
                      <span>{item.message}</span>
                      {item.field ? <small>Campo: {item.field}</small> : null}
                    </div>
                  ))}
                </div>
              ) : <div style={styles.valid}>Todos los registros superan las validaciones del simulador.</div>}
              <div style={styles.actions}>
                <button type="button" style={styles.secondary} onClick={() => openExternal(model190ErrorReportUrl(current.id))}>Descargar informe</button>
                {summary.errorRecords ? (
                  <button type="button" style={styles.primary} onClick={onClose}>Volver a AulaNomina</button>
                ) : (
                  <button type="button" style={styles.primary} onClick={() => setStep(4)}>Continuar a firma</button>
                )}
              </div>
            </section>
          ) : null}

          {step === 4 ? (
            <section style={styles.section}>
              <span style={styles.eyebrow}>FIRMA Y ENVÍO</span>
              <h3>Confirmación de la declaración informativa</h3>
              <div style={styles.formGrid}>
                <label>Firmante
                  <input value={signerName} onChange={(event) => setSignerName(event.target.value)} placeholder="Nombre del responsable" />
                </label>
                <label>Certificado
                  <input value={certificateAlias} onChange={(event) => setCertificateAlias(event.target.value)} />
                </label>
              </div>
              <label style={styles.confirmation}>
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                Confirmo la presentación simulada del fichero validado y su relación de perceptores.
              </label>
              <p style={styles.hash}>Fichero firmado: {report?.sha256}</p>
              <button type="button" style={{ ...styles.primary, opacity: canSign && !busy ? 1 : 0.45 }} disabled={!canSign || busy} onClick={present}>
                {busy ? "Firmando y enviando…" : "Firmar y enviar"}
              </button>
            </section>
          ) : null}

          {step === 5 ? (
            <section style={styles.section}>
              <span style={styles.eyebrow}>JUSTIFICANTE</span>
              <h3>Presentación simulada realizada</h3>
              <div style={styles.receipt}>
                <span>Empresa</span><b>{current.company_name}</b>
                <span>Ejercicio</span><b>{current.year}</b>
                <span>Fecha</span><b>{dateText(current.presented_at)}</b>
                <span>Justificante</span><b>{current.receipt_number}</b>
                <span>CSV simulado</span><b>{current.csv}</b>
                <span>Referencia</span><b>{current.presentation_reference}</b>
              </div>
              <div style={styles.valid}>
                <b>Fichero aceptado</b>
                <span>{report?.records_read || current.total_recipients + 1} registros leídos · 0 con errores</span>
              </div>
              <div style={styles.actions}>
                <button type="button" style={styles.secondary} onClick={() => openExternal(model190ReceiptUrl(current.id))}>Abrir justificante</button>
                <button type="button" style={styles.primary} onClick={onClose}>Cerrar</button>
              </div>
            </section>
          ) : null}
        </main>
      </section>
    </div>
  );
}

const border = "2px solid #111111";
const styles = {
  backdrop: { position: "fixed", inset: 0, zIndex: 120, display: "grid", placeItems: "center", padding: "24px", background: "rgba(17,17,17,.58)" },
  modal: { width: "min(920px, 96vw)", maxHeight: "94vh", overflowY: "auto", border: "3px solid #111111", background: "#ffffff", boxShadow: "8px 8px 0 #111111" },
  header: { display: "flex", justifyContent: "space-between", gap: "18px", padding: "20px", borderBottom: "3px solid #111111", background: "#fff8a6" },
  simulation: { display: "inline-block", padding: "5px 8px", background: "#111111", color: "#fff37a", fontSize: "10px", fontWeight: 950, letterSpacing: ".08em" },
  title: { margin: "10px 0 4px", fontSize: "25px" },
  subtitle: { margin: 0, color: "#4b5563", fontWeight: 700 },
  close: { width: "38px", height: "38px", border, background: "#ffffff", fontSize: "23px", fontWeight: 900, cursor: "pointer" },
  steps: { display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", borderBottom: "2px solid #111111", background: "#f3f4f6" },
  step: { padding: "9px 6px", borderRight: "1px solid #9ca3af", color: "#6b7280", fontSize: "10px", fontWeight: 800, textAlign: "center" },
  stepActive: { padding: "9px 6px", borderRight: "1px solid #111111", background: "#fff37a", color: "#111111", fontSize: "10px", fontWeight: 950, textAlign: "center" },
  body: { padding: "22px" },
  section: { display: "grid", gap: "15px" },
  eyebrow: { fontSize: "10px", fontWeight: 950, letterSpacing: ".12em" },
  certificate: { display: "grid", gap: "5px", padding: "16px", border, background: "#f9fafb" },
  fileCard: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "14px", border, background: "#fffcde" },
  hash: { margin: 0, overflowWrap: "anywhere", color: "#4b5563", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "10px" },
  metrics: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" },
  metricOk: { background: "#ecfccb" },
  metricError: { background: "#fee2e2" },
  valid: { display: "grid", gap: "4px", padding: "12px", border: "1px solid #3f6212", background: "#ecfccb" },
  invalid: { display: "grid", gap: "4px", padding: "12px", border: "1px solid #991b1b", background: "#fee2e2" },
  error: { padding: "11px", border: "1px solid #991b1b", background: "#fee2e2", color: "#991b1b", fontWeight: 800 },
  errorList: { display: "grid", gap: "8px", maxHeight: "300px", overflowY: "auto" },
  errorRow: { display: "grid", gridTemplateColumns: "190px 1fr auto", gap: "10px", padding: "10px", borderLeft: "5px solid #b91c1c", background: "#fef2f2" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" },
  confirmation: { display: "flex", alignItems: "flex-start", gap: "9px", padding: "12px", border, background: "#fffcde", fontWeight: 750 },
  receipt: { display: "grid", gridTemplateColumns: "150px 1fr", gap: "7px 12px", padding: "15px", border, background: "#f9fafb" },
  actions: { display: "flex", flexWrap: "wrap", gap: "10px" },
  primary: { width: "fit-content", padding: "10px 15px", border, background: "#111111", color: "#fff37a", fontWeight: 950, cursor: "pointer" },
  secondary: { width: "fit-content", padding: "9px 13px", border, background: "#ffffff", color: "#111111", fontWeight: 900, cursor: "pointer" },
};
