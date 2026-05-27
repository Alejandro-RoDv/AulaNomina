import { useState } from "react";

import { createPayroll, deletePayroll, updatePayroll } from "../services/payrollApi";
import {
  buildPayrollPayload,
  buildPayrollUpdatePayload,
  initialPayrollForm,
} from "../utils/payrollPayloads";

export function usePayrollsModule({ contracts, onDataChanged }) {
  const [payrollForm, setPayrollForm] = useState(initialPayrollForm);
  const [payrollSubmitting, setPayrollSubmitting] = useState(false);
  const [payrollError, setPayrollError] = useState("");
  const [payrollSuccess, setPayrollSuccess] = useState("");

  const handlePayrollChange = (event) => {
    const { name, value } = event.target;

    setPayrollForm((prev) => {
      if (name === "employee_id") {
        return { ...prev, employee_id: value, contract_id: "", company_id: "", center_id: "" };
      }

      if (name === "contract_id") {
        const selectedContract = contracts.find((contract) => String(contract.id) === String(value));
        return {
          ...prev,
          contract_id: value,
          company_id: selectedContract?.company_id ? String(selectedContract.company_id) : "",
          center_id: selectedContract?.center_id ? String(selectedContract.center_id) : "",
        };
      }

      return { ...prev, [name]: value };
    });
  };

  const handlePayrollSubmit = async (event) => {
    event.preventDefault();
    setPayrollError("");
    setPayrollSuccess("");

    try {
      setPayrollSubmitting(true);
      await createPayroll(buildPayrollPayload(payrollForm));
      setPayrollSuccess("Nómina generada correctamente");
      setPayrollForm(initialPayrollForm);
      await onDataChanged();
    } catch (err) {
      setPayrollError(err.message || "Error al generar nómina");
    } finally {
      setPayrollSubmitting(false);
    }
  };

  const handleUpdatePayroll = async (payrollId, form) => {
    setPayrollError("");
    setPayrollSuccess("");

    try {
      setPayrollSubmitting(true);
      await updatePayroll(payrollId, buildPayrollUpdatePayload(form));
      setPayrollSuccess("Nómina actualizada correctamente");
      await onDataChanged();
    } catch (err) {
      setPayrollError(err.message || "Error al actualizar nómina");
      throw err;
    } finally {
      setPayrollSubmitting(false);
    }
  };

  const handleDeletePayroll = async (payrollId) => {
    setPayrollError("");
    setPayrollSuccess("");

    try {
      setPayrollSubmitting(true);
      await deletePayroll(payrollId);
      setPayrollSuccess("Nómina eliminada correctamente");
      await onDataChanged();
    } catch (err) {
      setPayrollError(err.message || "Error al eliminar nómina");
      throw err;
    } finally {
      setPayrollSubmitting(false);
    }
  };

  return {
    payrollForm,
    payrollSubmitting,
    payrollError,
    payrollSuccess,
    handlePayrollChange,
    handlePayrollSubmit,
    handleUpdatePayroll,
    handleDeletePayroll,
    setPayrollError,
  };
}
