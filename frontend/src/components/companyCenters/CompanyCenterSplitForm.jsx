import { useEffect, useMemo, useState } from "react";

import { createCompany } from "../../services/companyApi";
import { createWorkCalendar, fetchWorkCalendars, updateWorkCalendar } from "../../services/workCalendarApi";
import { createWorkCenter } from "../../services/workCenterApi";

const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const SILTRA_FLAGS = [
  ["exclusion_irpf", "Exclusión IRPF"],
  ["exclusion_fogasa", "Exclusión FOGASA"],
  ["exclusion_integrated_officials", "Exclusión funcionarios integrados"],
  ["resolution_2010_05_25", "Resolución 25/05/2010"],
  ["ceuta_melilla_bonus", "Bonificación Ceuta/Melilla"],
  ["local_police_extra_suspension", "Suspensión extra Navidad Policías Locales"],
];

const SECTOR_FLAGS = [
  ["textile", "Industrial textil"],
  ["leather_goods", "Marroquinería"],
  ["furniture", "Mueble"],
  ["toy", "Juguetería"],
  ["tourism", "Turismo"],
  ["research", "Investigación"],
  ["sports_club", "Club deportivo"],
];

function createEmptySchedule() {
  return WEEK_DAYS.reduce((acc, day) => {
    acc[day] = { morning: "", afternoon: "", total: "" };
    return acc;
  }, {});
}

function createStandardSchedule() {
  const schedule = createEmptySchedule();
  ["Lunes", "Martes", "Miércoles", "Jueves"].forEach((day) => {
    schedule[day] = { morning: "09:00-14:00", afternoon: "15:00-18:00", total: "8" };
  });
  schedule.Viernes = { morning: "09:00-14:00", afternoon: "", total: "5" };
  return schedule;
}

const initialCompany = {
  name: "",
  cif: "",
  ccc_regime: "0111",
  ccc_code: "",
  address: "",
  city: "",
  province: "",
  status: "alta",
  registration_date: "",
  deregistration_date: "",
  main_collective_agreement: "",
  is_cooperative: false,
  special_work_income_withholding: false,
  company_type: "privada",
  legal_representative_name: "",
  legal_representative_dni: "",
  legal_representative_position: "",
  cnae_2009_code: "",
  cnae_2009_name: "",
  cnae_2025_code: "",
  cnae_2025_name: "",
  pension_plan_enabled: false,
  pension_manager_key: "",
  pension_manager_entity_number: "",
  pension_plan_name: "",
  work_calendar_mode: "",
  selected_work_calendar_id: "",
  work_calendar_name: "",
  calendar_period_type: "todo_el_ano",
  winter_period: "",
  summer_period: "",
  rest_type: "semanal",
  rest_days: "Sábado y domingo",
  schedule: createEmptySchedule(),
  shifts_enabled: false,
  shift_1: "",
  shift_2: "",
  shift_3: "",
  shift_4: "",
  bank_iban: "ES7620770024003102575766",
  model_111: "trimestral",
  fiscal_regime: "plan_general_contable",
  complement_computation: "segun_convenio",
  siltra_enabled: false,
  siltra_payment_mode: "cargo_cuenta",
  siltra_flags: {},
  sector_flags: {},
  grouped_withholding_company: "",
};

