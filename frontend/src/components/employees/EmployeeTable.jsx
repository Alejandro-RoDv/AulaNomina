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

function formatStatus(status) {
  const labels = {
    active: "Activo",
    ended: "Finalizado",
    deleted: "Eliminado",
  };
  return labels[status] || status || "-";
}

function formatSalary(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value));
}

export default function EmployeeTable({
  loading,
  employees,
  companies,
  contracts,
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

  const companyMap = useMemo(() => {
    return companies.reduce((acc, company) => {
      acc[company.id] = company;
      return acc;
    }, {});
  }, [companies]);

  if (loading) return <p>Cargando...</p>;

  const openEditModal = (employee) => {
    setEditingEmployee(employee);
    setEditForm(toEditForm(employee));
    setEditError("");
  };

  const closeEditModal = () => {
    setEditingEmployee(null);
    setEditForm(emptyEditForm);
    setEditError("");
  };

  const openFileModal = (employee) => {
    setSelectedFileEmployee(employee);
  };

  const closeFileModal = () => {
    setSelectedFileEmployee(null);
  };

  const openDeleteModal = (employee) => {
    setEmployeeToDelete(employee);
    setDeleteError("");
  };

  const closeDeleteModal = () => {
    setEmployeeToDelete(null);
    setDeleteError("");
  };

  const getEmployeeContracts = (employeeId) => {
    return contracts
      .filter((contract) => Number(contract.employee_id) === Number(employeeId))
      .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")));
  };

  const getCompany = (contract) => {
    return companyMap[contract.company_id];
  };

  const getCompanyName = (contract) => {
    if (contract.company_name) return contract.company_name;
    const company = getCompany(contract);
    return company ? company.name : "-";
  };

  const getCompanyCcc = (contract) => {
    const company = getCompany(contract);
    return company?.ccc || "-";
  };

  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
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
      closeDeleteModal();
    } catch (err) {
      setDeleteError(err.message || "Error al desactivar trabajador");
    }
  };

  const selectedEmployeeContracts = selectedFileEmployee
    ? getEmployeeContracts(selectedFileEmployee.id)
    : [];

  const activeContract = selectedEmployeeContracts.find((contract) => contract.status === "active");
  const activeCompanyName = activeContract ? getCompanyName(activeContract) : "-";
  const activeCompanyCcc = activeContract ? getCompanyCcc(activeContract) : "-";

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
                  <td style={styles.td}>
                    <span style={employee.is_active ? styles.activeBadge : styles.inactiveBadge}>
                      {employee.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionGroup}>
                      <button
                        type="button"
                        style={styles.fileButton}
                        onClick={() => openFileModal(employee)}
                      >
                        Ficha
                      </button>
                      <button
                        type="button"
                        style={styles.editButton}
                        onClick={() => openEditModal(employee)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        style={styles.deleteButton}
                        onClick={() => openDeleteModal(employee)}
                      >
                        Eliminar
                      </button>
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
                <p style={styles.modalSubtitle}>
                  {selectedFileEmployee.first_name} {selectedFileEmployee.last_name}
                </p>
              </div>
              <button type="button" onClick={closeFileModal} style={styles.closeButton}>×</button>
            </div>

            <div style={styles.summaryGrid}>
              <div style={styles.summaryBox}>
                <span style={styles.summaryLabel}>Código</span>
                <strong>{selectedFileEmployee.employee_code || "-"}</strong>
              </div>
              <div style={styles.summaryBox}>
                <span style={styles.summaryLabel}>ID interno</span>
                <strong>{selectedFileEmployee.id}</strong>
              </div>
              <div style={styles.summaryBox}>
                <span style={styles.summaryLabel}>DNI</span>
                <strong>{selectedFileEmployee.dni || "-"}</strong>
              </div>
              <div style={styles.summaryBox}>
                <span style={styles.summaryLabel}>NAF</span>
                <strong>{selectedFileEmployee.naf || "-"}</strong>
              </div>
              <div style={styles.summaryBox}>
                <span style={styles.summaryLabel}>Email</span>
                <strong>{selectedFileEmployee.email || "-"}</strong>
              </div>
              <div style={styles.summaryBox}>
                <span style={styles.summaryLabel}>Teléfono</span>
                <strong>{selectedFileEmployee.phone || "-"}</strong>
              </div>
            </div>

            <div style={styles.summaryGridCompact}>
              <div style={styles.summaryBoxStrong}>
                <span style={styles.summaryLabel}>Contratos totales</span>
                <strong>{selectedEmployeeContracts.length}</strong>
              </div>
              <div style={styles.summaryBoxStrong}>
                <span style={styles.summaryLabel}>Contrato activo</span>
                <strong>{activeContract ? `ID ${activeContract.id} · ${activeContract.contract_type}` : "No"}</strong>
              </div>
              <div style={styles.summaryBoxStrong}>
                <span style={styles.summaryLabel}>Empresa actual</span>
                <strong>{activeCompanyName}</strong>
              </div>
              <div style={styles.summaryBoxStrong}>
                <span style={styles.summaryLabel}>CCC actual</span>
                <strong>{activeCompanyCcc}</strong>
              </div>
            </div>

            <div style={styles.sectionHeader}>
              <h4 style={styles.sectionTitle}>Histórico contractual</h4>
              <span style={styles.contractCount}>{selectedEmployeeContracts.length} contratos</span>
            </div>

            {!selectedEmployeeContracts.length ? (
              <p style={styles.empty}>Este trabajador todavía no tiene contratos registrados.</p>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>ID</th>
                      <th style={styles.th}>Empresa / centro</th>
                      <th style={styles.th}>CCC</th>
                      <th style={styles.th}>Tipo</th>
                      <th style={styles.th}>Inicio</th>
                      <th style={styles.th}>Fin</th>
                      <th style={styles.th}>Estado</th>
                      <th style={styles.th}>Salario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployeeContracts.map((contract) => (
                      <tr key={contract.id}>
                        <td style={styles.td}>{contract.id}</td>
                        <td style={styles.td}>{getCompanyName(contract)}</td>
                        <td style={styles.td}>{getCompanyCcc(contract)}</td>
                        <td style={styles.td}>{contract.contract_type}</td>
                        <td style={styles.td}>{formatDate(contract.start_date)}</td>
                        <td style={styles.td}>{formatDate(contract.end_date)}</td>
                        <td style={styles.td}>
                          <span style={contract.status === "active" ? styles.activeBadge : styles.inactiveBadge}>
                            {formatStatus(contract.status)}
                          </span>
                        </td>
                        <td style={styles.td}>{formatSalary(contract.salary_base)}</td>
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
                <div style={styles.formGroupCode}>
                  <label>Código trabajador</label>
                  <input name="employee_code" value={editForm.employee_code} readOnly disabled style={{ ...styles.input, ...styles.readOnlyInput }} />
                </div>
                <div style={styles.formGroupDni}>
                  <label>DNI</label>
                  <input name="dni" value={editForm.dni} onChange={handleEditChange} required style={styles.input} />
                </div>
                <div style={styles.formGroupNaf}>
                  <label>NAF</label>
                  <input name="naf" value={editForm.naf} onChange={handleEditChange} style={styles.input} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Nombre</label>
                  <input name="first_name" value={editForm.first_name} onChange={handleEditChange} required style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Apellidos</label>
                  <input name="last_name" value={editForm.last_name} onChange={handleEditChange} required style={styles.input} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Email</label>
                  <input name="email" type="email" value={editForm.email} onChange={handleEditChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Teléfono</label>
                  <input name="phone" value={editForm.phone} onChange={handleEditChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Fecha nacimiento</label>
                  <input name="birth_date" type="date" value={editForm.birth_date} onChange={handleEditChange} style={styles.input} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroupWide}>
                  <label>Dirección</label>
                  <input name="address" value={editForm.address} onChange={handleEditChange} style={styles.input} />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Ciudad</label>
                  <input name="city" value={editForm.city} onChange={handleEditChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Provincia</label>
                  <input name="province" value={editForm.province} onChange={handleEditChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Código postal</label>
                  <input name="postal_code" value={editForm.postal_code} onChange={handleEditChange} style={styles.input} />
                </div>
              </div>

              <label style={styles.checkboxLabel}>
                <input name="is_active" type="checkbox" checked={editForm.is_active} onChange={handleEditChange} />
                Trabajador activo
              </label>

              {editError && <div style={styles.error}>{editError}</div>}

              <div style={styles.modalActions}>
                <button type="button" onClick={closeEditModal} style={styles.cancelButton}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} style={styles.saveButton}>
                  {submitting ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {employeeToDelete && (
        <div style={styles.modalBackdrop}>
          <div style={styles.confirmModal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Eliminar trabajador</h3>
                <p style={styles.modalSubtitle}>Esta acción desactivará al trabajador.</p>
              </div>
              <button type="button" onClick={closeDeleteModal} style={styles.closeButton}>×</button>
            </div>

            <p style={styles.confirmText}>
              ¿Seguro que quieres eliminar/desactivar a {employeeToDelete.first_name} {employeeToDelete.last_name}?
            </p>

            {deleteError && <div style={styles.error}>{deleteError}</div>}

            <div style={styles.modalActions}>
              <button type="button" onClick={closeDeleteModal} style={styles.cancelButton}>
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmDelete} disabled={submitting} style={styles.dangerButton}>
                {submitting ? "Eliminando..." : "Confirmar eliminación"}
              </button>
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
  actionGroup: { display: "flex", gap: "8px", alignItems: "center" },
  activeBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  inactiveBadge: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  fileButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
  editButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(920px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  modalLarge: { width: "min(1060px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
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
  sectionTitle: { margin: 0, fontSize: "16px", fontWeight: 900, color: "#111827" },
  contractCount: { backgroundColor: "#fef9c3", color: "#713f12", border: "1px solid #e6d85c", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 900 },
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
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
};
