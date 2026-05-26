import { useMemo, useState } from "react";

import DocumentForm from "../components/documents/DocumentForm";
import DocumentTable from "../components/documents/DocumentTable";
import DocumentChecklistPanel from "../components/documents/DocumentChecklistPanel";
import { createDocument } from "../services/documentApi";
import { openReportPreset } from "../utils/reportShortcuts";

const initialFilters = { document_type: "", status: "", only_critical: false };
const initialEmployeeFilters = { code: "", name: "", dni: "", company_id: "" };

const checklistTemplates = [
  ["DNI_NIE", "DNI / NIE"],
  ["NAF", "NAF"],
  ["SIGNED_CONTRACT", "Contrato firmado"],
  ["MODEL_145", "Modelo 145"],
  ["SEXUAL_OFFENCES_CERTIFICATE", "Certificado delitos sexuales"],
  ["CONFIDENTIALITY_COMMITMENT", "Compromiso confidencialidad"],
  ["DATA_CONSENT", "Consentimiento datos"],
];

const statusPriority = { expired: 0, pending: 1, received: 2, not_applicable: 3 };
const statusLabels = { pending: "Pendiente", received: "Entregado", expired: "Caducado", not_applicable: "No aplica" };

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function mergeDocuments(baseDocuments, updatedDocument) {
  return baseDocuments.map((document) => Number(document.id) === Number(updatedDocument.id) ? { ...document, ...updatedDocument } : document);
}

