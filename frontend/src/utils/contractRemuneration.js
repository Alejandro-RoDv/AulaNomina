const numeric = value => Number(value) || 0;
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
export function isRecurringContractConcept(concept) {
  const name = String(concept.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return !/salario base|paga|prorrata|atraso|regularizacion|ajuste manual|indemnizacion|vacacion|prestacion|incapacidad|\bit\b|horas? (extra|complementaria)|dieta|kilometraje|gastos|suplido|permiso|comision|incentivo|bonus/.test(name);
}
export function calculateContractRemuneration(base, lines, partiality, paySchedule) {
  const ratio = Math.min(100, Math.max(0, partiality === '' || partiality == null ? 100 : numeric(partiality))) / 100;
  const baseApplied = round(numeric(base) * ratio);
  const supplements = round(lines.reduce((sum, line) => sum + numeric(line.amount) * (line.applies_workday_percentage === false ? 1 : ratio), 0));
  const ordinary = round(baseApplied + supplements);
  const annual = round(ordinary * 14);
  const proration = paySchedule === 'prorated_12' ? round(ordinary * 2 / 12) : 0;
  return { baseApplied, supplements, ordinary, proration, monthly: round(ordinary + proration), annual };
}
