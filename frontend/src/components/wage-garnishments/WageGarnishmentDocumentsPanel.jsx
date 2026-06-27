import { useEffect, useState } from "react";

import {
  createWageGarnishmentDocument,
  fetchWageGarnishmentDocuments,
} from "../../services/wageGarnishmentApi";

const TYPES = [
  ["WAGE_GARNISHMENT_ORDER", "Orden de embargo"],
  ["WAGE_GARNISHMENT_MODIFICATION", "Modificación"],
  ["WAGE_GARNISHMENT_SUSPENSION", "Suspensión"],
  ["WAGE_GARNISHMENT_RELEASE", "Levantamiento"],
  ["WAGE_GARNISHMENT_PAYMENT_RECEIPT", "Justificante de ingreso"],
  ["OTHER", "Otro documento"],
];

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export default function WageGarnishmentDocumentsPanel({ garnishment }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    document_type: "WAGE_GARNISHMENT_ORDER",
    document_name: "",
    issue_date: "",
    notes: "",
  });

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setDocuments(await fetchWageGarnishmentDocuments(garnishment.id));
    } catch (loadError) {
      setError(loadError.message || "No se han podido cargar los documentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchWageGarnishmentDocuments(garnishment.id)
      .then((data) => {
        if (active) setDocuments(data);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "No se han podido cargar los documentos");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [garnishment.id]);

  const submitDocument = async () => {
    setError("");
    if (!form.document_name.trim()) {
      setError("Indica un nombre para el documento.");
      return;
    }
    try {
      setSaving(true);
      await createWageGarnishmentDocument(garnishment.id, {
        employee_id: garnishment.employee_id,
        company_id: garnishment.company_id,
        center_id: null,
        wage_garnishment_id: garnishment.id,
        document_type: form.document_type,
        document_name: form.document_name.trim(),
        status: "received",
        issue_date: form.issue_date || null,
        expiry_date: null,
        notes: form.notes.trim() || null,
      });
      setForm((previous) => ({ ...previous, document_name: "", issue_date: "", notes: "" }));
      await loadDocuments();
    } catch (saveError) {
      setError(saveError.message || "No se ha podido vincular el documento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Documentación del expediente</h3>
          <p style={styles.subtitle}>Registra órdenes, modificaciones, suspensiones, levantamientos y justificantes.</p>
        </div>
        <span style={styles.counter}>{documents.length} documentos</span>
      </div>

      <div style={styles.formGrid}>
        <label style={styles.field}><span>Tipo documental</span><select value={form.document_type} onChange={(event) => setForm((previous) => ({ ...previous, document_type: event.target.value }))} style={styles.input}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label style={styles.fieldWide}><span>Nombre del documento</span><input value={form.document_name} onChange={(event) => setForm((previous) => ({ ...previous, document_name: event.target.value }))} style={styles.input} placeholder="Ej. Diligencia de embargo 15/06/2026" /></label>
        <label style={styles.field}><span>Fecha del documento</span><input type="date" value={form.issue_date} onChange={(event) => setForm((previous) => ({ ...previous, issue_date: event.target.value }))} style={styles.input} /></label>
        <label style={styles.fieldWide}><span>Observaciones</span><input value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} style={styles.input} /></label>
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <div style={styles.actions}><button type="button" disabled={saving} onClick={submitDocument} style={styles.primaryButton}>{saving ? "Vinculando…" : "Vincular documento"}</button></div>

      <div style={styles.list}>
        {loading && <div style={styles.empty}>Cargando documentos…</div>}
        {!loading && documents.length === 0 && <div style={styles.empty}>No hay documentos vinculados.</div>}
        {!loading && documents.map((document) => (
          <article key={document.id} style={styles.documentCard}>
            <div style={styles.documentIcon}>DOC</div>
            <div style={styles.documentText}>
              <strong>{document.document_name}</strong>
              <span>{TYPES.find(([value]) => value === document.document_type)?.[1] || document.document_type}</span>
            </div>
            <span style={styles.date}>{formatDate(document.issue_date)}</span>
            <span style={styles.status}>{document.status === "received" ? "Recibido" : document.status}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

const styles = {
  panel: { border: "1px solid #d4d4d8", borderRadius: "12px", backgroundColor: "#fff", overflow: "hidden" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "16px 18px", borderBottom: "1px solid #e4e4e7", backgroundColor: "#fffdf0" },
  title: { margin: 0, fontSize: "16px", fontWeight: 900 },
  subtitle: { margin: "4px 0 0", fontSize: "11px", color: "#64748b" },
  counter: { borderRadius: "999px", backgroundColor: "#f4e96b", padding: "7px 10px", fontSize: "10px", fontWeight: 850 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", padding: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "10px", fontWeight: 850 },
  fieldWide: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "10px", fontWeight: 850, gridColumn: "span 2" },
  input: { minHeight: "39px", border: "1px solid #a1a1aa", borderRadius: "7px", padding: "8px 9px", boxSizing: "border-box", backgroundColor: "#fff", fontSize: "12px" },
  actions: { display: "flex", justifyContent: "flex-end", padding: "0 16px 16px" },
  primaryButton: { border: "1px solid #111827", borderRadius: "7px", backgroundColor: "#f4e96b", padding: "9px 14px", fontSize: "10px", fontWeight: 900, cursor: "pointer" },
  error: { margin: "0 16px 12px", border: "1px solid #fecaca", borderRadius: "7px", backgroundColor: "#fff1f2", color: "#991b1b", padding: "9px 11px", fontSize: "11px", fontWeight: 750 },
  list: { borderTop: "1px solid #e4e4e7", padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: "8px" },
  documentCard: { display: "grid", gridTemplateColumns: "42px 1fr auto auto", gap: "12px", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px" },
  documentIcon: { width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", backgroundColor: "#111827", color: "#fff", fontSize: "9px", fontWeight: 900 },
  documentText: { display: "flex", flexDirection: "column", gap: "2px", fontSize: "11px" },
  date: { color: "#475569", fontSize: "10px", whiteSpace: "nowrap" },
  status: { borderRadius: "999px", backgroundColor: "#dcfce7", color: "#166534", padding: "5px 8px", fontSize: "9px", fontWeight: 850 },
  empty: { padding: "22px", textAlign: "center", color: "#64748b", fontSize: "11px" },
};
