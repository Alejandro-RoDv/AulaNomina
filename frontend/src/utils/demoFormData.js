// Fictional practice data. These helpers fill forms only; persistence is explicit.
const lastChoices = new Map();
let serial = Math.floor(Math.random() * 8000000) + 1000000;
const nextNumber = () => String((serial++ % 9000000) + 1000000);
export function pickDifferent(items, key) {
  const candidates = items.filter((item) => item !== lastChoices.get(key));
  const pool = candidates.length ? candidates : items;
  const item = pool[Math.floor(Math.random() * pool.length)];
  lastChoices.set(key, item);
  return item;
}
export const COMPANY_PRESETS = {
  services: { label: "Empresa de servicios", names: ["Servicios Azahara SL", "Gestión Mediterránea SL", "Consultoría Albor SL", "Soluciones Guadalquivir SL", "Oficinas del Sur SL"], cnae: "8211", activity: "Servicios administrativos combinados" },
  education: { label: "Centro educativo privado", names: ["Colegio San Rafael", "CEI La Milagrosa", "Colegio Los Olivos", "Centro Educativo Albor", "Academia Sierra Morena"], cnae: "8531", activity: "Educación secundaria general" },
  commerce: { label: "Comercio", names: ["Comercial Los Patios SL", "Suministros La Vega SL", "Mercado Sierra Sur SL", "Distribuciones Albor SL", "Comercial El Puente SL"], cnae: "4719", activity: "Otro comercio al por menor en establecimientos no especializados" },
  ett: { label: "ETT", names: ["Sur Empleo Temporal ETT", "Talento Mediterráneo ETT", "Empleo La Campiña ETT", "Personal Albor ETT", "Trabaja Córdoba ETT"], cnae: "7820", activity: "Actividades de las empresas de trabajo temporal" },
};
const surnames = ["García", "López", "Romero", "Moreno", "Serrano", "Ruiz", "Navarro", "Molina"];
const people = ["Ana", "Miguel", "Lucía", "Javier", "Elena", "Pablo", "Carmen", "Manuel"];
const streets = ["Calle del Olivo", "Avenida de la Sierra", "Calle del Laurel", "Plaza de la Encina", "Calle del Río"];
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function demoDni() {
  const digits = `3${nextNumber()}`;
  return digits + "TRWAGMYFPDXBNJZSQVHLCKE"[Number(digits) % 23];
}
export function demoCif() {
  const digits = nextNumber();
  const sum = [...digits].reduce((total, digit, index) => {
    const value = Number(digit) * (index % 2 === 0 ? 2 : 1);
    return total + Math.floor(value / 10) + value % 10;
  }, 0);
  return `B${digits}${(10 - sum % 10) % 10}`;
}
export function demoCcc() {
  const digits = `14${nextNumber()}`;
  return digits + String(Number(digits) % 97).padStart(2, "0");
}
const mutuals = ["ASEPEYO - (nº 151)", "FREMAP - (nº 061)", "IBERMUTUA - (nº 274)", "EGARSAT - (nº 276)", "MC MUTUAL - (nº 001)"];
export function demoIban() {
  const account = `21000418${nextNumber().padStart(12, "0")}`;
  const check = 98n - BigInt(account + "142800") % 97n;
  return `ES${String(check).padStart(2, "0")}${account}`;
}
function address() { return `${pickDifferent(streets, "street")}, ${Math.floor(Math.random() * 80) + 1}`; }
function unique(factory, used) {
  let result;
  do { result = factory(); } while (used.includes(result));
  return result;
}
export function createCompanyDemo(kind, existing = [], agreements = []) {
  const preset = COMPANY_PRESETS[kind] || COMPANY_PRESETS.services;
  const cif = unique(demoCif, existing.map((company) => company.cif));
  const name = pickDifferent(preset.names, kind);
  const agreement = agreements.find((item) => item.is_active !== false && (kind === "education" ? /enseñanza|educación/i : kind === "ett" ? /trabajo temporal/i : kind === "commerce" ? /comercio/i : /oficinas|despachos/i).test(item.name));
  const mutual = pickDifferent(mutuals, "company-mutual");
  return {
    name, cif, ccc_regime: "0111", ccc_code: demoCcc(), address: address(), city: "Córdoba", province: "Córdoba",
    company_phone: `957${nextNumber().slice(-6)}`, company_email: `empresa.${cif.toLowerCase()}@example.test`,
    company_contact_person: `${pickDifferent(people, "contact")} ${pickDifferent(surnames, "contact-surname")}`,
    registration_date: localDate(), company_type: kind === "ett" ? "ett" : "privada", main_collective_agreement: agreement?.name || "",
    cnae_2009_code: preset.cnae, cnae_2009_name: preset.activity,
    professional_contingencies_mutual: mutual, common_it_mutual: mutual, work_calendar_name: pickDifferent(["Calendario general", "Jornada intensiva de verano", "Calendario de turnos"], "calendar"),
    bank_iban: demoIban(), company_website: `https://empresa-${cif.toLowerCase()}.example.test`,
    legal_representative_name: `${pickDifferent(people, "representative")} ${pickDifferent(surnames, "representative-surname")}`,
    legal_representative_dni: demoDni(), legal_representative_position: pickDifferent(["Administrador", "Gerente", "Apoderado"], "representative-position"),
    professional_contingencies_policy: `POL-${nextNumber()}`, common_it_policy: `IT-${nextNumber()}`,
    professional_contingencies_effective_date: localDate(), common_it_effective_date: localDate(),
  };
}
export function createCenterDemo(company) {
  if (!company) return null;
  return {
    name: `${pickDifferent(["Sede Centro", "Centro Norte", "Centro Sur", "Delegación La Sierra", "Oficina El Parque"], "center")} · ${nextNumber().slice(-4)}`,
    general_ccc: company.ccc || "", main_ccc: demoCcc(), address: address(), city: company.city || "Córdoba", province: company.province || "Córdoba",
    collective_agreement: company.main_collective_agreement || "", mobile: `6${nextNumber().padStart(8, "0")}`, fax: `957${nextNumber().slice(-6)}`, website: `https://centro-${nextNumber()}.example.test`, phone: `957${nextNumber().slice(-6)}`, email: `centro.${nextNumber()}@example.test`,
  };
}
export function createEmployeeDemo(companyId, centers, existing = []) {
  const available = centers.filter((center) => center.is_active !== false && String(center.company_id) === String(companyId));
  if (!companyId || !available.length) return null;
  const nafBase = `14${nextNumber().padStart(8, "0")}`;
  const dni = unique(demoDni, existing.map((employee) => employee.dni));
  return {
    company_id: String(companyId), center_id: String(pickDifferent(available, "employee-center").id), document_type: "DNI", dni,
    naf: nafBase + String(Number(nafBase) % 97).padStart(2, "0"), first_name: pickDifferent(people, "first-name"), last_name: pickDifferent(surnames, "last-name"), second_last_name: pickDifferent(surnames, "second-name"),
    birth_date: `${1980 + Math.floor(Math.random() * 20)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`, nationality: "Española", domicile: address(), city: "Córdoba", province: "Córdoba", postal_code: "14001",
    mobile_phone: `6${nextNumber().padStart(8, "0")}`, email: `persona.${dni.toLowerCase()}@example.test`, education_level: pickDifferent(["Formación Profesional Grado Superior", "Bachiller, BUP y equivalente", "Estudios univ. oficiales de grado y de máster"], "education-level"),
    birth_place: pickDifferent(["Córdoba", "Montilla", "Sevilla", "Málaga"], "birth-place"),
    academic_title: pickDifferent(["Administración y Finanzas", "Gestión Administrativa", "Administración de Empresas"], "title"),
    main_profession: pickDifferent(["Administrativo", "Técnico de gestión", "Atención al cliente"], "profession"),
    languages: pickDifferent(["Español; inglés B1", "Español; inglés B2", "Español; francés B1"], "languages"),
    observations: "Datos ficticios generados para una práctica formativa.",
  };
}
export function eligibleDemoEmployees(employees, contracts, companyId, centers) {
  return employees.filter((employee) => employee.is_active !== false && (!companyId || String(employee.company_id) === String(companyId))
    && centers.some((center) => center.is_active !== false && String(center.id) === String(employee.center_id) && String(center.company_id) === String(employee.company_id))
    && !contracts.some((contract) => String(contract.employee_id) === String(employee.id) && ["active", "draft"].includes(contract.status)));
}
export function createContractDemo(employee, company, catalog = []) {
  if (!employee || !company) return null;
  const code = pickDifferent(["100", "200"], "contract-code");
  const definition = catalog.find((item) => item.contract_code === code);
  const partTime = code === "200";
  const start = localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  return {
    form: { company_id: String(company.id), employee_id: String(employee.id), center_id: String(employee.center_id), contract_type: "indefinido", start_date: start, end_date: "", salary_base: String(1800 + Math.floor(Math.random() * 500)), pay_schedule: "not_prorated_14", status: "active" },
    extra: { contract_code: code, contract_code_description: definition?.contract_code_description || (partTime ? "Indefinido tiempo parcial" : "Indefinido tiempo completo"), contract_family: "indefinite", seniority_date: start, contribution_group: "7", working_day_type: partTime ? "part_time" : "full_time", weekly_hours: partTime ? "20" : "40", full_time_weekly_hours: "40", monthly_hours: partTime ? "86.67" : "173.33", annual_hours: partTime ? "1040" : "2080", partiality_coefficient: partTime ? "50" : "100", work_distribution: partTime ? "Lunes a viernes, de 09:00 a 13:00" : "Lunes a viernes, de 08:00 a 16:00", job_position: pickDifferent(["Auxiliar administrativo", "Oficial administrativo", "Técnico de gestión"], "job"), cno_code: "4309", cno_description: "Empleados administrativos", company_cnae: company.cnae_2025_code || company.cnae_2009_code || "", bonus_observations: "Contrato ficticio para práctica formativa" },
    ss: { situation_code: "1", situation_description: "Alta", registration_date: start, contribution_group: "7", red_contribution_group: "7", red_contract_key: code, monthly_or_daily_contribution: "monthly" },
  };
}