const DEMO_COMPANIES = {
  education: {
    label: "Centro educativo privado",
    data: {
      name: "Colegio San Rafael Demo",
      cif: "B14999001",
      ccc_regime: "0111",
      ccc_code: "14123456789",
      address: "Avda. de la Enseñanza, 12",
      city: "Córdoba",
      province: "Córdoba",
      registration_date: "2025-01-01",
      main_collective_agreement: "Convenio de enseñanza privada sostenida total o parcialmente con fondos públicos",
      company_type: "privada",
      legal_representative_name: "María Gómez Ruiz",
      legal_representative_dni: "30500123A",
      legal_representative_position: "Directora gerente",
      cnae_2009_code: "8531",
      cnae_2009_name: "Educación secundaria general",
      cnae_2025_code: "8531",
      cnae_2025_name: "Educación secundaria general",
      work_calendar_mode: "new",
      work_calendar_name: "Calendario docente estándar",
      schedule: createStandardSchedule(),
      siltra_enabled: true,
      model_111: "trimestral",
      fiscal_regime: "plan_general_contable",
    },
  },
  academy: {
    label: "Academia de formación",
    data: {
      name: "Academia Aula Sur Demo",
      cif: "B14999002",
      ccc_regime: "0111",
      ccc_code: "14123456790",
      address: "Calle Formación, 8",
      city: "Córdoba",
      province: "Córdoba",
      registration_date: "2025-01-01",
      main_collective_agreement: "Convenio de enseñanza no reglada",
      company_type: "privada",
      cnae_2009_code: "8559",
      cnae_2009_name: "Otra educación n.c.o.p.",
      cnae_2025_code: "8559",
      cnae_2025_name: "Otra educación n.c.o.p.",
      work_calendar_mode: "new",
      work_calendar_name: "Calendario academia tardes",
      schedule: createStandardSchedule(),
      shifts_enabled: true,
      shift_1: "Mañana 09:00-14:00",
      shift_2: "Tarde 16:00-21:00",
      siltra_enabled: true,
    },
  },
  nonprofit: {
    label: "Fundación sin ánimo de lucro",
    data: {
      name: "Fundación Laboral Demo",
      cif: "G14999003",
      ccc_regime: "0111",
      ccc_code: "14123456791",
      address: "Plaza Social, 4",
      city: "Córdoba",
      province: "Córdoba",
      registration_date: "2025-01-01",
      main_collective_agreement: "Convenio de acción e intervención social",
      company_type: "privada_sin_lucro",
      cnae_2009_code: "8899",
      cnae_2009_name: "Otros servicios sociales sin alojamiento n.c.o.p.",
      cnae_2025_code: "8899",
      cnae_2025_name: "Otros servicios sociales sin alojamiento n.c.o.p.",
      work_calendar_mode: "new",
      work_calendar_name: "Calendario entidad social",
      schedule: createStandardSchedule(),
      siltra_enabled: true,
      model_111: "trimestral",
    },
  },
  ett: {
    label: "ETT",
    data: {
      name: "Sur Empleo Temporal Demo",
      cif: "B14999004",
      ccc_regime: "0111",
      ccc_code: "14123456792",
      address: "Polígono Industrial, nave 15",
      city: "Córdoba",
      province: "Córdoba",
      registration_date: "2025-01-01",
      main_collective_agreement: "Convenio estatal de empresas de trabajo temporal",
      company_type: "ett",
      cnae_2009_code: "7820",
      cnae_2009_name: "Actividades de las empresas de trabajo temporal",
      cnae_2025_code: "7820",
      cnae_2025_name: "Actividades de las empresas de trabajo temporal",
      work_calendar_mode: "new",
      work_calendar_name: "Calendario ETT administración",
      schedule: createStandardSchedule(),
      siltra_enabled: true,
    },
  },
  cooperative: {
    label: "Sociedad cooperativa",
    data: {
      name: "Cooperativa Educativa Demo",
      cif: "F14999005",
      ccc_regime: "0111",
      ccc_code: "14123456793",
      address: "Camino Cooperativo, 3",
      city: "Montilla",
      province: "Córdoba",
      registration_date: "2025-01-01",
      main_collective_agreement: "Convenio de enseñanza privada",
      company_type: "privada",
      is_cooperative: true,
      cnae_2009_code: "8531",
      cnae_2009_name: "Educación secundaria general",
      cnae_2025_code: "8531",
      cnae_2025_name: "Educación secundaria general",
      work_calendar_mode: "new",
      work_calendar_name: "Calendario cooperativa educativa",
      schedule: createStandardSchedule(),
      siltra_enabled: true,
    },
  },
  public: {
    label: "Empresa pública",
    data: {
      name: "Agencia Pública Demo",
      cif: "Q14999006",
      ccc_regime: "0111",
      ccc_code: "14123456794",
      address: "Avda. Institucional, 1",
      city: "Córdoba",
      province: "Córdoba",
      registration_date: "2025-01-01",
      main_collective_agreement: "Convenio personal laboral sector público",
      company_type: "publica",
      cnae_2009_code: "8411",
      cnae_2009_name: "Actividades generales de la Administración Pública",
      cnae_2025_code: "8411",
      cnae_2025_name: "Actividades generales de la Administración Pública",
      work_calendar_mode: "new",
      work_calendar_name: "Calendario administración pública",
      schedule: createStandardSchedule(),
      siltra_enabled: true,
      model_111: "mensual",
    },
  },
};

