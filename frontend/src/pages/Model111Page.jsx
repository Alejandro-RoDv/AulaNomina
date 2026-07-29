import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createProfessional,
  createProfessionalInvoice,
  createTaxWithholdingAdjustment,
  fetchModel111Declaration,
  fetchModel111Declarations,
  fetchModel111Preview,
  fetchProfessionalInvoices,
  fetchProfessionals,
  fetchTaxWithholdingAdjustments,
  generateModel111Declaration,
  model111ReceiptUrl,
  presentModel111Declaration,
  seedModel111Demo,
} from "../services/model111Service";

const PERIODS = ["1T", "2T", "3T", "4T"];
const TABS = [
  ["summary", "Resumen"],
  ["professionals", "Profesionales"],
  ["adjustments", "Ajustes y atrasos"],
  ["declarations", "Declaraciones"],
];

function money(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function dateText(value, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(new Date(value));
}

function Metric({ label, value, note }) {
  return <article style={styles.metric}><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</article>;
}

function openReceipt(declarationId) {
  window.open(model111ReceiptUrl(declarationId), "_blank", "noopener,noreferrer");
}

function AeatModal({ declaration, onClose, onPresented }) {
  const [step, setStep] = useState(declaration.status === "presented" ? 4 : 0);
  const [conform, setConform] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(declaration);

  async function present() {
    setBusy(true);
    setError("");
    try {
      const updated = await presentModel111Declaration(current.id, {
        payment_method: current.result_type === "negative" ? "negative" : "simulated_nrc",
      });
      setCurrent(updated);
      setStep(4);
      onPresented(updated);
    } catch (requestError) {
      setError(requestError?.message || "No se ha podido completar la presentación simulada");
    } finally {
      setBusy(false);
    }
  }

  const titles = ["Acceso", "Validación", "Forma de ingreso", "Firma y envío", "Justificante"];
  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <header style={styles.modalHeader}>
          <div><b style={styles.educational}>SIMULACIÓN EDUCATIVA · SIN VALIDEZ FISCAL</b><h2>Sede AEAT simulada · Modelo 111</h2></div>
          <button type="button" style={styles.close} onClick={onClose}>×</button>
        </header>
        <nav style={styles.steps}>{titles.map((title, index) => <span key={title} style={index <= step ? styles.stepActive : styles.step}>{index + 1}. {title}</span>)}</nav>
        <section style={styles.modalBody}>
          {step === 0 ? <><h3>Acceso con certificado</h3><p><b>{current.company_name}</b> · {current.company_nif}</p><div style={styles.certificate}>Certificado AulaNomina Demo<br /><small>Representante autorizado en entorno formativo</small></div><button style={styles.primary} onClick={() => setStep(1)}>Acceder</button></> : null}
          {step === 1 ? <><h3>Declaración correcta</h3><p>No se han detectado errores en la declaración congelada.</p><div style={styles.result}>Resultado: <b>{money(current.result_amount)}</b></div><button style={styles.primary} onClick={() => setStep(2)}>Continuar</button></> : null}
          {step === 2 ? <><h3>Forma de ingreso</h3><label style={styles.option}><input type="radio" checked readOnly /> {current.result_type === "negative" ? "Declaración negativa" : "NRC simulado"}</label><label style={styles.disabledOption}><input type="radio" disabled /> Domiciliación · escenario avanzado</label><label style={styles.disabledOption}><input type="radio" disabled /> Reconocimiento de deuda · escenario avanzado</label><button style={styles.primary} onClick={() => setStep(3)}>Continuar</button></> : null}
          {step === 3 ? <><h3>Firma y envío</h3><p>{current.period} {current.year} · {money(current.result_amount)}</p><label style={styles.option}><input type="checkbox" checked={conform} onChange={(event) => setConform(event.target.checked)} /> Conforme con la presentación simulada</label>{error ? <p style={styles.error}>{error}</p> : null}<button style={{ ...styles.primary, opacity: !conform || busy ? 0.5 : 1 }} disabled={!conform || busy} onClick={present}>{busy ? "Enviando…" : "Firmar y enviar"}</button></> : null}
          {step === 4 ? <><h3>Presentación realizada correctamente</h3><div style={styles.receipt}><span>Empresa</span><b>{current.company_name}</b><span>Periodo</span><b>{current.period} {current.year}</b><span>Fecha</span><b>{dateText(current.presented_at, true)}</b><span>Resultado</span><b>{money(current.result_amount)}</b><span>Justificante</span><b>{current.receipt_number}</b><span>CSV simulado</span><b>{current.csv}</b><span>NRC</span><b>{current.nrc || "No procede"}</b></div><button style={styles.secondary} onClick={() => openReceipt(current.id)}>Abrir justificante / guardar PDF</button></> : null}
        </section>
      </div>
    </div>
  );
}

