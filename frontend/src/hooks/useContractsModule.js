import { useState } from "react";

import { createContract, deleteContract, updateContract } from "../services/api";
import { buildContractPayload, normalizeSocialSecurityPayload } from "../utils/contractPayloads";

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

    try {
      setContractSubmitting(true);
      await createContract(
        buildContractPayload(contractForm, advancedPayload.contractExtra),
        normalizeSocialSecurityPayload(advancedPayload.socialSecurity)
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
