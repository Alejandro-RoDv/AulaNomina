const STATUS_LABELS = {
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
      <span style={styles.moneyWrapper}>
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
  onChange,
}) {
  return (
    <div style={styles.wrapper}>
      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.icon}>01</div>
          <div>
            <h3 style={styles.title}>Orden judicial</h3>
            <p style={styles.subtitle}>Identifica el expediente y el organismo que ordena la retención.</p>
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
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.icon}>02</div>
          <div>
            <h3 style={styles.title}>Vigencia</h3>
            <p style={styles.subtitle}>Las fechas se introducen como fechas reales, sin formatos numéricos ni decimales.</p>
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
            <h3 style={styles.title}>Control económico</h3>
            <p style={styles.subtitle}>Registra la deuda reclamada y lo retenido antes del alta en AulaNomina.</p>
          </div>
        </div>

        <div style={styles.economicGrid}>
          <MoneyField label="Deuda total" value={form.total_debt} disabled={readOnly} onChange={(value) => onChange("total_debt", value)} />
          <MoneyField label="Retenido hasta la fecha" value={form.withheld_to_date} disabled={readOnly} onChange={(value) => onChange("withheld_to_date", value)} />
          <label style={styles.notesField}>
            <span style={styles.label}>Observaciones</span>
            <textarea value={form.notes} disabled={readOnly} onChange={(event) => onChange("notes", event.target.value)} style={styles.textarea} placeholder="Anotaciones internas del expediente" />
          </label>
        </div>
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
  mainGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px", padding: "18px" },
  dateGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", padding: "18px" },
  economicGrid: { display: "grid", gridTemplateColumns: "minmax(180px, 0.7fr) minmax(180px, 0.7fr) minmax(300px, 1.6fr)", gap: "16px", padding: "18px" },
  field: { display: "flex", flexDirection: "column", gap: "7px", minWidth: 0 },
  fieldWide: { display: "flex", flexDirection: "column", gap: "7px", minWidth: 0, gridColumn: "span 2" },
  notesField: { display: "flex", flexDirection: "column", gap: "7px", minWidth: 0 },
  label: { color: "#334155", fontSize: "11px", fontWeight: 850 },
  input: { width: "100%", minHeight: "42px", border: "1px solid #a1a1aa", borderRadius: "8px", backgroundColor: "#ffffff", color: "#111827", padding: "9px 11px", boxSizing: "border-box", fontSize: "13px", fontWeight: 700 },
  dateInput: { width: "100%", minHeight: "42px", border: "1px solid #a1a1aa", borderRadius: "8px", backgroundColor: "#ffffff", color: "#111827", padding: "8px 10px", boxSizing: "border-box", fontSize: "13px", fontWeight: 700, colorScheme: "light" },
  moneyWrapper: { display: "grid", gridTemplateColumns: "1fr 38px", border: "1px solid #a1a1aa", borderRadius: "8px", backgroundColor: "#ffffff", overflow: "hidden" },
  moneyInput: { width: "100%", minHeight: "40px", border: "none", backgroundColor: "transparent", color: "#111827", padding: "9px 11px", boxSizing: "border-box", fontSize: "13px", fontWeight: 700, outline: "none" },
  currency: { display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid #d4d4d8", backgroundColor: "#f8fafc", color: "#475569", fontSize: "13px", fontWeight: 900 },
  textarea: { width: "100%", minHeight: "88px", border: "1px solid #a1a1aa", borderRadius: "8px", resize: "vertical", padding: "10px 11px", boxSizing: "border-box", fontFamily: "inherit", fontSize: "13px", lineHeight: 1.4 },
};
