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

function PayslipParty({ title, children }) {
  return (
    <section className="payroll-payslip__party">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function PartyLine({ label, value }) {
  return (
    <p>
      <span>{label}:</span>
      <strong>{safeText(value)}</strong>
    </p>
  );
}

function PayslipLines({ lines = [], type }) {
  if (!lines.length) {
    return <div className="payroll-payslip__empty-row">Sin conceptos en este apartado.</div>;
  }

  return lines.map((line) => {
    const quantity = line.quantity ?? line.units ?? line.days ?? "";
    const price = line.unit_price ?? line.price ?? line.rate ?? line.percentage ?? "";
    return (
      <div className="payroll-payslip__line" key={`${type}-${line.code}-${line.id || line.display_order || line.name}`}>
        <div>
          <span className="payroll-payslip__line-code">{safeText(line.code, "")}</span>
          <strong>{safeText(line.name)}</strong>
          {line.description && <small>{line.description}</small>}
        </div>
        <span className="is-number">{quantity !== "" ? safeText(quantity) : ""}</span>
        <span className="is-number">{price !== "" ? safeText(price) : ""}</span>
        <strong className="is-number">{formatCurrency(line.amount)}</strong>
      </div>
    );
  });
}

function OfficialPayslip({ receipt }) {
  const companyAddress = [receipt.company?.address, receipt.company?.city, receipt.company?.province].filter(Boolean).join(" · ");
  const employeeAddress = [receipt.employee?.address, receipt.employee?.city, receipt.employee?.province].filter(Boolean).join(" · ");
  const category = receipt.contract?.professional_category || receipt.contract?.job_position;
  const group = receipt.contract?.contribution_group || receipt.contract?.group;

  return (
    <article className="payroll-payslip">
      <header className="payroll-payslip__parties">
        <PayslipParty title="EMPRESA">
          <PartyLine label="Nombre" value={receipt.company?.name} />
          <PartyLine label="Domicilio" value={companyAddress || "No informado"} />
          <PartyLine label="CIF" value={receipt.company?.tax_id} />
          <PartyLine label="Código cuenta cotización S.S." value={receipt.company?.contribution_account} />
        </PayslipParty>
        <PayslipParty title="TRABAJADOR/A">
          <PartyLine label="Nombre" value={receipt.employee?.name} />
          <PartyLine label="DNI/NIE" value={receipt.employee?.tax_id} />
          <PartyLine label="Número de afiliación a la S.S." value={receipt.employee?.social_security_number} />
          <PartyLine label="Categoría o grupo profesional" value={category} />
          <PartyLine label="Grupo de cotización" value={group} />
          <PartyLine label="Domicilio" value={employeeAddress || "No informado"} />
        </PayslipParty>
      </header>

      <section className="payroll-payslip__period">
        <div><span>Periodo de liquidación</span><strong>{safeText(receipt.period?.label)}</strong></div>
        <div><span>Fecha inicial</span><strong>{formatDate(receipt.period?.period_start)}</strong></div>
        <div><span>Fecha final</span><strong>{formatDate(receipt.period?.period_end)}</strong></div>
        <div><span>Total días</span><strong>{formatNumber(receipt.period?.contribution_days)}</strong></div>
      </section>

      <section className="payroll-payslip__section">
        <div className="payroll-payslip__section-title">DEVENGOS</div>
        <div className="payroll-payslip__columns">
          <span>Concepto</span><span>Cantidad</span><span>Precio</span><span>Totales</span>
        </div>
        <div className="payroll-payslip__subheading">Percepciones salariales y no salariales</div>
        <PayslipLines lines={receipt.earnings || []} type="earning" />
        <div className="payroll-payslip__subtotal">
          <strong>TOTAL DEVENGADO</strong>
          <strong>{formatCurrency(receipt.totals?.total_earnings)}</strong>
        </div>
      </section>

      <section className="payroll-payslip__section payroll-payslip__section--deductions">
        <div className="payroll-payslip__section-title">DEDUCCIONES</div>
        <div className="payroll-payslip__columns">
          <span>Concepto</span><span></span><span>Tipo / %</span><span>Totales</span>
        </div>
        <PayslipLines lines={receipt.deductions || []} type="deduction" />
        <div className="payroll-payslip__subtotal">
          <strong>TOTAL A DEDUCIR</strong>
          <strong>{formatCurrency(receipt.totals?.total_deductions)}</strong>
        </div>
      </section>

      <section className="payroll-payslip__net">
        <strong>LÍQUIDO A PERCIBIR</strong>
        <strong>{formatCurrency(receipt.totals?.net_salary)}</strong>
      </section>

      <section className="payroll-payslip__payment">
        <div><span>Fecha de ingreso de la nómina:</span><strong>{formatDate(receipt.payment_date)}</strong></div>
        <div><span>Entidad financiera:</span><strong>{safeText(receipt.bank_name, "-")}</strong></div>
        <div><span>Cuenta:</span><strong>{safeText(receipt.bank_account, "-")}</strong></div>
        <div className="payroll-payslip__signature">Firma del trabajador</div>
      </section>

      <section className="payroll-payslip__bases">
        <div className="payroll-payslip__section-title">DETERMINACIÓN DE LAS BASES DE COTIZACIÓN A LA SEGURIDAD SOCIAL Y CONCEPTOS DE RECAUDACIÓN CONJUNTA</div>
        {(receipt.base_lines || []).length > 0 ? (
          receipt.base_lines.map((line) => (
            <div className="payroll-payslip__base-line" key={`base-${line.code}-${line.id || line.name}`}>
              <span>{safeText(line.name || line.code)}</span>
              <strong>{formatCurrency(line.amount)}</strong>
            </div>
          ))
        ) : (
          <div className="payroll-payslip__empty-row">Sin bases informadas.</div>
        )}
      </section>
    </article>
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
    ["summary", "Nómina"],
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
            <button key={key} type="button" className={activeTab === key ? "is-active" : ""} onClick={() => setActiveTab(key)}>
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

              {activeTab === "summary" && <OfficialPayslip receipt={receipt} />}

              {activeTab === "concepts" && (
                <div className="payroll-receipt-s42__tab-panel">
                  <ReceiptTable title="Devengos" lines={receipt.earnings || []} />
                  <ReceiptTable title="Deducciones" lines={receipt.deductions || []} />
                  {receipt.informative_lines?.length > 0 && <ReceiptTable title="Líneas informativas" lines={receipt.informative_lines} />}
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
                    <div><span>LECTURA DIDÁCTICA</span><h3>Cómo se ha calculado esta nómina</h3></div>
                    <p>{receipt.incident_summary?.explanation || "La nómina no contiene incidencias con impacto específico en el periodo."}</p>
                  </section>
                  <ExplanationList title="Incidencias aplicadas" items={receipt.incident_explanations || []} renderMeta={(item) => item.period} />
                  <ExplanationList title="Bases y cotización" items={receipt.base_explanations || []} renderMeta={(item) => formatCurrency(item.amount)} />
                  <ExplanationList title="Explicación de conceptos" items={receipt.line_explanations || []} renderMeta={(item) => `${safeText(item.code)} · ${formatCurrency(item.amount)}`} />
                  {(receipt.incident_explanations || []).length === 0 && (receipt.base_explanations || []).length === 0 && (receipt.line_explanations || []).length === 0 && (
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
