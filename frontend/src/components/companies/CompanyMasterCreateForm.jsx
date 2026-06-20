import { useState } from "react";

import { createCompany } from "../../services/companyApi";

const MUTUALS = [
  "UMIVALE ACTIVA - (nº 003)",
  "ASEPEYO - (nº 151)",
  "EGARSAT - (nº 276)",
  "FRATERNIDAD - MUPRESPA - (nº 275)",
  "FREMAP - (nº 061)",
  "IBERMUTUA - (nº 274)",
  "MUTUA DE ANDALUCÍA Y CEUTA - CESMA - (nº 115)",
  "MUTUA UNIVERSAL, MUGENAT - (nº 010)",
  "MC MUTUAL - (nº 001)",
];

const EMPTY_FORM = {
  name: "",
  cif: "",
  ccc_regime: "0111",
  ccc_code: "",
  address: "",
  city: "",
  province: "",
  company_phone: "",
  company_email: "",
  company_website: "",
  company_contact_person: "",
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
  professional_contingencies_mutual: "",
  professional_contingencies_policy: "",
  professional_contingencies_effective_date: "",
  common_it_mutual: "",
  common_it_policy: "",
  common_it_effective_date: "",
  collective_insurance_enabled: false,
  collective_insurance_company: "",
  collective_insurance_policy: "",
  collective_insurance_capital: "",
  pension_plan_enabled: false,
  pension_manager_key: "",
  pension_manager_entity_number: "",
  pension_plan_name: "",
  work_calendar_mode: "new",
  work_calendar_name: "",
  bank_iban: "",
  fiscal_regime: "plan_general_contable",
};

const DEMOS = {
  education: {
    label: "Centro educativo privado",
    data: {
      name: "Colegio San Rafael Demo",
      cif: "B14999001",
      ccc_code: "14123456789",
      address: "Avda. de la Enseñanza, 12",
      city: "Córdoba",
      province: "Córdoba",
      registration_date: "2025-01-01",
      main_collective_agreement: "Convenio de enseñanza privada sostenida con fondos públicos",
      company_type: "privada",
      cnae_2009_code: "8531",
      cnae_2009_name: "Educación secundaria general",
      cnae_2025_code: "8531",
      cnae_2025_name: "Educación secundaria general",
      professional_contingencies_mutual: "UMIVALE ACTIVA - (nº 003)",
      common_it_mutual: "UMIVALE ACTIVA - (nº 003)",
      work_calendar_name: "Calendario docente estándar",
    },
  },
  nonprofit: {
    label: "Fundación sin ánimo de lucro",
    data: {
      name: "Fundación Laboral Demo",
      cif: "G14999003",
      ccc_code: "14123456791",
      address: "Plaza Social, 4",
      city: "Córdoba",
      province: "Córdoba",
      registration_date: "2025-01-01",
      main_collective_agreement: "Convenio de acción e intervención social",
      company_type: "privada_sin_lucro",
      cnae_2009_code: "8899",
      cnae_2009_name: "Otros servicios sociales sin alojamiento",
      cnae_2025_code: "8899",
      cnae_2025_name: "Otros servicios sociales sin alojamiento",
      professional_contingencies_mutual: "MUTUA DE ANDALUCÍA Y CEUTA - CESMA - (nº 115)",
      common_it_mutual: "MUTUA DE ANDALUCÍA Y CEUTA - CESMA - (nº 115)",
      work_calendar_name: "Calendario entidad social",
    },
  },
  ett: {
    label: "ETT",
    data: {
      name: "Sur Empleo Temporal Demo",
      cif: "B14999004",
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
      professional_contingencies_mutual: "ASEPEYO - (nº 151)",
      common_it_mutual: "ASEPEYO - (nº 151)",
      work_calendar_name: "Calendario ETT administración",
    },
  },
};

function emptyToNull(value) {
  return value === "" ? null : value;
}

