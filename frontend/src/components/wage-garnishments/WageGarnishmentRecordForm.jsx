const STATUS_LABELS = {
  draft: "Borrador",
  active: "Activo",
  suspended: "Suspendido",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

function TextField({ label, value, onChange, disabled = false, placeholder = "" }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input value={value} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} style={styles.input} />
    </label>
  );
}

function DateField({ label, value, onChange, disabled = false, required = false }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}{required ? " *" : ""}</span>
      <input type="date" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} style={styles.dateInput} />
    </label>
  );
}

function MoneyField({ label, value, onChange, disabled = false }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <span style={{ ...styles.moneyWrapper, ...(disabled ? styles.disabledWrapper : {}) }}>
        <input value={value} disabled={disabled} inputMode="decimal" placeholder="0,00" onChange={(event) => onChange(event.target.value)} style={styles.moneyInput} />
        <span style={styles.currency}>€</span>
      </span>
    </label>
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
    <div style={styles.wrapper}>
      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.icon}>01</div>
          <div>
            <h3 style={styles.title}>Orden judicial</h3>
            <p style={styles.subtitle}>Identifica el expediente, su estado y el orden de aplicación.</p>
          </div>
        </div>

        <div style={styles.mainGrid}>
          <TextField label="Referencia / autos *" value={form.reference} disabled={readOnly} onChange={(value) => onChange("reference", value)} placeholder="Ej. ETJ 123/2026" />
          <TextField label="Órgano emisor *" value={form.issuing_body} disabled={readOnly} onChange={(value) => onChange("issuing_body", value)} placeholder="Juzgado u organismo" />
          <TextField label="Acreedor" value={form.creditor} disabled={readOnly} onChange={(value) => onChange("creditor", value)} placeholder="Persona o entidad acreedora" />
          <label style={styles.field}>
            <span style={styles.label}>Estado</span>
            <select value={form.status} disabled={readOnly} onChange={(event) => onChange("status", event.target.value)} style={styles.input}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Prioridad de aplicación</span>
            <input type="number" min="1" step="1" value={form.priority} disabled={readOnly} onChange={(event) => onChange("priority", event.target.value)} style={styles.input} />
          </label>
          <label style={styles.fieldWide}>
            <span style={styles.label}>Contrato vinculado</span>
            <select value={form.contract_id} disabled={readOnly} onChange={(event) => onChange("contract_id", event.target.value)} style={styles.input}>
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
          <div style={styles.warning}>
            El trabajador ya tiene {activeCount} embargo{activeCount === 1 ? " activo" : "s activos"}. Revisa la prioridad antes de activar este expediente.
          </div>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.icon}>02</div>
          <div>
            <h3 style={styles.title}>Vigencia</h3>
            <p style={styles.subtitle}>Fechas de notificación, inicio efectivo y finalización.</p>
          </div>
        </div>

        <div style={styles.dateGrid}>
          <DateField label="Notificación" value={form.notification_date} disabled={readOnly} onChange={(value) => onChange("notification_date", value)} />
          <DateField label="Inicio" value={form.start_date} disabled={readOnly} required onChange={(value) => onChange("start_date", value)} />
          <DateField label="Finalización" value={form.end_date} disabled={readOnly} onChange={(value) => onChange("end_date", value)} />
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.icon}>03</div>
          <div>
            <h3 style={styles.title}>Reducción autorizada</h3>
            <p style={styles.subtitle}>Solo debe aplicarse cuando conste expresamente en una resolución del órgano ejecutante.</p>
          </div>
        </div>

        <div style={styles.authorizationGrid}>
          <label style={styles.checkboxField}>
            <input type="checkbox" checked={Boolean(form.reduction_authorized)} disabled={readOnly} onChange={(event) => onChange("reduction_authorized", event.target.checked)} />
            <span>Existe reducción autorizada</span>
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Porcentaje autorizado</span>
            <select value={form.reduction_percentage} disabled={readOnly || !form.reduction_authorized} onChange={(event) => onChange("reduction_percentage", event.target.value)} style={styles.input}>
              <option value="0">Sin reducción</option>
              <option value="10">10 %</option>
              <option value="15">15 %</option>
            </select>
          </label>
          <DateField label="Fecha de resolución" value={form.reduction_authorization_date} disabled={readOnly || !form.reduction_authorized} onChange={(value) => onChange("reduction_authorization_date", value)} />
          <TextField label="Referencia de la resolución" value={form.reduction_authorization_reference} disabled={readOnly || !form.reduction_authorized} onChange={(value) => onChange("reduction_authorization_reference", value)} placeholder="Resolución, diligencia o providencia" />
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.icon}>04</div>
          <div>
            <h3 style={styles.title}>Control económico</h3>
            <p style={styles.subtitle}>La deuda pendiente se actualizará automáticamente con los movimientos mensuales.</p>
          </div>
        </div>

        <div style={styles.economicGrid}>
          <MoneyField label="Deuda total" value={form.total_debt} disabled={readOnly} onChange={(value) => onChange("total_debt", value)} />
          <MoneyField label="Retenido antes de AulaNomina" value={form.withheld_to_date} disabled={readOnly || movementCount > 0} onChange={(value) => onChange("withheld_to_date", value)} />
          <label style={styles.notesField}>
            <span style={styles.label}>Observaciones</span>
            <textarea value={form.notes} disabled={readOnly} onChange={(event) => onChange("notes", event.target.value)} style={styles.textarea} placeholder="Anotaciones internas del expediente" />
          </label>
        </div>
        {movementCount > 0 && <div style={styles.info}>El retenido acumulado procede de los movimientos mensuales y ya no puede editarse manualmente.</div>}
      </section>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "16px" },
  card: { border: "1px solid #d4d4d8", borderRadius: "12px", backgroundColor: "#ffffff", boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)", overflow: "hidden" },
  cardHeader: { display: "flex", alignItems: "center", gap: "12px", padding: "16px 18px", borderBottom: "1px solid #e4e4e7", background: "linear-gradient(90deg, #fffdf0 0%, #ffffff 76%)" },
  icon: { width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "10px", backgroundColor: "#f4e96b", color: "#111827", fontSize: "11px", fontWeight: 950 },
  title: { margin: 0, color: "#111827", fontSize: "15px", fontWeight: 900 },
  subtitle: { margin: "3px 0 0", color: "#64748b", fontSize: "11px", fontWeight: 600 },
  mainGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", padding: "18px" },
  dateGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", padding: "18px" },
  authorizationGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px", alignItems: "end", padding: "18px" },
  economicGrid: { display: "grid", gridTemplateColumns: "minmax(180px, 0.7fr) minmax(180px, 0.7fr) minmax(300px, 1.6fr)", gap: "16px", padding: "18px" },
  field: { display: "flex", flexDirection: "column", gap: "7px", minWidth: 0 },
  fieldWide: { display: "flex", flexDirection: "column", gap: "7px", minWidth: 0, gridColumn: "span 2" },
  notesField: { display: "flex", flexDirection: "column", gap: "7px", minWidth: 0 },
  checkboxField: { minHeight: "42px", display: "flex", alignItems: "center", gap: "9px", border: "1px solid #d4d4d8", borderRadius: "8px", backgroundColor: "#f8fafc", padding: "0 12px", fontSize: "11px", fontWeight: 850 },
  label: { color: "#334155", fontSize: "11px", fontWeight: 850 },
  input: { width: "100%", minHeight: "42px", border: "1px solid #a1a1aa", borderRadius: "8px", backgroundColor: "#ffffff", color: "#111827", padding: "9px 11px", boxSizing: "border-box", fontSize: "13px", fontWeight: 700 },
  dateInput: { width: "100%", minHeight: "42px", border: "1px solid #a1a1aa", borderRadius: "8px", backgroundColor: "#ffffff", color: "#111827", padding: "8px 10px", boxSizing: "border-box", fontSize: "13px", fontWeight: 700, colorScheme: "light" },
  moneyWrapper: { display: "grid", gridTemplateColumns: "1fr 38px", border: "1px solid #a1a1aa", borderRadius: "8px", backgroundColor: "#ffffff", overflow: "hidden" },
  disabledWrapper: { backgroundColor: "#f4f4f5" },
  moneyInput: { width: "100%", minHeight: "40px", border: "none", backgroundColor: "transparent", color: "#111827", padding: "9px 11px", boxSizing: "border-box", fontSize: "13px", fontWeight: 700, outline: "none" },
  currency: { display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid #d4d4d8", backgroundColor: "#f8fafc", color: "#475569", fontSize: "13px", fontWeight: 900 },
  textarea: { width: "100%", minHeight: "88px", border: "1px solid #a1a1aa", borderRadius: "8px", resize: "vertical", padding: "10px 11px", boxSizing: "border-box", fontFamily: "inherit", fontSize: "13px", lineHeight: 1.4 },
  warning: { margin: "0 18px 18px", border: "1px solid #f59e0b", borderRadius: "8px", backgroundColor: "#fffbeb", color: "#92400e", padding: "10px 12px", fontSize: "11px", fontWeight: 750 },
  info: { margin: "0 18px 18px", border: "1px solid #bfdbfe", borderRadius: "8px", backgroundColor: "#eff6ff", color: "#1e40af", padding: "10px 12px", fontSize: "11px", fontWeight: 700 },
};
