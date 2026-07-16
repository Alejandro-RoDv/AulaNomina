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
import "./craFilesPage.css";

const TABS = [
  { id: "generate", label: "Generar CRA", hint: "Asistente mensual" },
  { id: "files", label: "Ficheros y envíos", hint: "Revisión y SILTRA" },
  { id: "configuration", label: "Configuración conceptos", hint: "Parametrización maestra" },
];

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
    GENERATED: "Pendiente de envío",
    SENT: "Enviado",
    PROCESSING: "Procesando",
    ACCEPTED: "Aceptado",
    ACCEPTED_WITH_WARNINGS: "Aceptado con avisos",
    REJECTED: "Rechazado",
  }[status] || status || "-";
}

function statusTone(status) {
  if (status === "ACCEPTED") return "success";
  if (status === "ACCEPTED_WITH_WARNINGS") return "warning";
  if (status === "REJECTED") return "danger";
  if (status === "GENERATED") return "pending";
  return "neutral";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function formatPeriod(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return value || "-";
  const [year, month] = value.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
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

function Metric({ label, value, hint, tone = "default" }) {
  return (
    <div className={`cra-metric cra-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function StatusPill({ status }) {
  return <span className={`cra-status cra-status--${statusTone(status)}`}>{statusLabel(status)}</span>;
}

function WizardStep({ number, title, description, state }) {
  return (
    <div className={`cra-wizard-step cra-wizard-step--${state}`}>
      <span className="cra-wizard-step__number">{state === "done" ? "✓" : number}</span>
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
    </div>
  );
}

export default function CraFilesPage({ companies = [] }) {
  const activeCompanies = useMemo(
    () => companies.filter((company) => company.is_active !== false),
    [companies]
  );
  const [activeTab, setActiveTab] = useState("generate");
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
  const [bulkSaving, setBulkSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewSearch, setPreviewSearch] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [conceptSearch, setConceptSearch] = useState("");
  const [mappingFilter, setMappingFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedConceptIds, setSelectedConceptIds] = useState([]);
  const [bulkCraCode, setBulkCraCode] = useState("");
  const [bulkIndicator, setBulkIndicator] = useState("I");
  const [bulkActive, setBulkActive] = useState(true);

  useEffect(() => subscribeSelectedCompany(setCompanyId), []);

  useEffect(() => {
    if (!companyId && activeCompanies.length) setSelectedCompanyId(activeCompanies[0].id);
  }, [activeCompanies, companyId]);

  async function loadStaticData() {
    try {
      const [catalogData, conceptData, mappingData] = await Promise.all([
        fetchCraCatalog(),
        fetchPayrollConcepts(true),
        fetchCraMappings(true),
      ]);
      const earningConcepts = (conceptData || []).filter((concept) => concept.concept_type === "DEVENGO");
      const mappingByConcept = (mappingData || []).reduce(
        (acc, item) => ({ ...acc, [item.payroll_concept_id]: item }),
        {}
      );
      setCatalog(catalogData || []);
      setConcepts(earningConcepts);
      setMappings(mappingData || []);
      setDrafts(earningConcepts.reduce((acc, concept) => ({
        ...acc,
        [concept.id]: mappingDraft(mappingByConcept[concept.id], catalogData || []),
      }), {}));
    } catch (requestError) {
      setError(requestError.message || "No se pudo cargar la configuración CRA.");
    }
  }

  useEffect(() => {
    loadStaticData();
  }, []);

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
      setCccId((current) => (
        (cccData || []).some((item) => String(item.ccc_id) === String(current))
          ? current
          : cccData?.[0]?.ccc_id || ""
      ));
    } catch (requestError) {
      setError(requestError.message || "No se pudieron cargar los CCC y ficheros CRA.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPreview(null);
    setSelectedFileId(null);
    loadCompanyData();
  }, [companyId]);

  const mappingByConcept = useMemo(
    () => mappings.reduce((acc, item) => ({ ...acc, [item.payroll_concept_id]: item }), {}),
    [mappings]
  );

  const mappedCount = useMemo(
    () => concepts.filter((concept) => mappingByConcept[concept.id]?.cra_code && mappingByConcept[concept.id]?.is_active).length,
    [concepts, mappingByConcept]
  );
  const inactiveCount = useMemo(
    () => concepts.filter((concept) => mappingByConcept[concept.id]?.cra_code && !mappingByConcept[concept.id]?.is_active).length,
    [concepts, mappingByConcept]
  );
  const unmappedCount = Math.max(concepts.length - mappedCount - inactiveCount, 0);

  const categories = useMemo(
    () => [...new Set(concepts.map((concept) => concept.category).filter(Boolean))].sort(),
    [concepts]
  );

  const previewRows = useMemo(() => {
    if (!preview?.workers) return [];
    return preview.workers.flatMap((worker) => worker.records.map((record, index) => ({
      ...record,
      rowKey: `${worker.payroll_id}-${record.cra_code}-${record.base_indicator}-${index}`,
      payroll_id: worker.payroll_id,
      employee_name: worker.employee_name,
      naf: worker.naf,
      worker_total: worker.total_amount,
    })));
  }, [preview]);

  const filteredPreviewRows = useMemo(() => {
    const query = previewSearch.trim().toLowerCase();
    if (!query) return previewRows;
    return previewRows.filter((row) => [
      row.employee_name,
      row.naf,
      row.cra_code,
      row.cra_name,
      row.payroll_id,
    ].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [previewRows, previewSearch]);

  const filteredFiles = useMemo(() => {
    const query = fileSearch.trim().toLowerCase();
    if (!query) return files;
    return files.filter((file) => [
      file.original_filename,
      file.period,
      file.ccc_id,
      statusLabel(file.status),
      file.response_code,
    ].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [files, fileSearch]);

  const selectedFile = useMemo(
    () => files.find((file) => String(file.id) === String(selectedFileId)) || null,
    [files, selectedFileId]
  );

  const currentContextFile = useMemo(
    () => files.find((file) => String(file.ccc_id) === String(cccId) && file.period === period) || null,
    [cccId, files, period]
  );

  const filteredConcepts = useMemo(() => {
    const query = conceptSearch.trim().toLowerCase();
    return concepts.filter((concept) => {
      const mapping = mappingByConcept[concept.id];
      const matchesSearch = !query || [concept.name, concept.code, concept.category]
        .some((value) => String(value || "").toLowerCase().includes(query));
      const matchesCategory = categoryFilter === "all" || concept.category === categoryFilter;
      const hasCode = Boolean(mapping?.cra_code);
      const isActive = Boolean(mapping?.is_active);
      const matchesStatus = mappingFilter === "all"
        || (mappingFilter === "mapped" && hasCode && isActive)
        || (mappingFilter === "unmapped" && !hasCode)
        || (mappingFilter === "inactive" && hasCode && !isActive);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, conceptSearch, concepts, mappingByConcept, mappingFilter]);

  const fileStats = useMemo(() => ({
    total: files.length,
    pending: files.filter((file) => file.status === "GENERATED").length,
    accepted: files.filter((file) => file.status === "ACCEPTED").length,
    rejected: files.filter((file) => file.status === "REJECTED").length,
  }), [files]);

  const bulkAllowedIndicators = useMemo(
    () => catalog.find((item) => item.code === bulkCraCode)?.allowed_indicators || ["I", "E"],
    [bulkCraCode, catalog]
  );

  useEffect(() => {
    if (!bulkAllowedIndicators.includes(bulkIndicator)) setBulkIndicator(bulkAllowedIndicators[0]);
  }, [bulkAllowedIndicators, bulkIndicator]);

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

  async function refreshMappings() {
    const mappingData = await fetchCraMappings(true);
    const byConcept = (mappingData || []).reduce(
      (acc, item) => ({ ...acc, [item.payroll_concept_id]: item }),
      {}
    );
    setMappings(mappingData || []);
    setDrafts((current) => concepts.reduce((acc, concept) => ({
      ...acc,
      [concept.id]: mappingDraft(byConcept[concept.id] || current[concept.id], catalog),
    }), {}));
    setPreview(null);
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
      await refreshMappings();
      setMessage("Vinculación CRA actualizada.");
    } catch (requestError) {
      setError(requestError.message || "No se pudo guardar la vinculación CRA.");
    } finally {
      setMappingBusyId(null);
    }
  }

  async function saveBulkMappings() {
    if (!selectedConceptIds.length) {
      setError("Selecciona al menos un concepto de nómina.");
      return;
    }
    if (!bulkCraCode) {
      setError("Selecciona la clave CRA que se aplicará a los conceptos marcados.");
      return;
    }
    setBulkSaving(true);
    setError("");
    setMessage("");
    try {
      await Promise.all(selectedConceptIds.map((conceptId) => saveCraMapping(conceptId, {
        cra_code: bulkCraCode,
        base_indicator: bulkIndicator,
        is_active: bulkActive,
        notes: "Asignación masiva desde el asistente CRA",
      })));
      await refreshMappings();
      setMessage(`${selectedConceptIds.length} conceptos actualizados mediante asignación masiva.`);
      setSelectedConceptIds([]);
    } catch (requestError) {
      setError(requestError.message || "No se pudo completar la asignación masiva.");
    } finally {
      setBulkSaving(false);
    }
  }

  function toggleConcept(conceptId) {
    setSelectedConceptIds((current) => (
      current.includes(conceptId)
        ? current.filter((id) => id !== conceptId)
        : [...current, conceptId]
    ));
  }

  function toggleAllFilteredConcepts() {
    const filteredIds = filteredConcepts.map((concept) => concept.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedConceptIds.includes(id));
    setSelectedConceptIds((current) => (
      allSelected
        ? current.filter((id) => !filteredIds.includes(id))
        : [...new Set([...current, ...filteredIds])]
    ));
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
      setPreviewSearch("");
    } catch (requestError) {
      setError(requestError.message || "No se pudo preparar el CRA.");
    } finally {
      setBusy(false);
    }
  }

  async function createFile() {
    if (!companyId || !cccId || !period) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await generateCra({ company_id: Number(companyId), ccc_id: cccId, period });
      setPreview(result.preview);
      await loadCompanyData();
      setSelectedFileId(result.file.id);
      setMessage(`Fichero ${result.file.original_filename} generado y disponible para su envío.`);
      setActiveTab("files");
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
      setSelectedFileId(file.id);
      await loadCompanyData();
    } catch (requestError) {
      setError(requestError.message || "No se pudo enviar el CRA por SILTRA simulado.");
    } finally {
      setBusy(false);
    }
  }

  function downloadFile(file) {
    if (!file?.content) {
      setError("El fichero no tiene contenido disponible para descargar.");
      return;
    }
    const blob = new Blob([file.content], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.original_filename || `CRA_${file.period || "fichero"}.xml`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function resetProcess() {
    setPreview(null);
    setPreviewSearch("");
    setMessage("");
    setError("");
    setActiveTab("generate");
  }

  const wizardState = currentContextFile?.status === "ACCEPTED"
    ? 4
    : currentContextFile?.status === "GENERATED"
      ? 3
      : preview
        ? 2
        : 1;

  return (
    <div className="cra-workspace">
      <section className="cra-hero">
        <div>
          <span className="cra-eyebrow">Seguridad Social · Conceptos retributivos abonados</span>
          <h2>Proceso CRA</h2>
          <p>Configura los conceptos una sola vez, genera el fichero desde las nóminas calculadas, revísalo y envíalo por SILTRA simulado.</p>
        </div>
        <div className="cra-hero__summary">
          <div><span>Conceptos configurados</span><strong>{mappedCount}/{concepts.length}</strong></div>
          <div><span>Ficheros pendientes</span><strong>{fileStats.pending}</strong></div>
        </div>
      </section>

      <nav className="cra-tabs" aria-label="Secciones del proceso CRA">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "cra-tab cra-tab--active" : "cra-tab"}
            onClick={() => {
              setActiveTab(tab.id);
              setError("");
              setMessage("");
            }}
          >
            <strong>{tab.label}</strong>
            <small>{tab.hint}</small>
          </button>
        ))}
      </nav>

      {error && <div className="cra-alert cra-alert--error">{error}</div>}
      {message && <div className="cra-alert cra-alert--success">{message}</div>}

      {activeTab === "generate" && (
        <>
          <div className="cra-wizard">
            <WizardStep number="1" title="Parámetros" description="Empresa, CCC y periodo" state={wizardState > 1 ? "done" : wizardState === 1 ? "active" : "pending"} />
            <WizardStep number="2" title="Revisión" description="Trabajadores y conceptos" state={wizardState > 2 ? "done" : wizardState === 2 ? "active" : "pending"} />
            <WizardStep number="3" title="Fichero" description="Generación del XML" state={wizardState > 3 ? "done" : wizardState === 3 ? "active" : "pending"} />
            <WizardStep number="4" title="SILTRA" description="Envío y respuesta" state={wizardState === 4 ? "done" : "pending"} />
          </div>

          <PageCard title="1. Parámetros del proceso" subtitle="En los ERP laborales, el CRA se genera después de calcular las nóminas del periodo.">
            <div className="cra-form-grid">
              <label className="cra-field">
                <span>Empresa</span>
                <select value={companyId} onChange={changeCompany}>
                  <option value="">Seleccionar empresa</option>
                  {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </label>
              <label className="cra-field">
                <span>Código de cuenta de cotización</span>
                <select
                  value={cccId}
                  onChange={(event) => {
                    setCccId(event.target.value);
                    setPreview(null);
                  }}
                  disabled={!companyId}
                >
                  <option value="">Seleccionar CCC</option>
                  {cccOptions.map((option) => (
                    <option key={option.ccc_id} value={option.ccc_id}>
                      {option.ccc_id} · {option.label || option.center_name || "Empresa"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cra-field">
                <span>Ejercicio y mes</span>
                <input
                  type="month"
                  value={period}
                  onChange={(event) => {
                    setPeriod(event.target.value);
                    setPreview(null);
                  }}
                />
              </label>
              <label className="cra-field">
                <span>Tipo de liquidación</span>
                <select defaultValue="NORMAL">
                  <option value="NORMAL">Mes normal</option>
                  <option value="ATRASOS" disabled>Atrasos · próxima ampliación</option>
                </select>
              </label>
              <label className="cra-field">
                <span>Tipo de actuación</span>
                <select defaultValue="A">
                  <option value="A">Alta · primera comunicación</option>
                  <option value="M" disabled>Modificación · próxima ampliación</option>
                  <option value="C" disabled>Complementaria · próxima ampliación</option>
                  <option value="B" disabled>Baja · próxima ampliación</option>
                </select>
              </label>
            </div>

            <div className="cra-check-panel">
              <div className="cra-check-panel__item">
                <span className="cra-check-icon">1</span>
                <div><strong>Nóminas calculadas</strong><small>El asistente buscará nóminas del mes y CCC seleccionados.</small></div>
              </div>
              <div className="cra-check-panel__item">
                <span className={unmappedCount ? "cra-check-icon cra-check-icon--warning" : "cra-check-icon cra-check-icon--ok"}>{unmappedCount ? "!" : "✓"}</span>
                <div><strong>Conceptos configurados: {mappedCount} de {concepts.length}</strong><small>{unmappedCount ? `${unmappedCount} conceptos todavía no tienen clave CRA.` : "Todos los conceptos de devengo tienen tratamiento CRA."}</small></div>
              </div>
              {unmappedCount > 0 && (
                <button type="button" className="cra-link-button" onClick={() => setActiveTab("configuration")}>Revisar configuración</button>
              )}
            </div>

            <div className="cra-action-bar">
              <span>El proceso no modifica las nóminas; solo prepara la comunicación CRA.</span>
              <button type="button" className="cra-button cra-button--primary" onClick={calculatePreview} disabled={busy || loading || !cccId || !period}>
                {busy ? "Preparando..." : "Siguiente: revisar datos"}
              </button>
            </div>
          </PageCard>

          {preview && (
            <PageCard title="2. Revisión del fichero" subtitle="Comprueba el resultado antes de generar el XML. Los importes proceden de las líneas de nómina.">
              <div className="cra-metrics">
                <Metric label="Nóminas incluidas" value={preview.payroll_count} hint={formatPeriod(period)} />
                <Metric label="Trabajadores" value={preview.worker_count} hint={cccId} />
                <Metric label="Registros CRA" value={preview.record_count} />
                <Metric label="Importe comunicado" value={money(preview.total_amount)} tone="highlight" />
              </div>

              {!!preview.warnings?.length && (
                <div className="cra-review-box cra-review-box--warning">
                  <strong>Comprobaciones del asistente</strong>
                  {preview.warnings.map((warning) => <span key={warning}>{warning}</span>)}
                </div>
              )}

              {!!preview.unmapped_concepts?.length && (
                <div className="cra-review-box cra-review-box--danger">
                  <div>
                    <strong>Conceptos sin tratamiento CRA</strong>
                    <span>No se incluirán en el fichero hasta que se les asigne una clave.</span>
                  </div>
                  {preview.unmapped_concepts.map((item) => (
                    <span key={item.payroll_concept_id}>{item.concept_code || "SIN_CODIGO"} · {item.concept_name}: {money(item.amount)}</span>
                  ))}
                  <button type="button" className="cra-link-button" onClick={() => setActiveTab("configuration")}>Abrir configuración de conceptos</button>
                </div>
              )}

              <div className="cra-table-toolbar">
                <div>
                  <strong>Detalle a comunicar</strong>
                  <small>{filteredPreviewRows.length} líneas visibles</small>
                </div>
                <input
                  type="search"
                  value={previewSearch}
                  onChange={(event) => setPreviewSearch(event.target.value)}
                  placeholder="Buscar trabajador, NAF o clave CRA"
                />
              </div>

              <div className="cra-table-wrap">
                <table className="cra-table">
                  <thead>
                    <tr>
                      <th>Trabajador</th>
                      <th>NAF</th>
                      <th>Nómina</th>
                      <th>Clave CRA</th>
                      <th>Tratamiento</th>
                      <th className="cra-table__number">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPreviewRows.map((row) => (
                      <tr key={row.rowKey}>
                        <td><strong>{row.employee_name}</strong></td>
                        <td>{row.naf || <span className="cra-text-warning">Sin NAF</span>}</td>
                        <td>#{row.payroll_id}</td>
                        <td><strong>{row.cra_code}</strong><small>{row.cra_name}</small></td>
                        <td>{row.base_indicator === "I" ? "Incluido en base" : "Excluido de base"}</td>
                        <td className="cra-table__number"><strong>{money(row.amount)}</strong></td>
                      </tr>
                    ))}
                    {!filteredPreviewRows.length && (
                      <tr><td colSpan="6" className="cra-empty">No hay registros que coincidan con la búsqueda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="cra-action-bar">
                <button type="button" className="cra-button cra-button--secondary" onClick={() => setPreview(null)}>Volver a parámetros</button>
                <div className="cra-action-bar__right">
                  <span>{preview.unmapped_concepts?.length ? "Puedes generar el fichero, pero los conceptos sin clave quedarán fuera." : "La revisión está preparada para generar."}</span>
                  <button type="button" className="cra-button cra-button--primary" onClick={createFile} disabled={busy || !preview.worker_count}>
                    {busy ? "Generando..." : "Generar fichero CRA"}
                  </button>
                </div>
              </div>
            </PageCard>
          )}
        </>
      )}

      {activeTab === "files" && (
        <>
          <PageCard title="Ficheros CRA y comunicaciones" subtitle="Editor, descarga y envío a SILTRA simulado. Esta área equivale al gestor de ficheros de un ERP laboral.">
            <div className="cra-metrics">
              <Metric label="Ficheros" value={fileStats.total} />
              <Metric label="Pendientes de envío" value={fileStats.pending} tone={fileStats.pending ? "warning" : "default"} />
              <Metric label="Aceptados" value={fileStats.accepted} tone="success" />
              <Metric label="Rechazados" value={fileStats.rejected} tone={fileStats.rejected ? "danger" : "default"} />
            </div>

            <div className="cra-table-toolbar">
              <div>
                <strong>Historial de ficheros</strong>
                <small>{files.length} fichero(s) de la empresa seleccionada</small>
              </div>
              <div className="cra-toolbar-actions">
                <input
                  type="search"
                  value={fileSearch}
                  onChange={(event) => setFileSearch(event.target.value)}
                  placeholder="Buscar fichero, periodo o estado"
                />
                <button type="button" className="cra-button cra-button--secondary" onClick={resetProcess}>Nuevo fichero</button>
              </div>
            </div>

            <div className="cra-table-wrap">
              <table className="cra-table cra-table--files">
                <thead>
                  <tr>
                    <th>Fichero</th>
                    <th>Periodo</th>
                    <th>CCC</th>
                    <th>Contenido</th>
                    <th>Generado</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file) => (
                    <tr key={file.id} className={String(file.id) === String(selectedFileId) ? "cra-table__selected" : ""}>
                      <td><strong>{file.original_filename}</strong><small>{file.response_code ? `${file.response_code} · ${file.response_message}` : "Sin respuesta SILTRA"}</small></td>
                      <td>{formatPeriod(file.period)}</td>
                      <td>{file.ccc_id}</td>
                      <td>{file.metadata?.worker_count || 0} trabajadores<small>{file.metadata?.record_count || 0} registros CRA</small></td>
                      <td>{formatDate(file.generated_at)}</td>
                      <td><StatusPill status={file.status} /></td>
                      <td>
                        <div className="cra-row-actions">
                          <button type="button" className="cra-button cra-button--small cra-button--secondary" onClick={() => setSelectedFileId(file.id)}>Revisar</button>
                          <button type="button" className="cra-button cra-button--small cra-button--secondary" onClick={() => downloadFile(file)}>Descargar</button>
                          {file.status === "GENERATED" && (
                            <button type="button" className="cra-button cra-button--small cra-button--send" onClick={() => sendFile(file)} disabled={busy}>
                              Enviar a SILTRA
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredFiles.length && (
                    <tr><td colSpan="7" className="cra-empty">No hay ficheros CRA para los filtros seleccionados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </PageCard>

          {selectedFile && (
            <PageCard title={`Editor del fichero · ${selectedFile.original_filename}`} subtitle="Consulta el contenido generado y la respuesta asociada antes o después de enviarlo.">
              <div className="cra-file-inspector">
                <div className="cra-file-inspector__summary">
                  <div><span>Empresa</span><strong>{activeCompanies.find((company) => String(company.id) === String(companyId))?.name || "-"}</strong></div>
                  <div><span>Periodo</span><strong>{formatPeriod(selectedFile.period)}</strong></div>
                  <div><span>CCC</span><strong>{selectedFile.ccc_id}</strong></div>
                  <div><span>Estado</span><StatusPill status={selectedFile.status} /></div>
                  <div><span>Respuesta</span><strong>{selectedFile.response_code ? `${selectedFile.response_code} · ${selectedFile.response_message}` : "Pendiente"}</strong></div>
                </div>
                <pre>{selectedFile.content || "Contenido XML no disponible en la respuesta del servidor."}</pre>
                <div className="cra-action-bar">
                  <button type="button" className="cra-button cra-button--secondary" onClick={() => downloadFile(selectedFile)}>Descargar XML</button>
                  {selectedFile.status === "GENERATED" && (
                    <button type="button" className="cra-button cra-button--send" onClick={() => sendFile(selectedFile)} disabled={busy}>
                      {busy ? "Enviando..." : "Enviar fichero a SILTRA"}
                    </button>
                  )}
                </div>
              </div>
            </PageCard>
          )}
        </>
      )}

      {activeTab === "configuration" && (
        <PageCard title="Configuración maestra de conceptos CRA" subtitle="Asigna una clave CRA a cada concepto de devengo. Esta parametrización se reutiliza en todos los procesos mensuales.">
          <div className="cra-config-intro">
            <div>
              <strong>Orden recomendado</strong>
              <ol>
                <li>Revisar conceptos sin asignar.</li>
                <li>Aplicar una clave CRA y el indicador incluido/excluido.</li>
                <li>Guardar la configuración antes de generar el mes.</li>
              </ol>
            </div>
            <button type="button" className="cra-button cra-button--primary" onClick={() => setActiveTab("generate")}>Volver al asistente mensual</button>
          </div>

          <div className="cra-metrics cra-metrics--compact">
            <Metric label="Conceptos de devengo" value={concepts.length} />
            <Metric label="Configurados y activos" value={mappedCount} tone="success" />
            <Metric label="Sin asignar" value={unmappedCount} tone={unmappedCount ? "danger" : "default"} />
            <Metric label="Inactivos" value={inactiveCount} tone={inactiveCount ? "warning" : "default"} />
          </div>

          <div className="cra-config-filters">
            <label className="cra-field">
              <span>Buscar concepto</span>
              <input type="search" value={conceptSearch} onChange={(event) => setConceptSearch(event.target.value)} placeholder="Nombre, código o categoría" />
            </label>
            <label className="cra-field">
              <span>Estado</span>
              <select value={mappingFilter} onChange={(event) => setMappingFilter(event.target.value)}>
                <option value="all">Todos</option>
                <option value="unmapped">Sin asignar</option>
                <option value="mapped">Configurados</option>
                <option value="inactive">Inactivos</option>
              </select>
            </label>
            <label className="cra-field">
              <span>Categoría</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">Todas</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
          </div>

          <section className="cra-bulk-panel">
            <div className="cra-bulk-panel__title">
              <div><strong>Asistente de asignación masiva</strong><small>{selectedConceptIds.length} concepto(s) seleccionado(s)</small></div>
              <button type="button" className="cra-link-button" onClick={() => setSelectedConceptIds([])} disabled={!selectedConceptIds.length}>Limpiar selección</button>
            </div>
            <div className="cra-bulk-panel__fields">
              <label className="cra-field cra-field--wide">
                <span>Clave CRA</span>
                <select value={bulkCraCode} onChange={(event) => setBulkCraCode(event.target.value)}>
                  <option value="">Seleccionar clave</option>
                  {catalog.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
                </select>
              </label>
              <label className="cra-field">
                <span>Indicador</span>
                <select value={bulkIndicator} onChange={(event) => setBulkIndicator(event.target.value)} disabled={!bulkCraCode}>
                  {bulkAllowedIndicators.map((indicator) => (
                    <option key={indicator} value={indicator}>{indicator === "I" ? "I · Incluido" : "E · Excluido"}</option>
                  ))}
                </select>
              </label>
              <label className="cra-checkbox-field">
                <input type="checkbox" checked={bulkActive} onChange={(event) => setBulkActive(event.target.checked)} />
                <span>Asignación activa</span>
              </label>
              <button type="button" className="cra-button cra-button--primary" onClick={saveBulkMappings} disabled={bulkSaving || !selectedConceptIds.length || !bulkCraCode}>
                {bulkSaving ? "Aplicando..." : "Aplicar a seleccionados"}
              </button>
            </div>
          </section>

          <div className="cra-table-toolbar">
            <div>
              <strong>Conceptos salariales</strong>
              <small>{filteredConcepts.length} concepto(s) visibles</small>
            </div>
            <button type="button" className="cra-button cra-button--secondary" onClick={toggleAllFilteredConcepts}>
              {filteredConcepts.length > 0 && filteredConcepts.every((concept) => selectedConceptIds.includes(concept.id)) ? "Desmarcar visibles" : "Seleccionar visibles"}
            </button>
          </div>

          <div className="cra-table-wrap cra-table-wrap--tall">
            <table className="cra-table cra-table--configuration">
              <thead>
                <tr>
                  <th className="cra-table__check"><input type="checkbox" aria-label="Seleccionar conceptos visibles" checked={filteredConcepts.length > 0 && filteredConcepts.every((concept) => selectedConceptIds.includes(concept.id))} onChange={toggleAllFilteredConcepts} /></th>
                  <th>Concepto de nómina</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Clave CRA</th>
                  <th>Indicador</th>
                  <th>Activo</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredConcepts.map((concept) => {
                  const draft = drafts[concept.id] || mappingDraft(null, catalog);
                  const savedMapping = mappingByConcept[concept.id];
                  const allowed = catalog.find((item) => item.code === draft.cra_code)?.allowed_indicators || ["I", "E"];
                  const state = !savedMapping?.cra_code ? "unmapped" : savedMapping.is_active ? "mapped" : "inactive";
                  return (
                    <tr key={concept.id} className={state === "unmapped" ? "cra-table__attention" : ""}>
                      <td className="cra-table__check"><input type="checkbox" checked={selectedConceptIds.includes(concept.id)} onChange={() => toggleConcept(concept.id)} /></td>
                      <td><strong>{concept.name}</strong><small>{concept.code}</small></td>
                      <td>{concept.category || "Sin categoría"}</td>
                      <td><span className={`cra-config-state cra-config-state--${state}`}>{state === "mapped" ? "Configurado" : state === "inactive" ? "Inactivo" : "Sin asignar"}</span></td>
                      <td>
                        <select value={draft.cra_code} onChange={(event) => changeDraft(concept.id, { cra_code: event.target.value })}>
                          <option value="">Sin comunicar</option>
                          {catalog.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={draft.base_indicator || "I"} onChange={(event) => changeDraft(concept.id, { base_indicator: event.target.value })} disabled={!draft.cra_code}>
                          {allowed.map((indicator) => <option key={indicator} value={indicator}>{indicator === "I" ? "I · Incluido" : "E · Excluido"}</option>)}
                        </select>
                      </td>
                      <td className="cra-table__check"><input type="checkbox" checked={draft.is_active !== false} onChange={(event) => changeDraft(concept.id, { is_active: event.target.checked })} /></td>
                      <td><button type="button" className="cra-button cra-button--small cra-button--primary" onClick={() => saveMapping(concept.id)} disabled={mappingBusyId === concept.id || !draft.cra_code}>{mappingBusyId === concept.id ? "Guardando..." : "Guardar"}</button></td>
                    </tr>
                  );
                })}
                {!filteredConcepts.length && (
                  <tr><td colSpan="8" className="cra-empty">No hay conceptos que coincidan con los filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </PageCard>
      )}
    </div>
  );
}
