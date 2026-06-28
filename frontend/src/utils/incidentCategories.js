export const INCIDENT_CATEGORY_TABS = [
  {
    value: "all",
    label: "Resumen mensual",
    types: null,
    defaultType: null,
    title: "Registrar incidencia",
    subtitle: "Selecciona trabajador y vida laboral; el backend comprobará vigencia, solapamientos y nóminas afectadas.",
    submitLabel: "Registrar incidencia",
    defaults: {},
  },
  {
    value: "medical",
    label: "Incapacidad y prestaciones",
    types: ["IT", "RECAIDA", "NACIMIENTO_CUIDADO", "RIESGO_EMBARAZO", "RIESGO_LACTANCIA", "CUIDADO_MENOR"],
    defaultType: "IT",
    title: "Registrar incapacidad o prestación",
    subtitle: "Gestiona bajas, recaídas y prestaciones protegidas con su proceso y efecto en nómina.",
    submitLabel: "Registrar incapacidad o prestación",
    defaults: { unit_type: "days", payroll_effect: "pending" },
  },
  {
    value: "absence",
    label: "Absentismo",
    types: ["AUSENCIA", "PERMISO_RETRIBUIDO", "PERMISO_NO_RETRIBUIDO", "SUSPENSION", "SANCION"],
    defaultType: "AUSENCIA",
    title: "Registrar absentismo",
    subtitle: "Registra ausencias, permisos, suspensiones y sanciones con su tratamiento retributivo.",
    submitLabel: "Registrar absentismo",
    defaults: { unit_type: "days", payroll_effect: "pending" },
  },
  {
    value: "vacation",
    label: "Vacaciones",
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
    types: ["HORAS_EXTRA"],
    defaultType: "HORAS_EXTRA",
    title: "Registrar horas extraordinarias",
    subtitle: "Introduce horas, valor unitario y destino para su inclusión o compensación.",
    submitLabel: "Registrar horas extraordinarias",
    defaults: { unit_type: "hours", payroll_effect: "earning" },
  },
  {
    value: "movement",
    label: "Cambios del trabajador",
    types: ["MOVIMIENTO"],
    defaultType: "MOVIMIENTO",
    title: "Registrar cambio del trabajador",
    subtitle: "Documenta cambios de categoría, jornada, centro u otras condiciones con fecha de efectos.",
    submitLabel: "Registrar cambio",
    defaults: { unit_type: "informative", payroll_effect: "pending" },
  },
];

export function getIncidentCategory(value) {
  return INCIDENT_CATEGORY_TABS.find((tab) => tab.value === value) || INCIDENT_CATEGORY_TABS[0];
}

export function getCategoryFormUpdates(tab, currentType) {
  if (!tab || !tab.defaultType) return {};
  const currentTypeAllowed = Array.isArray(tab.types) && tab.types.includes(currentType);
  return {
    ...(currentTypeAllowed ? {} : { incident_type: tab.defaultType }),
    ...tab.defaults,
  };
}
