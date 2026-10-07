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
  services: { label: "Empresa de servicios", names: ["Servicios Horizonte SL", "Gestión Integral Atlas SL", "Consultoría Nexo SL", "Soluciones Prisma SL", "Oficinas Nova SL"], cnae: "8211", activity: "Servicios administrativos combinados" },
  education: { label: "Centro educativo privado", names: ["Colegio Horizonte", "Escuela Infantil Arcoíris", "Colegio Alameda", "Centro Educativo Nova", "Academia Ágora"], cnae: "8531", activity: "Educación secundaria general" },
  commerce: { label: "Comercio", names: ["Comercial Prisma SL", "Suministros Atlas SL", "Mercado Central SL", "Distribuciones Nexo SL", "Comercial Horizonte SL"], cnae: "4719", activity: "Otro comercio al por menor en establecimientos no especializados" },
  ett: { label: "ETT", names: ["Empleo Integral ETT", "Talento Global ETT", "Selección Horizonte ETT", "Personal Nova ETT", "Conecta Empleo ETT"], cnae: "7820", activity: "Actividades de las empresas de trabajo temporal" },
};
const surnames = ["García", "López", "Martín", "Fernández", "Serrano", "Ruiz", "Navarro", "Molina", "Ortega", "Vidal", "Alonso", "Iglesias", "Sánchez", "Castro", "Domínguez", "Herrera", "Rubio", "Torres", "Medina", "Gil"];
const people = ["Ana", "Miguel", "Lucía", "Javier", "Elena", "Pablo", "Carmen", "Daniel", "Marta", "Adrián", "Natalia", "Sergio", "Beatriz", "Álvaro", "Irene", "Marcos", "Claudia", "Hugo", "Nuria", "Raquel"];
const streets = ["Calle Mayor", "Avenida de Europa", "Calle de la Estación", "Plaza del Mercado", "Calle del Parque", "Avenida de la Constitución", "Calle de la Biblioteca", "Paseo de los Jardines"];
export const DEMO_LOCATIONS = [
  { city: "Madrid", province: "Madrid", postal_code: "28013", phone: "915" },
  { city: "Barcelona", province: "Barcelona", postal_code: "08002", phone: "933" },
  { city: "Valencia", province: "Valencia", postal_code: "46002", phone: "963" },
  { city: "Zaragoza", province: "Zaragoza", postal_code: "50001", phone: "976" },
  { city: "Bilbao", province: "Bizkaia", postal_code: "48001", phone: "944" },
  { city: "Vigo", province: "Pontevedra", postal_code: "36201", phone: "986" },
  { city: "Valladolid", province: "Valladolid", postal_code: "47001", phone: "983" },
  { city: "Oviedo", province: "Asturias", postal_code: "33001", phone: "985" },
  { city: "Santander", province: "Cantabria", postal_code: "39001", phone: "942" },
  { city: "Pamplona", province: "Navarra", postal_code: "31001", phone: "948" },
  { city: "Salamanca", province: "Salamanca", postal_code: "37001", phone: "923" },
  { city: "Alicante", province: "Alicante", postal_code: "03001", phone: "965" },
  { city: "Logroño", province: "La Rioja", postal_code: "26001", phone: "941" },
  { city: "Toledo", province: "Toledo", postal_code: "45001", phone: "925" },
  { city: "Cáceres", province: "Cáceres", postal_code: "10001", phone: "927" },
  { city: "Palma", province: "Illes Balears", postal_code: "07001", phone: "971" },
  { city: "Las Palmas de Gran Canaria", province: "Las Palmas", postal_code: "35001", phone: "928" },
  { city: "Málaga", province: "Málaga", postal_code: "29001", phone: "952" },
];
function person(key) {
  const first_name = pickDifferent(people, `${key}-first`);
  const last_name = pickDifferent(surnames, `${key}-last`);
  const second_last_name = pickDifferent(surnames.filter((name) => name !== last_name), `${key}-second`);
  return { first_name, last_name, second_last_name };
}
function fullName(key) { return Object.values(person(key)).join(" "); }
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function demoDni() {
  const digits = `${pickDifferent(["1", "2", "3", "4", "5", "6", "7", "8"], "dni-prefix")}${nextNumber()}`;
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
export function demoCcc(provinceCode = pickDifferent(DEMO_LOCATIONS, "ccc-province").postal_code.slice(0, 2)) {
  const digits = `${provinceCode}${nextNumber()}`;
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
  const location = pickDifferent(DEMO_LOCATIONS, "company-location");
  return {
    name, cif, ccc_regime: "0111", ccc_code: demoCcc(location.postal_code.slice(0, 2)), address: address(), city: location.city, province: location.province,
    company_phone: `${location.phone}${nextNumber().slice(-6)}`, company_email: `empresa.${cif.toLowerCase()}@example.test`,
    company_contact_person: fullName("contact"),
    registration_date: localDate(), company_type: kind === "ett" ? "ett" : "privada", main_collective_agreement: agreement?.name || "",
    cnae_2009_code: preset.cnae, cnae_2009_name: preset.activity,
    professional_contingencies_mutual: mutual, common_it_mutual: mutual, work_calendar_name: pickDifferent(["Calendario general", "Jornada intensiva de verano", "Calendario de turnos"], "calendar"),
    bank_iban: demoIban(), company_website: `https://empresa-${cif.toLowerCase()}.example.test`,
    legal_representative_name: fullName("representative"),
    legal_representative_dni: demoDni(), legal_representative_position: pickDifferent(["Administrador", "Gerente", "Apoderado"], "representative-position"),
    professional_contingencies_policy: `POL-${nextNumber()}`, common_it_policy: `IT-${nextNumber()}`,
    professional_contingencies_effective_date: localDate(), common_it_effective_date: localDate(),
  };
}
export function createCenterDemo(company) {
  if (!company) return null;
  const location = pickDifferent(DEMO_LOCATIONS, "center-location");
  return {
    name: `${pickDifferent(["Sede Principal", "Centro Empresarial", "Delegación Comercial", "Oficina de Gestión", "Centro de Servicios"], "center")} · ${nextNumber().slice(-4)}`,
    general_ccc: company.ccc || "", main_ccc: demoCcc(location.postal_code.slice(0, 2)), address: address(), city: location.city, province: location.province,
    collective_agreement: company.main_collective_agreement || "", mobile: `6${nextNumber().padStart(8, "0")}`, fax: `${location.phone}${nextNumber().slice(-6)}`, website: `https://centro-${nextNumber()}.example.test`, phone: `${location.phone}${nextNumber().slice(-6)}`, email: `centro.${nextNumber()}@example.test`,
  };
}
export function createEmployeeDemo(companyId, centers, existing = []) {
  const available = centers.filter((center) => center.is_active !== false && String(center.company_id) === String(companyId));
  if (!companyId || !available.length) return null;
  const location = pickDifferent(DEMO_LOCATIONS, "employee-location");
  const profile = person("employee");
  const nafBase = `${location.postal_code.slice(0, 2)}${String(10000000 + Number(nextNumber()))}`;
  const dni = unique(demoDni, existing.map((employee) => employee.dni));
  return {
    company_id: String(companyId), center_id: String(pickDifferent(available, "employee-center").id), document_type: "DNI", dni,
    naf: nafBase + String(Number(nafBase) % 97).padStart(2, "0"), ...profile,
    birth_date: `${1980 + Math.floor(Math.random() * 20)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`, nationality: "Española", domicile: address(), city: location.city, province: location.province, postal_code: location.postal_code,
    mobile_phone: `6${nextNumber().padStart(8, "0")}`, email: `persona.${dni.toLowerCase()}@example.test`, education_level: pickDifferent(["Formación Profesional Grado Superior", "Bachiller, BUP y equivalente", "Estudios univ. oficiales de grado y de máster"], "education-level"),
    birth_place: pickDifferent(DEMO_LOCATIONS, "birth-place").city,
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
