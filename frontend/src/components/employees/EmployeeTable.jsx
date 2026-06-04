import { useMemo, useState } from "react";

import { EDUCATION_LEVEL_OPTIONS } from "../../utils/employeePayloads";
import { getSortLabel, nextSortConfig, sortRows } from "../../utils/tableSorting";
import { getEmployeeVisibleCode } from "../../utils/visibleCodes";

const emptyEditForm = {
  employee_code: "",
  company_id: "",
  center_id: "",
  document_type: "DNI",
  dni: "",
  naf: "",
  first_name: "",
  last_name: "",
  second_last_name: "",
  sex: "",
  birth_date: "",
  nationality: "",
  birth_place: "",
  domicile: "",
  address: "",
  city: "",
  province: "",
  postal_code: "",
  landline_phone: "",
  mobile_phone: "",
  phone: "",
  fax: "",
  email: "",
  website: "",
  education_level: "",
  academic_title: "",
  academic_title_date: "",
  main_profession: "",
  other_courses: "",
  accreditations: "",
  languages: "",
  representative_role: "",
  representative_nif: "",
  representative_full_name: "",
  observations: "",
  is_active: true,
};

function toEditForm(employee) {
  return {
    ...emptyEditForm,
    employee_code: employee.employee_code || "",
    company_id: employee.company_id ? String(employee.company_id) : "",
    center_id: employee.center_id ? String(employee.center_id) : "",
    document_type: employee.document_type || "DNI",
    dni: employee.dni || "",
    naf: employee.naf || "",
    first_name: employee.first_name || "",
    last_name: employee.last_name || "",
    second_last_name: employee.second_last_name || "",
    sex: employee.sex || "",
    birth_date: employee.birth_date || "",
    nationality: employee.nationality || "",
    birth_place: employee.birth_place || "",
    domicile: employee.domicile || "",
    address: employee.address || "",
    city: employee.city || "",
    province: employee.province || "",
    postal_code: employee.postal_code || "",
    landline_phone: employee.landline_phone || "",
    mobile_phone: employee.mobile_phone || "",
    phone: employee.phone || "",
    fax: employee.fax || "",
    email: employee.email || "",
    website: employee.website || "",
    education_level: employee.education_level || "",
    academic_title: employee.academic_title || "",
    academic_title_date: employee.academic_title_date || "",
    main_profession: employee.main_profession || "",
    other_courses: employee.other_courses || "",
    accreditations: employee.accreditations || "",
    languages: employee.languages || "",
    representative_role: employee.representative_role || "",
    representative_nif: employee.representative_nif || "",
    representative_full_name: employee.representative_full_name || "",
    observations: employee.observations || "",
    is_active: employee.is_active ?? true,
  };
}

function formatValue(value) {
  return value || "-";
}

function SectionTitle({ children }) {
  return <h4 style={styles.sectionTitle}>{children}</h4>;
}

function Field({ label, name, value, onChange, type = "text", required = false, readOnly = false, disabled = false }) {
  return (
    <div style={styles.formGroup}>
      <label>{label}</label>
      <input
        name={name}
        type={type}
        value={value || ""}
        onChange={onChange}
        required={required}
        readOnly={readOnly}
        disabled={disabled}
        style={{ ...styles.input, ...(disabled || readOnly ? styles.readOnlyInput : {}) }}
      />
    </div>
  );
}

function TextAreaField({ label, name, value, onChange }) {
  return (
    <div style={styles.formGroupTextarea}>
      <label>{label}</label>
      <textarea name={name} value={value || ""} onChange={onChange} style={styles.textarea} />
    </div>
  );
}

function DetailBox({ label, value, wide = false }) {
  return (
    <div style={wide ? styles.detailBoxWide : styles.detailBox}>
      <span>{label}</span>
      <strong>{formatValue(value)}</strong>
    </div>
  );
}

