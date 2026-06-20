import { useEffect, useMemo, useState } from "react";

import CompanyBankingPanel from "../companyBanking/CompanyBankingPanel";
import CompanyPreferencesPanel from "../companyPreferences/CompanyPreferencesPanel";
import WorkCenterTable from "../workCenters/WorkCenterTable";
import EmbeddedCompanyPanel from "./EmbeddedCompanyPanel";
import "./companyWorkspace.css";

function emptyToNull(value) {
  return value === "" ? null : value;
}

function toForm(company) {
  return {
    name: company.name || "",
    cif: company.cif || "",
    status: company.status || "alta",
    registration_date: company.registration_date || "",
    deregistration_date: company.deregistration_date || "",
    company_type: company.company_type || "privada",
    ccc_regime: company.ccc_regime || "",
    ccc_code: company.ccc_code || "",
    main_collective_agreement: company.main_collective_agreement || "",
    is_cooperative: !!company.is_cooperative,
    special_work_income_withholding: !!company.special_work_income_withholding,
    address: company.address || "",
    city: company.city || "",
    province: company.province || "",
    company_phone: company.company_phone || "",
    company_email: company.company_email || "",
    company_website: company.company_website || "",
    company_contact_person: company.company_contact_person || "",
    legal_representative_name: company.legal_representative_name || "",
    legal_representative_dni: company.legal_representative_dni || "",
    legal_representative_position: company.legal_representative_position || "",
    cnae_2009_code: company.cnae_2009_code || "",
    cnae_2009_name: company.cnae_2009_name || "",
    cnae_2025_code: company.cnae_2025_code || "",
    cnae_2025_name: company.cnae_2025_name || "",
    professional_contingencies_mutual: company.professional_contingencies_mutual || "",
    professional_contingencies_policy: company.professional_contingencies_policy || "",
    professional_contingencies_effective_date: company.professional_contingencies_effective_date || "",
    common_it_mutual: company.common_it_mutual || "",
    common_it_policy: company.common_it_policy || "",
    common_it_effective_date: company.common_it_effective_date || "",
    collective_insurance_enabled: !!company.collective_insurance_enabled,
    collective_insurance_company: company.collective_insurance_company || "",
    collective_insurance_policy: company.collective_insurance_policy || "",
    collective_insurance_capital: company.collective_insurance_capital || "",
    pension_plan_enabled: !!company.pension_plan_enabled,
    pension_manager_key: company.pension_manager_key || "",
    pension_manager_entity_number: company.pension_manager_entity_number || "",
    pension_plan_name: company.pension_plan_name || "",
    work_calendar_mode: company.work_calendar_mode || "new",
    work_calendar_name: company.work_calendar_name || "",
    fiscal_regime: company.fiscal_regime || "plan_general_contable",
    is_active: company.is_active !== false,
  };
}

function buildPayload(form) {
  return {
    ...form,
    ccc: [form.ccc_regime, form.ccc_code].filter(Boolean).join("/") || null,
    registration_date: emptyToNull(form.registration_date),
    deregistration_date: emptyToNull(form.deregistration_date),
    professional_contingencies_effective_date: emptyToNull(form.professional_contingencies_effective_date),
    common_it_effective_date: emptyToNull(form.common_it_effective_date),
  };
}

function statusLabel(status) {
  if (status === "baja_temporal") return "Baja temporal";
  if (status === "baja_definitiva") return "Baja definitiva";
  return "Alta";
}

function Field({ label, name, value, onChange, type = "text", wide = false, children }) {
  return (
    <label className={wide ? "company-detail-field company-detail-field-wide" : "company-detail-field"}>
      <span>{label}</span>
      {children || <input type={type} name={name} value={value ?? ""} onChange={onChange} />}
    </label>
  );
}

