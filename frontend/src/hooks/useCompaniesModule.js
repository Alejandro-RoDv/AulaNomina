import { useState } from "react";

import { createCompany, deleteCompany, updateCompany } from "../services/companyApi";
import { createWorkCenter, deleteWorkCenter, updateWorkCenter } from "../services/workCenterApi";
import {
  buildCompanyPayload,
  buildWorkCenterPayload,
  initialCompanyForm,
  initialWorkCenterForm,
} from "../utils/companyPayloads";

export function useCompaniesModule({ companies, onDataChanged }) {
  const [companyForm, setCompanyForm] = useState(initialCompanyForm);
  const [workCenterForm, setWorkCenterForm] = useState(initialWorkCenterForm);

  const [companySubmitting, setCompanySubmitting] = useState(false);
  const [workCenterSubmitting, setWorkCenterSubmitting] = useState(false);

  const [companyError, setCompanyError] = useState("");
  const [companySuccess, setCompanySuccess] = useState("");
  const [workCenterError, setWorkCenterError] = useState("");
  const [workCenterSuccess, setWorkCenterSuccess] = useState("");

  const handleCompanyChange = (event) => {
    const { name, value } = event.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleWorkCenterChange = (event) => {
    const { name, value } = event.target;
    setWorkCenterForm((prev) => {
      if (name === "company_id") {
        const selectedCompany = companies.find((company) => String(company.id) === String(value));
        return { ...prev, company_id: value, general_ccc: selectedCompany?.ccc || "" };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleCompanySubmit = async (event) => {
    event.preventDefault();
    setCompanyError("");
    setCompanySuccess("");

    try {
      setCompanySubmitting(true);
      await createCompany(buildCompanyPayload(companyForm));
      setCompanySuccess("Empresa creada correctamente");
      setCompanyForm(initialCompanyForm);
      await onDataChanged();
    } catch (err) {
      setCompanyError(err.message || "Error al crear empresa");
    } finally {
      setCompanySubmitting(false);
    }
  };

  const handleUpdateCompany = async (companyId, form) => {
    setCompanyError("");
    setCompanySuccess("");

    try {
      setCompanySubmitting(true);
      await updateCompany(companyId, buildCompanyPayload(form));
      setCompanySuccess("Empresa actualizada correctamente");
      await onDataChanged();
    } catch (err) {
      setCompanyError(err.message || "Error al actualizar empresa");
      throw err;
    } finally {
      setCompanySubmitting(false);
    }
  };

  const handleDeleteCompany = async (companyId) => {
    setCompanyError("");
    setCompanySuccess("");

    try {
      setCompanySubmitting(true);
      await deleteCompany(companyId);
      setCompanySuccess("Empresa desactivada correctamente");
      await onDataChanged();
    } catch (err) {
      setCompanyError(err.message || "Error al desactivar empresa");
      throw err;
    } finally {
      setCompanySubmitting(false);
    }
  };

  const handleWorkCenterSubmit = async (event) => {
    event.preventDefault();
    setWorkCenterError("");
    setWorkCenterSuccess("");

    try {
      setWorkCenterSubmitting(true);
      await createWorkCenter(buildWorkCenterPayload(workCenterForm));
      setWorkCenterSuccess("Centro creado correctamente");
      setWorkCenterForm(initialWorkCenterForm);
      await onDataChanged();
    } catch (err) {
      setWorkCenterError(err.message || "Error al crear centro");
    } finally {
      setWorkCenterSubmitting(false);
    }
  };

  const handleUpdateWorkCenter = async (workCenterId, form) => {
    setWorkCenterError("");
    setWorkCenterSuccess("");

    try {
      setWorkCenterSubmitting(true);
      await updateWorkCenter(workCenterId, buildWorkCenterPayload(form));
      setWorkCenterSuccess("Centro actualizado correctamente");
      await onDataChanged();
    } catch (err) {
      setWorkCenterError(err.message || "Error al actualizar centro");
      throw err;
    } finally {
      setWorkCenterSubmitting(false);
    }
  };

  const handleDeleteWorkCenter = async (workCenterId) => {
    setWorkCenterError("");
    setWorkCenterSuccess("");

    try {
      setWorkCenterSubmitting(true);
      await deleteWorkCenter(workCenterId);
      setWorkCenterSuccess("Centro desactivado correctamente");
      await onDataChanged();
    } catch (err) {
      setWorkCenterError(err.message || "Error al desactivar centro");
      throw err;
    } finally {
      setWorkCenterSubmitting(false);
    }
  };

  return {
    companyForm,
    workCenterForm,
    companySubmitting,
    workCenterSubmitting,
    companyError,
    companySuccess,
    workCenterError,
    workCenterSuccess,
    handleCompanyChange,
    handleCompanySubmit,
    handleUpdateCompany,
    handleDeleteCompany,
    handleWorkCenterChange,
    handleWorkCenterSubmit,
    handleUpdateWorkCenter,
    handleDeleteWorkCenter,
    setCompanyError,
    setWorkCenterError,
  };
}
