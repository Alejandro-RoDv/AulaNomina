import { useState } from "react";

import { createContract, deleteContract, updateContract } from "../services/api";
import { getSelectedCompanyId, setSelectedCompanyId } from "../utils/companyContext";
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

function contractFormWithContext() {
  return { ...initialContractForm, company_id: getSelectedCompanyId() };
}

function formatValidationErrors(errors) {
  return `Validaciones pendientes: ${errors
    .map((error, index) => `${index + 1}. ${error}`)
    .join(" ")}`;
}

function parseSalaryLinesFromContractExtra(contractExtra = {}) {
  if (Array.isArray(contractExtra.salaryLines)) return contractExtra.salaryLines;
  const observations = String(contractExtra.bonus_observations || "");
  const marker = "Complementos:";
  if (!observations.includes(marker)) return [];
  return observations
    .split(marker)[1]
    .split("|")[0]
    .split(";")
    .map((rawLine) => rawLine.trim())
    .filter(Boolean)
    .map((rawLine, index) => {
      const parts = rawLine.split(" ");
      const amount = Number(parts.pop() || 0);
      const name = parts.join(" ").trim() || `Complemento ${index + 1}`;
      return { id: index + 1, name, amount, type: "complement" };
    })
    .filter((line) => line.name && Number(line.amount) > 0);
}

function cleanContractExtraForPersistence(contractExtra = {}) {
  const cleanExtra = { ...contractExtra };
  delete cleanExtra.salaryLines;

  if (typeof cleanExtra.bonus_observations === "string" && cleanExtra.bonus_observations.includes("Complementos:")) {
    cleanExtra.bonus_observations = cleanExtra.bonus_observations
      .split("|")
      .filter((segment) => !segment.includes("Complementos:"))
      .map((segment) => segment.trim())
      .filter(Boolean)
      .join(" | ");
  }

  return cleanExtra;
}

export function useContractsModule({ onDataChanged }) {
  const [contractForm, setContractForm] = useState(contractFormWithContext);
  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [contractError, setContractError] = useState("");
  const [contractSuccess, setContractSuccess] = useState("");

  const handleContractChange = (event) => {
    const { name, value } = event.target;
    if (name === "company_id") setSelectedCompanyId(value);
    setContractForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleContractSubmit = async (event, advancedPayload = {}) => {
    event.preventDefault();
    setContractError("");
    setContractSuccess("");

    const contractExtra = advancedPayload.contractExtra || {};
    const cleanContractExtra = cleanContractExtraForPersistence(contractExtra);
    const salaryLines = advancedPayload.salaryLines || parseSalaryLinesFromContractExtra(contractExtra);
    const socialSecurityPayload = advancedPayload.socialSecurity || null;
    const validationErrors = validateContractWorkflow(
      contractForm,
      cleanContractExtra,
      socialSecurityPayload
    );

    if (validationErrors.length) {
      setContractError(formatValidationErrors(validationErrors));
      return;
    }

    try {
      setContractSubmitting(true);
      await createContract(
        buildContractPayload(contractForm, cleanContractExtra),
        normalizeSocialSecurityPayload(socialSecurityPayload),
        salaryLines
      );
      setContractSuccess("Contrato, alta SS y estructura retributiva creados correctamente");
      setContractForm(contractFormWithContext());
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