export default function CompanyDetailWorkspace({
  company,
  companies,
  workCenters,
  activeTab = "general",
  onTabChange,
  onBack,
  onDirtyChange,
  onUpdateCompany,
  onManageCenters,
  onUpdateWorkCenter,
  onDeleteWorkCenter,
  companySubmitting,
  workCenterSubmitting,
}) {
  const initialCompanyForm = useMemo(() => toForm(company), [company]);
  const [form, setForm] = useState(initialCompanyForm);
  const [savedForm, setSavedForm] = useState(initialCompanyForm);
  const [preferencesDirty, setPreferencesDirty] = useState(false);
  const [bankingDirty, setBankingDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initialCompanyForm);
    setSavedForm(initialCompanyForm);
    setPreferencesDirty(false);
    setBankingDirty(false);
    setMessage("");
    setError("");
  }, [company.id, initialCompanyForm]);

  const centers = useMemo(
    () => workCenters.filter((center) => center.is_active !== false && String(center.company_id) === String(company.id)),
    [workCenters, company.id]
  );

  const generalDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  );

  const changedFields = useMemo(
    () => Object.keys(form).filter((key) => JSON.stringify(form[key]) !== JSON.stringify(savedForm[key])).length,
    [form, savedForm]
  );

  const anyDirty = generalDirty || preferencesDirty || bankingDirty;
  const currentTabDirty = activeTab === "general"
    ? generalDirty
    : activeTab === "preferences"
      ? preferencesDirty
      : activeTab === "banking"
        ? bankingDirty
        : false;

  useEffect(() => {
    onDirtyChange?.(anyDirty);
  }, [anyDirty, onDirtyChange]);

  useEffect(() => {
    if (!anyDirty) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [anyDirty]);

  const change = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setMessage("");
    setError("");
  };

  const save = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await onUpdateCompany(company.id, buildPayload(form));
      setSavedForm({ ...form });
      setMessage("Datos generales actualizados.");
    } catch (err) {
      setError(err.message || "No se pudo actualizar la empresa");
    }
  };

  const discardCurrentTab = () => {
    if (activeTab === "general") setForm(savedForm);
    if (activeTab === "preferences") setPreferencesDirty(false);
    if (activeTab === "banking") setBankingDirty(false);
  };

  const confirmLeaveCurrentTab = () => {
    if (!currentTabDirty) return true;
    const confirmed = window.confirm("Hay cambios sin guardar en esta sección. ¿Salir y descartarlos?");
    if (confirmed) discardCurrentTab();
    return confirmed;
  };

  const requestTab = (nextTab) => {
    if (nextTab === activeTab || !confirmLeaveCurrentTab()) return;
    onTabChange?.(nextTab);
  };

  const requestBack = () => {
    if (!confirmLeaveCurrentTab()) return;
    onBack?.();
  };

  const tabs = [
    ["general", "Datos generales", generalDirty],
    ["centers", `Centros (${centers.length})`, false],
    ["preferences", "Preferencias", preferencesDirty],
    ["banking", "Domiciliación de pagos", bankingDirty],
  ];

  return (
    <div className="company-detail-workspace">
      <button type="button" className="company-back-link" onClick={requestBack}>← Volver al listado</button>

      <header className="company-detail-header">
        <div>
          <div className="company-detail-eyebrow">Ficha de empresa · EMP-{String(company.id).padStart(4, "0")}</div>
          <h2>{company.name}</h2>
          <p>CIF {company.cif || "sin informar"} · CCC {company.ccc || "sin informar"} · {company.company_type || "tipo sin definir"}</p>
        </div>
        <div className="company-detail-header-status">
          {anyDirty && <span className="company-unsaved-pill">Cambios sin guardar</span>}
          <span className={`company-status ${company.status === "alta" ? "company-status-active" : company.status === "baja_temporal" ? "company-status-warning" : "company-status-inactive"}`}>{statusLabel(company.status)}</span>
        </div>
      </header>

      <nav className="company-detail-tabs">
        {tabs.map(([key, label, dirty]) => (
          <button key={key} type="button" className={activeTab === key ? "active" : ""} onClick={() => requestTab(key)}>
            {label}{dirty && <span className="company-tab-dirty" aria-label="Cambios sin guardar" />}
          </button>
        ))}
      </nav>

      {activeTab === "general" && (
        <form onSubmit={save} className="company-detail-form">
          <section className="company-detail-section">
            <div className="company-detail-section-heading"><div><h3>Identificación y estado</h3><p>Datos maestros de la empresa y encuadramiento principal.</p></div></div>
            <div className="company-detail-grid">
              <Field label="Nombre" name="name" value={form.name} onChange={change} wide />
              <Field label="CIF" name="cif" value={form.cif} onChange={change} />
              <Field label="Estado" name="status" value={form.status} onChange={change}><select name="status" value={form.status} onChange={change}><option value="alta">Alta</option><option value="baja_temporal">Baja temporal</option><option value="baja_definitiva">Baja definitiva</option></select></Field>
              <Field label="Fecha de alta" name="registration_date" value={form.registration_date} onChange={change} type="date" />
              <Field label="Fecha de baja" name="deregistration_date" value={form.deregistration_date} onChange={change} type="date" />
              <Field label="Tipo de empresa" name="company_type" value={form.company_type} onChange={change}><select name="company_type" value={form.company_type} onChange={change}><option value="privada">Privada</option><option value="publica">Pública</option><option value="privada_sin_lucro">Privada sin lucro</option><option value="corporaciones">Corporaciones</option><option value="ett">ETT</option><option value="sociedad_laboral_privada">Sociedad laboral privada</option></select></Field>
              <Field label="CCC régimen" name="ccc_regime" value={form.ccc_regime} onChange={change} />
              <Field label="CCC código" name="ccc_code" value={form.ccc_code} onChange={change} />
              <Field label="Convenio principal" name="main_collective_agreement" value={form.main_collective_agreement} onChange={change} wide />
            </div>
            <div className="company-detail-checks"><label><input type="checkbox" name="is_cooperative" checked={form.is_cooperative} onChange={change} /> Sociedad cooperativa</label><label><input type="checkbox" name="special_work_income_withholding" checked={form.special_work_income_withholding} onChange={change} /> Cálculo especial de retenciones</label><label><input type="checkbox" name="is_active" checked={form.is_active} onChange={change} /> Empresa activa</label></div>
          </section>

          <section className="company-detail-section">
            <div className="company-detail-section-heading"><div><h3>Domicilio social y contacto</h3><p>Información administrativa y vías de contacto.</p></div></div>
            <div className="company-detail-grid">
              <Field label="Domicilio social" name="address" value={form.address} onChange={change} wide />
              <Field label="Localidad" name="city" value={form.city} onChange={change} />
              <Field label="Provincia" name="province" value={form.province} onChange={change} />
              <Field label="Teléfono" name="company_phone" value={form.company_phone} onChange={change} />
              <Field label="Correo electrónico" name="company_email" value={form.company_email} onChange={change} type="email" />
              <Field label="Sitio web" name="company_website" value={form.company_website} onChange={change} />
              <Field label="Persona de contacto" name="company_contact_person" value={form.company_contact_person} onChange={change} />
            </div>
          </section>

          <section className="company-detail-section">
            <div className="company-detail-section-heading"><div><h3>Representación legal y actividad</h3><p>Representante y clasificación CNAE.</p></div></div>
            <div className="company-detail-grid">
              <Field label="Representante legal" name="legal_representative_name" value={form.legal_representative_name} onChange={change} wide />
              <Field label="DNI" name="legal_representative_dni" value={form.legal_representative_dni} onChange={change} />
              <Field label="Puesto" name="legal_representative_position" value={form.legal_representative_position} onChange={change} />
              <Field label="CNAE 2009 código" name="cnae_2009_code" value={form.cnae_2009_code} onChange={change} />
              <Field label="CNAE 2009 denominación" name="cnae_2009_name" value={form.cnae_2009_name} onChange={change} wide />
              <Field label="CNAE 2025 código" name="cnae_2025_code" value={form.cnae_2025_code} onChange={change} />
              <Field label="CNAE 2025 denominación" name="cnae_2025_name" value={form.cnae_2025_name} onChange={change} wide />
            </div>
          </section>

          <section className="company-detail-section">
            <div className="company-detail-section-heading"><div><h3>Mutuas y seguros</h3><p>Coberturas de contingencias, IT y seguro colectivo.</p></div></div>
            <div className="company-detail-grid">
              <Field label="Mutua contingencias profesionales" name="professional_contingencies_mutual" value={form.professional_contingencies_mutual} onChange={change} wide />
              <Field label="Póliza CP" name="professional_contingencies_policy" value={form.professional_contingencies_policy} onChange={change} />
              <Field label="Fecha efecto CP" name="professional_contingencies_effective_date" value={form.professional_contingencies_effective_date} onChange={change} type="date" />
              <Field label="Mutua incapacidad temporal" name="common_it_mutual" value={form.common_it_mutual} onChange={change} wide />
              <Field label="Póliza IT" name="common_it_policy" value={form.common_it_policy} onChange={change} />
              <Field label="Fecha efecto IT" name="common_it_effective_date" value={form.common_it_effective_date} onChange={change} type="date" />
            </div>
            <div className="company-detail-checks"><label><input type="checkbox" name="collective_insurance_enabled" checked={form.collective_insurance_enabled} onChange={change} /> Seguro colectivo de convenio</label></div>
            {form.collective_insurance_enabled && <div className="company-detail-grid"><Field label="Aseguradora" name="collective_insurance_company" value={form.collective_insurance_company} onChange={change} /><Field label="Nº de póliza" name="collective_insurance_policy" value={form.collective_insurance_policy} onChange={change} /><Field label="Capital asegurado" name="collective_insurance_capital" value={form.collective_insurance_capital} onChange={change} /></div>}
          </section>

          <section className="company-detail-section">
            <div className="company-detail-section-heading"><div><h3>Plan de pensiones, calendario y fiscalidad</h3><p>Configuraciones maestras no vinculadas a una operación bancaria.</p></div></div>
            <div className="company-detail-checks"><label><input type="checkbox" name="pension_plan_enabled" checked={form.pension_plan_enabled} onChange={change} /> Plan de pensiones habilitado</label></div>
            {form.pension_plan_enabled && <div className="company-detail-grid"><Field label="Clave entidad gestora" name="pension_manager_key" value={form.pension_manager_key} onChange={change} /><Field label="Número entidad gestora" name="pension_manager_entity_number" value={form.pension_manager_entity_number} onChange={change} /><Field label="Denominación del plan" name="pension_plan_name" value={form.pension_plan_name} onChange={change} wide /></div>}
            <div className="company-detail-grid">
              <Field label="Modo de calendario" name="work_calendar_mode" value={form.work_calendar_mode} onChange={change}><select name="work_calendar_mode" value={form.work_calendar_mode} onChange={change}><option value="new">Calendario propio</option><option value="existing">Calendario existente</option></select></Field>
              <Field label="Nombre del calendario" name="work_calendar_name" value={form.work_calendar_name} onChange={change} />
              <Field label="Régimen fiscal" name="fiscal_regime" value={form.fiscal_regime} onChange={change}><select name="fiscal_regime" value={form.fiscal_regime} onChange={change}><option value="estimacion_directa">Estimación directa</option><option value="modulos">Módulos</option><option value="plan_general_contable">Plan general contable</option></select></Field>
            </div>
          </section>

          {error && <div className="company-form-error">{error}</div>}
          {message && <div className="company-form-success">{message}</div>}
          <div className="company-detail-savebar">
            <span>{generalDirty ? `${changedFields} campos modificados sin guardar.` : "Preferencias, cálculo e imagen corporativa se gestionan en su pestaña específica."}</span>
            <button type="submit" className="company-button-primary" disabled={companySubmitting || !generalDirty}>{companySubmitting ? "Guardando..." : generalDirty ? `Guardar cambios · ${changedFields}` : "Sin cambios pendientes"}</button>
          </div>
        </form>
      )}

      {activeTab === "centers" && (
        <section className="company-detail-section">
          <div className="company-detail-section-heading"><div><h3>Centros de trabajo</h3><p>Centros vinculados exclusivamente a {company.name}.</p></div><button type="button" className="company-button-primary" onClick={() => onManageCenters(company)}>Gestionar centros</button></div>
          <WorkCenterTable loading={false} workCenters={centers} companies={companies} onUpdateWorkCenter={onUpdateWorkCenter} onDeleteWorkCenter={onDeleteWorkCenter} submitting={workCenterSubmitting} />
        </section>
      )}

      {activeTab === "preferences" && (
        <EmbeddedCompanyPanel
          className="company-embedded-preferences"
          onDirtyChange={setPreferencesDirty}
          successTexts={["Preferencias guardadas correctamente."]}
        >
          <CompanyPreferencesPanel companies={companies} selectedCompanyId={String(company.id)} onSelectedCompanyChange={() => {}} />
        </EmbeddedCompanyPanel>
      )}

      {activeTab === "banking" && (
        <EmbeddedCompanyPanel
          className="company-embedded-banking"
          onDirtyChange={setBankingDirty}
          successTexts={["Cuenta bancaria añadida.", "Cuenta asignada a la operación.", "Cuenta desvinculada de la operación."]}
          dirtyButtonTexts={["Generar código simulado"]}
        >
          <CompanyBankingPanel companies={companies} selectedCompanyId={String(company.id)} onSelectedCompanyChange={() => {}} />
        </EmbeddedCompanyPanel>
      )}
    </div>
  );
}
