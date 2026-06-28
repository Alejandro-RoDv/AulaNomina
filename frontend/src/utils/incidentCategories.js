export const INCIDENT_CATEGORY_TABS = [
  { value: "all", label: "Resumen mensual", kind: "dashboard", types: null },
  {
    value: "medical",
    label: "Incapacidad y prestaciones",
    kind: "form",
    types: ["IT", "RECAIDA", "NACIMIENTO_CUIDADO", "RIESGO_EMBARAZO", "RIESGO_LACTANCIA", "CUIDADO_MENOR"],
    defaultType: "IT",
    typeLabel: "Tipo de incapacidad o prestación",
    title: "Registrar incapacidad o prestación",
    subtitle: "Selecciona el proceso concreto y registra sus fechas, causa y tratamiento en nómina.",
    submitLabel: "Registrar incapacidad o prestación",
    defaults: { unit_type: "days", payroll_effect: "pending" },
  },
  {
    value: "absence",
    label: "Absentismo",
    kind: "form",
    types: ["AUSENCIA", "PERMISO_RETRIBUIDO", "PERMISO_NO_RETRIBUIDO", "SUSPENSION", "SANCION"],
    defaultType: "AUSENCIA",
    typeLabel: "Tipo de absentismo",
    title: "Registrar absentismo",
    subtitle: "Selecciona la causa de ausencia y define su duración y tratamiento retributivo.",
    submitLabel: "Registrar absentismo",
    defaults: { unit_type: "days", payroll_effect: "pending" },
  },
  {
    value: "vacation",
    label: "Vacaciones",
    kind: "form",
    types: ["VACACIONES"],
    defaultType: "VACACIONES",
    title: "Registrar vacaciones",
    subtitle: "Registra el periodo de vacaciones y su forma de cómputo en calendario y nómina.",
    submitLabel: "Registrar vacaciones",
    defaults: { unit_type: "days", payroll_effect: "informative" },
  },
  {
    value: "overtime",
    label: "Horas extraordinarias",
    kind: "form",
    types: ["HORAS_EXTRA"],
    defaultType: "HORAS_EXTRA",
    title: "Registrar horas extraordinarias",
    subtitle: "Introduce las horas realizadas, su valor y el destino de compensación o pago.",
    submitLabel: "Registrar horas extraordinarias",
    defaults: { unit_type: "hours", payroll_effect: "earning" },
  },
  {
    value: "movement",
    label: "Cambios del trabajador",
    kind: "form",
    types: ["MOVIMIENTO"],
    defaultType: "MOVIMIENTO",
    title: "Registrar cambio del trabajador",
    subtitle: "Documenta cambios de categoría, jornada, centro u otras condiciones con fecha de efectos.",
    submitLabel: "Registrar cambio",
    defaults: { unit_type: "informative", payroll_effect: "pending" },
  },
  { value: "history", label: "Historial de incidencias", kind: "history", types: null },
];

export function getIncidentCategory(value) {
  return INCIDENT_CATEGORY_TABS.find((tab) => tab.value === value) || INCIDENT_CATEGORY_TABS[0];
}

export function getCategoryFormUpdates(tab, currentType) {
  if (!tab || tab.kind !== "form" || !tab.defaultType) return {};
  const currentTypeAllowed = Array.isArray(tab.types) && tab.types.includes(currentType);
  return {
    ...(currentTypeAllowed ? {} : { incident_type: tab.defaultType }),
    ...tab.defaults,
  };
}
