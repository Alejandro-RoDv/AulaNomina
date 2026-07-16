import { useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import {
  fetchCraCatalog,
  fetchCraFiles,
  fetchCraMappings,
  generateCra,
  previewCra,
  saveCraMapping,
  sendCraFile,
} from "../services/craApi";
import { fetchPayrollConcepts } from "../services/payrollApi";
import { fetchCompanyCccOptions } from "../services/socialSecurityApi";
import {
  getSelectedCompanyId,
  setSelectedCompanyId,
  subscribeSelectedCompany,
} from "../utils/companyContext";

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function money(value) {
  return Number(value || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}

function statusLabel(status) {
  return {
    GENERATED: "Generado",
    SENT: "Enviado",
    PROCESSING: "Procesando",
    ACCEPTED: "Aceptado",
    ACCEPTED_WITH_WARNINGS: "Aceptado con avisos",
    REJECTED: "Rechazado",
  }[status] || status || "-";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function mappingDraft(mapping, catalog) {
  const code = mapping?.cra_code || "";
  const allowed = catalog.find((item) => item.code === code)?.allowed_indicators || ["I", "E"];
  return {
    cra_code: code,
    base_indicator: allowed.includes(mapping?.base_indicator) ? mapping.base_indicator : allowed[0],
    is_active: mapping?.is_active !== false,
    notes: mapping?.notes || "",
  };
}

export default function CraFilesPage({ companies = [] }) {
  const activeCompanies = useMemo(() => companies.filter((company) => company.is_active !== false), [companies]);
  const [companyId, setCompanyId] = useState(() => getSelectedCompanyId());
  const [period, setPeriod] = useState(currentPeriod);
  const [cccId, setCccId] = useState("");
  const [cccOptions, setCccOptions] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mappingBusyId, setMappingBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => subscribeSelectedCompany(setCompanyId), []);

  useEffect(() => {
    if (!companyId && activeCompanies.length) {
      setSelectedCompanyId(activeCompanies[0].id);
    }
  }, [activeCompanies, companyId]);

  async function loadStaticData() {
    try {
      const [catalogData, conceptData, mappingData] = await Promise.all([
        fetchCraCatalog(),
        fetchPayrollConcepts(true),
        fetchCraMappings(true),
      ]);
      setCatalog(catalogData || []);
      setConcepts((conceptData || []).filter((concept) => concept.concept_type === "DEVENGO"));
      setMappings(mappingData || []);
      const mappingByConcept = (mappingData || []).reduce((acc, item) => ({ ...acc, [item.payroll_concept_id]: item }), {});
      setDrafts((conceptData || []).reduce((acc, concept) => ({
        ...acc,
        [concept.id]: mappingDraft(mappingByConcept[concept.id], catalogData || []),
      }), {}));
    } catch (requestError) {
      setError(requestError.message || "No se pudo cargar la configuración CRA.");
    }
  }

  useEffect(() => { loadStaticData(); }, []);

  async function loadCompanyData(selectedCompanyId = companyId) {
    if (!selectedCompanyId) {
      setCccOptions([]);
      setFiles([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [cccData, fileData] = await Promise.all([
        fetchCompanyCccOptions(Number(selectedCompanyId)),
        fetchCraFiles({ company_id: Number(selectedCompanyId) }),
      ]);
      setCccOptions(cccData || []);
      setFiles(fileData || []);
      setCccId((current) => (cccData || []).some((item) => String(item.ccc_id) === String(current)) ? current : cccData?.[0]?.ccc_id || "");
    } catch (requestError) {
      setError(requestError.message || "No se pudieron cargar los CCC y ficheros CRA.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPreview(null);
    loadCompanyData();
  }, [companyId]);

  const mappingByConcept = useMemo(
    () => mappings.reduce((acc, item) => ({ ...acc, [item.payroll_concept_id]: item }), {}),
    [mappings]
  );

  function changeCompany(event) {
    setMessage("");
    setError("");
    setSelectedCompanyId(event.target.value);
  }

  function changeDraft(conceptId, patch) {
    setDrafts((current) => {
      const next = { ...(current[conceptId] || {}), ...patch };
      if (patch.cra_code !== undefined) {
        const allowed = catalog.find((item) => item.code === patch.cra_code)?.allowed_indicators || ["I", "E"];
        if (!allowed.includes(next.base_indicator)) next.base_indicator = allowed[0];
      }
      return { ...current, [conceptId]: next };
    });
  }

  async function saveMapping(conceptId) {
    const draft = drafts[conceptId];
    if (!draft?.cra_code) {
      setError("Selecciona una clave CRA antes de guardar.");
      return;
    }
    setMappingBusyId(conceptId);
    setError("");
    setMessage("");
    try {
      await saveCraMapping(conceptId, draft);
      const mappingData = await fetchCraMappings(true);
      setMappings(mappingData || []);
      setPreview(null);
      setMessage("Vinculación CRA actualizada.");
    } catch (requestError) {
      setError(requestError.message || "No se pudo guardar la vinculación CRA.");
    } finally {
      setMappingBusyId(null);
    }
  }

  async function calculatePreview() {
    if (!companyId || !cccId || !period) {
      setError("Selecciona empresa, CCC y periodo.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setPreview(await previewCra({ company_id: Number(companyId), ccc_id: cccId, period }));
    } catch (requestError) {
      setError(requestError.message || "No se pudo preparar el CRA.");
    } finally {
      setBusy(false);
    }
  }

  async function createFile() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await generateCra({ company_id: Number(companyId), ccc_id: cccId, period });
      setPreview(result.preview);
      setMessage(`Fichero ${result.file.original_filename} generado.`);
      await loadCompanyData();
    } catch (requestError) {
      setError(requestError.message || "No se pudo generar el fichero CRA.");
    } finally {
      setBusy(false);
    }
  }

  async function sendFile(file) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await sendCraFile(file.id);
      setMessage(`${result.submission_number}: ${result.response_message}`);
      await loadCompanyData();
    } catch (requestError) {
      setError(requestError.message || "No se pudo enviar el CRA por SILTRA simulado.");
    } finally {
      setBusy(false);
    }
  }

  const mappedCount = concepts.filter((concept) => mappingByConcept[concept.id]?.is_active).length;

  return (
    <div style={styles.wrapper}>
      <PageCard title="Ficheros CRA" subtitle="Comunicación educativa de los conceptos retributivos abonados, generada desde las nóminas y enviada mediante SILTRA simulado.">
        {error && <div style={styles.error}>{error}</div>}
        {message && <div style={styles.success}>{message}</div>}

        <div style={styles.scopeGrid}>
          <label style={styles.field}>Empresa
            <select value={companyId} onChange={changeCompany} style={styles.input}>
              <option value="">Seleccionar empresa</option>
              {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label style={styles.field}>CCC
            <select value={cccId} onChange={(event) => { setCccId(event.target.value); setPreview(null); }} style={styles.input} disabled={!companyId}>
              <option value="">Seleccionar CCC</option>
              {cccOptions.map((option) => <option key={option.ccc_id} value={option.ccc_id}>{option.ccc_id} · {option.label || option.center_name || "Empresa"}</option>)}
            </select>
          </label>
          <label style={styles.field}>Periodo de liquidación
            <input type="month" value={period} onChange={(event) => { setPeriod(event.target.value); setPreview(null); }} style={styles.input} />
          </label>
          <div style={styles.scopeActions}>
            <button type="button" onClick={calculatePreview} disabled={busy || loading || !cccId} style={styles.primaryButton}>{busy ? "Procesando..." : "Preparar CRA"}</button>
          </div>
        </div>

        <div style={styles.infoBox}>
          <strong>Flujo simplificado:</strong> AulaNomina toma los devengos de las nóminas, los agrupa por trabajador y clave CRA, genera un XML educativo con segmentos DDE, TRB y CRE y simula su aceptación en SILTRA.
        </div>
      </PageCard>

      {preview && (
        <PageCard title="Vista previa del fichero" subtitle="Revisa el desglose antes de generar el CRA.">
          <div style={styles.kpiGrid}>
            <Metric label="Nóminas" value={preview.payroll_count} />
            <Metric label="Trabajadores" value={preview.worker_count} />
            <Metric label="Registros CRA" value={preview.record_count} />
            <Metric label="Importe comunicado" value={money(preview.total_amount)} strong />
          </div>
          {preview.warnings?.map((warning) => <div key={warning} style={styles.warning}>{warning}</div>)}
          {!!preview.unmapped_concepts?.length && (
            <div style={styles.unmappedBox}>
              <strong>Conceptos sin vinculación CRA</strong>
              {preview.unmapped_concepts.map((item) => <span key={item.payroll_concept_id}>{item.concept_code || "SIN_CODIGO"} · {item.concept_name}: {money(item.amount)}</span>)}
            </div>
          )}
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>Trabajador</th><th style={styles.th}>NAF</th><th style={styles.th}>Nómina</th><th style={styles.th}>Conceptos CRA</th><th style={styles.thRight}>Total</th></tr></thead>
              <tbody>
                {preview.workers.map((worker) => (
                  <tr key={worker.payroll_id}>
                    <td style={styles.td}><strong>{worker.employee_name}</strong></td>
                    <td style={styles.td}>{worker.naf || "Sin NAF"}</td>
                    <td style={styles.td}>#{worker.payroll_id}</td>
                    <td style={styles.td}>{worker.records.map((record) => <div key={`${record.cra_code}-${record.base_indicator}`}>{record.cra_code} · {record.base_indicator} · {record.cra_name} · <strong>{money(record.amount)}</strong></div>)}</td>
                    <td style={styles.tdRight}>{money(worker.total_amount)}</td>
                  </tr>
                ))}
                {!preview.workers.length && <tr><td colSpan="5" style={styles.empty}>No hay registros comunicables.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={styles.actions}><button type="button" onClick={createFile} disabled={busy || !preview.worker_count} style={styles.primaryButton}>Generar fichero CRA</button></div>
        </PageCard>
      )}

      <PageCard title="Vinculación con conceptos de nómina" subtitle={`${mappedCount} de ${concepts.length} conceptos de devengo tienen una asignación CRA activa.`}>
        <div style={styles.mappingHelp}>Los conceptos ordinarios se asignan inicialmente de forma automática. Revisa especialmente dietas, kilometraje, indemnizaciones, retribución en especie y cualquier concepto personalizado.</div>
        <div style={styles.tableWrapTall}>
          <table style={{ ...styles.table, minWidth: "980px" }}>
            <thead><tr><th style={styles.th}>Concepto de nómina</th><th style={styles.th}>Categoría</th><th style={styles.th}>Clave CRA</th><th style={styles.th}>Indicador</th><th style={styles.th}>Activo</th><th style={styles.th}>Acción</th></tr></thead>
            <tbody>
              {concepts.map((concept) => {
                const draft = drafts[concept.id] || mappingDraft(null, catalog);
                const allowed = catalog.find((item) => item.code === draft.cra_code)?.allowed_indicators || ["I", "E"];
                return (
                  <tr key={concept.id}>
                    <td style={styles.td}><strong>{concept.name}</strong><span style={styles.code}>{concept.code}</span></td>
                    <td style={styles.td}>{concept.category}</td>
                    <td style={styles.td}><select value={draft.cra_code} onChange={(event) => changeDraft(concept.id, { cra_code: event.target.value })} style={styles.inputCompact}><option value="">Sin comunicar</option>{catalog.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></td>
                    <td style={styles.td}><select value={draft.base_indicator || "I"} onChange={(event) => changeDraft(concept.id, { base_indicator: event.target.value })} style={styles.inputCompact} disabled={!draft.cra_code}>{allowed.map((indicator) => <option key={indicator} value={indicator}>{indicator === "I" ? "I · Incluido" : "E · Excluido"}</option>)}</select></td>
                    <td style={styles.td}><input type="checkbox" checked={draft.is_active !== false} onChange={(event) => changeDraft(concept.id, { is_active: event.target.checked })} /></td>
                    <td style={styles.td}><button type="button" onClick={() => saveMapping(concept.id)} disabled={mappingBusyId === concept.id || !draft.cra_code} style={styles.smallButton}>{mappingBusyId === concept.id ? "Guardando..." : "Guardar"}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageCard>

      <PageCard title="Ficheros generados y envíos" subtitle="El envío produce una respuesta RCA simulada y marca el fichero como aceptado.">
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Fichero</th><th style={styles.th}>CCC</th><th style={styles.th}>Periodo</th><th style={styles.th}>Generado</th><th style={styles.th}>Estado</th><th style={styles.th}>Respuesta</th><th style={styles.th}>Acción</th></tr></thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id}>
                  <td style={styles.td}><strong>{file.original_filename}</strong><span style={styles.code}>{file.metadata?.worker_count || 0} trabajadores · {file.metadata?.record_count || 0} registros</span></td>
                  <td style={styles.td}>{file.ccc_id}</td>
                  <td style={styles.td}>{file.period}</td>
                  <td style={styles.td}>{formatDate(file.generated_at)}</td>
                  <td style={styles.td}><span style={file.status === "ACCEPTED" ? styles.statusOk : styles.statusNeutral}>{statusLabel(file.status)}</span></td>
                  <td style={styles.td}>{file.response_code ? `${file.response_code} · ${file.response_message}` : "Pendiente"}</td>
                  <td style={styles.td}>{file.status === "GENERATED" ? <button type="button" onClick={() => sendFile(file)} disabled={busy} style={styles.sendButton}>Enviar por SILTRA</button> : "Enviado"}</td>
                </tr>
              ))}
              {!files.length && <tr><td colSpan="7" style={styles.empty}>No hay ficheros CRA generados para esta empresa.</td></tr>}
            </tbody>
          </table>
        </div>
      </PageCard>
    </div>
  );
}

function Metric({ label, value, strong = false }) {
  return <div style={styles.metric}><span>{label}</span><strong style={strong ? styles.metricStrong : undefined}>{value}</strong></div>;
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  scopeGrid: { display: "grid", gridTemplateColumns: "1.4fr 1.2fr 220px auto", gap: "14px", alignItems: "end" },
  field: { display: "flex", flexDirection: "column", gap: "6px", color: "#374151", fontSize: "12px", fontWeight: 850 },
  input: { minHeight: "40px", border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 10px", backgroundColor: "#fff", fontWeight: 700 },
  inputCompact: { width: "100%", minHeight: "34px", border: "1px solid #d1d5db", borderRadius: "6px", padding: "5px 7px", backgroundColor: "#fff", fontSize: "12px" },
  scopeActions: { display: "flex", alignItems: "end" },
  primaryButton: { minHeight: "40px", border: "1px solid #111827", borderRadius: "8px", backgroundColor: "#111827", color: "#fff", padding: "9px 14px", cursor: "pointer", fontWeight: 900 },
  smallButton: { border: "1px solid #111827", borderRadius: "7px", backgroundColor: "#111827", color: "#fff", padding: "7px 10px", cursor: "pointer", fontWeight: 800 },
  sendButton: { border: "1px solid #1d4ed8", borderRadius: "7px", backgroundColor: "#dbeafe", color: "#1d4ed8", padding: "7px 10px", cursor: "pointer", fontWeight: 900 },
  infoBox: { marginTop: "14px", border: "1px solid #bfdbfe", borderRadius: "10px", backgroundColor: "#eff6ff", color: "#1e3a8a", padding: "12px", fontSize: "13px", lineHeight: 1.45 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px", marginBottom: "14px" },
  metric: { border: "1px solid #d1d5db", borderRadius: "10px", padding: "12px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "4px" },
  metricStrong: { fontSize: "20px", color: "#166534" },
  warning: { marginBottom: "8px", border: "1px solid #fde68a", borderRadius: "8px", backgroundColor: "#fffbeb", color: "#92400e", padding: "9px 11px", fontSize: "12px", fontWeight: 750 },
  unmappedBox: { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px", border: "1px solid #fecaca", borderRadius: "8px", backgroundColor: "#fef2f2", color: "#991b1b", padding: "10px", fontSize: "12px" },
  mappingHelp: { marginBottom: "12px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", padding: "10px", color: "#4b5563", fontSize: "12px", fontWeight: 700 },
  tableWrap: { overflowX: "auto" },
  tableWrapTall: { overflow: "auto", maxHeight: "560px", border: "1px solid #e5e7eb" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "900px", fontSize: "12px" },
  th: { position: "sticky", top: 0, zIndex: 1, textAlign: "left", padding: "10px", borderBottom: "1px solid #d1d5db", backgroundColor: "#f3f4f6", whiteSpace: "nowrap" },
  thRight: { textAlign: "right", padding: "10px", borderBottom: "1px solid #d1d5db", backgroundColor: "#f3f4f6" },
  td: { padding: "10px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
  tdRight: { padding: "10px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", textAlign: "right", fontWeight: 900 },
  code: { display: "block", marginTop: "3px", color: "#6b7280", fontSize: "11px" },
  actions: { display: "flex", justifyContent: "flex-end", marginTop: "14px" },
  statusOk: { display: "inline-block", borderRadius: "999px", padding: "4px 8px", backgroundColor: "#dcfce7", color: "#166534", fontWeight: 900 },
  statusNeutral: { display: "inline-block", borderRadius: "999px", padding: "4px 8px", backgroundColor: "#f3f4f6", color: "#374151", fontWeight: 900 },
  error: { marginBottom: "12px", borderRadius: "8px", backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px" },
  success: { marginBottom: "12px", borderRadius: "8px", backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px" },
  empty: { padding: "18px", textAlign: "center", color: "#6b7280" },
};
