import { useMemo, useState } from "react";

import DocumentForm from "../components/documents/DocumentForm";
import DocumentTable from "../components/documents/DocumentTable";
import DocumentChecklistPanel from "../components/documents/DocumentChecklistPanel";
import { createDocument } from "../services/documentApi";
import { openReportPreset } from "../utils/reportShortcuts";

const initialFilters = { document_type: "", status: "", only_critical: false };
const initialEmployeeFilters = { code: "", name: "", dni: "", company_id: "", center_id: "" };

const checklistTemplates = [
  ["DNI_NIE", "DNI / NIE"],
  ["NAF", "NAF"],
  ["SIGNED_CONTRACT", "Contrato firmado"],
  ["MODEL_145", "Modelo 145"],
  ["SEXUAL_OFFENCES_CERTIFICATE", "Certificado delitos sexuales"],
  ["CONFIDENTIALITY_COMMITMENT", "Compromiso confidencialidad"],
  ["DATA_CONSENT", "Consentimiento datos"],
];

const documentTypeOptions = [
  ["DNI_NIE", "DNI / NIE"],
  ["NAF", "NAF"],
  ["SIGNED_CONTRACT", "Contrato firmado"],
  ["MODEL_145", "Modelo 145"],
  ["SEXUAL_OFFENCES_CERTIFICATE", "Certificado delitos sexuales"],
  ["CONFIDENTIALITY_COMMITMENT", "Compromiso confidencialidad"],
  ["DATA_CONSENT", "Consentimiento datos"],
  ["DEGREE_CERTIFICATE", "Titulación"],
  ["OTHER", "Otros"],
];

const statusPriority = { expired: 0, pending: 1, received: 2, not_applicable: 3 };
const statusLabels = { pending: "Pendiente", received: "Entregado", expired: "Caducado", not_applicable: "No aplica" };

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function mergeDocuments(baseDocuments, updatedDocument) {
  return baseDocuments.map((document) => Number(document.id) === Number(updatedDocument.id) ? { ...document, ...updatedDocument } : document);
}

