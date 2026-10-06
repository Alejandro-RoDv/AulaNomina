import { subscribeSelectedCompany } from "../utils/companyContext";
import { useEffect, useState } from "react";

import { createIncident, deleteIncident, updateIncident } from "../services/incidentApi";
import {
  buildIncidentPayload,
  buildIncidentUpdatePayload,
  initialIncidentForm,
} from "../utils/incidentPayloads";

export function useIncidentsModule({ contracts, onDataChanged }) {
  const [incidentForm, setIncidentForm] = useState({ ...initialIncidentForm });
  useEffect(() => subscribeSelectedCompany((companyId) => {
    setIncidentForm((previous) => ({ ...previous, company_id: companyId, center_id: "", employee_id: "", contract_id: "" }));
  }), []);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentError, setIncidentError] = useState("");
  const [incidentSuccess, setIncidentSuccess] = useState("");

  const handleIncidentChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;

    setIncidentForm((prev) => {
      if (name === "employee_id") {
        return { ...prev, employee_id: nextValue, contract_id: "", company_id: "", center_id: "" };
      }

      if (name === "contract_id") {
        const selectedContract = contracts.find((contract) => String(contract.id) === String(nextValue));
        return {
          ...prev,
          contract_id: nextValue,
          company_id: selectedContract?.company_id ? String(selectedContract.company_id) : "",
          center_id: selectedContract?.center_id ? String(selectedContract.center_id) : "",
        };
      }

      if (name === "incident_type" && nextValue !== prev.incident_type) {
        return { ...initialIncidentForm, employee_id: prev.employee_id, contract_id: prev.contract_id, company_id: prev.company_id, center_id: prev.center_id, incident_type: nextValue };
      }
      return { ...prev, [name]: nextValue };
    });
  };

  const handleIncidentSubmit = async (event) => {
    event.preventDefault();
    setIncidentError("");
    setIncidentSuccess("");

    try {
      setIncidentSubmitting(true);
      const payload = buildIncidentPayload({ ...incidentForm, overtime_contract: contracts.find((contract) => String(contract.id) === String(incidentForm.contract_id)) });
      if (payload.incident_type === "HORAS_EXTRA" && payload.details.inclusion_destination === "payroll" && !(Number(payload.details.hour_value) > 0)) {
        throw new Error("El contrato no tiene un valor de hora calculable. Indica un importe manual o revisa su salario y jornada.");
      }
      await createIncident(payload);
      setIncidentSuccess("Incidencia creada correctamente");
      setIncidentForm({ ...initialIncidentForm, incident_type: incidentForm.incident_type, unit_type: incidentForm.unit_type, payroll_effect: incidentForm.payroll_effect });
      await onDataChanged();
    } catch (err) {
      setIncidentError((err.message || "Error al crear incidencia").replace("Revise el conflicto o autorícelo indicando un motivo.", "Revisa las fechas y las incidencias existentes en el historial."));
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
      setIncidentSuccess("Incidencia anulada correctamente");
      await onDataChanged();
    } catch (err) {
      setIncidentError(err.message || "Error al anular incidencia");
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