const initialCenter = { company_id: "", name: "", general_ccc: "", main_ccc: "", address: "", city: "", province: "", collective_agreement: "", phone: "", fax: "", mobile: "", email: "", website: "" };

function emptyToNull(value) { return value === "" ? null : value; }
function buildCalendarObject(form) { return { period_type: form.calendar_period_type, winter_period: form.winter_period, summer_period: form.summer_period, rest_type: form.rest_type, rest_days: form.rest_days, schedule: form.schedule, shifts_enabled: form.shifts_enabled, shifts: [form.shift_1, form.shift_2, form.shift_3, form.shift_4].filter(Boolean) }; }
function buildCalendarPayload(form) { return { name: form.work_calendar_name || "Calendario sin nombre", period_type: form.calendar_period_type, winter_period: emptyToNull(form.winter_period), summer_period: emptyToNull(form.summer_period), rest_type: form.rest_type, rest_days: emptyToNull(form.rest_days), schedule_data: JSON.stringify(form.schedule), shifts_enabled: form.shifts_enabled, shift_1: emptyToNull(form.shift_1), shift_2: emptyToNull(form.shift_2), shift_3: emptyToNull(form.shift_3), shift_4: emptyToNull(form.shift_4), is_active: true }; }
function buildCompanyPayload(form) { const ccc = [form.ccc_regime, form.ccc_code].filter(Boolean).join("/") || null; return { name: form.name, cif: form.cif, ccc, ccc_regime: emptyToNull(form.ccc_regime), ccc_code: emptyToNull(form.ccc_code), address: emptyToNull(form.address), city: emptyToNull(form.city), province: emptyToNull(form.province), status: form.status, registration_date: emptyToNull(form.registration_date), deregistration_date: emptyToNull(form.deregistration_date), main_collective_agreement: emptyToNull(form.main_collective_agreement), is_cooperative: form.is_cooperative, special_work_income_withholding: form.special_work_income_withholding, company_type: emptyToNull(form.company_type), legal_representative_name: emptyToNull(form.legal_representative_name), legal_representative_dni: emptyToNull(form.legal_representative_dni), legal_representative_position: emptyToNull(form.legal_representative_position), cnae_2009_code: emptyToNull(form.cnae_2009_code), cnae_2009_name: emptyToNull(form.cnae_2009_name), cnae_2025_code: emptyToNull(form.cnae_2025_code), cnae_2025_name: emptyToNull(form.cnae_2025_name), pension_plan_enabled: form.pension_plan_enabled, pension_manager_key: emptyToNull(form.pension_manager_key), pension_manager_entity_number: emptyToNull(form.pension_manager_entity_number), pension_plan_name: emptyToNull(form.pension_plan_name), work_calendar_mode: form.work_calendar_mode, work_calendar_name: emptyToNull(form.work_calendar_name), work_calendar_data: form.work_calendar_mode ? JSON.stringify(buildCalendarObject(form)) : null, bank_iban: emptyToNull(form.bank_iban), model_111: emptyToNull(form.model_111), fiscal_regime: emptyToNull(form.fiscal_regime), complement_computation: emptyToNull(form.complement_computation), siltra_enabled: form.siltra_enabled, siltra_payment_mode: emptyToNull(form.siltra_payment_mode), siltra_options: JSON.stringify(form.siltra_flags), sector_bonuses: JSON.stringify(form.sector_flags), grouped_withholding_company: emptyToNull(form.grouped_withholding_company) }; }
function parseScheduleData(scheduleData) { if (!scheduleData) return createEmptySchedule(); try { return { ...createEmptySchedule(), ...JSON.parse(scheduleData) }; } catch { return createEmptySchedule(); } }
function getNextCenterCode(companyId, workCenters) { if (!companyId) return ""; return `${companyId}.${workCenters.filter((center) => String(center.company_id) === String(companyId)).length + 1}`; }
function buildCenterPayload(form, company, workCenters) { return { company_id: Number(form.company_id), center_code: getNextCenterCode(form.company_id, workCenters), name: form.name, general_ccc: form.general_ccc || company?.ccc || null, main_ccc: form.main_ccc || null, address: form.address || company?.address || null, city: form.city || company?.city || null, province: form.province || company?.province || null, collective_agreement: form.collective_agreement || company?.main_collective_agreement || null, phone: form.phone || null, fax: form.fax || null, mobile: form.mobile || null, email: form.email || null, website: form.website || null }; }