export default function EmployeeTable({
  loading,
  employees,
  companies = [],
  workCenters = [],
  contracts = [],
  onUpdateEmployee,
  onDeleteEmployee,
  onOpenRecord,
  onDuplicateEmployee,
  submitting,
}) {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "code", direction: "asc" });
  const [openMenuEmployeeId, setOpenMenuEmployeeId] = useState(null);

  const companyMap = useMemo(() => companies.reduce((acc, company) => ({ ...acc, [company.id]: company }), {}), [companies]);
  const centerMap = useMemo(() => workCenters.reduce((acc, center) => ({ ...acc, [center.id]: center }), {}), [workCenters]);

  const availableCenters = useMemo(() => {
    return workCenters.filter((center) => !editForm.company_id || String(center.company_id) === String(editForm.company_id));
  }, [workCenters, editForm.company_id]);

  const getEmployeeCode = (employee) => getEmployeeVisibleCode(employee, employees, contracts);

  const getActiveContract = (employeeId) => {
    return contracts.find((contract) => Number(contract.employee_id) === Number(employeeId) && contract.status === "active")
      || contracts.find((contract) => Number(contract.employee_id) === Number(employeeId));
  };

  const getCompanyName = (employee) => {
    const activeContract = getActiveContract(employee.id);
    return activeContract?.company_name || companyMap[activeContract?.company_id]?.name || companyMap[employee.company_id]?.name || "-";
  };

  const getCenterName = (employee) => {
    const activeContract = getActiveContract(employee.id);
    return activeContract?.center_name || centerMap[activeContract?.center_id]?.name || centerMap[employee.center_id]?.name || "-";
  };

  const sortedEmployees = useMemo(() => sortRows(employees, sortConfig, {
    code: (employee) => getEmployeeCode(employee),
    dni: (employee) => employee.dni,
    naf: (employee) => employee.naf,
    name: (employee) => `${employee.first_name || ""} ${employee.last_name || ""} ${employee.second_last_name || ""}`,
    company: (employee) => getCompanyName(employee),
    center: (employee) => getCenterName(employee),
    status: (employee) => employee.is_active ? "Activo" : "Inactivo",
  }), [employees, contracts, companyMap, centerMap, sortConfig]);

  if (loading) return <p>Cargando...</p>;

  const handleSort = (key) => setSortConfig((current) => nextSortConfig(current, key));

  const sortHeader = (key, label) => (
    <th style={styles.th}>
      <button type="button" onClick={() => handleSort(key)} style={styles.sortButton}>
        <span>{label}</span>
        <span style={styles.sortIcon}>{getSortLabel(sortConfig, key)}</span>
      </button>
    </th>
  );

  const openDetailsModal = (employee) => {
    setSelectedEmployee(employee);
    setEditForm(toEditForm(employee));
    setEditMode(false);
    setEditError("");
    setDeleteError("");
    setOpenMenuEmployeeId(null);
  };

  const openEditModal = (employee) => {
    setSelectedEmployee(employee);
    setEditForm(toEditForm(employee));
    setEditMode(true);
    setEditError("");
    setDeleteError("");
    setOpenMenuEmployeeId(null);
  };

  const closeModal = () => {
    setSelectedEmployee(null);
    setEditForm(emptyEditForm);
    setEditMode(false);
    setEditError("");
    setDeleteError("");
  };

  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditForm((prev) => {
      if (name === "company_id") return { ...prev, company_id: value, center_id: "" };
      return { ...prev, [name]: type === "checkbox" ? checked : value };
    });
  };

  const handleCancelEdit = () => {
    if (selectedEmployee) setEditForm(toEditForm(selectedEmployee));
    setEditMode(false);
    setEditError("");
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditError("");

    try {
      await onUpdateEmployee(selectedEmployee.id, editForm);
      setSelectedEmployee({
        ...selectedEmployee,
        ...editForm,
        company_id: editForm.company_id ? Number(editForm.company_id) : null,
        center_id: editForm.center_id ? Number(editForm.center_id) : null,
      });
      setEditMode(false);
    } catch (err) {
      setEditError(err.message || "Error al actualizar trabajador");
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");
    try {
      await onDeleteEmployee(employeeToDelete.id);
      setEmployeeToDelete(null);
      closeModal();
    } catch (err) {
      setDeleteError(err.message || "Error al desactivar trabajador");
    }
  };

  const handleOpenRecord = (employee) => {
    setOpenMenuEmployeeId(null);
    if (onOpenRecord) {
      onOpenRecord(employee);
      return;
    }
    window.sessionStorage.setItem("aulanomina:selectedEmployeeId", String(employee.id));
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: "employee-record" } }));
  };

  const handleDuplicate = (employee) => {
    setOpenMenuEmployeeId(null);
    onDuplicateEmployee?.(employee);
    closeModal();
  };

  return (
    <>
      {!employees.length ? (
        <p style={styles.empty}>No hay trabajadores que coincidan con los filtros aplicados.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {sortHeader("code", "Código")}
                {sortHeader("dni", "Documento")}
                {sortHeader("naf", "NAF")}
                {sortHeader("name", "Nombre completo")}
                {sortHeader("company", "Empresa")}
                {sortHeader("center", "Centro")}
                {sortHeader("status", "Estado")}
                <th style={styles.actionsTh}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedEmployees.map((employee) => (
                <tr key={employee.id} style={styles.tableRow}>
                  <td style={styles.tdStrong}>{getEmployeeCode(employee)}</td>
                  <td style={styles.td}>{employee.dni}</td>
                  <td style={styles.td}>{employee.naf || "-"}</td>
                  <td style={styles.td}>{employee.first_name} {employee.last_name} {employee.second_last_name || ""}</td>
                  <td style={styles.td}>{getCompanyName(employee)}</td>
                  <td style={styles.td}>{getCenterName(employee)}</td>
                  <td style={styles.td}>
                    <span style={employee.is_active ? styles.activeBadge : styles.inactiveBadge}>{employee.is_active ? "Activo" : "Inactivo"}</span>
                  </td>
                  <td style={styles.actionsTd}>
                    <div style={styles.compactActions}>
                      <button type="button" style={styles.recordButton} onClick={() => handleOpenRecord(employee)}>Expediente</button>
                      <button type="button" style={styles.editButton} onClick={() => openEditModal(employee)}>Editar</button>
                      <div style={styles.moreWrapper}>
                        <button
                          type="button"
                          style={styles.moreButton}
                          onClick={() => setOpenMenuEmployeeId((current) => current === employee.id ? null : employee.id)}
                        >
                          Más ▾
                        </button>
                        {openMenuEmployeeId === employee.id && (
                          <div style={styles.moreMenu}>
                            <button type="button" style={styles.moreMenuItem} onClick={() => handleDuplicate(employee)}>Duplicar</button>
                            <button type="button" style={styles.moreMenuItem} onClick={() => openDetailsModal(employee)}>Detalles</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedEmployee && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>{editMode ? "Editar trabajador" : "Detalles del trabajador"}</h3>
                <p style={styles.modalSubtitle}>{selectedEmployee.first_name} {selectedEmployee.last_name} · {selectedEmployee.dni || "Sin documento"}</p>
              </div>
              <button type="button" onClick={closeModal} style={styles.closeButton}>×</button>
            </div>

            {!editMode ? (
              <div style={styles.detailsWrapper}>
                <div style={styles.detailsGrid}>
                  <DetailBox label="Código" value={selectedEmployee.employee_code} />
                  <DetailBox label="Tipo documento" value={selectedEmployee.document_type} />
                  <DetailBox label="Documento" value={selectedEmployee.dni} />
                  <DetailBox label="NAF" value={selectedEmployee.naf} />
                  <DetailBox label="Estado" value={selectedEmployee.is_active ? "Activo" : "Inactivo"} />
                  <DetailBox label="Nombre" value={selectedEmployee.first_name} />
                  <DetailBox label="Primer apellido" value={selectedEmployee.last_name} />
                  <DetailBox label="Segundo apellido" value={selectedEmployee.second_last_name} />
                  <DetailBox label="Sexo" value={selectedEmployee.sex} />
                  <DetailBox label="Nacimiento" value={selectedEmployee.birth_date} />
                  <DetailBox label="Nacionalidad" value={selectedEmployee.nationality} />
                  <DetailBox label="Lugar nacimiento" value={selectedEmployee.birth_place} />
                  <DetailBox label="Email" value={selectedEmployee.email} />
                  <DetailBox label="Móvil" value={selectedEmployee.mobile_phone || selectedEmployee.phone} />
                  <DetailBox label="Empresa" value={getCompanyName(selectedEmployee)} />
                  <DetailBox label="Centro" value={getCenterName(selectedEmployee)} />
                  <DetailBox label="Domicilio" value={selectedEmployee.domicile || selectedEmployee.address} wide />
                  <DetailBox label="Nivel formativo" value={selectedEmployee.education_level} />
                  <DetailBox label="Título académico" value={selectedEmployee.academic_title} />
                  <DetailBox label="Profesión principal" value={selectedEmployee.main_profession} />
                  <DetailBox label="Idiomas" value={selectedEmployee.languages} />
                  <DetailBox label="Observaciones" value={selectedEmployee.observations} wide />
                </div>

                <div style={styles.modalActionsSplit}>
                  <button type="button" onClick={() => setEmployeeToDelete(selectedEmployee)} style={styles.deleteButton}>Eliminar trabajador</button>
                  <div style={styles.modalActionsRight}>
                    <button type="button" onClick={() => handleDuplicate(selectedEmployee)} style={styles.duplicateButton}>Duplicar en otra empresa</button>
                    <button type="button" onClick={() => handleOpenRecord(selectedEmployee)} style={styles.recordButton}>Abrir expediente</button>
                    <button type="button" onClick={() => setEditMode(true)} style={styles.saveButton}>Editar datos</button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEditSubmit} style={styles.form}>
                <SectionTitle>Asignación inicial</SectionTitle>
                <div style={styles.formRow}>
                  <Field label="Código trabajador" name="employee_code" value={editForm.employee_code} onChange={handleEditChange} disabled />
                  <div style={styles.formGroup}>
                    <label>Empresa</label>
                    <select name="company_id" value={editForm.company_id} onChange={handleEditChange} style={styles.input}>
                      <option value="">Sin empresa</option>
                      {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label>Centro</label>
                    <select name="center_id" value={editForm.center_id} onChange={handleEditChange} style={styles.input} disabled={!editForm.company_id}>
                      <option value="">Sin centro</option>
                      {availableCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
                    </select>
                  </div>
                </div>

                <SectionTitle>Identificación personal</SectionTitle>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label>Tipo documento</label>
                    <select name="document_type" value={editForm.document_type} onChange={handleEditChange} required style={styles.input}>
                      <option value="DNI">DNI</option>
                      <option value="NIE">NIE</option>
                      <option value="PASAPORTE">Pasaporte</option>
                    </select>
                  </div>
                  <Field label="Documento" name="dni" value={editForm.dni} onChange={handleEditChange} required />
                  <Field label="NAF" name="naf" value={editForm.naf} onChange={handleEditChange} />
                </div>
                <div style={styles.formRow}>
                  <Field label="Nombre" name="first_name" value={editForm.first_name} onChange={handleEditChange} required />
                  <Field label="Primer apellido" name="last_name" value={editForm.last_name} onChange={handleEditChange} required />
                  <Field label="Segundo apellido" name="second_last_name" value={editForm.second_last_name} onChange={handleEditChange} />
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label>Sexo</label>
                    <select name="sex" value={editForm.sex} onChange={handleEditChange} style={styles.input}>
                      <option value="">No indicado</option>
                      <option value="Hombre">Hombre</option>
                      <option value="Mujer">Mujer</option>
                      <option value="Otro">Otro / no especificado</option>
                    </select>
                  </div>
                  <Field label="Fecha nacimiento" name="birth_date" value={editForm.birth_date} onChange={handleEditChange} type="date" />
                  <Field label="Nacionalidad" name="nationality" value={editForm.nationality} onChange={handleEditChange} />
                  <Field label="Lugar de nacimiento" name="birth_place" value={editForm.birth_place} onChange={handleEditChange} />
                </div>

                <SectionTitle>Contacto y domicilio</SectionTitle>
                <div style={styles.formRow}>
                  <Field label="Domicilio" name="domicile" value={editForm.domicile} onChange={handleEditChange} />
                  <Field label="Dirección" name="address" value={editForm.address} onChange={handleEditChange} />
                  <Field label="Ciudad" name="city" value={editForm.city} onChange={handleEditChange} />
                  <Field label="Provincia" name="province" value={editForm.province} onChange={handleEditChange} />
                  <Field label="Código postal" name="postal_code" value={editForm.postal_code} onChange={handleEditChange} />
                  <Field label="Teléfono fijo" name="landline_phone" value={editForm.landline_phone} onChange={handleEditChange} />
                  <Field label="Móvil" name="mobile_phone" value={editForm.mobile_phone} onChange={handleEditChange} />
                  <Field label="Teléfono general" name="phone" value={editForm.phone} onChange={handleEditChange} />
                  <Field label="Fax" name="fax" value={editForm.fax} onChange={handleEditChange} />
                  <Field label="Correo electrónico" name="email" value={editForm.email} onChange={handleEditChange} type="email" />
                  <Field label="Web" name="website" value={editForm.website} onChange={handleEditChange} />
                </div>

                <SectionTitle>Formación y perfil profesional</SectionTitle>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label>Nivel formativo</label>
                    <select name="education_level" value={editForm.education_level} onChange={handleEditChange} style={styles.input}>
                      <option value="">Seleccionar nivel</option>
                      {EDUCATION_LEVEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <Field label="Título académico" name="academic_title" value={editForm.academic_title} onChange={handleEditChange} />
                  <Field label="Fecha concesión" name="academic_title_date" value={editForm.academic_title_date} onChange={handleEditChange} type="date" />
                  <Field label="Profesión principal" name="main_profession" value={editForm.main_profession} onChange={handleEditChange} />
                </div>
                <div style={styles.formRow}>
                  <TextAreaField label="Otros cursos" name="other_courses" value={editForm.other_courses} onChange={handleEditChange} />
                  <TextAreaField label="Acreditaciones" name="accreditations" value={editForm.accreditations} onChange={handleEditChange} />
                  <TextAreaField label="Idiomas" name="languages" value={editForm.languages} onChange={handleEditChange} />
                </div>

                <SectionTitle>Representante y observaciones</SectionTitle>
                <div style={styles.formRow}>
                  <Field label="Representante en calidad de" name="representative_role" value={editForm.representative_role} onChange={handleEditChange} />
                  <Field label="NIF representante" name="representative_nif" value={editForm.representative_nif} onChange={handleEditChange} />
                  <Field label="Nombre y apellidos representante" name="representative_full_name" value={editForm.representative_full_name} onChange={handleEditChange} />
                </div>
                <div style={styles.formRow}>
                  <TextAreaField label="Observaciones" name="observations" value={editForm.observations} onChange={handleEditChange} />
                </div>

                <label style={styles.checkboxLabel}>
                  <input name="is_active" type="checkbox" checked={editForm.is_active} onChange={handleEditChange} />
                  Trabajador activo
                </label>

                {editError && <div style={styles.error}>{editError}</div>}
                <div style={styles.modalActionsRight}>
                  <button type="button" onClick={handleCancelEdit} style={styles.cancelButton}>Cancelar</button>
                  <button type="submit" disabled={submitting} style={styles.saveButton}>{submitting ? "Guardando..." : "Guardar cambios"}</button>
                </div>
              </form>
            )}
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
  tableWrapper: { overflowX: "auto", overflowY: "visible" },
  table: { width: "100%", borderCollapse: "collapse" },
  tableRow: { height: "56px" },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #d1d5db", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  actionsTh: { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #d1d5db", backgroundColor: "#f9fafb", whiteSpace: "nowrap", width: "260px" },
  sortButton: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: 0, border: "none", backgroundColor: "transparent", color: "inherit", font: "inherit", fontWeight: 900, cursor: "pointer", textAlign: "left" },
  sortIcon: { color: "#6b7280", fontSize: "12px" },
  td: { padding: "10px 12px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap", verticalAlign: "middle" },
  tdStrong: { padding: "10px 12px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap", verticalAlign: "middle", fontWeight: 900 },
  actionsTd: { padding: "10px 12px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap", verticalAlign: "middle", position: "relative" },
  compactActions: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "nowrap" },
  activeBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  inactiveBadge: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  recordButton: { backgroundColor: "#f8f3b5", color: "#111827", border: "1px solid #111827", borderRadius: "7px", padding: "7px 9px", cursor: "pointer", fontWeight: 850, fontSize: "12px" },
  editButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "7px", padding: "7px 9px", cursor: "pointer", fontWeight: 850, fontSize: "12px" },
  duplicateButton: { backgroundColor: "#ffffff", color: "#111827", border: "1px solid #9ca3af", borderRadius: "7px", padding: "7px 9px", cursor: "pointer", fontWeight: 800, fontSize: "12px" },
  detailsButton: { backgroundColor: "#ffffff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "7px 9px", cursor: "pointer", fontWeight: 800, fontSize: "12px" },
  moreWrapper: { position: "relative" },
  moreButton: { backgroundColor: "#ffffff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "7px 9px", cursor: "pointer", fontWeight: 850, fontSize: "12px" },
  moreMenu: { position: "absolute", right: 0, top: "calc(100% + 6px)", minWidth: "150px", backgroundColor: "#ffffff", border: "1px solid #d1d5db", borderRadius: "8px", boxShadow: "0 12px 24px rgba(17, 24, 39, 0.14)", zIndex: 30, padding: "6px" },
  moreMenuItem: { width: "100%", textAlign: "left", backgroundColor: "transparent", border: "none", borderRadius: "6px", padding: "8px 10px", cursor: "pointer", fontWeight: 800, color: "#111827" },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(1120px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "1px solid #d1d5db", borderRadius: "12px", boxShadow: "0 18px 40px rgba(17, 24, 39, 0.18)", padding: "22px" },
  confirmModal: { width: "min(560px, 100%)", backgroundColor: "#ffffff", border: "1px solid #d1d5db", borderRadius: "12px", boxShadow: "0 18px 40px rgba(17, 24, 39, 0.18)", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  detailsWrapper: { display: "flex", flexDirection: "column", gap: "16px" },
  detailsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" },
  detailBox: { border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 },
  detailBoxWide: { border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "4px", gridColumn: "1 / -1" },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  sectionTitle: { margin: "6px 0 0", paddingTop: "8px", borderTop: "1px solid #e5e7eb", fontSize: "14px", fontWeight: 900, color: "#111827" },
  formRow: { display: "flex", gap: "14px", flexWrap: "wrap" },
  formGroup: { flex: "1 1 210px", minWidth: "200px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupTextarea: { flex: "1 1 260px", minWidth: "240px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  textarea: { minHeight: "86px", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", resize: "vertical" },
  readOnlyInput: { backgroundColor: "#f3f4f6", color: "#6b7280", cursor: "not-allowed", fontWeight: 800 },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 },
  confirmText: { margin: "0 0 16px", color: "#374151", lineHeight: 1.5 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
};
