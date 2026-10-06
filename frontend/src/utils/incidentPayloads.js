import { overtimeValues } from "./overtime.js";

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
  unit_type: "days",
  hours: "",
  days: "",
  paid: "",
  payroll_effect: "pending",
  generated_amount: "",
  overlap_override: false,
  overlap_reason: "",
  origin: "manual",
  benefit_type: "",
  process_type: "",
  cause_code: "",
  discharge_date: "",
  direct_payment: false,
  natural_days: false,
  relapse_process_reference: "",
  vacation_day_type: "calendar",
  pay_in_payroll: false,
  payroll_label: "",
  overtime_type: "ordinary",
  overtime_unit: "hours",
  overtime_quantity: "",
  overtime_day_hours: "8",
  overtime_amount_mode: "automatic",
  overtime_amount: "",
  overtime_contract: null,
  hour_value: "",
  inclusion_destination: "payroll",
  cont_aux: "",
  movement_field: "",
  previous_value: "",
  new_value: "",
  effective_date: "",
  payroll_incidence_aux: "",
  d_baja_aux: "",
  replacement_date: "",
  indicator_c: "",
  indicator_h: "",
  gp_aux: "",
  aux_calculation: "",
  internal_indicator: "",
};

const DETAIL_FIELDS = [
  "benefit_type", "process_type", "cause_code", "discharge_date", "direct_payment", "natural_days",
  "relapse_process_reference", "vacation_day_type", "pay_in_payroll", "payroll_label", "overtime_type",
  "hour_value", "inclusion_destination", "cont_aux", "movement_field", "previous_value", "new_value",
  "effective_date", "payroll_incidence_aux", "d_baja_aux", "replacement_date", "indicator_c", "indicator_h",
  "gp_aux", "aux_calculation", "internal_indicator",
];

function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

function nullableBoolean(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  return value === "true";
}

function buildDetails(form) {
  return DETAIL_FIELDS.reduce((result, field) => {
    const value = form[field];
    if (typeof value === "boolean") {
      result[field] = value;
    } else if (value !== "" && value !== null && value !== undefined) {
      result[field] = value;
    }
    return result;
  }, {});
}

export function buildIncidentPayload(form) {
  const simpleOvertime = form.incident_type === "HORAS_EXTRA" && form.overtime_quantity !== "" && form.overtime_quantity != null;
  const overtime = simpleOvertime ? overtimeValues(form, form.overtime_contract || {}) : null;
  const details = buildDetails(form);
  if (overtime) Object.assign(details, { hour_value: overtime.rate, amount_mode: form.overtime_amount_mode, entered_quantity: Number(form.overtime_quantity), entered_unit: form.overtime_unit, day_hours: Number(form.overtime_day_hours), requested_amount: overtime.total });
  if (["IT", "RECAIDA", "NACIMIENTO_CUIDADO", "RIESGO_EMBARAZO", "RIESGO_LACTANCIA", "CUIDADO_MENOR"].includes(form.incident_type)) {
    details.benefit_type = ({ IT: "temporary_disability", RECAIDA: "temporary_disability", NACIMIENTO_CUIDADO: "birth_care", RIESGO_EMBARAZO: "pregnancy_risk", RIESGO_LACTANCIA: "lactation_risk", CUIDADO_MENOR: "child_care" })[form.incident_type];
  }
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
    unit_type: overtime ? "hours" : emptyToNull(form.unit_type),
    hours: overtime ? overtime.hours : form.hours === "" ? null : Number(form.hours),
    days: overtime ? null : form.days === "" ? null : Number(form.days),
    paid: nullableBoolean(form.paid),
    payroll_effect: form.payroll_effect || "pending",
    generated_amount: null,
    overlap_override: Boolean(form.overlap_override),
    overlap_reason: form.overlap_reason || null,
    origin: form.origin || "manual",
    details,
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
    unit_type: emptyToNull(form.unit_type),
    hours: form.hours === "" ? null : Number(form.hours),
    days: form.days === "" ? null : Number(form.days),
    paid: nullableBoolean(form.paid),
    payroll_effect: form.payroll_effect || "pending",
    generated_amount: form.generated_amount === "" ? null : Number(form.generated_amount),
    overlap_override: Boolean(form.overlap_override),
    overlap_reason: form.overlap_reason || null,
    origin: form.origin || "manual",
    details: buildDetails(form),
    expected_version: form.version || null,
    change_reason: form.change_reason || null,
  };
}
