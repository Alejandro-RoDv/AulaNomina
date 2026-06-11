import { useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import EmployeeForm from "../components/employees/EmployeeForm";
import EmployeeTable from "../components/employees/EmployeeTable";
import EmployeeTimeline from "../components/employees/EmployeeTimeline";
import { fetchEmployeeAssignmentHistory } from "../services/employeeApi";
import { openReportPreset } from "../utils/reportShortcuts";

const DOCUMENT_TYPE_LABELS = {
  SIGNED_CONTRACT: "Contrato firmado",
  CONTRACT: "Contrato",
  NAF: "Número de afiliación",
  MODEL_145: "Modelo 145",
  SEXUAL_OFFENCES_CERTIFICATE: "Certificado delitos sexuales",
  DATA_CONSENT: "Consentimiento de datos",
  CONFIDENTIALITY_COMMITMENT: "Compromiso de confidencialidad",
  DNI_NIE: "DNI / NIE",
  ID_DOCUMENT: "Documento identificativo",
  BANK_CERTIFICATE: "Certificado bancario",
  ACADEMIC_TITLE: "Título académico",
  PRL_CERTIFICATE: "Certificado PRL",
  MEDICAL_REPORT: "Informe médico",
};

const STATUS_LABELS = {
  active: "Activo",
  inactive: "Inactivo",
  pending: "Pendiente",
  received: "Recibido",
  signed: "Firmado",
  accepted: "Aceptado",
  rejected: "Rechazado",
  expired: "Caducado",
  draft: "Borrador",
  generated: "Generada",
  calculated: "Calculada",
  paid: "Pagada",
  reviewed: "Revisada",
  cancelled: "Cancelada",
  closed: "Cerrada",
  open: "Abierta",
};

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function formatValue(value) {
  return value || "-";
}

function translateStatus(value) {
  if (!value) return "-";
  return STATUS_LABELS[String(value).toLowerCase()] || value;
}

function translateDocumentType(value) {
  if (!value) return "-";
  return DOCUMENT_TYPE_LABELS[String(value).toUpperCase()] || value;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES");
}

function getActiveContract(employee, contracts) {
  return contracts.find((contract) => Number(contract.employee_id) === Number(employee.id) && contract.status === "active") || contracts.find((contract) => Number(contract.employee_id) === Number(employee.id));
}

function getEmployeeCompanyId(employee, contracts) {
  return getActiveContract(employee, contracts)?.company_id || employee.company_id;
}

function getEmployeeCenterId(employee, contracts) {
  return getActiveContract(employee, contracts)?.center_id || employee.center_id;
}

function RecordTab({ active, children, onClick }) {
  return <button type="button" onClick={onClick} style={active ? styles.recordTabActive : styles.recordTab}>{children}</button>;
}

function DataBox({ label, value, wide = false }) {
  return (
    <div style={wide ? styles.detailBoxWide : styles.detailBox}>
      <span style={styles.detailLabel}>{label}</span>
      <strong style={styles.detailValue}>{formatValue(value)}</strong>
    </div>
  );
}

export default function EmployeesPage({
  mode = "new",
  loading,
  employees,
  companies,
  workCenters,
  contracts,
  incidents,
  payrolls,
  documents = [],
  employeeForm,
  onEmployeeChange,
  onEmployeeSubmit,
  onUpdateEmployee,
  onDeleteEmployee,
  onOpenRecord,
  onDuplicateEmployee,
  onPrefillEmployee,
  employeeError,
  employeeSuccess,
  employeeSubmitting,
}) {
  const [recordEmployeeId, setRecordEmployeeId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem("aulanomina:selectedEmployeeId") || "";
  });
  const [recordTab, setRecordTab] = useState("personal");
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [assignmentHistoryLoading, setAssignmentHistoryLoading] = useState(false);
  const [assignmentHistoryError, setAssignmentHistoryError] = useState("");
  const [filters, setFilters] = useState({ id: "", name: "", dni: "", companyId: "", centerId: "", status: "" });

  const hasSelectedCompany = Boolean(filters.companyId);

  useEffect(() => {
    if (mode !== "record" || typeof window === "undefined") return;
    const storedEmployeeId = window.sessionStorage.getItem("aulanomina:selectedEmployeeId");
    if (storedEmployeeId) setRecordEmployeeId(storedEmployeeId);
  }, [mode]);

  useEffect(() => {
    if (mode !== "record" || recordTab !== "history" || !recordEmployeeId) return;

    async function loadAssignmentHistory() {
      setAssignmentHistoryLoading(true);
      setAssignmentHistoryError("");
      try {
        const data = await fetchEmployeeAssignmentHistory(recordEmployeeId);
        setAssignmentHistory(data || []);
      } catch (error) {
        setAssignmentHistoryError(error.message || "Error al cargar histórico empresa/centro");
        setAssignmentHistory([]);
      } finally {
        setAssignmentHistoryLoading(false);
      }
    }

    loadAssignmentHistory();
  }, [mode, recordTab, recordEmployeeId]);

  const companyMap = useMemo(() => companies.reduce((acc, company) => ({ ...acc, [company.id]: company }), {}), [companies]);
  const centerMap = useMemo(() => workCenters.reduce((acc, center) => ({ ...acc, [center.id]: center }), {}), [workCenters]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value, ...(name === "companyId" ? { centerId: "" } : {}) }));
    if (name === "companyId" || name === "centerId") {
      setRecordEmployeeId("");
      if (typeof window !== "undefined") window.sessionStorage.removeItem("aulanomina:selectedEmployeeId");
    }
  };

  const clearFilters = () => {
    setFilters({ id: "", name: "", dni: "", companyId: "", centerId: "", status: "" });
    setRecordEmployeeId("");
    if (typeof window !== "undefined") window.sessionStorage.removeItem("aulanomina:selectedEmployeeId");
  };

  const availableFilterCenters = useMemo(() => workCenters.filter((center) => !filters.companyId || String(center.company_id) === String(filters.companyId)), [workCenters, filters.companyId]);

  const filteredEmployees = useMemo(() => {
    if (!hasSelectedCompany) return [];

    const idFilter = normalizeText(filters.id);
    const nameFilter = normalizeText(filters.name);
    const dniFilter = normalizeText(filters.dni);

    return employees.filter((employee) => {
      const employeeId = normalizeText(employee.employee_code || employee.id);
      const fullName = normalizeText(`${employee.first_name} ${employee.last_name} ${employee.second_last_name || ""}`);
      const dni = normalizeText(employee.dni);
      const companyId = getEmployeeCompanyId(employee, contracts);
      const centerId = getEmployeeCenterId(employee, contracts);
      const status = employee.is_active ? "active" : "inactive";

      return (
        String(companyId || "") === String(filters.companyId) &&
        (!filters.centerId || String(centerId || "") === String(filters.centerId)) &&
        (!idFilter || employeeId.includes(idFilter) || String(employee.id).includes(idFilter)) &&
        (!nameFilter || fullName.includes(nameFilter)) &&
        (!dniFilter || dni.includes(dniFilter)) &&
        (!filters.status || status === filters.status)
      );
    });
  }, [employees, contracts, filters, hasSelectedCompany]);

  const selectedRecordEmployee = filteredEmployees.find((employee) => String(employee.id) === String(recordEmployeeId));
  const selectedEmployeeContracts = selectedRecordEmployee ? contracts.filter((contract) => Number(contract.employee_id) === Number(selectedRecordEmployee.id)) : [];
  const selectedEmployeeIncidents = selectedRecordEmployee ? incidents.filter((incident) => Number(incident.employee_id) === Number(selectedRecordEmployee.id)) : [];
  const selectedEmployeePayrolls = selectedRecordEmployee ? payrolls.filter((payroll) => Number(payroll.employee_id) === Number(selectedRecordEmployee.id)) : [];
  const selectedEmployeeDocuments = selectedRecordEmployee ? documents.filter((document) => Number(document.employee_id) === Number(selectedRecordEmployee.id)) : [];
  const activeContract = selectedEmployeeContracts.find((contract) => contract.status === "active") || selectedEmployeeContracts[0];
  const selectedCompanyId = activeContract?.company_id || selectedRecordEmployee?.company_id;
  const selectedCenterId = activeContract?.center_id || selectedRecordEmployee?.center_id;

  const handleRecordEmployeeChange = (event) => {
    const value = event.target.value;
    setRecordEmployeeId(value);
    setRecordTab("personal");
    setAssignmentHistory([]);
    if (typeof window !== "undefined") {
      if (value) window.sessionStorage.setItem("aulanomina:selectedEmployeeId", value);
      else window.sessionStorage.removeItem("aulanomina:selectedEmployeeId");
    }
  };

  const scopeFilters = (
    <div style={styles.filters}>
      <div style={styles.filterGroupSelect}><label>Empresa</label><select name="companyId" value={filters.companyId} onChange={handleFilterChange} style={styles.input}><option value="">Seleccionar empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
      <div style={styles.filterGroupSelect}><label>Centro</label><select name="centerId" value={filters.centerId} onChange={handleFilterChange} style={styles.input} disabled={!filters.companyId}><option value="">Todos los centros</option>{availableFilterCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></div>
      <button type="button" onClick={clearFilters} style={styles.clearButton}>Limpiar ámbito</button>
    </div>
  );

  if (mode === "list") {
    return (
      <div style={styles.wrapper}>
        <PageCard title="Listado de trabajadores" subtitle="Primero selecciona empresa. Después se muestra únicamente su plantilla.">
          <div style={styles.reportActions}>
            <button type="button" style={styles.reportButton} onClick={() => openReportPreset({ category: "employee", reportId: "employees-active" })} disabled={!hasSelectedCompany}>Informe trabajadores en alta</button>
            <button type="button" style={styles.reportButtonSecondary} onClick={() => openReportPreset({ category: "employee", reportId: "contracts-active" })} disabled={!hasSelectedCompany}>Informe contratos activos</button>
          </div>

          {scopeFilters}

          {hasSelectedCompany && (
            <div style={styles.filtersSecondary}>
              <div style={styles.filterGroupCode}><label>Código trabajador</label><input name="id" value={filters.id} onChange={handleFilterChange} style={styles.input} /></div>
              <div style={styles.filterGroupName}><label>Nombre y apellidos</label><input name="name" value={filters.name} onChange={handleFilterChange} style={styles.input} /></div>
              <div style={styles.filterGroupDni}><label>Documento</label><input name="dni" value={filters.dni} onChange={handleFilterChange} style={styles.input} /></div>
              <div style={styles.filterGroupStatus}><label>Estado</label><select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}><option value="">Todos</option><option value="active">Activo</option><option value="inactive">Inactivo</option></select></div>
            </div>
          )}

          {!hasSelectedCompany ? (
            <div style={styles.emptyCompanyState}><strong>Empresa obligatoria.</strong><p>No se muestra ningún trabajador hasta seleccionar una empresa. Esto evita listados masivos y mantiene el módulo gestionable.</p></div>
          ) : (
            <EmployeeTable loading={loading} employees={filteredEmployees} companies={companies} workCenters={workCenters} contracts={contracts} incidents={incidents} payrolls={payrolls} onUpdateEmployee={onUpdateEmployee} onDeleteEmployee={onDeleteEmployee} onOpenRecord={onOpenRecord} onDuplicateEmployee={onDuplicateEmployee} submitting={employeeSubmitting} />
          )}
        </PageCard>
      </div>
    );
  }

  if (mode === "record") {
    return (
      <div style={styles.wrapper}>
        <PageCard title="Expediente del trabajador" subtitle="Selecciona empresa y después trabajador para consultar su expediente.">
          {scopeFilters}

          {!hasSelectedCompany ? (
            <div style={styles.emptyCompanyState}><strong>Empresa obligatoria.</strong><p>Selecciona una empresa para cargar los trabajadores disponibles y consultar expedientes.</p></div>
          ) : (
            <>
              <div style={styles.recordSelectorRow}>
                <div style={styles.recordSelector}>
                  <label>Trabajador</label>
                  <select value={recordEmployeeId} onChange={handleRecordEmployeeChange} style={styles.input}>
                    <option value="">Seleccionar trabajador</option>
                    {filteredEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name} {employee.second_last_name || ""} · {employee.dni}</option>)}
                  </select>
                </div>
                {selectedRecordEmployee && (
                  <div style={styles.recordHeaderSummary}>
                    <strong>{selectedRecordEmployee.first_name} {selectedRecordEmployee.last_name} {selectedRecordEmployee.second_last_name || ""}</strong>
                    <span>{selectedRecordEmployee.dni || "Sin documento"} · {companyMap[selectedCompanyId]?.name || "Sin empresa"} · {centerMap[selectedCenterId]?.name || "Sin centro"}</span>
                  </div>
                )}
              </div>

              {!selectedRecordEmployee ? (
                <p style={styles.empty}>Selecciona un trabajador de la empresa elegida para consultar su expediente.</p>
              ) : (
                <div style={styles.recordLayout}>
                  <div style={styles.kpiRow}>
                    <div style={styles.kpiBox}><span>Estado</span><strong>{selectedRecordEmployee.is_active ? "Activo" : "Inactivo"}</strong></div>
                    <div style={styles.kpiBox}><span>Contratos</span><strong>{selectedEmployeeContracts.length}</strong></div>
                    <div style={styles.kpiBox}><span>Incidencias</span><strong>{selectedEmployeeIncidents.length}</strong></div>
                    <div style={styles.kpiBox}><span>Nóminas</span><strong>{selectedEmployeePayrolls.length}</strong></div>
                    <div style={styles.kpiBox}><span>Documentos</span><strong>{selectedEmployeeDocuments.length}</strong></div>
                  </div>

                  <div style={styles.recordTabs}>
                    <RecordTab active={recordTab === "personal"} onClick={() => setRecordTab("personal")}>Datos personales</RecordTab>
                    <RecordTab active={recordTab === "contracts"} onClick={() => setRecordTab("contracts")}>Contratos</RecordTab>
                    <RecordTab active={recordTab === "incidents"} onClick={() => setRecordTab("incidents")}>Incidencias</RecordTab>
                    <RecordTab active={recordTab === "payrolls"} onClick={() => setRecordTab("payrolls")}>Nóminas</RecordTab>
                    <RecordTab active={recordTab === "documents"} onClick={() => setRecordTab("documents")}>Documentos</RecordTab>
                    <RecordTab active={recordTab === "history"} onClick={() => setRecordTab("history")}>Histórico empresa/centro</RecordTab>
                    <RecordTab active={recordTab === "timeline"} onClick={() => setRecordTab("timeline")}>Vida laboral</RecordTab>
                    <RecordTab active={recordTab === "summary"} onClick={() => setRecordTab("summary")}>Resumen</RecordTab>
                  </div>

                  {recordTab === "personal" && (
                    <div style={styles.recordPanelWide}>
                      <h3 style={styles.panelTitle}>Datos personales y contacto</h3>
                      <div style={styles.detailGridFour}>
                        <DataBox label="Código" value={selectedRecordEmployee.employee_code} />
                        <DataBox label="Tipo documento" value={selectedRecordEmployee.document_type} />
                        <DataBox label="Documento" value={selectedRecordEmployee.dni} />
                        <DataBox label="NAF" value={selectedRecordEmployee.naf} />
                        <DataBox label="Nombre" value={selectedRecordEmployee.first_name} />
                        <DataBox label="Primer apellido" value={selectedRecordEmployee.last_name} />
                        <DataBox label="Segundo apellido" value={selectedRecordEmployee.second_last_name} />
                        <DataBox label="Sexo" value={selectedRecordEmployee.sex} />
                        <DataBox label="Fecha nacimiento" value={selectedRecordEmployee.birth_date} />
                        <DataBox label="Nacionalidad" value={selectedRecordEmployee.nationality} />
                        <DataBox label="Lugar nacimiento" value={selectedRecordEmployee.birth_place} />
                        <DataBox label="Profesión principal" value={selectedRecordEmployee.main_profession} />
                        <DataBox label="Email" value={selectedRecordEmployee.email} />
                        <DataBox label="Móvil" value={selectedRecordEmployee.mobile_phone || selectedRecordEmployee.phone} />
                        <DataBox label="Teléfono fijo" value={selectedRecordEmployee.landline_phone} />
                        <DataBox label="Código postal" value={selectedRecordEmployee.postal_code} />
                        <DataBox label="Domicilio" value={selectedRecordEmployee.domicile || selectedRecordEmployee.address} wide />
                      </div>
                    </div>
                  )}

                  {recordTab === "contracts" && (
                    <div style={styles.recordPanelWide}>
                      <h3 style={styles.panelTitle}>Contratos vinculados</h3>
                      {!selectedEmployeeContracts.length ? <p style={styles.empty}>No hay contratos vinculados.</p> : (
                        <table style={styles.miniTable}><thead><tr><th>Código</th><th>Tipo</th><th>Empresa</th><th>Centro</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Salario base</th></tr></thead><tbody>{selectedEmployeeContracts.map((contract) => <tr key={contract.id}><td>{contract.contract_code || contract.id}</td><td>{contract.contract_type || "-"}</td><td>{contract.company_name || companyMap[contract.company_id]?.name || "-"}</td><td>{contract.center_name || centerMap[contract.center_id]?.name || "-"}</td><td>{contract.start_date || "-"}</td><td>{contract.end_date || "-"}</td><td>{translateStatus(contract.status)}</td><td>{contract.salary_base || "-"}</td></tr>)}</tbody></table>
                      )}
                    </div>
                  )}

                  {recordTab === "incidents" && (
                    <div style={styles.recordPanelWide}>
                      <h3 style={styles.panelTitle}>Incidencias laborales</h3>
                      {!selectedEmployeeIncidents.length ? <p style={styles.empty}>No hay incidencias vinculadas.</p> : (
                        <table style={styles.miniTable}><thead><tr><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Afecta nómina</th><th>Descripción</th></tr></thead><tbody>{selectedEmployeeIncidents.map((incident) => <tr key={incident.id}><td>{incident.incident_type || "-"}</td><td>{incident.start_date || "-"}</td><td>{incident.end_date || "-"}</td><td>{translateStatus(incident.status)}</td><td>{incident.affects_payroll ? "Sí" : "No"}</td><td>{incident.description || "-"}</td></tr>)}</tbody></table>
                      )}
                    </div>
                  )}

                  {recordTab === "payrolls" && (
                    <div style={styles.recordPanelWide}>
                      <h3 style={styles.panelTitle}>Nóminas generadas</h3>
                      {!selectedEmployeePayrolls.length ? <p style={styles.empty}>No hay nóminas vinculadas.</p> : (
                        <table style={styles.miniTable}><thead><tr><th>Periodo</th><th>Empresa</th><th>Bruto</th><th>Deducciones</th><th>Neto</th><th>IRPF</th><th>Estado</th></tr></thead><tbody>{selectedEmployeePayrolls.map((payroll) => <tr key={payroll.id}><td>{payroll.period_label || `${payroll.period_month}/${payroll.period_year}`}</td><td>{payroll.company_name || companyMap[payroll.company_id]?.name || "-"}</td><td>{payroll.gross_salary || "-"}</td><td>{payroll.total_deductions || "-"}</td><td>{payroll.net_salary || "-"}</td><td>{payroll.irpf_percentage ?? "-"}%</td><td>{translateStatus(payroll.status)}</td></tr>)}</tbody></table>
                      )}
                    </div>
                  )}

                  {recordTab === "documents" && (
                    <div style={styles.recordPanelWide}>
                      <div style={styles.panelHeaderRow}>
                        <h3 style={styles.panelTitle}>Documentos del expediente</h3>
                        <button type="button" style={styles.reportButtonSecondary} onClick={() => { window.location.hash = "documents"; window.dispatchEvent(new Event("aulanomina-route-change")); }}>Abrir módulo documentos</button>
                      </div>
                      {!selectedEmployeeDocuments.length ? <p style={styles.empty}>No hay documentos vinculados a este trabajador.</p> : (
                        <table style={styles.miniTable}><thead><tr><th>Tipo</th><th>Nombre</th><th>Estado</th><th>Fecha emisión</th><th>Fecha caducidad</th><th>Notas</th></tr></thead><tbody>{selectedEmployeeDocuments.map((document) => <tr key={document.id}><td>{translateDocumentType(document.document_type)}</td><td>{document.name || document.title || document.document_name || "-"}</td><td>{translateStatus(document.status)}</td><td>{formatDateTime(document.issue_date || document.created_at)}</td><td>{formatDateTime(document.expiry_date || document.expiration_date)}</td><td>{document.notes || document.description || "-"}</td></tr>)}</tbody></table>
                      )}
                    </div>
                  )}

                  {recordTab === "history" && (
                    <div style={styles.recordPanelWide}>
                      <h3 style={styles.panelTitle}>Histórico empresa/centro</h3>
                      {assignmentHistoryLoading && <p style={styles.empty}>Cargando histórico...</p>}
                      {assignmentHistoryError && <div style={styles.error}>{assignmentHistoryError}</div>}
                      {!assignmentHistoryLoading && !assignmentHistoryError && !assignmentHistory.length ? <p style={styles.empty}>No hay movimientos de empresa/centro registrados.</p> : null}
                      {!assignmentHistoryLoading && !!assignmentHistory.length && (
                        <table style={styles.miniTable}>
                          <thead><tr><th>Empresa</th><th>Centro</th><th>Fecha inicio</th><th>Fecha fin</th><th>Motivo / notas</th></tr></thead>
                          <tbody>{assignmentHistory.map((assignment) => <tr key={assignment.id}><td>{assignment.company_name || companyMap[assignment.company_id]?.name || "-"}</td><td>{assignment.center_name || centerMap[assignment.center_id]?.name || "-"}</td><td>{assignment.start_date || "-"}</td><td>{assignment.end_date || "Actual"}</td><td>{assignment.notes || "-"}</td></tr>)}</tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {recordTab === "timeline" && (
                    <EmployeeTimeline employee={selectedRecordEmployee} contracts={contracts} incidents={incidents} payrolls={payrolls} documents={documents} alerts={[]} companies={companies} workCenters={workCenters} />
                  )}

                  {recordTab === "summary" && (
                    <div style={styles.recordGrid}>
                      <div style={styles.recordPanel}><h3 style={styles.panelTitle}>Formación</h3><div style={styles.detailGrid}><DataBox label="Nivel" value={selectedRecordEmployee.education_level} /><DataBox label="Título" value={selectedRecordEmployee.academic_title} /><DataBox label="Fecha concesión" value={selectedRecordEmployee.academic_title_date} /><DataBox label="Idiomas" value={selectedRecordEmployee.languages} /></div></div>
                      <div style={styles.recordPanel}><h3 style={styles.panelTitle}>Representante</h3><div style={styles.detailGrid}><DataBox label="En calidad de" value={selectedRecordEmployee.representative_role} /><DataBox label="NIF" value={selectedRecordEmployee.representative_nif} /><DataBox label="Nombre" value={selectedRecordEmployee.representative_full_name} wide /></div></div>
                      <div style={styles.recordPanelWide}><h3 style={styles.panelTitle}>Observaciones</h3><p style={styles.observations}>{selectedRecordEmployee.observations || "Sin observaciones registradas."}</p></div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </PageCard>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <PageCard title="Nuevo trabajador" subtitle="Alta de datos personales, contacto, formación, representante y observaciones. El alta laboral se gestiona desde Contratación.">
        <EmployeeForm form={employeeForm} companies={companies} workCenters={workCenters} employees={employees} contracts={contracts} onChange={onEmployeeChange} onSubmit={onEmployeeSubmit} onPrefillEmployee={onPrefillEmployee} error={employeeError} success={employeeSuccess} submitting={employeeSubmitting} />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  reportActions: { display: "flex", gap: "10px", justifyContent: "flex-end", marginBottom: "14px", flexWrap: "wrap" },
  reportButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  reportButtonSecondary: { backgroundColor: "#fff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  filters: { display: "flex", gap: "14px", alignItems: "end", flexWrap: "wrap", marginBottom: "18px" },
  filtersSecondary: { display: "flex", gap: "14px", alignItems: "end", flexWrap: "wrap", marginBottom: "18px", borderTop: "1px solid #e5e7eb", paddingTop: "14px" },
  filterGroupCode: { width: "180px", flex: "0 0 180px", display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupName: { width: "300px", flex: "0 0 300px", display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupDni: { width: "190px", flex: "0 0 190px", display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupSelect: { width: "230px", flex: "0 0 230px", display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupStatus: { width: "150px", flex: "0 0 150px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px" },
  clearButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 700 },
  empty: { margin: 0, color: "#6b7280", fontSize: "14px" },
  emptyCompanyState: { border: "1px dashed #d1d5db", borderRadius: "12px", padding: "18px", backgroundColor: "#f9fafb", color: "#4b5563", fontSize: "14px", lineHeight: 1.45 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", marginBottom: "12px" },
  recordSelectorRow: { display: "flex", gap: "16px", alignItems: "end", justifyContent: "space-between", flexWrap: "wrap", marginBottom: "18px" },
  recordSelector: { display: "flex", flexDirection: "column", gap: "6px", minWidth: "360px", flex: "1 1 420px" },
  recordHeaderSummary: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "4px", minWidth: "320px" },
  recordLayout: { display: "flex", flexDirection: "column", gap: "16px" },
  recordTabs: { display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px" },
  recordTab: { backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 800 },
  recordTabActive: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  recordGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" },
  recordPanel: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#ffffff" },
  recordPanelWide: { gridColumn: "1 / -1", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#ffffff" },
  panelHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" },
  panelTitle: { margin: "0 0 12px", fontSize: "15px", fontWeight: 900, color: "#111827" },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" },
  detailGridFour: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" },
  detailBox: { border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 },
  detailBoxWide: { gridColumn: "1 / -1", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 },
  detailLabel: { color: "#6b7280", fontSize: "12px", fontWeight: 800 },
  detailValue: { color: "#111827", fontSize: "14px", overflowWrap: "anywhere" },
  kpiRow: { display: "flex", gap: "12px", flexWrap: "wrap" },
  kpiBox: { flex: 1, minWidth: "120px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" },
  observations: { margin: 0, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-wrap" },
  miniTable: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
};