function buildPayload(form) {
  return {
    ...form,
    ccc: [form.ccc_regime, form.ccc_code].filter(Boolean).join("/") || null,
    ccc_regime: emptyToNull(form.ccc_regime),
    ccc_code: emptyToNull(form.ccc_code),
    address: emptyToNull(form.address),
    city: emptyToNull(form.city),
    province: emptyToNull(form.province),
    company_phone: emptyToNull(form.company_phone),
    company_email: emptyToNull(form.company_email),
    company_website: emptyToNull(form.company_website),
    company_contact_person: emptyToNull(form.company_contact_person),
    registration_date: emptyToNull(form.registration_date),
    deregistration_date: emptyToNull(form.deregistration_date),
    main_collective_agreement: emptyToNull(form.main_collective_agreement),
    company_type: emptyToNull(form.company_type),
    legal_representative_name: emptyToNull(form.legal_representative_name),
    legal_representative_dni: emptyToNull(form.legal_representative_dni),
    legal_representative_position: emptyToNull(form.legal_representative_position),
    cnae_2009_code: emptyToNull(form.cnae_2009_code),
    cnae_2009_name: emptyToNull(form.cnae_2009_name),
    cnae_2025_code: emptyToNull(form.cnae_2025_code),
    cnae_2025_name: emptyToNull(form.cnae_2025_name),
    professional_contingencies_mutual: emptyToNull(form.professional_contingencies_mutual),
    professional_contingencies_policy: emptyToNull(form.professional_contingencies_policy),
    professional_contingencies_effective_date: emptyToNull(form.professional_contingencies_effective_date),
    common_it_mutual: emptyToNull(form.common_it_mutual),
    common_it_policy: emptyToNull(form.common_it_policy),
    common_it_effective_date: emptyToNull(form.common_it_effective_date),
    collective_insurance_company: emptyToNull(form.collective_insurance_company),
    collective_insurance_policy: emptyToNull(form.collective_insurance_policy),
    collective_insurance_capital: emptyToNull(form.collective_insurance_capital),
    pension_manager_key: emptyToNull(form.pension_manager_key),
    pension_manager_entity_number: emptyToNull(form.pension_manager_entity_number),
    pension_plan_name: emptyToNull(form.pension_plan_name),
    work_calendar_name: emptyToNull(form.work_calendar_name),
    work_calendar_data: null,
    bank_iban: emptyToNull(form.bank_iban),
    fiscal_regime: emptyToNull(form.fiscal_regime),
    model_111: null,
    complement_computation: null,
    siltra_enabled: false,
    siltra_payment_mode: null,
    siltra_options: null,
    sector_bonuses: null,
    grouped_withholding_company: null,
  };
}

function Field({ label, wide = false, children }) {
  return <label style={wide ? styles.fieldWide : styles.field}><span>{label}</span>{children}</label>;
}

function TextInput({ name, form, onChange, type = "text", required = false }) {
  return <input name={name} value={form[name] || ""} onChange={onChange} type={type} required={required} style={styles.input} />;
}

function MutualSelect({ name, value, onChange }) {
  return (
    <select name={name} value={value} onChange={onChange} style={styles.input}>
      <option value="">Seleccionar mutua</option>
      {MUTUALS.map((mutual) => <option key={mutual} value={mutual}>{mutual}</option>)}
    </select>
  );
}

