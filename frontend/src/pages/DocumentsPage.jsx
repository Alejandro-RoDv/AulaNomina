import { useMemo, useState } from "react";

import DocumentForm from "../components/documents/DocumentForm";
import DocumentTable from "../components/documents/DocumentTable";
import { createDocument } from "../services/documentApi";

const initialFilters = {
  employee_id: "",
  document_type: "",
  status: "",
  only_critical: false,
};

const checklistTemplates = [
  ["DNI_NIE", "DNI / NIE"],
  ["NAF", "NAF"],
  ["SIGNED_CONTRACT", "Contrato firmado"],
  ["MODEL_145", "Modelo 145"],
  ["SEXUAL_OFFENCES_CERTIFICATE", "Certificado delitos sexuales"],
  ["CONFIDENTIALITY_COMMITMENT", "Compromiso confidencialidad"],
  ["DATA_CONSENT", "Consentimiento datos"],
];

const statusPriority = {
  expired: 0,
  pending: 1,
  received: 2,
  not_applicable: 3,
};

export default function DocumentsPage({
  loading,
  documents,
  employees,
  companies,
  workCenters,
  documentForm,
  onDocumentChange,
  onDocumentSubmit,
  onUpdateDocument,
  onDeleteDocument,
  documentSubmitting,
  documentError,
  documentSuccess,
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [checklistEmployeeId, setChecklistEmployeeId] = useState("");
  const [checklistMessage, setChecklistMessage] = useState("");
  const [checklistError, setChecklistError] = useState("");
  const [checklistLoading, setChecklistLoading] = useState(false);

  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      const statusDiff = (statusPriority[a.status] ?? 9) - (statusPriority[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      return String(a.expiry_date || "9999-12-31").localeCompare(String(b.expiry_date || "9999-12-31"));
    });
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return sortedDocuments.filter((document) => {
      if (filters.employee_id && String(document.employee_id) !== String(filters.employee_id)) return false;
      if (filters.document_type && document.document_type !== filters.document_type) return false;
      if (filters.status && document.status !== filters.status) return false;
      if (filters.only_critical && !["pending", "expired"].includes(document.status)) return false;
      return true;
    });
  }, [sortedDocuments, filters]);

  const totals = useMemo(() => ({
    total: documents.length,
    pending: documents.filter((document) => document.status === "pending").length,
    expired: documents.filter((document) => document.status === "expired").length,
    received: documents.filter((document) => document.status === "received").length,
  }), [documents]);

  const criticalDocuments = sortedDocuments
    .filter((document) => ["pending", "expired"].includes(document.status))
    .slice(0, 6);

  const handleFilterChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFilters((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleStatusChange = async (document, status) => {
    await onUpdateDocument(document.id, {
      center_id: document.center_id || null,
      document_type: document.document_type,
      document_name: document.document_name,
      status,
      issue_date: document.issue_date || null,
      expiry_date: document.expiry_date || null,
      notes: document.notes || null,
    });
  };

  const handleSaveDocument = async (document, payload) => {
    await onUpdateDocument(document.id, payload);
  };

  const handleGenerateChecklist = async () => {
    setChecklistMessage("");
    setChecklistError("");

    const employee = employees.find((item) => String(item.id) === String(checklistEmployeeId));
    if (!employee) {
      setChecklistError("Selecciona un trabajador para generar el checklist.");
      return;
    }

    try {
      setChecklistLoading(true);
      const existingTypes = new Set(
        documents
          .filter((document) => Number(document.employee_id) === Number(employee.id))
          .map((document) => document.document_type)
      );

      const missingTemplates = checklistTemplates.filter(([documentType]) => !existingTypes.has(documentType));

      if (missingTemplates.length === 0) {
        setChecklistMessage("El trabajador ya tiene el checklist documental básico creado.");
        return;
      }

      await Promise.all(
        missingTemplates.map(([documentType, documentName]) =>
          createDocument({
            employee_id: Number(employee.id),
            company_id: employee.company_id ? Number(employee.company_id) : null,
            center_id: employee.center_id ? Number(employee.center_id) : null,
            document_type: documentType,
            document_name: documentName,
            status: "pending",
            issue_date: null,
            expiry_date: null,
            notes: "Documento creado automáticamente desde checklist básico.",
          })
        )
      );

      setChecklistMessage(`Checklist creado: ${missingTemplates.length} documentos pendientes añadidos.`);
      window.location.reload();
    } catch (err) {
      setChecklistError(err.message || "Error al generar checklist documental.");
    } finally {
      setChecklistLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <section style={styles.cardsGrid}>
        <SummaryCard title="Documentos totales" value={totals.total} />
        <SummaryCard title="Pendientes" value={totals.pending} />
        <SummaryCard title="Caducados" value={totals.expired} />
        <SummaryCard title="Entregados" value={totals.received} />
      </section>

      <section style={styles.criticalCard}>
        <h2 style={styles.title}>Pendientes críticos</h2>
        {criticalDocuments.length === 0 ? (
          <p style={styles.muted}>No hay pendientes críticos.</p>
        ) : (
          <ul style={styles.criticalList}>
            {criticalDocuments.map((document) => (
              <li key={document.id} style={styles.criticalItem}>
                <strong>{document.status === "expired" ? "Caducado" : "Pendiente"}:</strong> {document.document_name} — {document.employee_name || document.employee_id}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={styles.checklistCard}>
        <div>
          <h2 style={styles.title}>Checklist documental</h2>
          <p style={styles.muted}>Crea automáticamente los documentos básicos pendientes para un trabajador.</p>
        </div>
        <div style={styles.checklistActions}>
          <select value={checklistEmployeeId} onChange={(event) => setChecklistEmployeeId(event.target.value)} style={styles.input}>
            <option value="">Seleccionar trabajador</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>
            ))}
          </select>
          <button type="button" onClick={handleGenerateChecklist} disabled={checklistLoading} style={styles.button}>
            {checklistLoading ? "Generando..." : "Generar checklist"}
          </button>
        </div>
        {checklistMessage ? <p style={styles.success}>{checklistMessage}</p> : null}
        {checklistError ? <p style={styles.error}>{checklistError}</p> : null}
      </section>

      <section style={styles.filtersCard}>
        <label style={styles.label}>
          Trabajador
          <select name="employee_id" value={filters.employee_id} onChange={handleFilterChange} style={styles.input}>
            <option value="">Todos</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Tipo
          <select name="document_type" value={filters.document_type} onChange={handleFilterChange} style={styles.input}>
            <option value="">Todos</option>
            <option value="DNI_NIE">DNI / NIE</option>
            <option value="NAF">NAF</option>
            <option value="SIGNED_CONTRACT">Contrato firmado</option>
            <option value="MODEL_145">Modelo 145</option>
            <option value="SEXUAL_OFFENCES_CERTIFICATE">Certificado delitos sexuales</option>
            <option value="CONFIDENTIALITY_COMMITMENT">Compromiso confidencialidad</option>
            <option value="DATA_CONSENT">Consentimiento datos</option>
            <option value="DEGREE_CERTIFICATE">Titulación</option>
            <option value="OTHER">Otros</option>
          </select>
        </label>

        <label style={styles.label}>
          Estado
          <select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}>
            <option value="">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="received">Entregado</option>
            <option value="expired">Caducado</option>
            <option value="not_applicable">No aplica</option>
          </select>
        </label>

        <label style={styles.checkboxLabel}>
          <input type="checkbox" name="only_critical" checked={filters.only_critical} onChange={handleFilterChange} />
          Ver solo pendientes/caducados
        </label>
      </section>

      <DocumentForm
        form={documentForm}
        employees={employees}
        companies={companies}
        workCenters={workCenters}
        onChange={onDocumentChange}
        onSubmit={onDocumentSubmit}
        submitting={documentSubmitting}
        error={documentError}
        success={documentSuccess}
      />

      <DocumentTable
        loading={loading}
        documents={filteredDocuments}
        onMarkReceived={(document) => handleStatusChange(document, "received")}
        onMarkPending={(document) => handleStatusChange(document, "pending")}
        onMarkExpired={(document) => handleStatusChange(document, "expired")}
        onMarkNotApplicable={(document) => onDeleteDocument(document.id)}
        onSaveDocument={handleSaveDocument}
      />
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <article style={styles.summaryCard}>
      <p style={styles.summaryTitle}>{title}</p>
      <p style={styles.summaryValue}>{value}</p>
    </article>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  cardsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" },
  summaryCard: { border: "3px solid #111", background: "#fff", padding: "16px", boxShadow: "4px 4px 0 #f0df62" },
  summaryTitle: { margin: 0, fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#4b5563" },
  summaryValue: { margin: "8px 0 0", fontSize: "32px", fontWeight: 900, color: "#111" },
  criticalCard: { border: "2px solid #111", background: "#fff7c2", padding: "16px", boxShadow: "4px 4px 0 #111" },
  checklistCard: { border: "2px solid #111", background: "#fff", padding: "16px", boxShadow: "4px 4px 0 #f0df62", display: "grid", gap: "12px" },
  checklistActions: { display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "center" },
  title: { margin: "0 0 10px", fontSize: "20px", fontWeight: 900, color: "#111" },
  muted: { margin: 0, color: "#6b7280", fontWeight: 700 },
  criticalList: { margin: 0, paddingLeft: "20px", display: "grid", gap: "6px" },
  criticalItem: { fontWeight: 800, color: "#111" },
  filtersCard: { border: "2px solid #111", background: "#fff", padding: "14px", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px", alignItems: "end" },
  label: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#111" },
  checkboxLabel: { display: "flex", gap: "8px", alignItems: "center", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#111", border: "2px solid #111", padding: "9px 10px", background: "#fff" },
  input: { border: "2px solid #111", padding: "9px 10px", fontSize: "14px", fontWeight: 700, background: "#fff", color: "#111" },
  button: { border: "3px solid #111", background: "#f0df62", padding: "9px 14px", fontWeight: 900, cursor: "pointer", boxShadow: "3px 3px 0 #111" },
  success: { background: "#dcfce7", border: "2px solid #166534", color: "#166534", padding: "10px", fontWeight: 800, margin: 0 },
  error: { background: "#fee2e2", border: "2px solid #991b1b", color: "#991b1b", padding: "10px", fontWeight: 800, margin: 0 },
};
