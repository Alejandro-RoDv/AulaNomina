export const initialIncidentForm = {
  employee_id: "",
  contract_id: "",
  company_id: "",
  center_id: "",
  incident_type: "",
  start_date: "",
  end_date: "",
  description: "",
  status: "open",
};

export function buildIncidentPayload(form) {
  return {
    employee_id: Number(form.employee_id),
    contract_id: Number(form.contract_id),
    company_id: Number(form.company_id),
    center_id: form.center_id ? Number(form.center_id) : null,
    incident_type: form.incident_type,
    start_date: form.start_date,
    end_date: form.end_date || null,
    description: form.description || null,
    status: form.status,
  };
}

export function buildIncidentUpdatePayload(form) {
  return {
    center_id: form.center_id ? Number(form.center_id) : null,
    incident_type: form.incident_type,
    start_date: form.start_date,
    end_date: form.end_date || null,
    description: form.description || null,
    status: form.status,
  };
}