export default function CompanyCenterSplitForm({ companies, workCenters = [], initialSection = "companies", onReloadData, onSelectedCompanyChange }) {
  const [section, setSection] = useState(initialSection);
  const [companyForm, setCompanyForm] = useState(initialCompany);
  const [centerForm, setCenterForm] = useState(initialCenter);
  const [workCalendars, setWorkCalendars] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeCompanies = companies.filter((company) => company.is_active);
  const selectedCompany = useMemo(() => activeCompanies.find((company) => String(company.id) === String(centerForm.company_id)), [activeCompanies, centerForm.company_id]);
  const showCalendarDetails = companyForm.work_calendar_mode === "new" || Boolean(companyForm.selected_work_calendar_id);

  useEffect(() => { setSection(initialSection); }, [initialSection]);
  useEffect(() => { loadCalendars(); }, []);

  async function loadCalendars() { try { setCalendarLoading(true); setWorkCalendars((await fetchWorkCalendars()) || []); } catch { setWorkCalendars([]); } finally { setCalendarLoading(false); } }
  const resetMessages = () => { setError(""); setSuccess(""); };
  const reloadData = async () => { if (onReloadData) await onReloadData(); };
  const resetCalendarFields = () => ({ selected_work_calendar_id: "", work_calendar_name: "", calendar_period_type: "todo_el_ano", winter_period: "", summer_period: "", rest_type: "semanal", rest_days: "Sábado y domingo", schedule: createEmptySchedule(), shifts_enabled: false, shift_1: "", shift_2: "", shift_3: "", shift_4: "" });

  const loadDemoCompany = (demoKey) => {
    const demo = DEMO_COMPANIES[demoKey];
    if (!demo) return;
    resetMessages();
    setCompanyForm({ ...initialCompany, ...demo.data, siltra_payment_mode: demo.data.siltra_payment_mode || "cargo_cuenta", siltra_flags: demo.data.siltra_flags || {}, sector_flags: demo.data.sector_flags || {} });
    setSuccess(`Demo cargada: ${demo.label}. Puedes ajustar los datos antes de crearla.`);
  };

  const applyCalendarToCompanyForm = (calendarId) => { const calendar = workCalendars.find((item) => String(item.id) === String(calendarId)); if (!calendar) return; setCompanyForm((prev) => ({ ...prev, selected_work_calendar_id: calendarId, work_calendar_name: calendar.name || "", calendar_period_type: calendar.period_type || "todo_el_ano", winter_period: calendar.winter_period || "", summer_period: calendar.summer_period || "", rest_type: calendar.rest_type || "semanal", rest_days: calendar.rest_days || "", schedule: parseScheduleData(calendar.schedule_data), shifts_enabled: !!calendar.shifts_enabled, shift_1: calendar.shift_1 || "", shift_2: calendar.shift_2 || "", shift_3: calendar.shift_3 || "", shift_4: calendar.shift_4 || "" })); };
  const handleCompanyChange = (event) => { const { name, value, checked, type } = event.target; if (name === "work_calendar_mode") { setCompanyForm((prev) => ({ ...prev, work_calendar_mode: value, ...resetCalendarFields() })); return; } if (name === "selected_work_calendar_id") { if (!value) { setCompanyForm((prev) => ({ ...prev, selected_work_calendar_id: "" })); return; } applyCalendarToCompanyForm(value); return; } setCompanyForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value })); };
  const handleScheduleChange = (day, field, value) => setCompanyForm((prev) => ({ ...prev, schedule: { ...prev.schedule, [day]: { ...prev.schedule[day], [field]: value } } }));
  const handleFlagChange = (group, key, checked) => setCompanyForm((prev) => ({ ...prev, [group]: { ...prev[group], [key]: checked } }));
  const handleCenterChange = (event) => { const { name, value } = event.target; if (name === "company_id") { const company = activeCompanies.find((item) => String(item.id) === String(value)); setCenterForm((prev) => ({ ...prev, company_id: value, general_ccc: company?.ccc || "", address: company?.address || "", city: company?.city || "", province: company?.province || "", collective_agreement: company?.main_collective_agreement || "" })); if (onSelectedCompanyChange) onSelectedCompanyChange(value); return; } setCenterForm((prev) => ({ ...prev, [name]: value })); };

  const handleCreateCompany = async (event) => { event.preventDefault(); resetMessages(); if (!companyForm.work_calendar_mode) { setError("Selecciona un calendario de trabajo o crea uno nuevo."); return; } if (companyForm.work_calendar_mode === "existing" && !companyForm.selected_work_calendar_id) { setError("Selecciona un calendario ya creado."); return; } if (companyForm.work_calendar_mode === "new" && !companyForm.work_calendar_name) { setError("Indica un nombre para el nuevo calendario."); return; } try { setSubmitting(true); if (companyForm.work_calendar_mode === "new") { try { await createWorkCalendar(buildCalendarPayload(companyForm)); } catch (calendarError) { if (!String(calendarError.message || "").includes("existe")) throw calendarError; } } if (companyForm.work_calendar_mode === "existing" && companyForm.selected_work_calendar_id) await updateWorkCalendar(companyForm.selected_work_calendar_id, buildCalendarPayload(companyForm)); await createCompany(buildCompanyPayload(companyForm)); setCompanyForm(initialCompany); setSuccess("Empresa creada correctamente"); await reloadData(); } catch (err) { setError(err.message || "Error al crear empresa"); } finally { setSubmitting(false); } };
  const handleCreateCenter = async (event) => { event.preventDefault(); resetMessages(); if (!selectedCompany) { setError("Selecciona una empresa ya creada antes de crear el centro."); return; } try { setSubmitting(true); await createWorkCenter(buildCenterPayload(centerForm, selectedCompany, workCenters)); setCenterForm(initialCenter); setSuccess("Centro creado correctamente"); if (onSelectedCompanyChange) onSelectedCompanyChange(""); await reloadData(); } catch (err) { setError(err.message || "Error al crear centro"); } finally { setSubmitting(false); } };
  const renderInput = (name, label, props = {}) => <label style={props.wide ? styles.formGroupWide : styles.formGroup}>{label}<input name={name} value={companyForm[name]} onChange={handleCompanyChange} style={styles.input} {...props} /></label>;

  const calendarDetails = showCalendarDetails ? <div style={styles.subCard}>{companyForm.work_calendar_mode === "new" && renderInput("work_calendar_name", "Nombre calendario")}{companyForm.work_calendar_mode === "existing" && <div style={styles.readOnlyTitle}>Editando calendario: {companyForm.work_calendar_name}</div>}<div style={styles.formRow}><label style={styles.formGroup}>Periodo<select name="calendar_period_type" value={companyForm.calendar_period_type} onChange={handleCompanyChange} style={styles.input}><option value="todo_el_ano">Todo el año</option><option value="verano_invierno">Verano e invierno</option></select></label><label style={styles.formGroup}>Descanso y vacaciones<select name="rest_type" value={companyForm.rest_type} onChange={handleCompanyChange} style={styles.input}><option value="semanal">Semanal</option><option value="intermedio">Intermedio</option></select></label>{renderInput("rest_days", "Días de descanso")}</div>{companyForm.calendar_period_type === "verano_invierno" && <div style={styles.formRow}>{renderInput("winter_period", "Periodo invierno")}{renderInput("summer_period", "Periodo verano")}</div>}<div style={styles.scheduleWrapper}><table style={styles.scheduleTable}><thead><tr><th>Día</th><th>Horario mañana</th><th>Horario tarde</th><th>Total horas</th></tr></thead><tbody>{WEEK_DAYS.map((day) => <tr key={day}><td>{day}</td><td><input value={companyForm.schedule[day].morning} onChange={(e) => handleScheduleChange(day, "morning", e.target.value)} style={styles.input} /></td><td><input value={companyForm.schedule[day].afternoon} onChange={(e) => handleScheduleChange(day, "afternoon", e.target.value)} style={styles.input} /></td><td><input value={companyForm.schedule[day].total} onChange={(e) => handleScheduleChange(day, "total", e.target.value)} style={styles.input} /></td></tr>)}</tbody></table></div><label style={styles.inlineCheck}><input type="checkbox" name="shifts_enabled" checked={companyForm.shifts_enabled} onChange={handleCompanyChange} /> Activar turnos</label>{companyForm.shifts_enabled && <div style={styles.formRow}>{renderInput("shift_1", "Turno 1")}{renderInput("shift_2", "Turno 2")}{renderInput("shift_3", "Turno 3")}{renderInput("shift_4", "Turno 4")}</div>}</div> : null;

  return <div style={styles.wrapper}>{section === "companies" ? <form onSubmit={handleCreateCompany} style={styles.form}><div style={styles.headerRow}><h3 style={styles.sectionTitle}>Crear nueva empresa</h3><span style={styles.badge}>Ficha ampliada Split 24</span></div><section style={styles.block}><div style={styles.headerRow}><h4 style={styles.blockTitle}>Empresa demo</h4><span style={styles.badge}>Carga rápida para demo comercial</span></div><div style={styles.demoGrid}>{Object.entries(DEMO_COMPANIES).map(([key, demo]) => <button key={key} type="button" onClick={() => loadDemoCompany(key)} style={styles.secondaryButton}>{demo.label}</button>)}</div></section><section style={styles.block}><h4 style={styles.blockTitle}>Identificación</h4><div style={styles.formRow}>{renderInput("name", "Nombre empresa", { required: true })}{renderInput("cif", "CIF", { required: true })}<label style={styles.formGroupSmall}>Estado actual<select name="status" value={companyForm.status} onChange={handleCompanyChange} style={styles.input}><option value="alta">Alta</option><option value="baja_temporal">Baja temporal</option><option value="baja_definitiva">Baja definitiva</option></select></label></div><div style={styles.formRow}>{renderInput("registration_date", "Fecha de alta", { type: "date" })}{renderInput("deregistration_date", "Fecha de baja", { type: "date" })}{renderInput("main_collective_agreement", "Convenio principal aplicable")}</div><div style={styles.formRow}>{renderInput("ccc_regime", "CCC régimen")}{renderInput("ccc_code", "CCC código")}<label style={styles.formGroup}>Tipo de empresa<select name="company_type" value={companyForm.company_type} onChange={handleCompanyChange} style={styles.input}><option value="privada">Privada</option><option value="publica">Pública</option><option value="privada_sin_lucro">Privada sin lucro</option><option value="corporaciones">Corporaciones</option><option value="ett">ETT</option><option value="sociedad_laboral_privada">Sociedad laboral privada</option></select></label></div><label style={styles.formGroupWide}>Domicilio social<input name="address" value={companyForm.address} onChange={handleCompanyChange} style={styles.input} /></label><div style={styles.formRow}>{renderInput("city", "Ciudad")}{renderInput("province", "Provincia")}</div><div style={styles.checkboxRow}><label><input type="checkbox" name="is_cooperative" checked={companyForm.is_cooperative} onChange={handleCompanyChange} /> Sociedad cooperativa</label><label><input type="checkbox" name="special_work_income_withholding" checked={companyForm.special_work_income_withholding} onChange={handleCompanyChange} /> Cálculo especial de retenciones de rendimientos del trabajo</label></div></section><section style={styles.block}><h4 style={styles.blockTitle}>Representante legal y CNAE</h4><div style={styles.formRow}>{renderInput("legal_representative_name", "Nombre y apellidos representante")}{renderInput("legal_representative_dni", "DNI")}{renderInput("legal_representative_position", "Puesto")}</div><div style={styles.formRow}>{renderInput("cnae_2009_code", "CNAE 2009 código")}{renderInput("cnae_2009_name", "CNAE 2009 nombre")}{renderInput("cnae_2025_code", "CNAE 2025 código")}{renderInput("cnae_2025_name", "CNAE 2025 nombre")}</div></section><section style={styles.block}><div style={styles.headerRow}><h4 style={styles.blockTitle}>Plan de pensiones</h4><label style={styles.inlineCheck}><input type="checkbox" name="pension_plan_enabled" checked={companyForm.pension_plan_enabled} onChange={handleCompanyChange} /> Activar apartado</label></div>{companyForm.pension_plan_enabled && <div style={styles.formRow}>{renderInput("pension_manager_key", "Clave entidad gestora")}{renderInput("pension_manager_entity_number", "Número entidad gestora")}{renderInput("pension_plan_name", "Denominación plan de pensiones")}</div>}</section><section style={styles.block}><div style={styles.headerRow}><h4 style={styles.blockTitle}>Calendario de trabajo</h4><span style={styles.badge}>{calendarLoading ? "Cargando calendarios..." : `${workCalendars.length} disponibles`}</span></div><div style={styles.formRow}><label style={styles.formGroup}>Selección de calendario<select name="work_calendar_mode" value={companyForm.work_calendar_mode} onChange={handleCompanyChange} style={styles.input}><option value="">Seleccionar opción</option><option value="existing">Elegir calendario creado</option><option value="new">Crear calendario nuevo</option></select></label>{companyForm.work_calendar_mode === "existing" && <label style={styles.formGroup}>Calendario creado<select name="selected_work_calendar_id" value={companyForm.selected_work_calendar_id} onChange={handleCompanyChange} style={styles.input}><option value="">Seleccionar calendario guardado</option>{workCalendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select></label>}</div>{calendarDetails}</section><section style={styles.block}><h4 style={styles.blockTitle}>Fiscalidad, pagos y SILTRA</h4><div style={styles.formRow}>{renderInput("bank_iban", "IBAN transferencias")}<label style={styles.formGroup}>Modelo 111<select name="model_111" value={companyForm.model_111} onChange={handleCompanyChange} style={styles.input}><option value="trimestral">Trimestral</option><option value="mensual">Mensual</option><option value="no_confecciona">No confecciona</option><option value="solo_mod216">Solo mod. 216</option></select></label><label style={styles.formGroup}>Régimen fiscal<select name="fiscal_regime" value={companyForm.fiscal_regime} onChange={handleCompanyChange} style={styles.input}><option value="estimacion_directa">Estimación directa</option><option value="modulos">Módulos</option><option value="plan_general_contable">Plan general contable</option></select></label></div><div style={styles.formRow}><label style={styles.formGroup}>Cómputo complementos<select name="complement_computation" value={companyForm.complement_computation} onChange={handleCompanyChange} style={styles.input}><option value="segun_convenio">Según convenio</option><option value="calendario_laboral">Por calendario laboral</option></select></label>{renderInput("grouped_withholding_company", "Retenciones 111/190 agrupadas con otra empresa")}</div><label style={styles.inlineCheck}><input type="checkbox" name="siltra_enabled" checked={companyForm.siltra_enabled} onChange={handleCompanyChange} /> Cotización SILTRA</label>{companyForm.siltra_enabled && <><label style={styles.formGroup}>Forma de pago SILTRA<select name="siltra_payment_mode" value={companyForm.siltra_payment_mode} onChange={handleCompanyChange} style={styles.input}><option value="cargo_cuenta">Cargo en cuenta</option><option value="pago_electronico">Pago electrónico</option><option value="retribucion_contable">Retribución contable</option></select></label><div style={styles.flagGrid}>{SILTRA_FLAGS.map(([key, label]) => <label key={key}><input type="checkbox" checked={!!companyForm.siltra_flags[key]} onChange={(e) => handleFlagChange("siltra_flags", key, e.target.checked)} /> {label}</label>)}</div><h5 style={styles.miniTitle}>Bonificación sectorial</h5><div style={styles.flagGrid}>{SECTOR_FLAGS.map(([key, label]) => <label key={key}><input type="checkbox" checked={!!companyForm.sector_flags[key]} onChange={(e) => handleFlagChange("sector_flags", key, e.target.checked)} /> {label}</label>)}</div></>}</section>{error && <div style={styles.error}>{error}</div>}{success && <div style={styles.success}>{success}</div>}<button type="submit" disabled={submitting} style={styles.button}>{submitting ? "Guardando..." : "Crear empresa"}</button></form> : <form onSubmit={handleCreateCenter} style={styles.form}><h3 style={styles.sectionTitle}>Centro asociado a empresa ya creada</h3><label style={styles.formGroupWide}>Empresa asociada<select name="company_id" value={centerForm.company_id} onChange={handleCenterChange} required style={styles.input}><option value="">Seleccionar empresa existente</option>{activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name} · {company.cif}</option>)}</select></label><label style={styles.formGroupWide}>Nombre centro<input name="name" value={centerForm.name} onChange={handleCenterChange} required placeholder="Ej. Colegio San Rafael" style={styles.input} /></label><div style={styles.formRow}><label style={styles.formGroup}><span>Convenio del centro</span><input name="collective_agreement" value={centerForm.collective_agreement} onChange={handleCenterChange} placeholder="Por defecto, convenio de empresa" style={styles.input} /></label><label style={styles.formGroup}><span>CCC empresa</span><input name="general_ccc" value={centerForm.general_ccc} onChange={handleCenterChange} placeholder="Se copia de la empresa" style={styles.input} /></label><label style={styles.formGroup}><span>CCC centro</span><input name="main_ccc" value={centerForm.main_ccc} onChange={handleCenterChange} placeholder="CCC propia del centro" style={styles.input} /></label></div><label style={styles.formGroupWide}>Domicilio del centro<input name="address" value={centerForm.address} onChange={handleCenterChange} placeholder="Por defecto, domicilio social de empresa" style={styles.input} /></label><div style={styles.formRow}><label style={styles.formGroup}><span>Ciudad</span><input name="city" value={centerForm.city} onChange={handleCenterChange} style={styles.input} /></label><label style={styles.formGroup}><span>Provincia</span><input name="province" value={centerForm.province} onChange={handleCenterChange} style={styles.input} /></label></div><div style={styles.formRow}><label style={styles.formGroup}><span>Teléfono</span><input name="phone" value={centerForm.phone} onChange={handleCenterChange} style={styles.input} /></label><label style={styles.formGroup}><span>Fax</span><input name="fax" value={centerForm.fax} onChange={handleCenterChange} style={styles.input} /></label><label style={styles.formGroup}><span>Móvil</span><input name="mobile" value={centerForm.mobile} onChange={handleCenterChange} style={styles.input} /></label><label style={styles.formGroup}><span>Email</span><input name="email" value={centerForm.email} onChange={handleCenterChange} style={styles.input} /></label><label style={styles.formGroup}><span>Web</span><input name="website" value={centerForm.website} onChange={handleCenterChange} style={styles.input} /></label></div>{error && <div style={styles.error}>{error}</div>}{success && <div style={styles.success}>{success}</div>}<button type="submit" disabled={submitting} style={styles.button}>{submitting ? "Guardando..." : "Crear centro"}</button></form>}</div>;
}

