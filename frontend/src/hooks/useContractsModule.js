import { useState } from "react";

import { createContract, deleteContract, updateContract } from "../services/api";
import {
  buildContractPayload,
  normalizeSocialSecurityPayload,
  validateContractWorkflow,
} from "../utils/contractPayloads";

const initialContractForm = {
  employee_id: "",
  company_id: "",
  center_id: "",
  contract_type: "",
  start_date: "",
  end_date: "",
  salary_base: "",
  pay_schedule: "not_prorated_14",
  status: "active",
};

function formatValidationErrors(errors) {
  return errors.join("\n");
}

export function useContractsModule({ onDataChanged }) {
  const [contractForm, setContractForm] = useState(initialContractForm);
  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [contractError, setContractError] = useState("");
  const [contractSuccess, setContractSuccess] = useState("");

  const handleContractChange = (event) => {
    const { name, value } = event.target;
    setContractForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleContractSubmit = async (event, advancedPayload = {}) => {
    event.preventDefault();
    setContractError("");
    setContractSuccess("");

    const socialSecurityPayload = advancedPayload.socialSecurity || null;
    const validationErrors = validateContractWorkflow(
      contractForm,
      advancedPayload.contractExtra || {},
      socialSecurityPayload
    );

    if (validationErrors.length) {
      setContractError(formatValidationErrors(validationErrors));
      return;
    }

    try {
      setContractSubmitting(true);
      await createContract(
        buildContractPayload(contractForm, advancedPayload.contractExtra),
        normalizeSocialSecurityPayload(socialSecurityPayload)
      );
      setContractSuccess("Contrato y alta SS creados correctamente");
      setContractForm(initialContractForm);
      await onDataChanged();
    } catch (err) {
      setContractError(err.message || "Error al crear contrato");
    } finally {
      setContractSubmitting(false);
    }
  };

  const handleUpdateContract = async (contractId, form, socialSecurityPayload = null) => {
    setContractError("");
    setContractSuccess("");

    const validationErrors = validateContractWorkflow(form, form, socialSecurityPayload);
    if (validationErrors.length) {
      const message = formatValidationErrors(validationErrors);
      setContractError(message);
      throw new Error(message);
    }

    try {
      setContractSubmitting(true);
      await updateContract(
        contractId,
        buildContractPayload(form, form),
        normalizeSocialSecurityPayload(socialSecurityPayload)
      );
      setContractSuccess("Contrato y alta SS actualizados correctamente");
      await onDataChanged();
    } catch (err) {
      setContractError(err.message || "Error al actualizar contrato");
      throw err;
    } finally {
      setContractSubmitting(false);
    }
  };

  const handleDeleteContract = async (contractId) => {
    setContractError("");
    setContractSuccess("");

    try {
      setContractSubmitting(true);
      await deleteContract(contractId);
      setContractSuccess("Contrato eliminado correctamente");
      await onDataChanged();
    } catch (err) {
      setContractError(err.message || "Error al eliminar contrato");
      throw err;
    } finally {
      setContractSubmitting(false);
    }
  };

  return {
    contractForm,
    contractSubmitting,
    contractError,
    contractSuccess,
    handleContractChange,
    handleContractSubmit,
    handleUpdateContract,
    handleDeleteContract,
    setContractError,
  };
}
