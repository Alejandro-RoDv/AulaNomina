import { useMemo, useState } from "react";

const emptyEditForm = {
  employee_code: "",
  dni: "",
  naf: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  birth_date: "",
  address: "",
  city: "",
  province: "",
  postal_code: "",
  is_active: true,
};

const incidentTypeLabels = {
  IT: "IT / baja médica",
  RECAIDA: "Recaída",
  VACACIONES: "Vacaciones",
  AUSENCIA: "Ausencia",
  PERMISO_RETRIBUIDO: "Permiso retribuido",
  PERMISO_NO_RETRIBUIDO: "Permiso no retribuido",
};

const incidentStatusLabels = {
  open: "Abierta",
  closed: "Cerrada",
};

const payrollStatusLabels = {
  draft: "Borrador",
  calculated: "Calculada",
  closed: "Cerrada",
};

function toEditForm(employee) {
  return {
    employee_code: employee.employee_code || "",
    dni: employee.dni || "",
    naf: employee.naf || "",
    first_name: employee.first_name || "",
    last_name: employee.last_name || "",
    email: employee.email || "",
    phone: employee.phone || "",
    birth_date: employee.birth_date || "",
    address: employee.address || "",
    city: employee.city || "",
    province: employee.province || "",
    postal_code: employee.postal_code || "",
    is_active: employee.is_active ?? true,
  };
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatPeriod(payroll) {
  if (!payroll) return "-";
  if (payroll.period_label) return payroll.period_label;
  const month = String(payroll.period_month || "").padStart(2, "0");
  return `${month}/${payroll.period_year || ""}`;
}

function payrollPeriodSortValue(payroll) {
  return Number(`${payroll.period_year || 0}${String(payroll.period_month || 0).padStart(2, "0")}`);
}

function formatStatus(status) {
  const labels = { active: "Activo", ended: "Finalizado", deleted: "Eliminado" };
  return labels[status] || status || "-";
}

function formatIncidentStatus(status) {
  return incidentStatusLabels[status] || status || "-";
}

function formatIncidentType(type) {
  return incidentTypeLabels[type] || type || "-";
}

function formatPayrollStatus(status) {
  return payrollStatusLabels[status] || status || "-";
}

function formatSalary(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value));
}

