import { useEffect, useMemo, useState } from "react";

import { buildPayrollReceiptPrintUrl, fetchPayrollReceipt } from "../../services/payrollApi";
import { formatCurrency } from "./PayrollForm";
import "./payrollReceiptSplit42.css";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES");
}

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("es-ES", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function safeText(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function SummaryField({ label, value, secondary }) {
  return (
    <div className="payroll-receipt-s42__summary-field">
      <span>{label}</span>
      <strong>{safeText(value)}</strong>
      {secondary && <small>{secondary}</small>}
    </div>
  );
}

function Total({ label, value, primary = false }) {
  return (
    <div className={`payroll-receipt-s42__total${primary ? " is-primary" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReceiptTable({ title, lines = [], emptyLabel = "Sin conceptos" }) {
  return (
    <section className="payroll-receipt-s42__section">
      <div className="payroll-receipt-s42__section-heading">
        <h3>{title}</h3>
        <span>{lines.length} conceptos</span>
      </div>
      <div className="payroll-receipt-s42__table-wrap">
        <table className="payroll-receipt-s42__table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Concepto</th>
              <th>Origen</th>
              <th className="is-number">Importe</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={`${line.code}-${line.id || line.display_order || line.name}`}>
                <td className="is-code">{safeText(line.code)}</td>
                <td>
                  <strong>{safeText(line.name)}</strong>
                  {line.description && <small>{line.description}</small>}
                </td>
                <td>{safeText(line.source_type)}</td>
                <td className="is-number"><strong>{formatCurrency(line.amount)}</strong></td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan="4" className="payroll-receipt-s42__empty">{emptyLabel}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ExplanationList({ title, items = [], renderMeta }) {
  if (!items.length) return null;
  return (
    <section className="payroll-receipt-s42__section">
      <div className="payroll-receipt-s42__section-heading">
        <h3>{title}</h3>
        <span>{items.length} elementos</span>
      </div>
      <div className="payroll-receipt-s42__explanation-list">
        {items.map((item, index) => (
          <article key={item.id || item.code || `${title}-${index}`}>
            <div>
              <strong>{item.title || item.name || item.code || `Elemento ${index + 1}`}</strong>
              {renderMeta?.(item) && <span>{renderMeta(item)}</span>}
            </div>
            <p>{item.explanation || item.description || "Sin explicación adicional."}</p>
            {item.formula && <code>{item.formula}</code>}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function PayrollReceiptModal({ payrollId, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("summary");

  useEffect(() => {
    let cancelled = false;
    async function loadReceipt() {
      if (!payrollId) return;
      try {
        setLoading(true);
        setError("");
        setActiveTab("summary");
        const data = await fetchPayrollReceipt(payrollId);
        if (!cancelled) setReceipt(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "No se pudo cargar la nómina");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadReceipt();
    return () => {
      cancelled = true;
    };
  }, [payrollId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const periodLabel = useMemo(() => {
    if (!receipt?.period) return "-";
    return `${receipt.period.label} · ${formatDate(receipt.period.period_start)} – ${formatDate(receipt.period.period_end)}`;
  }, [receipt]);

  if (!payrollId) return null;

  const tabs = [
    ["summary", "Resumen"],
    ["concepts", "Conceptos"],
    ["bases", "Bases y coste"],
    ["explanation", "Explicación"],
  ];

  return (
    <div className="payroll-receipt-s42__overlay" role="dialog" aria-modal="true" aria-label="Detalle de nómina">
      <div className="payroll-receipt-s42__modal">
        <header className="payroll-receipt-s42__header">
          <div>
            <p>NÓMINA</p>
            <h2>{receipt?.employee?.name || "Detalle de nómina"}</h2>
            <span>{receipt ? `${receipt.payroll_code} · ${periodLabel}` : "Cargando..."}</span>
          </div>
          <div className="payroll-receipt-s42__header-actions">
            <button
              type="button"
              className="payroll-receipt-s42__secondary"
              onClick={() => window.open(buildPayrollReceiptPrintUrl(payrollId), "_blank", "noopener,noreferrer")}
            >
              Abrir PDF
            </button>
            <button type="button" className="payroll-receipt-s42__close" onClick={onClose} aria-label="Cerrar">×</button>
          </div>
        </header>

        <nav className="payroll-receipt-s42__tabs" aria-label="Secciones de la nómina">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={activeTab === key ? "is-active" : ""}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <main className="payroll-receipt-s42__body">
          {loading && <div className="payroll-receipt-s42__state">Cargando nómina...</div>}
          {error && <div className="payroll-receipt-s42__error">{error}</div>}

          {receipt && !loading && (
            <>
              {receipt.warnings?.length > 0 && (
                <div className="payroll-receipt-s42__warning">
                  {receipt.warnings.map((warning) => <div key={warning}>{warning}</div>)}
                </div>
              )}

              {activeTab === "summary" && (
                <div className="payroll-receipt-s42__tab-panel">
                  <section className="payroll-receipt-s42__identity">
                    <SummaryField
                      label="Trabajador"
                      value={receipt.employee?.name}
                      secondary={`${safeText(receipt.employee?.tax_id)} · NAF ${safeText(receipt.employee?.social_security_number)}`}
                    />
                    <SummaryField
                      label="Empresa / centro"
                      value={receipt.company?.name}
                      secondary={receipt.work_center?.name || "Sin centro informado"}
                    />
                    <SummaryField label="Periodo" value={receipt.period?.label} secondary={`${formatNumber(receipt.period?.worked_days)} días trabajados · ${formatNumber(receipt.period?.contribution_days)} cotizados`} />
                    <SummaryField
                      label="Contrato / categoría"
                      value={safeText(receipt.contract?.code || receipt.contract?.type)}
                      secondary={safeText(receipt.contract?.professional_category || receipt.contract?.job_position)}
                    />
                  </section>

                  <section className="payroll-receipt-s42__totals">
                    <Total label="Devengos" value={formatCurrency(receipt.totals?.total_earnings)} />
                    <Total label="Deducciones" value={formatCurrency(receipt.totals?.total_deductions)} />
                    <Total label="Líquido a percibir" value={formatCurrency(receipt.totals?.net_salary)} primary />
                    <Total label="Coste empresa" value={formatCurrency(receipt.totals?.company_total_cost)} />
                  </section>

                  <div className="payroll-receipt-s42__summary-grid">
                    <ReceiptTable title="Devengos" lines={receipt.earnings || []} />
                    <ReceiptTable title="Deducciones" lines={receipt.deductions || []} />
                  </div>

                  <section className="payroll-receipt-s42__period-detail">
                    <SummaryField label="Días de incidencia" value={formatNumber(receipt.period?.incident_days)} />
                    <SummaryField label="Prestaciones" value={formatCurrency(receipt.incident_summary?.total_benefits)} />
                    <SummaryField label="Complementos" value={formatCurrency(receipt.incident_summary?.total_company_complements)} />
                    <SummaryField label="Descuentos por ausencia" value={formatCurrency(receipt.incident_summary?.total_absence_deductions)} />
                  </section>
                </div>
              )}

              {activeTab === "concepts" && (
                <div className="payroll-receipt-s42__tab-panel">
                  <ReceiptTable title="Devengos" lines={receipt.earnings || []} />
                  <ReceiptTable title="Deducciones" lines={receipt.deductions || []} />
                  {receipt.informative_lines?.length > 0 && (
                    <ReceiptTable title="Líneas informativas" lines={receipt.informative_lines} />
                  )}
                </div>
              )}

              {activeTab === "bases" && (
                <div className="payroll-receipt-s42__tab-panel">
                  <section className="payroll-receipt-s42__totals payroll-receipt-s42__totals--compact">
                    <Total label="Bruto" value={formatCurrency(receipt.totals?.total_earnings)} />
                    <Total label="Líquido" value={formatCurrency(receipt.totals?.net_salary)} primary />
                    <Total label="Coste empresa" value={formatCurrency(receipt.totals?.company_total_cost)} />
                  </section>
                  <ReceiptTable title="Bases de cotización e IRPF" lines={receipt.base_lines || []} />
                  <ReceiptTable title="Costes de empresa" lines={receipt.company_cost_lines || []} />
                </div>
              )}

              {activeTab === "explanation" && (
                <div className="payroll-receipt-s42__tab-panel">
                  <section className="payroll-receipt-s42__explanation-intro">
                    <div>
                      <span>LECTURA DIDÁCTICA</span>
                      <h3>Cómo se ha calculado esta nómina</h3>
                    </div>
                    <p>{receipt.incident_summary?.explanation || "La nómina no contiene incidencias con impacto específico en el periodo."}</p>
                  </section>

                  <ExplanationList
                    title="Incidencias aplicadas"
                    items={receipt.incident_explanations || []}
                    renderMeta={(item) => item.period}
                  />
                  <ExplanationList
                    title="Bases y cotización"
                    items={receipt.base_explanations || []}
                    renderMeta={(item) => formatCurrency(item.amount)}
                  />
                  <ExplanationList
                    title="Explicación de conceptos"
                    items={receipt.line_explanations || []}
                    renderMeta={(item) => `${safeText(item.code)} · ${formatCurrency(item.amount)}`}
                  />

                  {(receipt.incident_explanations || []).length === 0 &&
                    (receipt.base_explanations || []).length === 0 &&
                    (receipt.line_explanations || []).length === 0 && (
                      <div className="payroll-receipt-s42__state">No hay explicaciones adicionales para esta nómina.</div>
                    )}
                </div>
              )}

              {receipt.legal_footer && <footer className="payroll-receipt-s42__legal">{receipt.legal_footer}</footer>}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