const styles = { wrapper: { display: "flex", flexDirection: "column", gap: "18px" }, form: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "14px" }, block: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "12px", backgroundColor: "#ffffff" }, subCard: { border: "1px solid #d1d5db", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "12px", backgroundColor: "#f9fafb" }, headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }, formRow: { display: "flex", gap: "16px", flexWrap: "wrap" }, demoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }, checkboxRow: { display: "flex", gap: "18px", flexWrap: "wrap", fontWeight: 800, color: "#111827" }, inlineCheck: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#111827" }, formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px", fontWeight: 800, color: "#111827" }, formGroupSmall: { width: "190px", flex: "0 0 190px", display: "flex", flexDirection: "column", gap: "6px", fontWeight: 800, color: "#111827" }, formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px", fontWeight: 800, color: "#111827" }, readOnlyTitle: { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 12px", backgroundColor: "#ffffff", fontWeight: 900, color: "#374151" }, sectionTitle: { margin: 0, fontSize: "15px", fontWeight: 900, color: "#111827" }, blockTitle: { margin: 0, fontSize: "14px", fontWeight: 900, color: "#111827" }, miniTitle: { margin: "4px 0 0", fontSize: "13px", fontWeight: 900, color: "#374151" }, badge: { border: "1px solid #d1d5db", borderRadius: "999px", padding: "5px 9px", fontSize: "12px", fontWeight: 900, color: "#374151", backgroundColor: "#f9fafb" }, input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" }, button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "12px 18px", cursor: "pointer", width: "fit-content", fontWeight: 800 }, secondaryButton: { backgroundColor: "#ffffff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 12px", cursor: "pointer", fontWeight: 900, textAlign: "left" }, error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" }, success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" }, scheduleWrapper: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#ffffff" }, scheduleTable: { width: "100%", borderCollapse: "collapse" }, flagGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", fontWeight: 700, color: "#111827" } };