export default function EmployeeTable({
  loading,
  employees,
  companies,
  contracts,
  incidents = [],
  payrolls = [],
  onUpdateEmployee,
  onDeleteEmployee,
  submitting,
}) {
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedFileEmployee, setSelectedFileEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const companyMap = useMemo(() => companies.reduce((acc, company) => ({ ...acc, [company.id]: company }), {}), [companies]);

  if (loading) return <p>Cargando...</p>;

  const getEmployeeContracts = (employeeId) => contracts
    .filter((contract) => Number(contract.employee_id) === Number(employeeId))
    .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")));

  const getEmployeeIncidents = (employeeId) => incidents
    .filter((incident) => Number(incident.employee_id) === Number(employeeId))
    .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")));

  const getEmployeePayrolls = (employeeId) => payrolls
    .filter((payroll) => Number(payroll.employee_id) === Number(employeeId))
    .sort((a, b) => payrollPeriodSortValue(b) - payrollPeriodSortValue(a));

  const getCompanyName = (contract) => contract.company_name || companyMap[contract.company_id]?.name || "-";
  const getCompanyCcc = (contract) => companyMap[contract.company_id]?.ccc || "-";
  const getIncidentCompanyName = (incident) => incident.company_name || companyMap[incident.company_id]?.name || "-";
  const getPayrollCompanyName = (payroll) => payroll.company_name || companyMap[payroll.company_id]?.name || "-";
  const getPayrollStatusStyle = (status) => {
    if (status === "closed") return styles.closedPayrollBadge;
    if (status === "calculated") return styles.calculatedPayrollBadge;
    return styles.draftPayrollBadge;
  };

  const openEditModal = (employee) => {
    setEditingEmployee(employee);
    setEditForm(toEditForm(employee));
    setEditError("");
    setDeleteError("");
  };

  const closeEditModal = () => {
    setEditingEmployee(null);
    setEditForm(emptyEditForm);
    setEditError("");
  };

  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditError("");
    try {
      await onUpdateEmployee(editingEmployee.id, editForm);
      closeEditModal();
    } catch (err) {
      setEditError(err.message || "Error al actualizar trabajador");
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");
    try {
      await onDeleteEmployee(employeeToDelete.id);
      setEmployeeToDelete(null);
      closeEditModal();
    } catch (err) {
      setDeleteError(err.message || "Error al desactivar trabajador");
    }
  };

  const selectedEmployeeContracts = selectedFileEmployee ? getEmployeeContracts(selectedFileEmployee.id) : [];
  const selectedEmployeeIncidents = selectedFileEmployee ? getEmployeeIncidents(selectedFileEmployee.id) : [];
  const selectedEmployeePayrolls = selectedFileEmployee ? getEmployeePayrolls(selectedFileEmployee.id) : [];
  const activeContract = selectedEmployeeContracts.find((contract) => contract.status === "active");
  const openIncidents = selectedEmployeeIncidents.filter((incident) => incident.status === "open");
  const latestPayroll = selectedEmployeePayrolls[0];
  const totalNetPayroll = selectedEmployeePayrolls.reduce((acc, payroll) => acc + Number(payroll.net_salary || 0), 0);

  return (
    <>
      {!employees.length ? (
        <p style={styles.empty}>No hay trabajadores que coincidan con los filtros aplicados.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Código</th>
                <th style={styles.th}>DNI</th>
                <th style={styles.th}>NAF</th>
                <th style={styles.th}>Nombre completo</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Teléfono</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td style={styles.td}>{employee.employee_code}</td>
                  <td style={styles.td}>{employee.dni}</td>
                  <td style={styles.td}>{employee.naf || "-"}</td>
                  <td style={styles.td}>{employee.first_name} {employee.last_name}</td>
                  <td style={styles.td}>{employee.email || "-"}</td>
                  <td style={styles.td}>{employee.phone || "-"}</td>
                  <td style={styles.td}><span style={employee.is_active ? styles.activeBadge : styles.inactiveBadge}>{employee.is_active ? "Activo" : "Inactivo"}</span></td>
                  <td style={styles.td}>
                    <div style={styles.actionGroup}>
                      <button type="button" style={styles.fileButton} onClick={() => setSelectedFileEmployee(employee)}>Ficha</button>
                      <button type="button" style={styles.editButton} onClick={() => openEditModal(employee)}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedFileEmployee && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalLarge}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Ficha del trabajador</h3>
                <p style={styles.modalSubtitle}>{selectedFileEmployee.first_name} {selectedFileEmployee.last_name}</p>
              </div>
              <button type="button" onClick={() => setSelectedFileEmployee(null)} style={styles.closeButton}>×</button>
            </div>

            <div style={styles.summaryGrid}>
              <div style={styles.summaryBox}><span style={styles.summaryLabel}>Código</span><strong>{selectedFileEmployee.employee_code || "-"}</strong></div>
              <div style={styles.summaryBox}><span style={styles.summaryLabel}>ID interno</span><strong>{selectedFileEmployee.id}</strong></div>
              <div style={styles.summaryBox}><span style={styles.summaryLabel}>DNI</span><strong>{selectedFileEmployee.dni || "-"}</strong></div>
              <div style={styles.summaryBox}><span style={styles.summaryLabel}>NAF</span><strong>{selectedFileEmployee.naf || "-"}</strong></div>
              <div style={styles.summaryBox}><span style={styles.summaryLabel}>Email</span><strong>{selectedFileEmployee.email || "-"}</strong></div>
              <div style={styles.summaryBox}><span style={styles.summaryLabel}>Teléfono</span><strong>{selectedFileEmployee.phone || "-"}</strong></div>
            </div>

            <div style={styles.summaryGridCompact}>
              <div style={styles.summaryBoxStrong}><span style={styles.summaryLabel}>Contratos totales</span><strong>{selectedEmployeeContracts.length}</strong></div>
              <div style={styles.summaryBoxStrong}><span style={styles.summaryLabel}>Contrato activo</span><strong>{activeContract ? `ID ${activeContract.id} · ${activeContract.contract_type}` : "No"}</strong></div>
              <div style={styles.summaryBoxStrong}><span style={styles.summaryLabel}>Empresa actual</span><strong>{activeContract ? getCompanyName(activeContract) : "-"}</strong></div>
              <div style={styles.summaryBoxStrong}><span style={styles.summaryLabel}>Incidencias abiertas</span><strong>{openIncidents.length}</strong></div>
              <div style={styles.summaryBoxStrong}><span style={styles.summaryLabel}>Nóminas generadas</span><strong>{selectedEmployeePayrolls.length}</strong></div>
              <div style={styles.summaryBoxStrong}><span style={styles.summaryLabel}>Última nómina</span><strong>{latestPayroll ? `${formatPeriod(latestPayroll)} · ${formatSalary(latestPayroll.net_salary)}` : "-"}</strong></div>
            </div>

            <div style={styles.sectionHeader}>
              <h4 style={styles.sectionTitle}>Histórico contractual</h4>
              <span style={styles.contractCount}>{selectedEmployeeContracts.length} contratos</span>
            </div>

            {!selectedEmployeeContracts.length ? <p style={styles.empty}>Este trabajador todavía no tiene contratos registrados.</p> : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>ID</th><th style={styles.th}>Empresa / centro</th><th style={styles.th}>CCC</th><th style={styles.th}>Tipo</th><th style={styles.th}>Inicio</th><th style={styles.th}>Fin</th><th style={styles.th}>Estado</th><th style={styles.th}>Salario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployeeContracts.map((contract) => (
                      <tr key={contract.id}>
                        <td style={styles.td}>{contract.id}</td><td style={styles.td}>{getCompanyName(contract)}</td><td style={styles.td}>{getCompanyCcc(contract)}</td><td style={styles.td}>{contract.contract_type}</td><td style={styles.td}>{formatDate(contract.start_date)}</td><td style={styles.td}>{formatDate(contract.end_date)}</td><td style={styles.td}><span style={contract.status === "active" ? styles.activeBadge : styles.inactiveBadge}>{formatStatus(contract.status)}</span></td><td style={styles.td}>{formatSalary(contract.salary_base)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={styles.sectionHeaderPayrolls}>
              <h4 style={styles.sectionTitle}>Histórico de nóminas</h4>
              <div style={styles.headerBadges}>
                <span style={styles.payrollCount}>{selectedEmployeePayrolls.length} nóminas</span>
                <span style={styles.netTotalBadge}>Neto acumulado: {formatSalary(totalNetPayroll)}</span>
              </div>
            </div>

            {!selectedEmployeePayrolls.length ? <p style={styles.empty}>Este trabajador todavía no tiene nóminas generadas.</p> : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>ID</th>
                      <th style={styles.th}>Periodo</th>
                      <th style={styles.th}>Empresa / centro</th>
                      <th style={styles.th}>Bruto</th>
                      <th style={styles.th}>Deducciones</th>
                      <th style={styles.th}>Neto</th>
                      <th style={styles.th}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployeePayrolls.map((payroll) => (
                      <tr key={payroll.id}>
                        <td style={styles.td}>{payroll.id}</td>
                        <td style={styles.td}>{formatPeriod(payroll)}</td>
                        <td style={styles.td}>{getPayrollCompanyName(payroll)}</td>
                        <td style={styles.td}>{formatSalary(payroll.gross_salary)}</td>
                        <td style={styles.td}>{formatSalary(payroll.total_deductions)}</td>
                        <td style={styles.tdStrong}>{formatSalary(payroll.net_salary)}</td>
                        <td style={styles.td}><span style={getPayrollStatusStyle(payroll.status)}>{formatPayrollStatus(payroll.status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={styles.sectionHeaderIncidents}>
              <h4 style={styles.sectionTitle}>Histórico de incidencias</h4>
              <span style={styles.incidentCount}>{selectedEmployeeIncidents.length} incidencias</span>
            </div>

            {!selectedEmployeeIncidents.length ? <p style={styles.empty}>Este trabajador todavía no tiene incidencias registradas.</p> : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>ID</th>
                      <th style={styles.th}>Empresa / centro</th>
                      <th style={styles.th}>Contrato</th>
                      <th style={styles.th}>Tipo</th>
                      <th style={styles.th}>Inicio</th>
                      <th style={styles.th}>Fin</th>
                      <th style={styles.th}>Estado</th>
                      <th style={styles.th}>Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployeeIncidents.map((incident) => (
                      <tr key={incident.id}>
                        <td style={styles.td}>{incident.id}</td>
                        <td style={styles.td}>{getIncidentCompanyName(incident)}</td>
                        <td style={styles.td}>{incident.contract_type || incident.contract_id || "-"}</td>
                        <td style={styles.td}><span style={styles.incidentTypeBadge}>{formatIncidentType(incident.incident_type)}</span></td>
                        <td style={styles.td}>{formatDate(incident.start_date)}</td>
                        <td style={styles.td}>{formatDate(incident.end_date)}</td>
                        <td style={styles.td}><span style={incident.status === "closed" ? styles.closedIncidentBadge : styles.openIncidentBadge}>{formatIncidentStatus(incident.status)}</span></td>
                        <td style={styles.descriptionTd}>{incident.description || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {editingEmployee && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Editar trabajador</h3>
                <p style={styles.modalSubtitle}>{editingEmployee.first_name} {editingEmployee.last_name}</p>
              </div>
              <button type="button" onClick={closeEditModal} style={styles.closeButton}>×</button>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroupCode}><label>Código trabajador</label><input name="employee_code" value={editForm.employee_code} readOnly disabled style={{ ...styles.input, ...styles.readOnlyInput }} /></div>
                <div style={styles.formGroupDni}><label>DNI</label><input name="dni" value={editForm.dni} onChange={handleEditChange} required style={styles.input} /></div>
                <div style={styles.formGroupNaf}><label>NAF</label><input name="naf" value={editForm.naf} onChange={handleEditChange} style={styles.input} /></div>
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}><label>Nombre</label><input name="first_name" value={editForm.first_name} onChange={handleEditChange} required style={styles.input} /></div>
                <div style={styles.formGroup}><label>Apellidos</label><input name="last_name" value={editForm.last_name} onChange={handleEditChange} required style={styles.input} /></div>
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}><label>Email</label><input name="email" type="email" value={editForm.email} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Teléfono</label><input name="phone" value={editForm.phone} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Fecha nacimiento</label><input name="birth_date" type="date" value={editForm.birth_date} onChange={handleEditChange} style={styles.input} /></div>
              </div>
              <div style={styles.formRow}><div style={styles.formGroupWide}><label>Dirección</label><input name="address" value={editForm.address} onChange={handleEditChange} style={styles.input} /></div></div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}><label>Ciudad</label><input name="city" value={editForm.city} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Provincia</label><input name="province" value={editForm.province} onChange={handleEditChange} style={styles.input} /></div>
                <div style={styles.formGroup}><label>Código postal</label><input name="postal_code" value={editForm.postal_code} onChange={handleEditChange} style={styles.input} /></div>
              </div>
              <label style={styles.checkboxLabel}><input name="is_active" type="checkbox" checked={editForm.is_active} onChange={handleEditChange} />Trabajador activo</label>

              {editError && <div style={styles.error}>{editError}</div>}
              <div style={styles.modalActionsSplit}>
                <button type="button" onClick={() => setEmployeeToDelete(editingEmployee)} style={styles.deleteButton}>Eliminar trabajador</button>
                <div style={styles.modalActionsRight}>
                  <button type="button" onClick={closeEditModal} style={styles.cancelButton}>Cancelar</button>
                  <button type="submit" disabled={submitting} style={styles.saveButton}>{submitting ? "Guardando..." : "Guardar cambios"}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {employeeToDelete && (
        <div style={styles.modalBackdrop}>
          <div style={styles.confirmModal}>
            <div style={styles.modalHeader}>
              <div><h3 style={styles.modalTitle}>Eliminar trabajador</h3><p style={styles.modalSubtitle}>Esta acción desactivará al trabajador.</p></div>
              <button type="button" onClick={() => setEmployeeToDelete(null)} style={styles.closeButton}>×</button>
            </div>
            <p style={styles.confirmText}>¿Seguro que quieres eliminar/desactivar a {employeeToDelete.first_name} {employeeToDelete.last_name}?</p>
            {deleteError && <div style={styles.error}>{deleteError}</div>}
            <div style={styles.modalActions}>
              <button type="button" onClick={() => setEmployeeToDelete(null)} style={styles.cancelButton}>Cancelar</button>
              <button type="button" onClick={handleConfirmDelete} disabled={submitting} style={styles.dangerButton}>{submitting ? "Eliminando..." : "Confirmar eliminación"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  empty: { margin: 0, color: "#6b7280", fontSize: "14px" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "12px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  td: { padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  tdStrong: { padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", fontWeight: 900 },
  descriptionTd: { padding: "12px", borderBottom: "1px solid #eee", minWidth: "220px", maxWidth: "360px", whiteSpace: "normal" },
  actionGroup: { display: "flex", gap: "8px", alignItems: "center" },
  activeBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  inactiveBadge: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  incidentTypeBadge: { backgroundColor: "#fef3c7", color: "#92400e", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, whiteSpace: "nowrap" },
  openIncidentBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  closedIncidentBadge: { backgroundColor: "#e5e7eb", color: "#374151", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  draftPayrollBadge: { backgroundColor: "#e5e7eb", color: "#374151", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  calculatedPayrollBadge: { backgroundColor: "#dbeafe", color: "#1e40af", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  closedPayrollBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  fileButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
  editButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(920px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  modalLarge: { width: "min(1120px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  confirmModal: { width: "min(560px, 100%)", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" },
  summaryGridCompact: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px", marginBottom: "20px" },
  summaryBox: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "4px" },
  summaryBoxStrong: { border: "1px solid #e6d85c", borderRadius: "10px", padding: "12px", backgroundColor: "#fefce8", display: "flex", flexDirection: "column", gap: "4px" },
  summaryLabel: { fontSize: "12px", color: "#6b7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", margin: "8px 0 12px", paddingTop: "12px", borderTop: "1px solid #e5e7eb" },
  sectionHeaderPayrolls: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", margin: "22px 0 12px", paddingTop: "16px", borderTop: "2px solid #111827" },
  sectionHeaderIncidents: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", margin: "22px 0 12px", paddingTop: "16px", borderTop: "2px solid #111827" },
  sectionTitle: { margin: 0, fontSize: "16px", fontWeight: 900, color: "#111827" },
  headerBadges: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  contractCount: { backgroundColor: "#fef9c3", color: "#713f12", border: "1px solid #e6d85c", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 900 },
  payrollCount: { backgroundColor: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 900 },
  netTotalBadge: { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #f59e0b", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 900 },
  incidentCount: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 900 },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "200px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupCode: { width: "150px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupDni: { width: "190px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupNaf: { width: "230px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  readOnlyInput: { backgroundColor: "#f3f4f6", color: "#6b7280", cursor: "not-allowed", fontWeight: 800 },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 },
  confirmText: { margin: "0 0 16px", color: "#374151", lineHeight: 1.5 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
};
