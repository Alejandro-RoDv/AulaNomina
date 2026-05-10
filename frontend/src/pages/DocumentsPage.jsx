import { useMemo, useState } from "react";

import DocumentForm from "../components/documents/DocumentForm";
import DocumentTable from "../components/documents/DocumentTable";
import { createDocument } from "../services/documentApi";

const initialFilters = {
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
  const [localDocuments, setLocalDocuments] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [checklistEmployeeId, setChecklistEmployeeId] = useState("");
  const [checklistMessage, setChecklistMessage] = useState("");
  const [checklistError, setChecklistError] = useState("");
  const [checklistLoading, setChecklistLoading] = useState(false);

  const visibleDocuments = localDocuments || documents;
  const selectedEmployee = employees.find((employee) => Number(employee.id) === Number(selectedEmployeeId));

  const sortedDocuments = useMemo(() => {
    return [...visibleDocuments].sort((a, b) => {
      const statusDiff = (statusPriority[a.status] ?? 9) - (statusPriority[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      return String(a.expiry_date || "9999-12-31").localeCompare(String(b.expiry_date || "9999-12-31"));
    });
  }, [visibleDocuments]);

  const employeeCards = useMemo(() => {
    return employees.map((employee) => {
      const employeeDocuments = visibleDocuments.filter((document) => Number(document.employee_id) === Number(employee.id));
      return {
        employee,
        total: employeeDocuments.length,
        pending: employeeDocuments.filter((document) => document.status === "pending").length,
        expired: employeeDocuments.filter((document) => document.status === "expired").length,
        received: employeeDocuments.filter((document) => document.status === "received").length,
      };
    });
  }, [employees, visibleDocuments]);

  const filteredDocuments = useMemo(() => {
    return sortedDocuments.filter((document) => {
      if (selectedEmployeeId && Number(document.employee_id) !== Number(selectedEmployeeId)) return false;
      if (filters.document_type && document.document_type !== filters.document_type) return false;
      if (filters.status && document.status !== filters.status) return false;
      if (filters.only_critical && !["pending", "expired"].includes(document.status)) return false;
      return true;
    });
  }, [sortedDocuments, selectedEmployeeId, filters]);

  const totals = useMemo(() => ({
    total: visibleDocuments.length,
    pending: visibleDocuments.filter((document) => document.status === "pending").length,
    expired: visibleDocuments.filter((document) => document.status === "expired").length,
    received: visibleDocuments.filter((document) => document.status === "received").length,
  }), [visibleDocuments]);

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

    if (!employee.company_id) {
      setChecklistError("Este trabajador no tiene empresa asociada. Asigna empresa/centro antes de generar documentación.");
      return;
    }

    try {
      setChecklistLoading(true);
      const currentDocuments = localDocuments || documents;
      const existingTypes = new Set(
        currentDocuments
          .filter((document) => Number(document.employee_id) === Number(employee.id))
          .map((document) => document.document_type)
      );

      const missingTemplates = checklistTemplates.filter(([documentType]) => !existingTypes.has(documentType));

      if (missingTemplates.length === 0) {
        setChecklistMessage("El trabajador ya tiene el checklist documental básico creado.");
        return;
      }

      const createdDocuments = await Promise.all(
        missingTemplates.map(([documentType, documentName]) =>
          createDocument({
            employee_id: Number(employee.id),
            company_id: Number(employee.company_id),
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

      setLocalDocuments([...currentDocuments, ...createdDocuments]);
      setSelectedEmployeeId(employee.id);
      setChecklistMessage(`Checklist creado: ${missingTemplates.length} documentos pendientes añadidos.`);
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

      {!selectedEmployee ? (
        <section style={styles.employeeListCard}>
          <h2 style={styles.title}>Expedientes documentales por trabajador</h2>
          <p style={styles.muted}>Selecciona un trabajador para ver su documentación.</p>
          <div style={styles.employeeGrid}>
            {employeeCards.map(({ employee, total, pending, expired, received }) => (
              <button key={employee.id} type="button" style={styles.employeeCard} onClick={() => setSelectedEmployeeId(employee.id)}>
                <strong>{employee.first_name} {employee.last_name}</strong>
                <span>{employee.employee_code || employee.id} · {employee.dni}</span>
                <span>Total: {total} · Pendientes: {pending} · Caducados: {expired} · Entregados: {received}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section style={styles.detailHeader}>
            <button type="button" style={styles.secondaryButton} onClick={() => setSelectedEmployeeId(null)}>← Volver al listado de trabajadores</button>
            <div>
              <h2 style={styles.title}>{selectedEmployee.first_name} {selectedEmployee.last_name}</h2>
              <p style={styles.muted}>Expediente documental del trabajador seleccionado.</p>
            </div>
          </section>

          <section style={styles.filtersCard}>
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

          <DocumentTable
            loading={loading}
            documents={filteredDocuments}
            onMarkReceived={(document) => handleStatusChange(document, "received")}
            onMarkPending={(document) => handleStatusChange(document, "pending")}
            onMarkExpired={(document) => handleStatusChange(document, "expired")}
            onMarkNotApplicable={(document) => onDeleteDocument(document.id)}
            onSaveDocument={handleSaveDocument}
          />
        </>
      )}

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
  employeeListCard: { border: "2px solid #111", background: "#fff", padding: "18px", boxShadow: "5px 5px 0 #f0df62" },
  employeeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px", marginTop: "14px" },
  employeeCard: { border: "2px solid #111", background: "#fff", padding: "14px", display: "grid", gap: "6px", textAlign: "left", fontWeight: 800, cursor: "pointer" },
  detailHeader: { border: "2px solid #111", background: "#fff", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" },
  secondaryButton: { border: "2px solid #111", background: "#fff", padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  title: { margin: "0 0 10px", fontSize: "20px", fontWeight: 900, color: "#111" },
  muted: { margin: 0, color: "#6b7280", fontWeight: 700 },
  criticalList: { margin: 0, paddingLeft: "20px", display: "grid", gap: "6px" },
  criticalItem: { fontWeight: 800, color: "#111" },
  filtersCard: { border: "2px solid #111", background: "#fff", padding: "14px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", alignItems: "end" },
  label: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#111" },
  checkboxLabel: { display: "flex", gap: "8px", alignItems: "center", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#111", border: "2px solid #111", padding: "9px 10px", background: "#fff" },
  input: { border: "2px solid #111", padding: "9px 10px", fontSize: "14px", fontWeight: 700, background: "#fff", color: "#111" },
  button: { border: "3px solid #111", background: "#f0df62", padding: "9px 14px", fontWeight: 900, cursor: "pointer", boxShadow: "3px 3px 0 #111" },
  success: { background: "#dcfce7", border: "2px solid #166534", color: "#166534", padding: "10px", fontWeight: 800, margin: 0 },
  error: { background: "#fee2e2", border: "2px solid #991b1b", color: "#991b1b", padding: "10px", fontWeight: 800, margin: 0 },
};