function matchesDocumentFilters(document, filters) {
  if (filters.document_type && document.document_type !== filters.document_type) return false;
  if (filters.status && document.status !== filters.status) return false;
  if (filters.only_critical && !["pending", "expired"].includes(document.status)) return false;
  return true;
}

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
  documentSubmitting,
  documentError,
  documentSuccess,
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [employeeFilters, setEmployeeFilters] = useState(initialEmployeeFilters);
  const [localDocuments, setLocalDocuments] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [checklistMessage, setChecklistMessage] = useState("");
  const [checklistError, setChecklistError] = useState("");
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [documentActionMessage, setDocumentActionMessage] = useState("");
  const [documentActionError, setDocumentActionError] = useState("");

  const visibleDocuments = localDocuments || documents;
  const selectedEmployee = employees.find((employee) => Number(employee.id) === Number(selectedEmployeeId));
  const hasSelectedCompany = Boolean(employeeFilters.company_id);
  const hasDocumentFilters = Boolean(filters.document_type || filters.status || filters.only_critical);

  const companyMap = useMemo(() => companies.reduce((acc, company) => ({ ...acc, [company.id]: company }), {}), [companies]);
  const centerMap = useMemo(() => workCenters.reduce((acc, center) => ({ ...acc, [center.id]: center }), {}), [workCenters]);
  const availableCenters = useMemo(
    () => workCenters.filter((center) => String(center.company_id) === String(employeeFilters.company_id)),
    [workCenters, employeeFilters.company_id],
  );

  const scopedDocuments = useMemo(() => {
    if (!hasSelectedCompany) return [];
    return visibleDocuments.filter((document) => {
      if (String(document.company_id || "") !== String(employeeFilters.company_id)) return false;
      if (employeeFilters.center_id && String(document.center_id || "") !== String(employeeFilters.center_id)) return false;
      return true;
    });
  }, [visibleDocuments, hasSelectedCompany, employeeFilters.company_id, employeeFilters.center_id]);

  const sortedDocuments = useMemo(() => [...scopedDocuments].sort((a, b) => {
    const statusDiff = (statusPriority[a.status] ?? 9) - (statusPriority[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    return String(a.expiry_date || "9999-12-31").localeCompare(String(b.expiry_date || "9999-12-31"));
  }), [scopedDocuments]);

  const filteredScopeDocuments = useMemo(
    () => sortedDocuments.filter((document) => matchesDocumentFilters(document, filters)),
    [sortedDocuments, filters],
  );

  const employeeRows = useMemo(() => {
    if (!hasSelectedCompany) return [];

    const codeFilter = normalizeText(employeeFilters.code);
    const nameFilter = normalizeText(employeeFilters.name);
    const dniFilter = normalizeText(employeeFilters.dni);

    return employees
      .filter((employee) => {
        if (String(employee.company_id || "") !== String(employeeFilters.company_id)) return false;
        if (employeeFilters.center_id && String(employee.center_id || "") !== String(employeeFilters.center_id)) return false;
        return true;
      })
      .map((employee) => {
        const employeeDocuments = filteredScopeDocuments.filter((document) => Number(document.employee_id) === Number(employee.id));
        if (hasDocumentFilters && employeeDocuments.length === 0) return null;

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
      .filter(Boolean)
      .filter(({ employee }) => {
        const visibleCode = normalizeText(employee.employee_code || employee.id);
        const fullName = normalizeText(`${employee.first_name} ${employee.last_name}`);
        const dni = normalizeText(employee.dni);
        return (!codeFilter || visibleCode.includes(codeFilter) || String(employee.id).includes(codeFilter))
          && (!nameFilter || fullName.includes(nameFilter))
          && (!dniFilter || dni.includes(dniFilter));
      });
  }, [employees, filteredScopeDocuments, employeeFilters, hasSelectedCompany, hasDocumentFilters, companyMap, centerMap]);

  const filteredDocuments = useMemo(() => filteredScopeDocuments.filter((document) => {
    if (selectedEmployeeId && Number(document.employee_id) !== Number(selectedEmployeeId)) return false;
    return true;
  }), [filteredScopeDocuments, selectedEmployeeId]);

  const selectedEmployeeDocuments = useMemo(() => {
    if (!selectedEmployee) return [];
    return scopedDocuments.filter((document) => Number(document.employee_id) === Number(selectedEmployee.id));
  }, [scopedDocuments, selectedEmployee]);

  const selectedTotals = useMemo(() => ({
    total: selectedEmployeeDocuments.length,
    pending: selectedEmployeeDocuments.filter((document) => document.status === "pending").length,
    expired: selectedEmployeeDocuments.filter((document) => document.status === "expired").length,
    received: selectedEmployeeDocuments.filter((document) => document.status === "received").length,
  }), [selectedEmployeeDocuments]);

  const totals = useMemo(() => ({
    total: scopedDocuments.length,
    pending: scopedDocuments.filter((document) => document.status === "pending").length,
    expired: scopedDocuments.filter((document) => document.status === "expired").length,
    received: scopedDocuments.filter((document) => document.status === "received").length,
  }), [scopedDocuments]);

  const criticalDocuments = sortedDocuments.filter((document) => ["pending", "expired"].includes(document.status)).slice(0, 6);

  const handleFilterChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFilters((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleEmployeeFilterChange = (event) => {
    const { name, value } = event.target;
    setEmployeeFilters((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "company_id" ? { center_id: "" } : {}),
    }));
    setSelectedEmployeeId(null);
  };

  const clearAllFilters = () => {
    setEmployeeFilters(initialEmployeeFilters);
    setFilters(initialFilters);
    setSelectedEmployeeId(null);
  };

  const clearEmployeeSearch = () => {
    setEmployeeFilters((prev) => ({ ...prev, code: "", name: "", dni: "" }));
  };

  const setDocumentField = (name, value) => {
    onDocumentChange({ target: { name, value: value == null ? "" : String(value) } });
  };

  const handleOpenCreateForm = () => {
    if (selectedEmployee) {
      setDocumentField("employee_id", selectedEmployee.id);
      setDocumentField("company_id", selectedEmployee.company_id || "");
      setDocumentField("center_id", selectedEmployee.center_id || "");
    } else if (employeeFilters.company_id) {
      setDocumentField("employee_id", "");
      setDocumentField("company_id", employeeFilters.company_id);
      setDocumentField("center_id", employeeFilters.center_id || "");
    }
    setShowCreateForm(true);
  };

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
      const existingTypes = new Set(
        currentDocuments
          .filter((document) => Number(document.employee_id) === Number(employee.id))
          .map((document) => document.document_type),
      );
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

  const openEmployee = (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setChecklistMessage("");
    setChecklistError("");
    setDocumentActionMessage("");
    setDocumentActionError("");
  };

  return (
    <div className="documents-workspace">
      <section className="documents-controls">
        <div className="documents-controls__header">
          <div>
            <span className="documents-section-kicker">Consulta documental</span>
            <h2>Filtros y ámbito</h2>
            <p>Selecciona una empresa y acota el listado por centro, tipo o estado documental.</p>
          </div>
          <button
            type="button"
            className="documents-new-button"
            onClick={() => (showCreateForm ? setShowCreateForm(false) : handleOpenCreateForm())}
          >
            {showCreateForm ? "Cerrar nuevo documento" : "+ Nuevo documento"}
          </button>
        </div>

        <div className="documents-filter-grid">
          <label className="documents-field documents-field--company">
            <span>Empresa</span>
            <select name="company_id" value={employeeFilters.company_id} onChange={handleEmployeeFilterChange}>
              <option value="">Seleccionar empresa</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>

          <label className="documents-field">
            <span>Centro</span>
            <select name="center_id" value={employeeFilters.center_id} onChange={handleEmployeeFilterChange} disabled={!employeeFilters.company_id}>
              <option value="">Todos los centros</option>
              {availableCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
            </select>
          </label>

          <label className="documents-field">
            <span>Tipo documental</span>
            <select name="document_type" value={filters.document_type} onChange={handleFilterChange} disabled={!hasSelectedCompany}>
              <option value="">Todos los tipos</option>
              {documentTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="documents-field">
            <span>Estado</span>
            <select name="status" value={filters.status} onChange={handleFilterChange} disabled={!hasSelectedCompany}>
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="received">Entregado</option>
              <option value="expired">Caducado</option>
              <option value="not_applicable">No aplica</option>
            </select>
          </label>

          <label className={`documents-critical-toggle${!hasSelectedCompany ? " is-disabled" : ""}`}>
            <input type="checkbox" name="only_critical" checked={filters.only_critical} onChange={handleFilterChange} disabled={!hasSelectedCompany} />
            <span>Solo pendientes o caducados</span>
          </label>

          <button type="button" className="documents-clear-button" onClick={clearAllFilters}>
            Limpiar filtros
          </button>
        </div>
      </section>

      {showCreateForm && (
        <div className="documents-create-area">
          {(documentError || documentSuccess) && (
            <div className={`documents-inline-message ${documentError ? "is-error" : "is-success"}`}>
              {documentError || documentSuccess}
            </div>
          )}
          <DocumentForm
            form={documentForm}
            employees={employees}
            companies={companies}
            workCenters={workCenters}
            onChange={onDocumentChange}
            onSubmit={onDocumentSubmit}
            onCancel={() => setShowCreateForm(false)}
            submitting={documentSubmitting}
          />
        </div>
      )}

      <section className="documents-summary-grid" aria-label="Resumen documental">
        <SummaryCard title="Documentos" value={totals.total} />
        <SummaryCard title="Pendientes" value={totals.pending} tone={totals.pending ? "warning" : "neutral"} />
        <SummaryCard title="Caducados" value={totals.expired} tone={totals.expired ? "danger" : "neutral"} />
        <SummaryCard title="Entregados" value={totals.received} tone={totals.received ? "success" : "neutral"} />
      </section>

      {hasSelectedCompany && (
        <section className={`documents-critical-strip ${criticalDocuments.length ? "is-warning" : "is-clear"}`}>
          <div>
            <span className="documents-section-kicker">Control documental</span>
            <h2>Pendientes críticos</h2>
          </div>
          {criticalDocuments.length === 0 ? (
            <p>No hay documentos pendientes o caducados en el ámbito seleccionado.</p>
          ) : (
            <div className="documents-critical-items">
              {criticalDocuments.map((document) => (
                <span key={document.id} className={document.status === "expired" ? "is-expired" : "is-pending"}>
                  {document.status === "expired" ? "Caducado" : "Pendiente"} · {document.document_name} · {document.employee_name || document.employee_id}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="documents-browser-card">
        {!selectedEmployee ? (
          <>
            <div className="documents-browser-header">
              <div>
                <span className="documents-section-kicker">Expedientes</span>
                <h2>Documentación por trabajador</h2>
                <p>
                  {hasSelectedCompany
                    ? `${employeeRows.length} trabajador${employeeRows.length === 1 ? "" : "es"} visible${employeeRows.length === 1 ? "" : "s"} con los filtros actuales.`
                    : "Selecciona una empresa en los filtros superiores para cargar sus trabajadores."}
                </p>
              </div>
              <div className="documents-report-actions">
                <button type="button" onClick={() => openReportPreset({ category: "documents", reportId: "documents-pending" })} disabled={!hasSelectedCompany}>
                  Pendientes
                </button>
                <button type="button" onClick={() => openReportPreset({ category: "documents", reportId: "documents-all" })} disabled={!hasSelectedCompany}>
                  Estado completo
                </button>
              </div>
            </div>

            {hasSelectedCompany && (
              <div className="documents-employee-search">
                <label className="documents-field">
                  <span>Código</span>
                  <input name="code" value={employeeFilters.code} onChange={handleEmployeeFilterChange} placeholder="Código de trabajador" />
                </label>
                <label className="documents-field">
                  <span>Nombre</span>
                  <input name="name" value={employeeFilters.name} onChange={handleEmployeeFilterChange} placeholder="Nombre o apellidos" />
                </label>
                <label className="documents-field">
                  <span>DNI / NIE</span>
                  <input name="dni" value={employeeFilters.dni} onChange={handleEmployeeFilterChange} placeholder="Documento de identidad" />
                </label>
                <button type="button" onClick={clearEmployeeSearch}>Limpiar búsqueda</button>
              </div>
            )}

            {!hasSelectedCompany ? (
              <div className="documents-empty-state">
                <strong>Selecciona una empresa</strong>
                <p>El selector está en la parte superior del módulo. Al elegirla se cargarán sus trabajadores, centros y documentación.</p>
              </div>
            ) : employeeRows.length === 0 ? (
              <div className="documents-empty-state">
                <strong>Sin resultados</strong>
                <p>No hay trabajadores que coincidan con los filtros actuales.</p>
              </div>
            ) : (
              <div className="documents-employee-list">
                <div className="documents-employee-list__header">
                  <span>Trabajador</span>
                  <span>Empresa / centro</span>
                  <span>Documentos</span>
                  <span>Acción</span>
                </div>
                {employeeRows.map(({ employee, companyName, centerName, total, pending, expired, received }) => (
                  <div key={employee.id} className="documents-employee-row">
                    <div className="documents-employee-main">
                      <strong>{employee.first_name} {employee.last_name}</strong>
                      <small>{employee.employee_code || employee.id} · {employee.dni}</small>
                    </div>
                    <div className="documents-employee-company">
                      <span>{companyName}</span>
                      <small>{centerName}</small>
                    </div>
                    <div className="documents-employee-stats">
                      <span>Total <strong>{total}</strong></span>
                      <span>Pend. <strong>{pending}</strong></span>
                      <span>Cad. <strong>{expired}</strong></span>
                      <span>Ent. <strong>{received}</strong></span>
                    </div>
                    <button type="button" className="documents-open-button" onClick={() => openEmployee(employee.id)}>
                      Abrir expediente
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="documents-selected-header">
              <button type="button" onClick={() => setSelectedEmployeeId(null)}>← Volver</button>
              <div>
                <span className="documents-section-kicker">Expediente documental</span>
                <h2>{selectedEmployee.first_name} {selectedEmployee.last_name}</h2>
                <p>{selectedEmployee.employee_code || selectedEmployee.id} · {selectedEmployee.dni} · {companyMap[selectedEmployee.company_id]?.name || "Sin empresa"}</p>
              </div>
              <div className="documents-selected-stats">
                <span>Total <strong>{selectedTotals.total}</strong></span>
                <span>Pendientes <strong>{selectedTotals.pending}</strong></span>
                <span>Caducados <strong>{selectedTotals.expired}</strong></span>
                <span>Entregados <strong>{selectedTotals.received}</strong></span>
              </div>
            </div>

            <DocumentChecklistPanel
              selectedEmployee={selectedEmployee}
              checklistLoading={checklistLoading}
              checklistMessage={checklistMessage}
              checklistError={checklistError}
              onGenerateChecklist={handleGenerateChecklist}
            />

            <div className="documents-selected-toolbar">
              <p>{filteredDocuments.length} documento{filteredDocuments.length === 1 ? "" : "s"} con los filtros actuales.</p>
              <button type="button" className="documents-new-button documents-new-button--compact" onClick={handleOpenCreateForm}>
                + Nuevo documento para este trabajador
              </button>
            </div>

            <DocumentTable
              loading={loading}
              documents={filteredDocuments}
              statusMessage={documentActionMessage || documentSuccess}
              statusError={documentActionError || documentError}
              onMarkReceived={(document) => handleStatusChange(document, "received")}
              onMarkPending={(document) => handleStatusChange(document, "pending")}
              onMarkExpired={(document) => handleStatusChange(document, "expired")}
              onMarkNotApplicable={(document) => handleStatusChange(document, "not_applicable")}
              onSaveDocument={handleSaveDocument}
            />
          </>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ title, value, tone = "neutral" }) {
  return (
    <article className={`documents-summary-card is-${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}
