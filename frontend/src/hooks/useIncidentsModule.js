import { useState } from "react";

import { createIncident, deleteIncident, updateIncident } from "../services/incidentApi";
import {
  buildIncidentPayload,
  buildIncidentUpdatePayload,
  initialIncidentForm,
} from "../utils/incidentPayloads";

export function useIncidentsModule({ contracts, onDataChanged }) {
  const [incidentForm, setIncidentForm] = useState(initialIncidentForm);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentError, setIncidentError] = useState("");
  const [incidentSuccess, setIncidentSuccess] = useState("");

  const handleIncidentChange = (event) => {
    const { name, value } = event.target;

    setIncidentForm((prev) => {
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

  const handleIncidentSubmit = async (event) => {
    event.preventDefault();
    setIncidentError("");
    setIncidentSuccess("");

    try {
      setIncidentSubmitting(true);
      await createIncident(buildIncidentPayload(incidentForm));
      setIncidentSuccess("Incidencia creada correctamente");
      setIncidentForm(initialIncidentForm);
      await onDataChanged();
    } catch (err) {
      setIncidentError(err.message || "Error al crear incidencia");
    } finally {
      setIncidentSubmitting(false);
    }
  };

  const handleUpdateIncident = async (incidentId, form) => {
    setIncidentError("");
    setIncidentSuccess("");

    try {
      setIncidentSubmitting(true);
      await updateIncident(incidentId, buildIncidentUpdatePayload(form));
      setIncidentSuccess("Incidencia actualizada correctamente");
      await onDataChanged();
    } catch (err) {
      setIncidentError(err.message || "Error al actualizar incidencia");
      throw err;
    } finally {
      setIncidentSubmitting(false);
    }
  };

  const handleDeleteIncident = async (incidentId) => {
    setIncidentError("");
    setIncidentSuccess("");

    try {
      setIncidentSubmitting(true);
      await deleteIncident(incidentId);
      setIncidentSuccess("Incidencia eliminada correctamente");
      await onDataChanged();
    } catch (err) {
      setIncidentError(err.message || "Error al eliminar incidencia");
      throw err;
    } finally {
      setIncidentSubmitting(false);
    }
  };

  return {
    incidentForm,
    incidentSubmitting,
    incidentError,
    incidentSuccess,
    handleIncidentChange,
    handleIncidentSubmit,
    handleUpdateIncident,
    handleDeleteIncident,
    setIncidentError,
  };
}