export default function CompanyMasterCreateForm({ onCreated, onOpenPreferences }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdCompany, setCreatedCompany] = useState(null);

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setError("");
    setCreatedCompany(null);
  };

  const loadDemo = (key) => {
    setForm({ ...EMPTY_FORM, ...DEMOS[key].data });
    setError("");
    setCreatedCompany(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const company = await createCompany(buildPayload(form));
      setCreatedCompany(company);
      setForm(EMPTY_FORM);
      onCreated?.(company);
    } catch (err) {
      setError(err.message || "Error al crear la empresa");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <section style={styles.block}>
        <div style={styles.headingRow}>
          <div><h3 style={styles.title}>Ficha maestra de empresa</h3><p style={styles.subtitle}>Los parámetros de cálculo, SILTRA, retenciones e impresión se configuran después en Preferencias.</p></div>
          <span style={styles.badge}>Datos maestros</span>
        </div>
        <div style={styles.demoRow}>
          {Object.entries(DEMOS).map(([key, demo]) => <button key={key} type="button" onClick={() => loadDemo(key)} style={styles.secondaryButton}>{demo.label}</button>)}
        </div>
      </section>

      <section style={styles.block}>
        <h4 style={styles.blockTitle}>Identificación y estado</h4>
        <div style={styles.grid}>
          <Field label="Nombre de empresa"><TextInput name="name" form={form} onChange={handleChange} required /></Field>
          <Field label="CIF"><TextInput name="cif" form={form} onChange={handleChange} required /></Field>
          <Field label="Estado"><select name="status" value={form.status} onChange={handleChange} style={styles.input}><option value="alta">Alta</option><option value="baja_temporal">Baja temporal</option><option value="baja_definitiva">Baja definitiva</option></select></Field>
          <Field label="Fecha de alta"><TextInput name="registration_date" form={form} onChange={handleChange} type="date" /></Field>
          <Field label="Fecha de baja"><TextInput name="deregistration_date" form={form} onChange={handleChange} type="date" /></Field>
          <Field label="Tipo de empresa"><select name="company_type" value={form.company_type} onChange={handleChange} style={styles.input}><option value="privada">Privada</option><option value="publica">Pública</option><option value="privada_sin_lucro">Privada sin lucro</option><option value="corporaciones">Corporaciones</option><option value="ett">ETT</option><option value="sociedad_laboral_privada">Sociedad laboral privada</option></select></Field>
          <Field label="CCC régimen"><TextInput name="ccc_regime" form={form} onChange={handleChange} /></Field>
          <Field label="CCC código"><TextInput name="ccc_code" form={form} onChange={handleChange} /></Field>
          <Field label="Convenio principal" wide><TextInput name="main_collective_agreement" form={form} onChange={handleChange} /></Field>
        </div>
        <div style={styles.checkRow}>
          <label><input type="checkbox" name="is_cooperative" checked={form.is_cooperative} onChange={handleChange} /> Sociedad cooperativa</label>
          <label><input type="checkbox" name="special_work_income_withholding" checked={form.special_work_income_withholding} onChange={handleChange} /> Cálculo especial de retenciones de trabajo</label>
        </div>
      </section>

      <section style={styles.block}>
        <h4 style={styles.blockTitle}>Domicilio social y contacto</h4>
        <div style={styles.grid}>
          <Field label="Domicilio social" wide><TextInput name="address" form={form} onChange={handleChange} /></Field>
          <Field label="Localidad"><TextInput name="city" form={form} onChange={handleChange} /></Field>
          <Field label="Provincia"><TextInput name="province" form={form} onChange={handleChange} /></Field>
          <Field label="Teléfono"><TextInput name="company_phone" form={form} onChange={handleChange} /></Field>
          <Field label="Correo electrónico"><TextInput name="company_email" form={form} onChange={handleChange} type="email" /></Field>
          <Field label="Sitio web"><TextInput name="company_website" form={form} onChange={handleChange} /></Field>
          <Field label="Persona de contacto"><TextInput name="company_contact_person" form={form} onChange={handleChange} /></Field>
        </div>
      </section>

      <section style={styles.block}>
        <h4 style={styles.blockTitle}>Representante legal y actividad</h4>
        <div style={styles.grid}>
          <Field label="Nombre y apellidos"><TextInput name="legal_representative_name" form={form} onChange={handleChange} /></Field>
          <Field label="DNI"><TextInput name="legal_representative_dni" form={form} onChange={handleChange} /></Field>
          <Field label="Puesto"><TextInput name="legal_representative_position" form={form} onChange={handleChange} /></Field>
          <Field label="CNAE 2009 código"><TextInput name="cnae_2009_code" form={form} onChange={handleChange} /></Field>
          <Field label="CNAE 2009 denominación"><TextInput name="cnae_2009_name" form={form} onChange={handleChange} /></Field>
          <Field label="CNAE 2025 código"><TextInput name="cnae_2025_code" form={form} onChange={handleChange} /></Field>
          <Field label="CNAE 2025 denominación"><TextInput name="cnae_2025_name" form={form} onChange={handleChange} /></Field>
        </div>
      </section>

      <section style={styles.block}>
        <h4 style={styles.blockTitle}>Mutuas, seguros y previsión social</h4>
        <div style={styles.grid}>
          <Field label="Mutua contingencias profesionales"><MutualSelect name="professional_contingencies_mutual" value={form.professional_contingencies_mutual} onChange={handleChange} /></Field>
          <Field label="Nº póliza CP"><TextInput name="professional_contingencies_policy" form={form} onChange={handleChange} /></Field>
          <Field label="Fecha efecto CP"><TextInput name="professional_contingencies_effective_date" form={form} onChange={handleChange} type="date" /></Field>
          <Field label="Mutua incapacidad temporal"><MutualSelect name="common_it_mutual" value={form.common_it_mutual} onChange={handleChange} /></Field>
          <Field label="Nº póliza IT"><TextInput name="common_it_policy" form={form} onChange={handleChange} /></Field>
          <Field label="Fecha efecto IT"><TextInput name="common_it_effective_date" form={form} onChange={handleChange} type="date" /></Field>
        </div>
        <div style={styles.checkRow}>
          <label><input type="checkbox" name="collective_insurance_enabled" checked={form.collective_insurance_enabled} onChange={handleChange} /> Seguro colectivo de convenio</label>
          <label><input type="checkbox" name="pension_plan_enabled" checked={form.pension_plan_enabled} onChange={handleChange} /> Plan de pensiones</label>
        </div>
        {form.collective_insurance_enabled && <div style={styles.grid}><Field label="Aseguradora"><TextInput name="collective_insurance_company" form={form} onChange={handleChange} /></Field><Field label="Nº póliza"><TextInput name="collective_insurance_policy" form={form} onChange={handleChange} /></Field><Field label="Capital asegurado"><TextInput name="collective_insurance_capital" form={form} onChange={handleChange} /></Field></div>}
        {form.pension_plan_enabled && <div style={styles.grid}><Field label="Clave entidad gestora"><TextInput name="pension_manager_key" form={form} onChange={handleChange} /></Field><Field label="Número entidad gestora"><TextInput name="pension_manager_entity_number" form={form} onChange={handleChange} /></Field><Field label="Denominación del plan"><TextInput name="pension_plan_name" form={form} onChange={handleChange} /></Field></div>}
      </section>

      <section style={styles.block}>
        <h4 style={styles.blockTitle}>Calendario y datos financieros</h4>
        <div style={styles.grid}>
          <Field label="Modo de calendario"><select name="work_calendar_mode" value={form.work_calendar_mode} onChange={handleChange} style={styles.input}><option value="new">Calendario propio</option><option value="existing">Calendario existente</option></select></Field>
          <Field label="Nombre del calendario"><TextInput name="work_calendar_name" form={form} onChange={handleChange} /></Field>
          <Field label="IBAN"><TextInput name="bank_iban" form={form} onChange={handleChange} /></Field>
          <Field label="Régimen fiscal"><select name="fiscal_regime" value={form.fiscal_regime} onChange={handleChange} style={styles.input}><option value="estimacion_directa">Estimación directa</option><option value="modulos">Módulos</option><option value="plan_general_contable">Plan general contable</option></select></Field>
        </div>
      </section>

      {error && <div style={styles.error}>{error}</div>}
      {createdCompany && (
        <div style={styles.successRow}>
          <span>Empresa creada: <strong>{createdCompany.name}</strong>.</span>
          <button type="button" onClick={() => onOpenPreferences?.(createdCompany)} style={styles.preferencesButton}>Configurar preferencias</button>
        </div>
      )}
      <div style={styles.actions}><button type="submit" disabled={submitting} style={styles.saveButton}>{submitting ? "Creando..." : "Crear empresa"}</button></div>
    </form>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  block: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", backgroundColor: "#fff" },
  headingRow: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "start", flexWrap: "wrap" },
  title: { margin: 0, color: "#111827", fontSize: "18px" },
  subtitle: { margin: "5px 0 0", color: "#64748b", fontSize: "13px" },
  badge: { padding: "5px 9px", borderRadius: "999px", backgroundColor: "#fef3c7", color: "#92400e", fontSize: "12px", fontWeight: 900 },
  demoRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  secondaryButton: { border: "1px solid #d1d5db", backgroundColor: "#fff", color: "#111827", borderRadius: "7px", padding: "8px 10px", cursor: "pointer", fontWeight: 800 },
  blockTitle: { margin: 0, color: "#111827", fontSize: "14px", fontWeight: 900 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", color: "#374151", fontSize: "13px", fontWeight: 800 },
  fieldWide: { display: "flex", flexDirection: "column", gap: "6px", color: "#374151", fontSize: "13px", fontWeight: 800, gridColumn: "1 / -1" },
  input: { width: "100%", minHeight: "39px", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "7px", padding: "8px 10px", backgroundColor: "#fff" },
  checkRow: { display: "flex", gap: "18px", flexWrap: "wrap", color: "#374151", fontWeight: 800, fontSize: "13px" },
  error: { padding: "11px 13px", borderRadius: "8px", backgroundColor: "#fef2f2", color: "#b91c1c", fontWeight: 800 },
  successRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "8px", backgroundColor: "#f0fdf4", color: "#166534", flexWrap: "wrap" },
  preferencesButton: { border: "1px solid #eab308", backgroundColor: "#facc15", color: "#111827", borderRadius: "7px", padding: "8px 11px", cursor: "pointer", fontWeight: 900 },
  actions: { display: "flex", justifyContent: "flex-end" },
  saveButton: { border: "1px solid #111827", backgroundColor: "#111827", color: "#fff", borderRadius: "8px", padding: "10px 16px", cursor: "pointer", fontWeight: 900 },
};
