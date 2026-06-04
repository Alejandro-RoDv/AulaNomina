import { useState } from "react";

import {
  createEmployee,
  deleteEmployee,
  fetchNextEmployeeCode,
  updateEmployee,
} from "../services/employeeApi";
import { buildEmployeePayload, initialEmployeeForm } from "../utils/employeePayloads";

function buildDuplicatedEmployeeForm(employee) {
  if (!employee) return initialEmployeeForm;

  return {
    ...initialEmployeeForm,
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
    observations: employee.observations ? `${employee.observations}\n\nAlta duplicada desde trabajador ${employee.employee_code || employee.id}.` : `Alta duplicada desde trabajador ${employee.employee_code || employee.id}.`,
  };
}

export function useEmployeesModule({ onDataChanged }) {
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);
  const [employeeSubmitting, setEmployeeSubmitting] = useState(false);
  const [employeeError, setEmployeeError] = useState("");
  const [employeeSuccess, setEmployeeSuccess] = useState("");

  const loadNextEmployeeCode = async () => {
    const data = await fetchNextEmployeeCode();
    setEmployeeForm((prev) => ({ ...prev, employee_code: data.employee_code || data.next_code || "" }));
  };

  const setNextEmployeeCode = (employeeCode) => {
    setEmployeeForm((prev) => ({ ...prev, employee_code: employeeCode }));
  };

  const prefillEmployeeFromExisting = (employee, message = "Datos personales cargados desde otro registro del trabajador") => {
    setEmployeeError("");
    setEmployeeSuccess(message);
    setEmployeeForm(buildDuplicatedEmployeeForm(employee));
  };

  const handleEmployeeChange = (event) => {
    const { name, value } = event.target;
    setEmployeeForm((prev) =>
      name === "company_id"
        ? { ...prev, company_id: value, center_id: "" }
        : { ...prev, [name]: value }
    );
  };

  const handleEmployeeSubmit = async (event) => {
    event.preventDefault();
    setEmployeeError("");
    setEmployeeSuccess("");

    try {
      setEmployeeSubmitting(true);
      await createEmployee(buildEmployeePayload({ ...employeeForm, is_active: true }));
      setEmployeeSuccess("Trabajador creado correctamente");
      setEmployeeForm(initialEmployeeForm);
      await onDataChanged();
    } catch (err) {
      setEmployeeError(err.message || "Error al crear trabajador");
      await loadNextEmployeeCode();
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (employeeId, form) => {
    setEmployeeError("");
    setEmployeeSuccess("");

    try {
      setEmployeeSubmitting(true);
      await updateEmployee(employeeId, buildEmployeePayload(form));
      setEmployeeSuccess("Trabajador actualizado correctamente");
      await onDataChanged();
    } catch (err) {
      setEmployeeError(err.message || "Error al actualizar trabajador");
      throw err;
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    setEmployeeError("");
    setEmployeeSuccess("");

    try {
      setEmployeeSubmitting(true);
      await deleteEmployee(employeeId);
      setEmployeeSuccess("Trabajador desactivado correctamente");
      await onDataChanged();
    } catch (err) {
      setEmployeeError(err.message || "Error al desactivar trabajador");
      throw err;
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  return {
    employeeForm,
    employeeSubmitting,
    employeeError,
    employeeSuccess,
    handleEmployeeChange,
    handleEmployeeSubmit,
    handleUpdateEmployee,
    handleDeleteEmployee,
    prefillEmployeeFromExisting,
    setEmployeeError,
    setNextEmployeeCode,
    loadNextEmployeeCode,
  };
}