export default function Model111Page({ companies = [] }) {
  const activeCompanies = useMemo(() => companies.filter((company) => company.is_active), [companies]);
  const [companyId, setCompanyId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState("2T");
  const [preview, setPreview] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [tab, setTab] = useState("summary");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modal, setModal] = useState(null);
  const [professionalForm, setProfessionalForm] = useState({ nif: "", name: "", surname: "", withholding_rate: "15" });
  const [invoiceForm, setInvoiceForm] = useState({ professional_id: "", invoice_number: "", invoice_date: "", payment_date: "", tax_base: "", withholding_rate: "15", status: "paid" });
  const [adjustmentForm, setAdjustmentForm] = useState({ category: "work", adjustment_type: "arrears", source_date: "", recipient_nif: "", recipient_name: "", base_amount: "", withholding_amount: "", notes: "" });

  useEffect(() => {
    if (!companyId && activeCompanies.length) setCompanyId(String(activeCompanies[0].id));
  }, [activeCompanies, companyId]);

  const load = useCallback(async (targetYear = year, targetPeriod = period) => {
    if (!companyId) return;
    setBusy(true);
    setError("");
    try {
      const request = { companyId, year: targetYear, period: targetPeriod };
      const [nextPreview, nextProfessionals, nextInvoices, nextAdjustments, nextDeclarations] = await Promise.all([
        fetchModel111Preview(request),
        fetchProfessionals(companyId),
        fetchProfessionalInvoices(request),
        fetchTaxWithholdingAdjustments(request),
        fetchModel111Declarations({ companyId, year: targetYear }),
      ]);
      setPreview(nextPreview);
      setProfessionals(nextProfessionals);
      setInvoices(nextInvoices);
      setAdjustments(nextAdjustments);
      setDeclarations(nextDeclarations);
      setInvoiceForm((current) => ({ ...current, professional_id: current.professional_id || String(nextProfessionals[0]?.id || "") }));
    } catch (requestError) {
      setError(requestError?.message || "No se ha podido cargar el Modelo 111");
    } finally {
      setBusy(false);
    }
  }, [companyId, period, year]);

  useEffect(() => { load(); }, [load]);

  async function loadDemo() {
    if (!companyId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await seedModel111Demo(companyId);
      setYear(2026);
      setPeriod("2T");
      setPreview(result.preview);
      setMessage(`${result.message}. Profesionales: 3 · Base profesional: ${money(result.preview.professionals.base)}.`);
      await load(2026, "2T");
    } catch (requestError) {
      setError(requestError?.message || "No se ha podido cargar el caso demostrativo");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfessional(event) {
    event.preventDefault();
    setError("");
    try {
      await createProfessional({ company_id: Number(companyId), ...professionalForm, withholding_rate: Number(professionalForm.withholding_rate) });
      setProfessionalForm({ nif: "", name: "", surname: "", withholding_rate: "15" });
      setMessage("Profesional guardado.");
      await load();
    } catch (requestError) { setError(requestError?.message || "No se ha podido guardar el profesional"); }
  }

  async function saveInvoice(event) {
    event.preventDefault();
    setError("");
    try {
      await createProfessionalInvoice({
        company_id: Number(companyId),
        professional_id: Number(invoiceForm.professional_id),
        invoice_number: invoiceForm.invoice_number,
        invoice_date: invoiceForm.invoice_date,
        payment_date: invoiceForm.payment_date || null,
        tax_base: Number(invoiceForm.tax_base),
        withholding_rate: Number(invoiceForm.withholding_rate),
        status: invoiceForm.status,
      });
      setInvoiceForm((current) => ({ ...current, invoice_number: "", invoice_date: "", payment_date: "", tax_base: "" }));
      setMessage("Factura profesional guardada.");
      await load();
    } catch (requestError) { setError(requestError?.message || "No se ha podido guardar la factura"); }
  }

  async function saveAdjustment(event) {
    event.preventDefault();
    setError("");
    try {
      await createTaxWithholdingAdjustment({
        company_id: Number(companyId),
        category: adjustmentForm.category,
        adjustment_type: adjustmentForm.adjustment_type,
        source_date: adjustmentForm.source_date,
        recipient_nif: adjustmentForm.recipient_nif,
        recipient_name: adjustmentForm.recipient_name,
        base_amount: Number(adjustmentForm.base_amount || 0),
        withholding_amount: Number(adjustmentForm.withholding_amount || 0),
        status: "confirmed",
        notes: adjustmentForm.notes || null,
      });
      setAdjustmentForm((current) => ({ ...current, source_date: "", recipient_nif: "", recipient_name: "", base_amount: "", withholding_amount: "", notes: "" }));
      setMessage("Ajuste fiscal confirmado e incorporado al cálculo.");
      await load();
    } catch (requestError) { setError(requestError?.message || "No se ha podido guardar el ajuste fiscal"); }
  }

  async function generate(type = "ordinary", originalId = null) {
    setError("");
    setMessage("");
    try {
      const declaration = await generateModel111Declaration({
        company_id: Number(companyId), year: Number(year), period,
        declaration_type: type, original_declaration_id: originalId,
      });
      setMessage(type === "ordinary" ? "Declaración generada y congelada." : "Complementaria generada sin modificar la original.");
      setModal(declaration);
      await load();
    } catch (requestError) { setError(requestError?.message || "No se ha podido generar la declaración"); }
  }

  async function openDeclaration(id) {
    setError("");
    try { setModal(await fetchModel111Declaration(id)); }
    catch (requestError) { setError(requestError?.message || "No se ha podido abrir la declaración"); }
  }

  const calculatedRetention = Number(invoiceForm.tax_base || 0) * Number(invoiceForm.withholding_rate || 0) / 100;
  const totalPaid = Number(invoiceForm.tax_base || 0) - calculatedRetention;
  const adjustmentAllowsNegative = adjustmentForm.adjustment_type === "regularization";

  return (
    <div style={styles.page}>
      <section style={styles.toolbar}>
        <label>Empresa<select value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">Selecciona</option>{activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name} · {company.cif}</option>)}</select></label>
        <label>Ejercicio<input type="number" value={year} min="2000" max="2100" onChange={(event) => setYear(Number(event.target.value))} /></label>
        <label>Periodo<select value={period} onChange={(event) => setPeriod(event.target.value)}>{PERIODS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button style={styles.secondary} disabled={busy || !companyId} onClick={() => load()}>{busy ? "Calculando…" : "Recalcular"}</button>
        <button style={styles.demoButton} disabled={busy || !companyId} onClick={loadDemo}>Cargar caso demo 2T</button>
      </section>

      <div><b style={styles.educational}>SIMULACIÓN EDUCATIVA · NO VÁLIDA PARA PRESENTACIÓN REAL</b><h1 style={styles.title}>Modelo 111 · {period} {year}</h1><p style={styles.subtitle}>{preview ? `${preview.company.name} · ${dateText(preview.period_start)}–${dateText(preview.period_end)}` : "Selecciona empresa y periodo"}</p></div>
      {error ? <div style={styles.errorBanner}>{error}</div> : null}
      {message ? <div style={styles.success}>{message}</div> : null}

      <nav style={styles.tabs}>{TABS.map(([id, label]) => <button key={id} style={tab === id ? styles.tabActive : styles.tab} onClick={() => setTab(id)}>{label}</button>)}</nav>

      {tab === "summary" && preview ? <>
        <div style={preview.validations.is_valid ? styles.valid : styles.invalid}>
          <b>{preview.result_type === "no_activity" ? "Sin operaciones en el periodo" : preview.result_type === "negative" ? "Declaración negativa" : preview.validations.is_valid ? "Cálculo preparado" : "Errores bloqueantes"}</b>
          {preview.result_type === "no_activity" ? <p>No procede generar el Modelo 111.</p> : null}
          {preview.result_type === "negative" ? <p>Existen percepciones declarables, pero la retención resultante es 0,00 €.</p> : null}
          {preview.validations.errors.map((item) => <p key={item.code}>{item.message}</p>)}
        </div>
        <section style={styles.metrics}>
          <Metric label="Perceptores de trabajo" value={preview.work.perceptors} note={`Base ${money(preview.work.base)}`} />
          <Metric label="Retenciones trabajo" value={money(preview.work.withholding)} />
          <Metric label="Profesionales" value={preview.professionals.perceptors} note={`Base ${money(preview.professionals.base)}`} />
          <Metric label="Retenciones profesionales" value={money(preview.professionals.withholding)} />
          <Metric label="Resultado a ingresar" value={money(preview.result_amount)} />
        </section>
        <section style={styles.panel}><div style={styles.panelHead}><div><h2>Conciliación por origen</h2><p>Los totales pueden rastrearse hasta la nómina, factura o ajuste que los genera.</p></div><button style={{ ...styles.primary, opacity: !preview.validations.is_valid || !preview.has_operations ? 0.5 : 1 }} disabled={!preview.validations.is_valid || !preview.has_operations} onClick={() => generate()}>Generar Modelo 111</button></div>
          <table><thead><tr><th>Origen</th><th>Perceptores</th><th>Base</th><th>Retenciones</th><th>Documentos</th></tr></thead><tbody>{preview.reconciliation.map((row) => <tr key={row.key}><td>{row.label}</td><td>{row.perceptors}</td><td>{money(row.base)}</td><td>{money(row.withholding)}</td><td>{row.source_count}</td></tr>)}</tbody></table>
        </section>
        <section style={styles.panel}><h2>Detalle trazable</h2><table><thead><tr><th>Fecha</th><th>Origen</th><th>Perceptor</th><th>NIF</th><th>Base</th><th>Retención</th></tr></thead><tbody>{preview.lines.map((line) => <tr key={`${line.source_type}-${line.source_id}`}><td>{dateText(line.source_date)}</td><td>{line.source_label}</td><td>{line.recipient_name}</td><td>{line.recipient_nif || "Pendiente"}</td><td>{money(line.base_amount)}</td><td>{money(line.withholding_amount)}</td></tr>)}</tbody></table></section>
      </> : null}

      {tab === "professionals" ? <>
        <section style={styles.columns}>
          <form style={styles.panel} onSubmit={saveProfessional}><h2>Nuevo profesional</h2><div style={styles.formGrid}><label>NIF<input required value={professionalForm.nif} onChange={(event) => setProfessionalForm({ ...professionalForm, nif: event.target.value })} /></label><label>Nombre<input required value={professionalForm.name} onChange={(event) => setProfessionalForm({ ...professionalForm, name: event.target.value })} /></label><label>Apellidos<input value={professionalForm.surname} onChange={(event) => setProfessionalForm({ ...professionalForm, surname: event.target.value })} /></label><label>Retención %<input type="number" min="0" max="100" step="0.01" value={professionalForm.withholding_rate} onChange={(event) => setProfessionalForm({ ...professionalForm, withholding_rate: event.target.value })} /></label></div><button style={styles.primary}>Guardar profesional</button></form>
          <form style={styles.panel} onSubmit={saveInvoice}><h2>Registrar factura</h2><div style={styles.formGrid}><label>Profesional<select required value={invoiceForm.professional_id} onChange={(event) => setInvoiceForm({ ...invoiceForm, professional_id: event.target.value })}><option value="">Selecciona</option>{professionals.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.nif}</option>)}</select></label><label>N.º factura<input required value={invoiceForm.invoice_number} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoice_number: event.target.value })} /></label><label>Fecha factura<input required type="date" value={invoiceForm.invoice_date} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoice_date: event.target.value })} /></label><label>Fecha pago<input type="date" value={invoiceForm.payment_date} onChange={(event) => setInvoiceForm({ ...invoiceForm, payment_date: event.target.value })} /></label><label>Base<input required type="number" min="0" step="0.01" value={invoiceForm.tax_base} onChange={(event) => setInvoiceForm({ ...invoiceForm, tax_base: event.target.value })} /></label><label>Retención %<input type="number" min="0" max="100" step="0.01" value={invoiceForm.withholding_rate} onChange={(event) => setInvoiceForm({ ...invoiceForm, withholding_rate: event.target.value })} /></label></div><p>Retención: <b>{money(calculatedRetention)}</b> · Total pagado: <b>{money(totalPaid)}</b></p><button style={styles.primary}>Guardar factura</button></form>
        </section>
        <section style={styles.panel}><h2>Facturas del periodo</h2><table><thead><tr><th>Factura</th><th>Profesional</th><th>Fecha fiscal</th><th>Estado</th><th>Base</th><th>Retención</th><th>Total</th></tr></thead><tbody>{invoices.map((item) => <tr key={item.id}><td>{item.invoice_number}</td><td>{item.professional_name}<small>{item.professional_nif}</small></td><td>{dateText(item.fiscal_date)}</td><td>{item.status}</td><td>{money(item.tax_base)}</td><td>{money(item.withholding_amount)}</td><td>{money(item.total_amount)}</td></tr>)}</tbody></table></section>
      </> : null}

      {tab === "adjustments" ? <section style={styles.columns}>
        <form style={styles.panel} onSubmit={saveAdjustment}><h2>Nuevo ajuste fiscal</h2><p>Utiliza atrasos para importes adicionales y regularización cuando sea necesario corregir importes, incluidos valores negativos.</p><div style={styles.formGrid}>
          <label>Bloque<select value={adjustmentForm.category} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, category: event.target.value })}><option value="work">Rendimientos del trabajo</option><option value="economic_activity">Actividades económicas</option></select></label>
          <label>Tipo<select value={adjustmentForm.adjustment_type} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, adjustment_type: event.target.value })}><option value="arrears">Atrasos</option><option value="manual">Ajuste manual</option><option value="regularization">Regularización</option></select></label>
          <label>Fecha fiscal<input required type="date" value={adjustmentForm.source_date} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, source_date: event.target.value })} /></label>
          <label>NIF perceptor<input required value={adjustmentForm.recipient_nif} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, recipient_nif: event.target.value })} /></label>
          <label>Perceptor<input required value={adjustmentForm.recipient_name} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, recipient_name: event.target.value })} /></label>
          <label>Base<input required type="number" min={adjustmentAllowsNegative ? undefined : 0} step="0.01" value={adjustmentForm.base_amount} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, base_amount: event.target.value })} /></label>
          <label>Retención<input required type="number" min={adjustmentAllowsNegative ? undefined : 0} step="0.01" value={adjustmentForm.withholding_amount} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, withholding_amount: event.target.value })} /></label>
          <label>Observaciones<input value={adjustmentForm.notes} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, notes: event.target.value })} /></label>
        </div><button style={styles.primary}>Confirmar ajuste</button></form>
        <section style={styles.panel}><h2>Ajustes del periodo</h2><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Bloque</th><th>Perceptor</th><th>Base</th><th>Retención</th></tr></thead><tbody>{adjustments.map((item) => <tr key={item.id}><td>{dateText(item.source_date)}</td><td>{item.adjustment_type}</td><td>{item.category === "work" ? "Trabajo" : "Actividad económica"}</td><td>{item.recipient_name}<small>{item.recipient_nif}</small></td><td>{money(item.base_amount)}</td><td>{money(item.withholding_amount)}</td></tr>)}</tbody></table>{!adjustments.length ? <p>No existen ajustes confirmados en el periodo.</p> : null}</section>
      </section> : null}

      {tab === "declarations" ? <section style={styles.panel}><h2>Declaraciones persistentes</h2><p>La presentación bloquea la declaración. Una complementaria conserva intacta la original.</p><div style={styles.list}>{declarations.map((item) => <article key={item.id} style={styles.declaration}><div><b>Modelo 111 · {item.period} {item.year}</b><p>{item.declaration_type === "complementary" ? "Complementaria" : "Ordinaria"} · {item.status}</p></div><strong>{money(item.result_amount)}</strong><div style={styles.actions}>{item.status === "presented" ? <button style={styles.secondary} onClick={() => openReceipt(item.id)}>Justificante / PDF</button> : <button style={styles.secondary} onClick={() => openDeclaration(item.id)}>Presentar</button>}{item.status === "presented" ? <button style={styles.link} onClick={() => generate("complementary", item.id)}>Complementaria</button> : null}</div></article>)}</div></section> : null}

      {modal ? <AeatModal declaration={modal} onClose={() => setModal(null)} onPresented={(updated) => { setModal(updated); load(); }} /> : null}
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: 18 },
  toolbar: { display: "flex", flexWrap: "wrap", gap: 14, alignItems: "end", padding: 16, background: "#f9fafb", border: "1px solid #d1d5db", borderRadius: 8 },
  educational: { display: "inline-block", padding: "4px 8px", background: "#fef3c7", color: "#92400e", fontSize: 10, borderRadius: 4 },
  title: { margin: "8px 0 3px" }, subtitle: { margin: 0, color: "#6b7280" },
  tabs: { display: "flex", flexWrap: "wrap", borderBottom: "1px solid #d1d5db" }, tab: { border: 0, background: "transparent", padding: 12, fontWeight: 700, cursor: "pointer" }, tabActive: { border: 0, borderBottom: "3px solid #1d4ed8", background: "#eff6ff", padding: 12, fontWeight: 800, color: "#1d4ed8" },
  primary: { border: 0, background: "#1d4ed8", color: "white", padding: "10px 14px", borderRadius: 6, fontWeight: 800, cursor: "pointer" }, secondary: { border: "1px solid #9ca3af", background: "white", padding: "9px 13px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }, demoButton: { border: "2px solid #111827", background: "#f8f3b5", padding: "9px 13px", borderRadius: 4, fontWeight: 900, cursor: "pointer" }, link: { border: 0, background: "transparent", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" },
  errorBanner: { padding: 12, background: "#fee2e2", color: "#991b1b", fontWeight: 700 }, success: { padding: 12, background: "#dcfce7", color: "#166534", fontWeight: 700 }, error: { color: "#991b1b", fontWeight: 700 },
  valid: { padding: 14, background: "#f0fdf4", color: "#166534", border: "1px solid #86efac", borderRadius: 8 }, invalid: { padding: 14, background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 8 },
  metrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }, metric: { display: "flex", flexDirection: "column", gap: 6, padding: 15, border: "1px solid #d1d5db", borderRadius: 8 },
  panel: { padding: 18, border: "1px solid #d1d5db", borderRadius: 9, overflowX: "auto" }, panelHead: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }, columns: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(380px,1fr))", gap: 16 }, formGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 },
  list: { display: "flex", flexDirection: "column", gap: 10 }, declaration: { display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 16, padding: 14, border: "1px solid #d1d5db", borderRadius: 7 }, actions: { display: "flex", alignItems: "center", gap: 8 },
  backdrop: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }, modal: { width: "min(850px,100%)", maxHeight: "92vh", overflow: "auto", background: "white", borderRadius: 10 }, modalHeader: { display: "flex", justifyContent: "space-between", padding: 20, borderBottom: "1px solid #d1d5db" }, close: { border: 0, background: "transparent", fontSize: 28, cursor: "pointer" }, steps: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", background: "#f9fafb" }, step: { padding: 10, color: "#9ca3af", textAlign: "center", fontSize: 11 }, stepActive: { padding: 10, color: "#1d4ed8", background: "#eff6ff", textAlign: "center", fontSize: 11, fontWeight: 800 }, modalBody: { padding: 26, display: "flex", flexDirection: "column", gap: 14 }, certificate: { padding: 15, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 7 }, result: { padding: 14, background: "#f3f4f6", borderRadius: 6, fontSize: 18 }, option: { display: "flex", gap: 8, padding: 13, border: "1px solid #d1d5db", borderRadius: 6 }, disabledOption: { display: "flex", gap: 8, padding: 13, border: "1px solid #d1d5db", borderRadius: 6, opacity: .5 }, receipt: { display: "grid", gridTemplateColumns: "170px 1fr", gap: 9, padding: 16, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 7 },
};
