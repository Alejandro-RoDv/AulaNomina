const CONTRACT_NUMERIC_FIELDS = new Set([
  "weekly_hours",
  "full_time_weekly_hours",
  "annual_agreement_hours",
  "monthly_hours",
  "annual_hours",
  "partiality_coefficient",
  "gross_annual_salary",
  "collective_agreement_id",
  "professional_category_id",
  "salary_table_row_id",
  "bonus_fixed_fee",
  "ordinary_hours",
  "comparison_hours",
  "legal_workday_reduction_percentage",
  "it_rate",
  "ims_rate",
  "transformation_from_contract_id",
]);

const CONTRACT_BOOLEAN_FIELDS = new Set([
  "works_holidays",
  "holiday_only_service_days",
  "subrogation",
  "affects_extra_payments",
]);

const SOCIAL_SECURITY_NUMERIC_FIELDS = new Set([
  "disability_degree",
  "working_time_reduction",
  "initial_ctp",
]);

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function toNumberOrNull(value) {
  if (!hasValue(value)) return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function toBoolean(value) {
  return value === true || value === "true" || value === "on";
}

export function normalizeContractExtras(extra = {}) {
  return Object.entries(extra).reduce((acc, [key, value]) => {
    if (value === "" || value === undefined || value === null) return acc;
    if (CONTRACT_BOOLEAN_FIELDS.has(key)) {
      acc[key] = toBoolean(value);
      return acc;
    }
    acc[key] = CONTRACT_NUMERIC_FIELDS.has(key) ? Number(value) : value;
    return acc;
  }, {});
}

export function normalizeSocialSecurityPayload(payload = null) {
  if (!payload) return null;

  const normalized = Object.entries(payload).reduce((acc, [key, value]) => {
    if (value === "" || value === undefined) return acc;

    if (key === "is_replacement") {
      acc[key] = Boolean(value);
      return acc;
    }

    acc[key] = SOCIAL_SECURITY_NUMERIC_FIELDS.has(key) ? Number(value) : value;
    return acc;
  }, {});

  return Object.keys(normalized).length ? normalized : null;
}

export function validateContractWorkflow(form, contractExtra = {}, socialSecurity = null) {
  const errors = [];
  const ss = socialSecurity || {};
  const contractCode = contractExtra.contract_code || form.contract_code || "";
  const workingDayType = contractExtra.working_day_type || form.working_day_type;
  const partialityCoefficient = toNumberOrNull(contractExtra.partiality_coefficient || form.partiality_coefficient);
  const weeklyHours = toNumberOrNull(contractExtra.weekly_hours || form.weekly_hours);
  const fullTimeWeeklyHours = toNumberOrNull(contractExtra.full_time_weekly_hours || form.full_time_weekly_hours || 40);
  const annualAgreementHours = toNumberOrNull(contractExtra.annual_agreement_hours || form.annual_agreement_hours);
  const monthlyHours = toNumberOrNull(contractExtra.monthly_hours || form.monthly_hours);
  const annualHours = toNumberOrNull(contractExtra.annual_hours || form.annual_hours);
  const workingTimeReduction = toNumberOrNull(ss.working_time_reduction);
  const initialCtp = toNumberOrNull(ss.initial_ctp);
  const registrationDate = ss.registration_date || form.start_date;
  const bonusStart = contractExtra.bonus_start_date;
  const bonusEnd = contractExtra.bonus_end_date;
  const reductionStart = contractExtra.legal_workday_reduction_start;
  const reductionEnd = contractExtra.legal_workday_reduction_end;

  if (form.end_date && form.start_date && form.end_date < form.start_date) {
    errors.push("La fecha fin del contrato no puede ser anterior a la fecha de inicio.");
  }

  if (bonusEnd && bonusStart && bonusEnd < bonusStart) {
    errors.push("La fecha fin de bonificación no puede ser anterior a la fecha de inicio.");
  }

  if (reductionEnd && reductionStart && reductionEnd < reductionStart) {
    errors.push("La fecha fin de reducción de jornada no puede ser anterior a la fecha de inicio.");
  }

  if (contractCode.startsWith("5") && workingDayType !== "part_time") {
    errors.push("Los contratos con código 5xx deben estar marcados como jornada parcial.");
  }

  if (contractCode.startsWith("4") && workingDayType !== "full_time") {
    errors.push("Los contratos con código 4xx deben estar marcados como jornada completa.");
  }

  if (contractCode === "300" && workingDayType !== "fixed_discontinuous") {
    errors.push("El contrato 300 debe estar marcado como fijo discontinuo.");
  }

  if (workingDayType === "part_time") {
    if (!hasValue(partialityCoefficient)) errors.push("La jornada parcial requiere coeficiente de parcialidad.");
    if (!hasValue(weeklyHours) || !hasValue(fullTimeWeeklyHours)) errors.push("La jornada parcial requiere horas semanales y jornada completa de referencia.");
    if (partialityCoefficient !== null && (partialityCoefficient <= 0 || partialityCoefficient >= 100)) errors.push("En jornada parcial el coeficiente de parcialidad debe ser mayor que 0 y menor que 100.");
  }

  if (workingDayType === "full_time" && partialityCoefficient !== null && partialityCoefficient !== 100) {
    errors.push("En jornada completa el coeficiente de parcialidad debe ser 100.");
  }

  [[weeklyHours, "Las horas semanales no pueden ser negativas."], [fullTimeWeeklyHours, "La jornada completa de referencia debe ser mayor que 0."], [annualAgreementHours, "La jornada anual de convenio no puede ser negativa."], [monthlyHours, "Las horas mensuales no pueden ser negativas."], [annualHours, "Las horas anuales no pueden ser negativas."]].forEach(([value, message]) => {
    if (value !== null && value < 0) errors.push(message);
  });

  if (fullTimeWeeklyHours !== null && fullTimeWeeklyHours === 0) errors.push("La jornada completa de referencia debe ser mayor que 0.");

  if (workingTimeReduction !== null) {
    if (initialCtp === null) errors.push("Si existe reducción de jornada, debe indicarse el C.T.P. inicial.");
    else if (initialCtp <= workingTimeReduction) errors.push("El C.T.P. inicial debe ser mayor que la reducción de jornada.");
  }

  if (ss.is_replacement) {
    if (!ss.replacement_cause_code) errors.push("Si se marca sustitución/relevo, debe indicarse la causa de sustitución.");
    if (!ss.replaced_worker_naf) errors.push("Si se marca sustitución/relevo, debe indicarse el NAF de la persona sustituida.");
  }

  if (ss.situation_code === "1" && !registrationDate) errors.push("La situación de alta requiere fecha de alta.");
  if (registrationDate && form.start_date && registrationDate !== form.start_date) errors.push("La fecha de alta debe coincidir con la fecha de inicio del contrato en esta simulación MVP.");

  return errors;
}

export function buildContractPayload(form, extra = {}) {
  return {
    employee_id: Number(form.employee_id),
    company_id: form.company_id ? Number(form.company_id) : null,
    center_id: form.center_id ? Number(form.center_id) : null,
    contract_type: form.contract_type,
    start_date: form.start_date,
    end_date: form.end_date || null,
    salary_base: form.salary_base ? Number(form.salary_base) : null,
    pay_schedule: form.pay_schedule || "not_prorated_14",
    status: form.status,
    ...normalizeContractExtras(extra),
  };
}
