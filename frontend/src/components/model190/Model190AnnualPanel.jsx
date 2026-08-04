import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchModel190Preview, fetchModel190Reconciliation } from "../../services/model190Service";
import {
  buildModel190Validations,
  filterModel190Recipients,
  recipientDisplayName,
  reconciliationDifferenceTotal,
} from "../../utils/model190View";

const SECTIONS = [
  ["summary", "Resumen"],
  ["recipients", "Perceptores"],
  ["reconciliation", "Conciliación"],
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

function numberText(value) {
  return new Intl.NumberFormat("es-ES").format(Number(value || 0));
}

function dateText(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short" }).format(new Date(value));
}

function Status({ ok, children }) {
  return <span className={`m190-annual__status ${ok ? "is-ok" : "is-warning"}`}>{children}</span>;
}

function Metric({ label, value, note, tone = "neutral" }) {
  return (
    <article className={`m190-annual__metric is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

export default function Model190AnnualPanel({ companies = [] }) {
  const activeCompanies = useMemo(
    () => companies.filter((company) => company.is_active),
    [companies]
  );
  const [companyId, setCompanyId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [section, setSection] = useState("summary");
  const [selectedQuarter, setSelectedQuarter] = useState("1T");
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [filters, setFilters] = useState({ search: "", recipientType: "", key: "" });
  const [preview, setPreview] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
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

  const validations = useMemo(
    () => buildModel190Validations(preview, reconciliation),
    [preview, reconciliation]
  );
  const recipients = preview?.recipients || [];
  const filteredRecipients = useMemo(
    () => filterModel190Recipients(recipients, { ...filters, subkey: "", accrualYear: "" }),
    [filters, recipients]
  );
  const keys = useMemo(
    () => [...new Set(recipients.map((item) => item.key).filter(Boolean))].sort(),
    [recipients]
  );
  const annual = reconciliation?.annual;
  const quarter = reconciliation?.quarters?.find((item) => item.quarter === selectedQuarter);
  const differenceTotal = reconciliationDifferenceTotal(reconciliation);
  const relevantValidations = validations.items.filter((item) => item.level !== "information");
  const informationValidations = validations.items.filter((item) => item.level === "information");

  return (
    <section className="m190-annual">
      <div className="m190-annual__toolbar">
        <label>
          <span>Empresa</span>
          <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
            <option value="">Selecciona una empresa</option>
            {activeCompanies.map((company) => (
              <option key={company.id} value={company.id}>{company.name} · {company.cif}</option>
            ))}
          </select>
        </label>
        <label className="m190-annual__year">
          <span>Ejercicio</span>
          <input
            type="number"
            min="2000"
            max="2100"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          />
        </label>
        <button type="button" disabled={busy || !companyId} onClick={load}>
          {busy ? "Calculando…" : "Actualizar"}
        </button>
      </div>

      <div className="m190-annual__heading">
        <div>
          <span className="m190-annual__eyebrow">SIMULACIÓN EDUCATIVA · SIN VALIDEZ FISCAL</span>
          <h2>Resumen anual de retenciones</h2>
          <p>{preview ? `${preview.company_name} · ${preview.year}` : "Selecciona empresa y ejercicio"}</p>
        </div>
        {preview ? (
          <Status ok={validations.isValid}>
            {validations.isValid ? "Cálculo válido" : `${validations.counts.error} errores`}
          </Status>
        ) : null}
      </div>

      {error ? <div className="m190-annual__error">{error}</div> : null}

      <nav className="m190-annual__tabs" aria-label="Secciones del cierre anual">
        {SECTIONS.map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={section === id ? "is-active" : ""}
            onClick={() => setSection(id)}
          >
            {label}
            {id === "validations" && relevantValidations.length ? ` (${relevantValidations.length})` : ""}
          </button>
        ))}
      </nav>

      {!preview && !busy ? (
        <div className="m190-annual__empty">Selecciona una empresa para consultar el cierre anual.</div>
      ) : null}
      {preview && !preview.has_operations ? (
        <div className="m190-annual__empty">No hay operaciones declarables en el ejercicio seleccionado.</div>
      ) : null}

      {section === "summary" && preview?.has_operations ? (
        <div className="m190-annual__section">
          <div className="m190-annual__metrics">
            <Metric
              label="Percepciones"
              value={money(Number(preview.totals.total_cash_income || 0) + Number(preview.totals.total_in_kind_income || 0))}
            />
            <Metric label="Retenciones" value={money(preview.totals.total_withholding)} />
            <Metric
              label="Perceptores"
              value={numberText(preview.totals.total_recipients)}
              note={`${numberText(preview.totals.unique_nifs)} NIF únicos`}
            />
            <Metric
              label="Diferencia 111/190"
              value={money(differenceTotal)}
              tone={differenceTotal === 0 ? "success" : "warning"}
            />
          </div>

          <div className="m190-annual__summary-grid">
            <article className="m190-annual__panel">
              <header>
                <div>
                  <span className="m190-annual__eyebrow">ORIGEN</span>
                  <h3>Composición del cálculo</h3>
                </div>
                <b>{numberText(preview.source_count)} documentos</b>
              </header>
              <div className="m190-annual__source-list">
                {preview.source_summary.map((source) => (
                  <div key={source.source_type}>
                    <span>{SOURCE_LABELS[source.source_type] || source.source_type}</span>
                    <strong>{money(source.gross_amount)}</strong>
                    <small>{source.documents} documentos · {money(source.withholding_amount)} retenidos</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="m190-annual__panel m190-annual__next">
              <span className="m190-annual__eyebrow">ESTADO DEL CIERRE</span>
              <h3>{differenceTotal === 0 ? "Conciliación anual cuadrada" : "Existen diferencias pendientes"}</h3>
              <p>
                {validations.isValid
                  ? "No hay errores estructurales que bloqueen la generación."
                  : "Revisa las validaciones antes de generar la declaración."}
              </p>
              <div className="m190-annual__quick-actions">
                <button type="button" onClick={() => setSection("reconciliation")}>Revisar conciliación</button>
                <button type="button" onClick={() => setSection("validations")}>Abrir validaciones</button>
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {section === "recipients" && preview?.has_operations ? (
        <div className="m190-annual__section">
          <div className="m190-annual__filters">
            <label>
              <span>Buscar</span>
              <input
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                placeholder="NIF o nombre"
              />
            </label>
            <label>
              <span>Tipo</span>
              <select
                value={filters.recipientType}
                onChange={(event) => setFilters({ ...filters, recipientType: event.target.value })}
              >
                <option value="">Todos</option>
                <option value="employee">Trabajadores</option>
                <option value="professional">Profesionales</option>
              </select>
            </label>
            <label>
              <span>Clave</span>
              <select value={filters.key} onChange={(event) => setFilters({ ...filters, key: event.target.value })}>
                <option value="">Todas</option>
                {keys.map((key) => <option key={key}>{key}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => setFilters({ search: "", recipientType: "", key: "" })}>Limpiar</button>
          </div>

          <article className="m190-annual__panel">
            <header>
              <div>
                <span className="m190-annual__eyebrow">RELACIÓN NOMINATIVA</span>
                <h3>{filteredRecipients.length} líneas</h3>
              </div>
            </header>
            <div className="m190-annual__table-wrap">
              <table>
                <thead>
                  <tr><th>NIF</th><th>Perceptor</th><th>Clave</th><th>Devengo</th><th>Percepciones</th><th>Retenciones</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredRecipients.map((recipient) => (
                    <tr key={recipient.recipient_key}>
                      <td>{recipient.nif || "Pendiente"}</td>
                      <td><b>{recipientDisplayName(recipient)}</b><small>{recipient.recipient_type === "professional" ? "Profesional" : "Trabajador"}</small></td>
                      <td>{recipient.key || "—"}{recipient.subkey ? ` / ${recipient.subkey}` : ""}</td>
                      <td>{recipient.accrual_year || "—"}</td>
                      <td>{money(recipient.cash_income)}</td>
                      <td>{money(recipient.cash_withholding)}</td>
                      <td><button type="button" onClick={() => setSelectedRecipient(recipient)}>Detalle</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          {selectedRecipient ? (
            <article className="m190-annual__panel m190-annual__recipient-detail">
              <header>
                <div>
                  <span className="m190-annual__eyebrow">DETALLE</span>
                  <h3>{recipientDisplayName(selectedRecipient)}</h3>
                </div>
                <button type="button" onClick={() => setSelectedRecipient(null)}>Cerrar</button>
              </header>
              <div className="m190-annual__detail-grid">
                <span>NIF</span><b>{selectedRecipient.nif || "—"}</b>
                <span>Clave</span><b>{selectedRecipient.key || "—"}{selectedRecipient.subkey ? ` / ${selectedRecipient.subkey}` : ""}</b>
                <span>Devengo</span><b>{selectedRecipient.accrual_year || "—"}</b>
                <span>Gastos deducibles</span><b>{money(selectedRecipient.deductible_expenses)}</b>
              </div>
              <div className="m190-annual__table-wrap">
                <table>
                  <thead><tr><th>Fecha</th><th>Origen</th><th>Trimestre</th><th>Importe</th><th>Retención</th></tr></thead>
                  <tbody>
                    {(selectedRecipient.lines || []).map((line, index) => (
                      <tr key={`${line.source_type}-${line.source_id}-${index}`}>
                        <td>{dateText(line.source_date)}</td>
                        <td>{line.source_label || SOURCE_LABELS[line.source_type] || line.source_type}</td>
                        <td>{line.quarter || "—"}</td>
                        <td>{money(line.gross_amount)}</td>
                        <td>{money(line.withholding_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ) : null}
        </div>
      ) : null}

      {section === "reconciliation" && reconciliation ? (
        <div className="m190-annual__section">
          <div className="m190-annual__quarters">
            {reconciliation.quarters.map((item) => (
              <button
                type="button"
                key={item.quarter}
                className={selectedQuarter === item.quarter ? "is-active" : ""}
                onClick={() => setSelectedQuarter(item.quarter)}
              >
                <b>{item.quarter}</b>
                <Status ok={item.is_balanced}>{item.is_balanced ? "Conciliado" : "Revisar"}</Status>
              </button>
            ))}
          </div>

          <article className="m190-annual__panel">
            <header>
              <div>
                <span className="m190-annual__eyebrow">CIERRE ANUAL</span>
                <h3>Modelo 190 frente a Modelos 111 efectivos</h3>
              </div>
              <Status ok={Boolean(annual?.is_balanced)}>{annual?.is_balanced ? "Conciliado" : "Con diferencias"}</Status>
            </header>
            <div className="m190-annual__table-wrap">
              <table>
                <thead><tr><th>Bloque</th><th>190 percepciones</th><th>111 bases</th><th>Diferencia</th><th>190 retenciones</th><th>111 retenciones</th><th>Diferencia</th></tr></thead>
                <tbody>
                  {Object.keys(CATEGORY_LABELS).map((category) => (
                    <tr key={category}>
                      <td><b>{CATEGORY_LABELS[category]}</b></td>
                      <td>{money(annual?.operations?.[category]?.income)}</td>
                      <td>{money(annual?.model111?.[category]?.income)}</td>
                      <td>{money(annual?.differences?.[category]?.income)}</td>
                      <td>{money(annual?.operations?.[category]?.withholding)}</td>
                      <td>{money(annual?.model111?.[category]?.withholding)}</td>
                      <td>{money(annual?.differences?.[category]?.withholding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          {quarter ? (
            <article className="m190-annual__panel">
              <header>
                <div>
                  <span className="m190-annual__eyebrow">{quarter.quarter}</span>
                  <h3>Detalle trimestral</h3>
                </div>
                <Status ok={quarter.is_balanced}>{quarter.is_balanced ? "Conciliado" : "Revisar"}</Status>
              </header>
              <div className="m190-annual__table-wrap">
                <table>
                  <thead><tr><th>Bloque</th><th>Operaciones</th><th>Modelo 111</th><th>Diferencia base</th><th>Retención 190</th><th>Retención 111</th><th>Diferencia</th></tr></thead>
                  <tbody>
                    {Object.keys(CATEGORY_LABELS).map((category) => (
                      <tr key={category}>
                        <td><b>{CATEGORY_LABELS[category]}</b></td>
                        <td>{money(quarter.operations?.[category]?.income)}</td>
                        <td>{money(quarter.model111?.[category]?.income)}</td>
                        <td>{money(quarter.differences?.[category]?.income)}</td>
                        <td>{money(quarter.operations?.[category]?.withholding)}</td>
                        <td>{money(quarter.model111?.[category]?.withholding)}</td>
                        <td>{money(quarter.differences?.[category]?.withholding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {quarter.alerts?.length ? (
                <div className="m190-annual__alerts">
                  {quarter.alerts.map((alert, index) => (
                    <div key={`${alert.code}-${index}`}><b>{alert.code}</b><span>{alert.message}</span></div>
                  ))}
                </div>
              ) : null}
            </article>
          ) : null}
        </div>
      ) : null}

      {section === "validations" && preview ? (
        <div className="m190-annual__section">
          <div className="m190-annual__metrics is-compact">
            <Metric label="Errores" value={validations.counts.error} tone={validations.counts.error ? "warning" : "success"} />
            <Metric label="Avisos" value={validations.counts.warning} tone={validations.counts.warning ? "warning" : "neutral"} />
            <Metric label="Informativos" value={validations.counts.information} />
          </div>
          <article className="m190-annual__panel">
            <header>
              <div>
                <span className="m190-annual__eyebrow">CONTROL PREVIO</span>
                <h3>{validations.isValid ? "Sin errores bloqueantes" : "Correcciones necesarias"}</h3>
              </div>
              <Status ok={validations.isValid}>{validations.isValid ? "Válido" : "Bloqueado"}</Status>
            </header>
            {relevantValidations.length ? (
              <div className="m190-annual__validation-list">
                {relevantValidations.map((item, index) => (
                  <div key={`${item.code}-${index}`} className={`is-${item.level}`}>
                    <b>{item.code}</b>
                    <span>{item.message}</span>
                    {item.quarter ? <strong>{item.quarter}</strong> : null}
                  </div>
                ))}
              </div>
            ) : <div className="m190-annual__valid">No se han detectado errores ni avisos.</div>}
            {informationValidations.length ? (
              <details className="m190-annual__information">
                <summary>Ver {informationValidations.length} controles informativos</summary>
                {informationValidations.map((item, index) => (
                  <p key={`${item.code}-${index}`}><b>{item.code}</b> · {item.message}</p>
                ))}
              </details>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
