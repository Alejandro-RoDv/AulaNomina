const STATUS_LABELS = {
  active: "Activo",
  suspended: "Suspendido",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

export default function WageGarnishmentRecordForm({
  form,
  contracts = [],
  readOnly = false,
  onChange,
}) {
  return (
    <div style={styles.wrapper}>
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionNumber}>1</span>
          <div>
            <h3 style={styles.sectionTitle}>Datos del expediente</h3>
            <p style={styles.sectionSubtitle}>Identificación de la orden judicial y vigencia del embargo.</p>
          </div>
        </div>

        <div style={styles.grid}>
          <label style={styles.field}>
            <span style={styles.label}>Referencia / autos *</span>
            <input value={form.reference} disabled={readOnly} onChange={(event) => onChange("reference", event.target.value)} style={styles.input} />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Órgano emisor *</span>
            <input value={form.issuing_body} disabled={readOnly} onChange={(event) => onChange("issuing_body", event.target.value)} style={styles.input} />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Acreedor</span>
            <input value={form.creditor} disabled={readOnly} onChange={(event) => onChange("creditor", event.target.value)} style={styles.input} />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Estado</span>
            <select value={form.status} disabled={readOnly} onChange={(event) => onChange("status", event.target.value)} style={styles.input}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label style={styles.field}>
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
          <label style={styles.field}>
            <span style={styles.label}>Fecha de notificación</span>
            <input type="date" value={form.notification_date} disabled={readOnly} onChange={(event) => onChange("notification_date", event.target.value)} style={styles.input} />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Fecha de inicio *</span>
            <input type="date" value={form.start_date} disabled={readOnly} onChange={(event) => onChange("start_date", event.target.value)} style={styles.input} />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Fecha de finalización</span>
            <input type="date" value={form.end_date} disabled={readOnly} onChange={(event) => onChange("end_date", event.target.value)} style={styles.input} />
          </label>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionNumber}>2</span>
          <div>
            <h3 style={styles.sectionTitle}>Control económico</h3>
            <p style={styles.sectionSubtitle}>Importe reclamado y seguimiento acumulado del embargo.</p>
          </div>
        </div>

        <div style={styles.economicGrid}>
          <label style={styles.field}>
            <span style={styles.label}>Deuda total</span>
            <input value={form.total_debt} disabled={readOnly} inputMode="decimal" onChange={(event) => onChange("total_debt", event.target.value)} style={styles.input} placeholder="0,00" />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Retenido hasta la fecha</span>
            <input value={form.withheld_to_date} disabled={readOnly} inputMode="decimal" onChange={(event) => onChange("withheld_to_date", event.target.value)} style={styles.input} placeholder="0,00" />
          </label>
          <label style={styles.notesField}>
            <span style={styles.label}>Observaciones</span>
            <textarea value={form.notes} disabled={readOnly} onChange={(event) => onChange("notes", event.target.value)} style={styles.textarea} />
          </label>
        </div>
      </section>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "16px" },
  section: { border: "2px solid #111111", backgroundColor: "#ffffff" },
  sectionHeader: { display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", borderBottom: "2px solid #111111", backgroundColor: "#f5ef9c" },
  sectionNumber: { width: "28px", height: "28px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px solid #111111", backgroundColor: "#ffffff", fontSize: "13px", fontWeight: 950 },
  sectionTitle: { margin: 0, fontSize: "13px", fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.03em" },
  sectionSubtitle: { margin: "2px 0 0", fontSize: "10px", color: "#4b5563", fontWeight: 650 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: "14px", padding: "16px" },
  economicGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "14px", padding: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 },
  notesField: { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0, gridColumn: "span 2" },
  label: { fontSize: "10px", fontWeight: 950, color: "#111111", textTransform: "uppercase", letterSpacing: "0.03em" },
  input: { width: "100%", minHeight: "38px", border: "2px solid #111111", borderRadius: 0, backgroundColor: "#ffffff", color: "#111111", padding: "8px 10px", boxSizing: "border-box", fontSize: "13px", fontWeight: 700 },
  textarea: { width: "100%", minHeight: "72px", border: "2px solid #111111", borderRadius: 0, resize: "vertical", padding: "8px 10px", boxSizing: "border-box", fontFamily: "inherit", fontSize: "13px" },
};
