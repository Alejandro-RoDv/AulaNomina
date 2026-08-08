const STATUS_LABELS = {
  draft: "Borrador",
  active: "Activo",
  suspended: "Suspendido",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

function TextField({ label, value, onChange, disabled = false, placeholder = "", wide = false }) {
  return (
    <label className={`wg-field${wide ? " wg-field--wide" : ""}`}>
      <span className="wg-label">{label}</span>
      <input value={value} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="wg-input" />
    </label>
  );
}

function DateField({ label, value, onChange, disabled = false, required = false }) {
  return (
    <label className="wg-field">
      <span className="wg-label">{label}{required ? " *" : ""}</span>
      <input type="date" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="wg-input" />
    </label>
  );
}

function MoneyField({ label, value, onChange, disabled = false }) {
  return (
    <label className="wg-field">
      <span className="wg-label">{label}</span>
      <span className="wg-money">
        <input value={value} disabled={disabled} inputMode="decimal" placeholder="0,00" onChange={(event) => onChange(event.target.value)} />
        <span className="wg-money__currency">€</span>
      </span>
    </label>
  );
}

function SectionHeader({ number, title, subtitle }) {
  return (
    <header className="wg-record-section__header">
      <span className="wg-record-section__number">{number}</span>
      <div>
        <h3 className="wg-record-section__title">{title}</h3>
        <p className="wg-record-section__subtitle">{subtitle}</p>
      </div>
    </header>
  );
}

export default function WageGarnishmentRecordForm({
  form,
  contracts = [],
  readOnly = false,
  activeCount = 0,
  movementCount = 0,
  onChange,
}) {
  const priorityWarning = form.status === "active" && activeCount > 0;

  return (
    <div className="wg-record-form">
      <section className="wg-record-section">
        <SectionHeader number="01" title="Orden judicial" subtitle="Identificación, estado y orden de aplicación del expediente." />
        <div className="wg-record-section__grid">
          <TextField label="Referencia / autos *" value={form.reference} disabled={readOnly} onChange={(value) => onChange("reference", value)} placeholder="Ej. ETJ 123/2026" />
          <TextField label="Órgano emisor *" value={form.issuing_body} disabled={readOnly} onChange={(value) => onChange("issuing_body", value)} placeholder="Juzgado u organismo" />
          <TextField label="Acreedor" value={form.creditor} disabled={readOnly} onChange={(value) => onChange("creditor", value)} placeholder="Persona o entidad acreedora" />
          <label className="wg-field">
            <span className="wg-label">Estado</span>
            <select value={form.status} disabled={readOnly} onChange={(event) => onChange("status", event.target.value)} className="wg-select">
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="wg-field">
            <span className="wg-label">Prioridad de aplicación</span>
            <input type="number" min="1" step="1" value={form.priority} disabled={readOnly} onChange={(event) => onChange("priority", event.target.value)} className="wg-input" />
          </label>
          <label className="wg-field wg-field--wide">
            <span className="wg-label">Contrato vinculado</span>
            <select value={form.contract_id} disabled={readOnly} onChange={(event) => onChange("contract_id", event.target.value)} className="wg-select">
              <option value="">Sin contrato vinculado</option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.contract_code || contract.contract_type || `Contrato ${contract.id}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        {priorityWarning && (
          <div className="wg-alert">
            El trabajador ya tiene {activeCount} embargo{activeCount === 1 ? " activo" : "s activos"}. Revisa la prioridad antes de activar este expediente.
          </div>
        )}
      </section>

      <section className="wg-record-section">
        <SectionHeader number="02" title="Vigencia" subtitle="Fechas de notificación, inicio efectivo y finalización." />
        <div className="wg-record-section__grid">
          <DateField label="Notificación" value={form.notification_date} disabled={readOnly} onChange={(value) => onChange("notification_date", value)} />
          <DateField label="Inicio" value={form.start_date} disabled={readOnly} required onChange={(value) => onChange("start_date", value)} />
          <DateField label="Finalización" value={form.end_date} disabled={readOnly} onChange={(value) => onChange("end_date", value)} />
        </div>
      </section>

      <section className="wg-record-section">
        <SectionHeader number="03" title="Reducción autorizada" subtitle="Solo se aplica cuando existe resolución expresa del órgano ejecutante." />
        <div className="wg-record-section__grid">
          <label className="wg-checkbox">
            <input type="checkbox" checked={Boolean(form.reduction_authorized)} disabled={readOnly} onChange={(event) => onChange("reduction_authorized", event.target.checked)} />
            <span>Existe reducción autorizada</span>
          </label>
          <label className="wg-field">
            <span className="wg-label">Porcentaje autorizado</span>
            <select value={form.reduction_percentage} disabled={readOnly || !form.reduction_authorized} onChange={(event) => onChange("reduction_percentage", event.target.value)} className="wg-select">
              <option value="0">Sin reducción</option>
              <option value="10">10 %</option>
              <option value="15">15 %</option>
            </select>
          </label>
          <DateField label="Fecha de resolución" value={form.reduction_authorization_date} disabled={readOnly || !form.reduction_authorized} onChange={(value) => onChange("reduction_authorization_date", value)} />
          <TextField label="Referencia de la resolución" value={form.reduction_authorization_reference} disabled={readOnly || !form.reduction_authorized} onChange={(value) => onChange("reduction_authorization_reference", value)} placeholder="Resolución, diligencia o providencia" />
        </div>
      </section>

      <section className="wg-record-section">
        <SectionHeader number="04" title="Control económico" subtitle="Deuda, retenido acumulado y observaciones del expediente." />
        <div className="wg-record-section__grid wg-record-section__grid--economic">
          <MoneyField label="Deuda total" value={form.total_debt} disabled={readOnly} onChange={(value) => onChange("total_debt", value)} />
          <MoneyField label="Retenido antes de AulaNomina" value={form.withheld_to_date} disabled={readOnly || movementCount > 0} onChange={(value) => onChange("withheld_to_date", value)} />
          <label className="wg-field">
            <span className="wg-label">Observaciones</span>
            <textarea value={form.notes} disabled={readOnly} onChange={(event) => onChange("notes", event.target.value)} className="wg-textarea" placeholder="Anotaciones internas del expediente" />
          </label>
        </div>
        {movementCount > 0 && <div className="wg-alert wg-alert--info">El retenido acumulado procede de los movimientos mensuales y ya no puede editarse manualmente.</div>}
      </section>
    </div>
  );
}
