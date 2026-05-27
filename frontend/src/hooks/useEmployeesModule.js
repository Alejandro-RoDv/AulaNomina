import { useState } from "react";

import {
  createEmployee,
  deleteEmployee,
  fetchNextEmployeeCode,
  updateEmployee,
} from "../services/employeeApi";
import { buildEmployeePayload, initialEmployeeForm } from "../utils/employeePayloads";

export function useEmployeesModule({ onDataChanged }) {
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);
  const [employeeSubmitting, setEmployeeSubmitting] = useState(false);
  const [employeeError, setEmployeeError] = useState("");
  const [employeeSuccess, setEmployeeSuccess] = useState("");

  const loadNextEmployeeCode = async () => {
    const data = await fetchNextEmployeeCode();
    setEmployeeForm((prev) => ({ ...prev, employee_code: data.employee_code }));
  };

  const setNextEmployeeCode = (employeeCode) => {
    setEmployeeForm((prev) => ({ ...prev, employee_code: employeeCode }));
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
    setEmployeeError,
    setNextEmployeeCode,
    loadNextEmployeeCode,
  };
}