export default function DocumentsPage({ loading, documents, employees, companies, workCenters, documentForm, onDocumentChange, onDocumentSubmit, onUpdateDocument, onDeleteDocument, documentSubmitting, documentError, documentSuccess }) {
  const [filters, setFilters] = useState(initialFilters);
  const [employeeFilters, setEmployeeFilters] = useState(initialEmployeeFilters);
  const [localDocuments, setLocalDocuments] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [checklistMessage, setChecklistMessage] = useState("");
  const [checklistError, setChecklistError] = useState("");
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [documentActionMessage, setDocumentActionMessage] = useState("");
  const [documentActionError, setDocumentActionError] = useState("");

  const visibleDocuments = localDocuments || documents;
  const selectedEmployee = employees.find((employee) => Number(employee.id) === Number(selectedEmployeeId));

  const companyMap = useMemo(() => companies.reduce((acc, company) => ({ ...acc, [company.id]: company }), {}), [companies]);
  const centerMap = useMemo(() => workCenters.reduce((acc, center) => ({ ...acc, [center.id]: center }), {}), [workCenters]);

  const sortedDocuments = useMemo(() => [...visibleDocuments].sort((a, b) => {
    const statusDiff = (statusPriority[a.status] ?? 9) - (statusPriority[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    return String(a.expiry_date || "9999-12-31").localeCompare(String(b.expiry_date || "9999-12-31"));
  }), [visibleDocuments]);

  const employeeRows = useMemo(() => {
    const codeFilter = normalizeText(employeeFilters.code);
    const nameFilter = normalizeText(employeeFilters.name);
    const dniFilter = normalizeText(employeeFilters.dni);
    const companyFilter = employeeFilters.company_id;

    return employees
      .map((employee) => {
        const employeeDocuments = visibleDocuments.filter((document) => Number(document.employee_id) === Number(employee.id));
        const companyName = employee.company_id ? companyMap[employee.company_id]?.name || "-" : "Sin empresa";
        const centerName = employee.center_id ? centerMap[employee.center_id]?.name || "-" : "Sin centro";
        return {
          employee,
          companyName,
          centerName,
          total: employeeDocuments.length,
          pending: employeeDocuments.filter((document) => document.status === "pending").length,
          expired: employeeDocuments.filter((document) => document.status === "expired").length,
          received: employeeDocuments.filter((document) => document.status === "received").length,
        };
      })
      .filter(({ employee, companyName }) => {
        const visibleCode = normalizeText(employee.employee_code || employee.id);
        const fullName = normalizeText(`${employee.first_name} ${employee.last_name}`);
        const dni = normalizeText(employee.dni);
        const normalizedCompany = normalizeText(companyName);
        return (!codeFilter || visibleCode.includes(codeFilter) || String(employee.id).includes(codeFilter)) &&
          (!nameFilter || fullName.includes(nameFilter)) &&
          (!dniFilter || dni.includes(dniFilter)) &&
          (!companyFilter || String(employee.company_id || "") === String(companyFilter) || normalizedCompany.includes(normalizeText(companyFilter)));
      });
  }, [employees, visibleDocuments, employeeFilters, companyMap, centerMap]);

  const filteredDocuments = useMemo(() => sortedDocuments.filter((document) => {
    if (selectedEmployeeId && Number(document.employee_id) !== Number(selectedEmployeeId)) return false;
    if (filters.document_type && document.document_type !== filters.document_type) return false;
    if (filters.status && document.status !== filters.status) return false;
    if (filters.only_critical && !["pending", "expired"].includes(document.status)) return false;
    return true;
  }), [sortedDocuments, selectedEmployeeId, filters]);

  const selectedEmployeeDocuments = useMemo(() => {
    if (!selectedEmployee) return [];
    return visibleDocuments.filter((document) => Number(document.employee_id) === Number(selectedEmployee.id));
  }, [visibleDocuments, selectedEmployee]);

  const selectedTotals = useMemo(() => ({
    total: selectedEmployeeDocuments.length,
    pending: selectedEmployeeDocuments.filter((document) => document.status === "pending").length,
    expired: selectedEmployeeDocuments.filter((document) => document.status === "expired").length,
    received: selectedEmployeeDocuments.filter((document) => document.status === "received").length,
  }), [selectedEmployeeDocuments]);

  const totals = useMemo(() => ({
    total: visibleDocuments.length,
    pending: visibleDocuments.filter((document) => document.status === "pending").length,
    expired: visibleDocuments.filter((document) => document.status === "expired").length,
    received: visibleDocuments.filter((document) => document.status === "received").length,
  }), [visibleDocuments]);

  const criticalDocuments = sortedDocuments.filter((document) => ["pending", "expired"].includes(document.status)).slice(0, 6);

  const handleFilterChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFilters((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleEmployeeFilterChange = (event) => {
    const { name, value } = event.target;
    setEmployeeFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearEmployeeFilters = () => setEmployeeFilters(initialEmployeeFilters);

  const handleStatusChange = async (document, status) => {
    setDocumentActionMessage("");
    setDocumentActionError("");

    const payload = {
      center_id: document.center_id || null,
      document_type: document.document_type,
      document_name: document.document_name,
      status,
      issue_date: document.issue_date || null,
      expiry_date: document.expiry_date || null,
      notes: document.notes || null,
    };

    try {
      const updatedDocument = await onUpdateDocument(document.id, payload);
      const nextDocument = updatedDocument || { ...document, ...payload };
      const currentDocuments = localDocuments || documents;
      setLocalDocuments(mergeDocuments(currentDocuments, nextDocument));
      setDocumentActionMessage(`Estado actualizado a ${statusLabels[status] || status}.`);
    } catch (err) {
      setDocumentActionError(err.message || "Error al cambiar el estado del documento.");
    }
  };

  const handleSaveDocument = async (document, payload) => {
    setDocumentActionMessage("");
    setDocumentActionError("");

    try {
      const updatedDocument = await onUpdateDocument(document.id, payload);
      const nextDocument = updatedDocument || { ...document, ...payload };
      const currentDocuments = localDocuments || documents;
      setLocalDocuments(mergeDocuments(currentDocuments, nextDocument));
      setDocumentActionMessage("Documento actualizado correctamente.");
    } catch (err) {
      setDocumentActionError(err.message || "Error al actualizar documento.");
      throw err;
    }
  };

  const handleGenerateChecklist = async () => {
    setChecklistMessage("");
    setChecklistError("");
    setDocumentActionMessage("");
    setDocumentActionError("");

    const employee = selectedEmployee;
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
      const existingTypes = new Set(currentDocuments.filter((document) => Number(document.employee_id) === Number(employee.id)).map((document) => document.document_type));
      const missingTemplates = checklistTemplates.filter(([documentType]) => !existingTypes.has(documentType));

      if (missingTemplates.length === 0) {
        setChecklistMessage("El trabajador ya tiene el checklist documental básico creado.");
        return;
      }

      const createdDocuments = await Promise.all(missingTemplates.map(([documentType, documentName]) => createDocument({
        employee_id: Number(employee.id),
        company_id: Number(employee.company_id),
        center_id: employee.center_id ? Number(employee.center_id) : null,
        document_type: documentType,
        document_name: documentName,
        status: "pending",
        issue_date: null,
        expiry_date: null,
        notes: "Documento creado automáticamente desde checklist básico.",
      })));

      setLocalDocuments([...currentDocuments, ...createdDocuments]);
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
        <div style={styles.reportActions}>
          <button type="button" style={styles.reportButton} onClick={() => openReportPreset({ category: "documents", reportId: "documents-pending" })}>Exportar documentación pendiente</button>
          <button type="button" style={styles.reportButtonSecondary} onClick={() => openReportPreset({ category: "documents", reportId: "documents-all" })}>Estado documental completo</button>
        </div>
        <h2 style={styles.title}>Pendientes críticos</h2>
        {criticalDocuments.length === 0 ? <p style={styles.muted}>No hay pendientes críticos.</p> : (
          <ul style={styles.criticalList}>{criticalDocuments.map((document) => <li key={document.id} style={styles.criticalItem}><strong>{document.status === "expired" ? "Caducado" : "Pendiente"}:</strong> {document.document_name} — {document.employee_name || document.employee_id}</li>)}</ul>
        )}
      </section>

      <section style={styles.browserCard}>
        {!selectedEmployee ? (
          <>
            <div style={styles.browserHeader}><div><h2 style={styles.title}>Expedientes documentales por trabajador</h2><p style={styles.muted}>Selecciona un trabajador para ver su documentación y generar su checklist.</p></div></div>
            <div style={styles.employeeFiltersCard}>
              <label style={styles.label}>Código<input name="code" value={employeeFilters.code} onChange={handleEmployeeFilterChange} style={styles.input} /></label>
              <label style={styles.label}>Nombre<input name="name" value={employeeFilters.name} onChange={handleEmployeeFilterChange} style={styles.input} /></label>
              <label style={styles.label}>DNI<input name="dni" value={employeeFilters.dni} onChange={handleEmployeeFilterChange} style={styles.input} /></label>
              <label style={styles.label}>Empresa<select name="company_id" value={employeeFilters.company_id} onChange={handleEmployeeFilterChange} style={styles.input}><option value="">Todas</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
              <button type="button" onClick={clearEmployeeFilters} style={styles.secondaryButton}>Limpiar filtros</button>
            </div>
            <div style={styles.employeeList}>
              <div style={styles.employeeListHeader}><span>Trabajador</span><span>Empresa / centro</span><span>Documentos</span><span>Acción</span></div>
              {employeeRows.length === 0 ? <p style={styles.emptyList}>No hay trabajadores que coincidan con los filtros.</p> : employeeRows.map(({ employee, companyName, centerName, total, pending, expired, received }) => (
                <button key={employee.id} type="button" style={styles.employeeRow} onClick={() => { setSelectedEmployeeId(employee.id); setChecklistMessage(""); setChecklistError(""); setDocumentActionMessage(""); setDocumentActionError(""); }}>
                  <span style={styles.employeeMainCell}><strong>{employee.first_name} {employee.last_name}</strong><small>{employee.employee_code || employee.id} · {employee.dni}</small></span>
                  <span style={styles.employeeSecondaryCell}>{companyName}<small>{centerName}</small></span>
                  <span style={styles.employeeStatsCell}>Total: {total} · Pendientes: {pending} · Caducados: {expired} · Entregados: {received}</span>
                  <span style={styles.openBadge}>Abrir expediente</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={styles.browserHeaderSelected}>
              <button type="button" style={styles.secondaryButton} onClick={() => setSelectedEmployeeId(null)}>← Volver al listado</button>
              <div style={styles.selectedInfo}><h2 style={styles.title}>{selectedEmployee.first_name} {selectedEmployee.last_name}</h2><p style={styles.muted}>{selectedEmployee.employee_code || selectedEmployee.id} · {selectedEmployee.dni} · {companyMap[selectedEmployee.company_id]?.name || "Sin empresa"}</p></div>
              <div style={styles.selectedStats}><strong>Total: {selectedTotals.total}</strong><span>Pendientes: {selectedTotals.pending}</span><span>Caducados: {selectedTotals.expired}</span><span>Entregados: {selectedTotals.received}</span></div>
            </div>

            <DocumentChecklistPanel selectedEmployee={selectedEmployee} checklistLoading={checklistLoading} checklistMessage={checklistMessage} checklistError={checklistError} onGenerateChecklist={handleGenerateChecklist} />

            <section style={styles.filtersCard}>
              <label style={styles.label}>Tipo<select name="document_type" value={filters.document_type} onChange={handleFilterChange} style={styles.input}><option value="">Todos</option><option value="DNI_NIE">DNI / NIE</option><option value="NAF">NAF</option><option value="SIGNED_CONTRACT">Contrato firmado</option><option value="MODEL_145">Modelo 145</option><option value="SEXUAL_OFFENCES_CERTIFICATE">Certificado delitos sexuales</option><option value="CONFIDENTIALITY_COMMITMENT">Compromiso confidencialidad</option><option value="DATA_CONSENT">Consentimiento datos</option><option value="DEGREE_CERTIFICATE">Titulación</option><option value="OTHER">Otros</option></select></label>
              <label style={styles.label}>Estado<select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}><option value="">Todos</option><option value="pending">Pendiente</option><option value="received">Entregado</option><option value="expired">Caducado</option><option value="not_applicable">No aplica</option></select></label>
              <label style={styles.checkboxLabel}><input type="checkbox" name="only_critical" checked={filters.only_critical} onChange={handleFilterChange} />Ver solo pendientes/caducados</label>
            </section>
            <DocumentTable loading={loading} documents={filteredDocuments} statusMessage={documentActionMessage || documentSuccess} statusError={documentActionError || documentError} onMarkReceived={(document) => handleStatusChange(document, "received")} onMarkPending={(document) => handleStatusChange(document, "pending")} onMarkExpired={(document) => handleStatusChange(document, "expired")} onMarkNotApplicable={(document) => handleStatusChange(document, "not_applicable")} onSaveDocument={handleSaveDocument} />
          </>
        )}
      </section>

      <DocumentForm form={documentForm} employees={employees} companies={companies} workCenters={workCenters} onChange={onDocumentChange} onSubmit={onDocumentSubmit} submitting={documentSubmitting} />
    </div>
  );
}

function SummaryCard({ title, value }) {
  return <article style={styles.summaryCard}><p style={styles.summaryTitle}>{title}</p><p style={styles.summaryValue}>{value}</p></article>;
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  cardsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" },
  summaryCard: { border: "3px solid #111", background: "#fff", padding: "16px", boxShadow: "4px 4px 0 #f0df62" },
  summaryTitle: { margin: 0, fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#4b5563" },
  summaryValue: { margin: "8px 0 0", fontSize: "32px", fontWeight: 900, color: "#111" },
  criticalCard: { border: "2px solid #111", background: "#fff7c2", padding: "16px", boxShadow: "4px 4px 0 #111" },
  reportActions: { display: "flex", gap: "10px", justifyContent: "flex-end", marginBottom: "14px" },
  reportButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  reportButtonSecondary: { backgroundColor: "#fff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  browserCard: { border: "2px solid #111", background: "#fff", padding: "18px", boxShadow: "5px 5px 0 #f0df62" },
  browserHeader: { display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "14px" },
  browserHeaderSelected: { display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "16px", alignItems: "center", borderBottom: "3px solid #111", paddingBottom: "14px", marginBottom: "14px" },
  selectedInfo: { display: "grid", gap: "2px" },
  selectedStats: { display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-end", fontWeight: 900 },
  employeeFiltersCard: { border: "2px solid #111", background: "#fff", padding: "14px", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr)) auto", gap: "12px", alignItems: "end", marginBottom: "14px" },
  employeeList: { border: "2px solid #111" },
  employeeListHeader: { display: "grid", gridTemplateColumns: "1.4fr 1.2fr 1.4fr auto", gap: "14px", padding: "10px 14px", borderBottom: "3px solid #111", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", background: "#f9fafb" },
  employeeRow: { width: "100%", display: "grid", gridTemplateColumns: "1.4fr 1.2fr 1.4fr auto", gap: "14px", alignItems: "center", border: "none", borderBottom: "1px solid #d1d5db", background: "#fff", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: 800 },
  employeeMainCell: { display: "grid", gap: "4px" },
  employeeSecondaryCell: { display: "grid", gap: "4px" },
  employeeStatsCell: { fontWeight: 800 },
  openBadge: { border: "2px solid #111", background: "#f0df62", padding: "7px 10px", fontWeight: 900, whiteSpace: "nowrap" },
  emptyList: { margin: 0, padding: "16px", fontWeight: 800, color: "#6b7280" },
  secondaryButton: { border: "2px solid #111", background: "#fff", padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  title: { margin: "0 0 10px", fontSize: "20px", fontWeight: 900, color: "#111" },
  muted: { margin: 0, color: "#6b7280", fontWeight: 700 },
  criticalList: { margin: 0, paddingLeft: "20px", display: "grid", gap: "6px" },
  criticalItem: { fontWeight: 800, color: "#111" },
  filtersCard: { border: "2px solid #111", background: "#fff", padding: "14px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", alignItems: "end", marginBottom: "14px" },
  label: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#111" },
  checkboxLabel: { display: "flex", gap: "8px", alignItems: "center", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#111", border: "2px solid #111", padding: "9px 10px", background: "#fff" },
  input: { border: "2px solid #111", padding: "9px 10px", fontSize: "14px", fontWeight: 700, background: "#fff", color: "#111" },
};
