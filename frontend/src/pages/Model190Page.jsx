import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchModel190Preview, fetchModel190Reconciliation } from "../services/model190Service";
import {
  buildModel190Validations,
  filterModel190Recipients,
  recipientDisplayName,
  reconciliationDifferenceTotal,
} from "../utils/model190View";

const TABS = [
  ["summary", "Resumen anual"],
  ["recipients", "Perceptores"],
  ["reconciliation", "Conciliación 111/190"],
  ["validations", "Validaciones"],
];

const CATEGORY_LABELS = {
  work: "Rendimientos del trabajo",
  economic_activity: "Actividades económicas",
};

const SOURCE_LABELS = {
  payroll: "Nóminas",
  professional_invoice: "Facturas profesionales",
  tax_adjustment: "Ajustes fiscales",
  arrears: "Atrasos",
  regularization: "Regularizaciones",
  adjustment: "Ajustes",
};

function money(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function dateText(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short" }).format(new Date(value));
}

function numberText(value) {
  return new Intl.NumberFormat("es-ES").format(Number(value || 0));
}

function Metric({ label, value, note, tone = "neutral" }) {
  return (
    <article style={{ ...styles.metric, ...(tone === "warning" ? styles.metricWarning : {}), ...(tone === "success" ? styles.metricSuccess : {}) }}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      {note ? <small style={styles.metricNote}>{note}</small> : null}
    </article>
  );
}

function StatusPill({ balanced, missing = false }) {
  const label = missing ? "Sin Modelo 111" : balanced ? "Conciliado" : "Con diferencias";
  const style = missing ? styles.pillMissing : balanced ? styles.pillOk : styles.pillWarning;
  return <span style={{ ...styles.pill, ...style }}>{label}</span>;
}

function EmptyState({ title, text }) {
  return (
    <section style={styles.emptyState}>
      <div style={styles.emptyCode}>190</div>
      <div>
        <h2 style={styles.emptyTitle}>{title}</h2>
        <p style={styles.emptyText}>{text}</p>
      </div>
    </section>
  );
}

function RecipientDrawer({ recipient, onClose }) {
  if (!recipient) return null;
  const displayName = recipientDisplayName(recipient);

  return (
    <div style={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <aside style={styles.drawer} role="dialog" aria-modal="true" aria-label={`Detalle de ${displayName}`} onMouseDown={(event) => event.stopPropagation()}>
        <header style={styles.drawerHeader}>
          <div>
            <span style={styles.eyebrow}>PERCEPTOR ANUAL</span>
            <h2 style={styles.drawerTitle}>{displayName}</h2>
            <p style={styles.drawerSubtitle}>{recipient.nif || "Sin NIF"} · {recipient.recipient_type === "professional" ? "Profesional" : "Trabajador"}</p>
          </div>
          <button type="button" style={styles.closeButton} onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <section style={styles.drawerBody}>
          <div style={styles.definitionGrid}>
            <span>Clave / subclave</span><b>{recipient.key || "—"}{recipient.subkey ? ` / ${recipient.subkey}` : ""}</b>
            <span>Ejercicio de devengo</span><b>{recipient.accrual_year || "—"}</b>
            <span>Provincia</span><b>{recipient.province_code || "—"}</b>
            <span>Clasificación</span><b>{recipient.classification_source === "override" ? "Revisada manualmente" : "Automática"}</b>
            <span>Documentos</span><b>{recipient.source_count || recipient.lines?.length || 0}</b>
          </div>

          <div style={styles.drawerMetrics}>
            <Metric label="Percepción dineraria" value={money(recipient.cash_income)} />
            <Metric label="Retenciones" value={money(recipient.cash_withholding)} />
            <Metric label="Gastos deducibles" value={money(recipient.deductible_expenses)} />
            <Metric label="Percepción en especie" value={money(recipient.in_kind_income)} note="Capacidad todavía limitada" />
          </div>

          <section style={styles.drawerSection}>
            <h3 style={styles.sectionTitle}>Documentos de origen</h3>
            {recipient.lines?.length ? (
              <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr><th>Fecha</th><th>Origen</th><th>Trimestre</th><th>Importe</th><th>Retención</th></tr>
                  </thead>
                  <tbody>
                    {recipient.lines.map((line, index) => (
                      <tr key={`${line.source_type}-${line.source_id}-${index}`}>
                        <td>{dateText(line.source_date)}</td>
                        <td><b>{line.source_label || SOURCE_LABELS[line.source_type] || line.source_type}</b><small style={styles.cellNote}>ID {line.source_id || "—"}</small></td>
                        <td>{line.quarter || "—"}</td>
                        <td>{money(line.gross_amount)}</td>
                        <td>{money(line.withholding_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p style={styles.muted}>No hay documentos de origen asociados.</p>}
          </section>
        </section>
      </aside>
    </div>
  );
}

function AnnualComparison({ reconciliation }) {
  const annual = reconciliation?.annual;
  if (!annual) return null;

  return (
    <section style={styles.panel}>
      <div style={styles.panelHead}>
        <div>
          <span style={styles.eyebrow}>CIERRE ANUAL</span>
          <h2 style={styles.panelTitle}>Operaciones del 190 frente a Modelos 111 efectivos</h2>
          <p style={styles.panelDescription}>La comparación utiliza la última declaración presentada de cada trimestre.</p>
        </div>
        <StatusPill balanced={annual.is_balanced} />
      </div>
      <div style={styles.tableScroll}>
        <table style={styles.table}>
          <thead>
            <tr><th>Bloque</th><th>190 · percepciones</th><th>111 · bases</th><th>Diferencia</th><th>190 · retenciones</th><th>111 · retenciones</th><th>Diferencia</th></tr>
          </thead>
          <tbody>
            {Object.keys(CATEGORY_LABELS).map((category) => (
              <tr key={category}>
                <td><b>{CATEGORY_LABELS[category]}</b></td>
                <td>{money(annual.operations[category]?.income)}</td>
                <td>{money(annual.model111[category]?.income)}</td>
                <td style={Number(annual.differences[category]?.income || 0) !== 0 ? styles.differenceCell : undefined}>{money(annual.differences[category]?.income)}</td>
                <td>{money(annual.operations[category]?.withholding)}</td>
                <td>{money(annual.model111[category]?.withholding)}</td>
                <td style={Number(annual.differences[category]?.withholding || 0) !== 0 ? styles.differenceCell : undefined}>{money(annual.differences[category]?.withholding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QuarterWorkspace({ quarter }) {
  if (!quarter) return null;
  const hasDeclaration = Boolean(quarter.declaration);

  return (
    <section style={styles.panel}>
      <div style={styles.panelHead}>
        <div>
          <span style={styles.eyebrow}>{quarter.quarter}</span>
          <h2 style={styles.panelTitle}>Detalle de conciliación trimestral</h2>
          <p style={styles.panelDescription}>
            {hasDeclaration
              ? `Modelo 111 ${quarter.declaration.declaration_type} presentado${quarter.declaration.receipt_number ? ` · ${quarter.declaration.receipt_number}` : ""}`
              : quarter.pending_declaration
                ? "Existe una declaración generada, pero todavía no está presentada."
                : "No existe declaración trimestral para comparar."}
          </p>
        </div>
        <StatusPill balanced={quarter.is_balanced} missing={!hasDeclaration} />
      </div>

      <div style={styles.tableScroll}>
        <table style={styles.table}>
          <thead><tr><th>Bloque</th><th>Operaciones</th><th>Modelo 111</th><th>Diferencia base</th><th>Retención 190</th><th>Retención 111</th><th>Diferencia</th></tr></thead>
          <tbody>
            {Object.keys(CATEGORY_LABELS).map((category) => (
              <tr key={category}>
                <td><b>{CATEGORY_LABELS[category]}</b></td>
                <td>{money(quarter.operations[category]?.income)}</td>
                <td>{money(quarter.model111[category]?.income)}</td>
                <td style={Number(quarter.differences[category]?.income || 0) !== 0 ? styles.differenceCell : undefined}>{money(quarter.differences[category]?.income)}</td>
                <td>{money(quarter.operations[category]?.withholding)}</td>
                <td>{money(quarter.model111[category]?.withholding)}</td>
                <td style={Number(quarter.differences[category]?.withholding || 0) !== 0 ? styles.differenceCell : undefined}>{money(quarter.differences[category]?.withholding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {quarter.alerts?.length ? (
        <div style={styles.alertList}>
          {quarter.alerts.map((alert, index) => (
            <div key={`${alert.code}-${index}`} style={alert.level === "warning" ? styles.alertWarning : styles.alertInfo}>
              <b>{alert.code}</b><span>{alert.message}</span>
            </div>
          ))}
        </div>
      ) : <div style={styles.validBanner}>Sin diferencias ni avisos en el trimestre.</div>}

      <div style={styles.twoColumns}>
        <section style={styles.subPanel}>
          <h3 style={styles.sectionTitle}>Desglose por perceptor</h3>
          {quarter.drill_down?.recipients?.length ? (
            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <thead><tr><th>NIF</th><th>Perceptor</th><th>190</th><th>111</th><th>Diferencia</th></tr></thead>
                <tbody>
                  {quarter.drill_down.recipients.map((item, index) => (
                    <tr key={`${item.category}-${item.nif}-${index}`}>
                      <td>{item.nif || "Sin NIF"}</td>
                      <td><b>{item.name || "—"}</b><small style={styles.cellNote}>{item.category_label}</small></td>
                      <td>{money(item.model190_income)}</td>
                      <td>{money(item.model111_income)}</td>
                      <td style={!item.is_balanced ? styles.differenceCell : undefined}>{money(item.income_difference)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p style={styles.muted}>No hay perceptores en este trimestre.</p>}
        </section>

        <section style={styles.subPanel}>
          <h3 style={styles.sectionTitle}>Documentos no emparejados</h3>
          <p style={styles.documentCount}><b>{quarter.documents?.only_in_model190?.length || 0}</b> solo en 190</p>
          <p style={styles.documentCount}><b>{quarter.documents?.only_in_model111?.length || 0}</b> solo en 111</p>
          <p style={styles.documentCount}><b>{quarter.documents?.amount_differences?.length || 0}</b> con importes distintos</p>
          {[...(quarter.documents?.only_in_model190 || []), ...(quarter.documents?.only_in_model111 || [])].slice(0, 6).map((item, index) => (
            <div key={`${item.origin}-${item.source_type}-${item.source_id}-${index}`} style={styles.documentRow}>
              <div><b>{item.source_label || SOURCE_LABELS[item.source_type] || item.source_type}</b><small style={styles.cellNote}>{item.recipient_nif || "Sin NIF"} · {dateText(item.source_date)}</small></div>
              <span>{item.origin === "model190" ? "Solo 190" : "Solo 111"}</span>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}

export default function Model190Page({ companies = [] }) {
  const activeCompanies = useMemo(() => companies.filter((company) => company.is_active), [companies]);
  const [companyId, setCompanyId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [preview, setPreview] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [tab, setTab] = useState("summary");
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [selectedQuarter, setSelectedQuarter] = useState("1T");
  const [filters, setFilters] = useState({ search: "", key: "", subkey: "", recipientType: "", accrualYear: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyId && activeCompanies.length) setCompanyId(String(activeCompanies[0].id));
  }, [activeCompanies, companyId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setBusy(true);
    setError("");
    try {
      const request = { companyId, year };
      const [nextPreview, nextReconciliation] = await Promise.all([
        fetchModel190Preview(request),
        fetchModel190Reconciliation(request),
      ]);
      setPreview(nextPreview);
      setReconciliation(nextReconciliation);
      setSelectedRecipient(null);
    } catch (requestError) {
      setError(requestError?.message || "No se ha podido cargar el Modelo 190");
    } finally {
      setBusy(false);
    }
  }, [companyId, year]);

  useEffect(() => { load(); }, [load]);

  const validations = useMemo(() => buildModel190Validations(preview, reconciliation), [preview, reconciliation]);
  const recipients = preview?.recipients || [];
  const filteredRecipients = useMemo(() => filterModel190Recipients(recipients, filters), [filters, recipients]);
  const keys = useMemo(() => [...new Set(recipients.map((item) => item.key).filter(Boolean))].sort(), [recipients]);
  const subkeys = useMemo(() => [...new Set(recipients.map((item) => item.subkey).filter(Boolean))].sort(), [recipients]);
  const accrualYears = useMemo(() => [...new Set(recipients.map((item) => item.accrual_year).filter(Boolean))].sort((a, b) => b - a), [recipients]);
  const quarter = reconciliation?.quarters?.find((item) => item.quarter === selectedQuarter);
  const differenceTotal = reconciliationDifferenceTotal(reconciliation);

  return (
    <div style={styles.page}>
      <section style={styles.toolbar}>
        <label style={styles.control}>Empresa
          <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} style={styles.input}>
            <option value="">Selecciona una empresa</option>
            {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name} · {company.cif}</option>)}
          </select>
        </label>
        <label style={styles.control}>Ejercicio
          <input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} style={styles.yearInput} />
        </label>
        <button type="button" style={styles.secondaryButton} disabled={busy || !companyId} onClick={load}>{busy ? "Calculando…" : "Actualizar cálculo"}</button>
      </section>

      <header style={styles.pageHeader}>
        <div>
          <span style={styles.educational}>SIMULACIÓN EDUCATIVA · SIN VALIDEZ FISCAL</span>
          <h1 style={styles.title}>Modelo 190 · Resumen anual de retenciones</h1>
          <p style={styles.subtitle}>{preview ? `${preview.company_name} · Ejercicio ${preview.year}` : "Selecciona empresa y ejercicio"}</p>
        </div>
        {preview ? (
          <div style={validations.isValid ? styles.headerStatusOk : styles.headerStatusError}>
            <b>{validations.isValid ? "Cálculo estructuralmente válido" : "Revisión necesaria"}</b>
            <span>{validations.counts.error} errores · {validations.counts.warning} avisos</span>
          </div>
        ) : null}
      </header>

      {error ? <div style={styles.errorBanner}>{error}</div> : null}

      <nav style={styles.tabs}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" style={tab === id ? styles.tabActive : styles.tab} onClick={() => setTab(id)}>
            {label}{id === "validations" && validations.counts.error + validations.counts.warning > 0 ? ` (${validations.counts.error + validations.counts.warning})` : ""}
          </button>
        ))}
      </nav>

      {!preview && !busy ? <EmptyState title="Selecciona una empresa" text="El espacio anual se construirá con nóminas, facturas profesionales y ajustes confirmados." /> : null}
      {preview && !preview.has_operations ? <EmptyState title="No hay operaciones declarables" text="No existen nóminas cerradas, facturas pagadas ni ajustes confirmados en el ejercicio seleccionado." /> : null}

      {tab === "summary" && preview?.has_operations ? (
        <>
          <section style={styles.metrics}>
            <Metric label="Líneas de perceptor" value={numberText(preview.totals.total_recipients)} note={`${numberText(preview.totals.unique_nifs)} NIF únicos`} />
            <Metric label="Percepciones dinerarias" value={money(preview.totals.total_cash_income)} />
            <Metric label="Retenciones acumuladas" value={money(preview.totals.total_withholding)} />
            <Metric label="Gastos deducibles" value={money(preview.totals.total_deductible_expenses)} />
            <Metric label="Diferencia anual 111/190" value={money(differenceTotal)} tone={differenceTotal === 0 ? "success" : "warning"} />
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <div>
                <span style={styles.eyebrow}>ORIGEN DE DATOS</span>
                <h2 style={styles.panelTitle}>Composición del resumen anual</h2>
                <p style={styles.panelDescription}>Cada importe conserva el vínculo con su nómina, factura, atraso o regularización.</p>
              </div>
              <span style={styles.sourceCounter}>{numberText(preview.source_count)} documentos</span>
            </div>
            <div style={styles.sourceGrid}>
              {preview.source_summary.map((source) => (
                <article key={source.source_type} style={styles.sourceCard}>
                  <span>{SOURCE_LABELS[source.source_type] || source.source_type}</span>
                  <strong>{money(source.gross_amount)}</strong>
                  <small>{source.documents} documentos · Retención {money(source.withholding_amount)}</small>
                </article>
              ))}
            </div>
          </section>

          <AnnualComparison reconciliation={reconciliation} />

          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <div><span style={styles.eyebrow}>MAYORES PERCEPTORES</span><h2 style={styles.panelTitle}>Vista rápida nominativa</h2></div>
              <button type="button" style={styles.linkButton} onClick={() => setTab("recipients")}>Abrir listado completo →</button>
            </div>
            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <thead><tr><th>NIF</th><th>Perceptor</th><th>Clave</th><th>Devengo</th><th>Percepciones</th><th>Retenciones</th><th></th></tr></thead>
                <tbody>
                  {[...recipients].sort((a, b) => Number(b.cash_income) - Number(a.cash_income)).slice(0, 8).map((recipient) => (
                    <tr key={recipient.recipient_key}>
                      <td>{recipient.nif || "Sin NIF"}</td>
                      <td><b>{recipientDisplayName(recipient)}</b><small style={styles.cellNote}>{recipient.recipient_type === "professional" ? "Profesional" : "Trabajador"}</small></td>
                      <td>{recipient.key}{recipient.subkey ? ` / ${recipient.subkey}` : ""}</td>
                      <td>{recipient.accrual_year}</td>
                      <td>{money(recipient.cash_income)}</td>
                      <td>{money(recipient.cash_withholding)}</td>
                      <td><button type="button" style={styles.tableButton} onClick={() => setSelectedRecipient(recipient)}>Ver</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {tab === "recipients" && preview ? (
        <>
          <section style={styles.filterPanel}>
            <label style={{ ...styles.control, ...styles.searchControl }}>Buscar
              <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="NIF, nombre, clave…" style={styles.input} />
            </label>
            <label style={styles.control}>Tipo
              <select value={filters.recipientType} onChange={(event) => setFilters({ ...filters, recipientType: event.target.value })} style={styles.input}>
                <option value="">Todos</option><option value="employee">Trabajadores</option><option value="professional">Profesionales</option>
              </select>
            </label>
            <label style={styles.control}>Clave
              <select value={filters.key} onChange={(event) => setFilters({ ...filters, key: event.target.value })} style={styles.input}><option value="">Todas</option>{keys.map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            <label style={styles.control}>Subclave
              <select value={filters.subkey} onChange={(event) => setFilters({ ...filters, subkey: event.target.value })} style={styles.input}><option value="">Todas</option>{subkeys.map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            <label style={styles.control}>Devengo
              <select value={filters.accrualYear} onChange={(event) => setFilters({ ...filters, accrualYear: event.target.value })} style={styles.input}><option value="">Todos</option>{accrualYears.map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            <button type="button" style={styles.clearButton} onClick={() => setFilters({ search: "", key: "", subkey: "", recipientType: "", accrualYear: "" })}>Limpiar</button>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <div><span style={styles.eyebrow}>RELACIÓN NOMINATIVA</span><h2 style={styles.panelTitle}>{filteredRecipients.length} líneas encontradas</h2></div>
              <span style={styles.sourceCounter}>{recipients.length} totales</span>
            </div>
            {filteredRecipients.length ? (
              <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead><tr><th>NIF</th><th>Perceptor</th><th>Tipo</th><th>Clave</th><th>Devengo</th><th>Percepciones</th><th>Retenciones</th><th>Gastos</th><th>Docs.</th><th></th></tr></thead>
                  <tbody>
                    {filteredRecipients.map((recipient) => (
                      <tr key={recipient.recipient_key}>
                        <td>{recipient.nif || <b style={styles.errorText}>Pendiente</b>}</td>
                        <td><b>{recipientDisplayName(recipient)}</b><small style={styles.cellNote}>{recipient.classification_source === "override" ? "Clasificación revisada" : "Clasificación automática"}</small></td>
                        <td>{recipient.recipient_type === "professional" ? "Profesional" : "Trabajador"}</td>
                        <td><span style={styles.keyBadge}>{recipient.key || "—"}{recipient.subkey ? `-${recipient.subkey}` : ""}</span></td>
                        <td>{recipient.accrual_year || "—"}</td>
                        <td>{money(recipient.cash_income)}</td>
                        <td>{money(recipient.cash_withholding)}</td>
                        <td>{money(recipient.deductible_expenses)}</td>
                        <td>{recipient.source_count}</td>
                        <td><button type="button" style={styles.tableButton} onClick={() => setSelectedRecipient(recipient)}>Abrir</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p style={styles.muted}>No hay perceptores que coincidan con los filtros.</p>}
          </section>
        </>
      ) : null}

      {tab === "reconciliation" && reconciliation ? (
        <>
          <section style={styles.quarterStrip}>
            {reconciliation.quarters.map((item) => (
              <button key={item.quarter} type="button" style={selectedQuarter === item.quarter ? styles.quarterButtonActive : styles.quarterButton} onClick={() => setSelectedQuarter(item.quarter)}>
                <b>{item.quarter}</b><StatusPill balanced={item.is_balanced} missing={!item.declaration} />
                <small>Dif. retención {money(Number(item.differences.work.withholding || 0) + Number(item.differences.economic_activity.withholding || 0))}</small>
              </button>
            ))}
          </section>
          <AnnualComparison reconciliation={reconciliation} />
          <QuarterWorkspace quarter={quarter} />
        </>
      ) : null}

      {tab === "validations" && preview ? (
        <>
          <section style={styles.metrics}>
            <Metric label="Errores bloqueantes" value={validations.counts.error} tone={validations.counts.error ? "warning" : "success"} />
            <Metric label="Avisos" value={validations.counts.warning} tone={validations.counts.warning ? "warning" : "neutral"} />
            <Metric label="Información" value={validations.counts.information} />
            <Metric label="Documentos sin pareja" value={(reconciliation?.unmatched_documents?.only_in_model190?.length || 0) + (reconciliation?.unmatched_documents?.only_in_model111?.length || 0)} />
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <div><span style={styles.eyebrow}>CONTROL PREVIO</span><h2 style={styles.panelTitle}>{validations.isValid ? "Sin errores estructurales" : "Correcciones necesarias"}</h2><p style={styles.panelDescription}>Los avisos de conciliación no bloquean el cálculo, pero deben revisarse antes de generar una declaración.</p></div>
              <span style={validations.isValid ? styles.validationMarkOk : styles.validationMarkError}>{validations.isValid ? "APTO" : "NO APTO"}</span>
            </div>
            {validations.items.length ? (
              <div style={styles.validationList}>
                {validations.items.map((item, index) => (
                  <button
                    type="button"
                    key={`${item.code}-${item.recipientKey || item.quarter || index}`}
                    style={item.level === "error" ? styles.validationError : item.level === "warning" ? styles.validationWarning : styles.validationInfo}
                    onClick={() => {
                      if (!item.recipientKey) return;
                      const recipient = recipients.find((candidate) => candidate.recipient_key === item.recipientKey);
                      if (recipient) setSelectedRecipient(recipient);
                    }}
                  >
                    <span style={styles.validationCode}>{item.code}</span>
                    <span>{item.message}</span>
                    {item.quarter ? <b>{item.quarter}</b> : null}
                  </button>
                ))}
              </div>
            ) : <div style={styles.validBanner}>No se han detectado errores ni avisos.</div>}
          </section>
        </>
      ) : null}

      <RecipientDrawer recipient={selectedRecipient} onClose={() => setSelectedRecipient(null)} />
    </div>
  );
}

const border = "2px solid #111111";
const shadow = "4px 4px 0 #111111";

const styles = {
  page: { display: "grid", gap: "22px", color: "#111111" },
  toolbar: { display: "flex", flexWrap: "wrap", alignItems: "end", gap: "14px", padding: "16px", background: "#fff8a6", border, boxShadow: shadow },
  control: { display: "grid", gap: "6px", minWidth: "190px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em" },
  searchControl: { flex: "1 1 300px" },
  input: { height: "40px", padding: "0 11px", border: "2px solid #111111", background: "#ffffff", color: "#111111", font: "inherit", fontSize: "14px", fontWeight: 650, boxSizing: "border-box" },
  yearInput: { width: "120px", height: "40px", padding: "0 11px", border: "2px solid #111111", fontSize: "14px", fontWeight: 750 },
  secondaryButton: { height: "40px", padding: "0 18px", border, background: "#ffffff", color: "#111111", fontWeight: 900, cursor: "pointer", boxShadow: "2px 2px 0 #111111" },
  clearButton: { height: "40px", padding: "0 14px", border: "1px solid #111111", background: "#f3f4f6", fontWeight: 800, cursor: "pointer" },
  pageHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px", borderBottom: "3px solid #111111", paddingBottom: "18px" },
  educational: { display: "inline-block", padding: "5px 8px", background: "#111111", color: "#fff8a6", fontSize: "11px", fontWeight: 950, letterSpacing: "0.08em" },
  title: { margin: "12px 0 5px", fontSize: "30px", lineHeight: 1.08 },
  subtitle: { margin: 0, color: "#4b5563", fontWeight: 650 },
  headerStatusOk: { display: "grid", gap: "4px", minWidth: "220px", padding: "12px 14px", border, background: "#ecfccb", boxShadow: shadow },
  headerStatusError: { display: "grid", gap: "4px", minWidth: "220px", padding: "12px 14px", border, background: "#fee2e2", boxShadow: shadow },
  errorBanner: { padding: "13px 16px", border, background: "#fee2e2", fontWeight: 800 },
  tabs: { display: "flex", flexWrap: "wrap", gap: "8px", borderBottom: "2px solid #111111", paddingBottom: "8px" },
  tab: { border: "1px solid #111111", background: "#ffffff", padding: "9px 14px", fontWeight: 800, cursor: "pointer" },
  tabActive: { border, background: "#fff37a", padding: "9px 14px", fontWeight: 950, cursor: "pointer", boxShadow: "2px 2px 0 #111111" },
  metrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "14px" },
  metric: { display: "grid", gap: "7px", minHeight: "105px", padding: "16px", border, background: "#ffffff", boxShadow: "3px 3px 0 #111111", boxSizing: "border-box" },
  metricWarning: { background: "#fff1c7" },
  metricSuccess: { background: "#ecfccb" },
  metricLabel: { fontSize: "11px", fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.06em" },
  metricValue: { fontSize: "24px", lineHeight: 1.05 },
  metricNote: { color: "#4b5563", fontWeight: 650 },
  panel: { padding: "20px", border, background: "#ffffff", boxShadow: shadow, minWidth: 0 },
  subPanel: { padding: "16px", border: "1px solid #111111", background: "#fafafa", minWidth: 0 },
  panelHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "18px", marginBottom: "16px" },
  eyebrow: { display: "block", marginBottom: "5px", fontSize: "10px", fontWeight: 950, letterSpacing: "0.12em" },
  panelTitle: { margin: 0, fontSize: "20px" },
  panelDescription: { margin: "6px 0 0", color: "#4b5563", fontSize: "13px", lineHeight: 1.45 },
  sectionTitle: { margin: "0 0 12px", fontSize: "16px" },
  sourceCounter: { padding: "7px 10px", border: "1px solid #111111", background: "#fff8a6", fontSize: "12px", fontWeight: 900, whiteSpace: "nowrap" },
  sourceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px" },
  sourceCard: { display: "grid", gap: "6px", padding: "14px", border: "1px solid #111111", background: "#fffcde" },
  sourceCardStrong: { fontSize: "19px" },
  tableScroll: { overflowX: "auto", width: "100%" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  cellNote: { display: "block", marginTop: "3px", color: "#6b7280", fontSize: "11px" },
  differenceCell: { background: "#fee2e2", color: "#991b1b", fontWeight: 900 },
  linkButton: { border: 0, background: "transparent", fontWeight: 900, textDecoration: "underline", cursor: "pointer" },
  tableButton: { padding: "5px 9px", border: "1px solid #111111", background: "#fff8a6", fontWeight: 850, cursor: "pointer" },
  keyBadge: { display: "inline-block", minWidth: "30px", padding: "4px 7px", border: "1px solid #111111", background: "#fff8a6", textAlign: "center", fontWeight: 950 },
  filterPanel: { display: "flex", flexWrap: "wrap", alignItems: "end", gap: "12px", padding: "15px", border, background: "#f8f3b5" },
  quarterStrip: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" },
  quarterButton: { display: "grid", gap: "8px", textAlign: "left", padding: "13px", border: "1px solid #111111", background: "#ffffff", cursor: "pointer" },
  quarterButtonActive: { display: "grid", gap: "8px", textAlign: "left", padding: "13px", border, background: "#fff8a6", boxShadow: "3px 3px 0 #111111", cursor: "pointer" },
  pill: { display: "inline-flex", width: "fit-content", alignItems: "center", padding: "4px 7px", border: "1px solid #111111", fontSize: "10px", fontWeight: 950, textTransform: "uppercase" },
  pillOk: { background: "#d9f99d" },
  pillWarning: { background: "#fed7aa" },
  pillMissing: { background: "#e5e7eb" },
  alertList: { display: "grid", gap: "8px", margin: "16px 0" },
  alertWarning: { display: "grid", gridTemplateColumns: "minmax(150px, auto) 1fr", gap: "12px", padding: "10px 12px", borderLeft: "5px solid #b45309", background: "#fff7ed" },
  alertInfo: { display: "grid", gridTemplateColumns: "minmax(150px, auto) 1fr", gap: "12px", padding: "10px 12px", borderLeft: "5px solid #1d4ed8", background: "#eff6ff" },
  validBanner: { padding: "12px 14px", border: "1px solid #3f6212", background: "#ecfccb", fontWeight: 800 },
  twoColumns: { display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)", gap: "14px", marginTop: "16px" },
  documentCount: { margin: "7px 0", padding: "8px 10px", border: "1px solid #d1d5db", background: "#ffffff" },
  documentRow: { display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "8px", padding: "8px", borderTop: "1px solid #d1d5db", fontSize: "12px" },
  validationList: { display: "grid", gap: "9px" },
  validationError: { display: "grid", gridTemplateColumns: "180px 1fr auto", gap: "12px", width: "100%", textAlign: "left", padding: "11px", border: "1px solid #991b1b", background: "#fee2e2", cursor: "pointer" },
  validationWarning: { display: "grid", gridTemplateColumns: "180px 1fr auto", gap: "12px", width: "100%", textAlign: "left", padding: "11px", border: "1px solid #b45309", background: "#fff7ed", cursor: "pointer" },
  validationInfo: { display: "grid", gridTemplateColumns: "180px 1fr auto", gap: "12px", width: "100%", textAlign: "left", padding: "11px", border: "1px solid #1d4ed8", background: "#eff6ff", cursor: "pointer" },
  validationCode: { fontSize: "11px", fontWeight: 950 },
  validationMarkOk: { padding: "8px 12px", border, background: "#d9f99d", fontWeight: 950 },
  validationMarkError: { padding: "8px 12px", border, background: "#fecaca", fontWeight: 950 },
  emptyState: { display: "grid", gridTemplateColumns: "100px 1fr", alignItems: "center", gap: "20px", padding: "28px", border, background: "#fffcde", boxShadow: shadow },
  emptyCode: { display: "grid", placeItems: "center", width: "84px", height: "84px", border: "3px solid #111111", background: "#fff37a", fontSize: "27px", fontWeight: 950 },
  emptyTitle: { margin: "0 0 8px" },
  emptyText: { margin: 0, color: "#4b5563", lineHeight: 1.5 },
  muted: { color: "#6b7280" },
  errorText: { color: "#b91c1c" },
  backdrop: { position: "fixed", inset: 0, zIndex: 80, background: "rgba(17, 17, 17, 0.46)", display: "flex", justifyContent: "flex-end" },
  drawer: { width: "min(720px, 92vw)", height: "100vh", overflowY: "auto", background: "#ffffff", borderLeft: "3px solid #111111", boxShadow: "-8px 0 0 rgba(17,17,17,0.2)" },
  drawerHeader: { position: "sticky", top: 0, zIndex: 2, display: "flex", justifyContent: "space-between", gap: "18px", padding: "20px", borderBottom: "3px solid #111111", background: "#fff8a6" },
  drawerTitle: { margin: "5px 0", fontSize: "24px" },
  drawerSubtitle: { margin: 0, color: "#4b5563", fontWeight: 700 },
  closeButton: { width: "38px", height: "38px", border, background: "#ffffff", fontSize: "24px", fontWeight: 900, cursor: "pointer" },
  drawerBody: { display: "grid", gap: "18px", padding: "20px" },
  definitionGrid: { display: "grid", gridTemplateColumns: "minmax(160px, 1fr) 2fr", gap: "8px 14px", padding: "15px", border, background: "#f9fafb" },
  drawerMetrics: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  drawerSection: { padding: "16px", border, background: "#ffffff" },
};
