export function overtimeValues(form, contract = {}) {
  const quantity = Number(form.overtime_quantity || 0);
  const dayHours = Number(form.overtime_day_hours || 8);
  const hours = form.overtime_unit === "days" ? quantity * dayHours : quantity;
  const referenceHours = Number(contract.monthly_hours || (Number(contract.weekly_hours || contract.full_time_weekly_hours || 40) * 52 / 12));
  const ratio = contract.partiality_coefficient != null ? Number(contract.partiality_coefficient) / 100 : Number(contract.weekly_hours || 40) / Number(contract.full_time_weekly_hours || 40);
  const automaticRate = referenceHours > 0 ? Number(contract.salary_base || 0) * ratio / referenceHours : 0;
  const rate = form.overtime_amount_mode === "manual" ? (hours > 0 ? Number(form.overtime_amount || 0) / hours : 0) : automaticRate;
  return { hours, rate, total: Math.round(hours * rate * 100) / 100 };
}
