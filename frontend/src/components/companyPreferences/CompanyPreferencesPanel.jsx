import { useEffect, useMemo, useState } from "react";

import {
  fetchCompanyPreferences,
  updateCompanyPreferences,
} from "../../services/companyPreferencesApi";

const TABS = [
  ["general", "General"],
  ["contribution", "Cotización"],
  ["withholding", "Retenciones"],
  ["payroll", "Nóminas"],
  ["documents", "Recibos y documentos"],
  ["corporate_identity", "Imagen corporativa"],
  ["language", "Idioma"],
];

const DEFAULTS = {
  general: {
    configuration_mode: "own",
    processing_mode: "general",
    default_payment_code: "",
    default_collection_method: "bank_transfer",
  },
  contribution: {
    siltra_enabled: false,
    payment_mode: "direct_debit",
    accounting_relation: false,
    centralized_payment: false,
    authorization_number: "",
    authorization_date: "",
    bulletin_data_source: "company",
    letterhead_identification: true,
    exclusion_it: false,
    exclusion_fogasa: false,
    exclusion_integrated_officials: false,
    resolution_2010_05_25: false,
    ceuta_melilla_bonus: false,
    worker_surcharge: false,
    christmas_extra_suppression: false,
    local_police: false,
    sector_bonus: "",
    pd_1: false,
    pd_2: false,
    it: false,
    quarterly: false,
    skip_training_hours: false,
  },
  withholding: {
    model_111_same_nif: false,
    model_190_same_nif: false,
    model_190_collective_media: false,
    company_assumes_payment_on_account: false,
    model_111_direct_debit_file: false,
    model_190_other_exempt_income: false,
    grouped_irpf_different_nif: false,
    periodicity: "quarterly",
  },
  payroll: {
    preparation_mode: "general",
    seniority_source: "agreement",
    holidays_source: "agreement",
    extra_pay_source: "agreement",
    indemnities_source: "agreement",
    it_complements_source: "agreement",
    prorate_extra_pay_new_hires: false,
    individualize_earning_names: false,
    incident_closing_day: 20,
    allow_recalculation: true,
    rounding_mode: "two_decimals",
    retroactive_mode: "separate_payroll",
    block_after_closure: false,
  },
  documents: {
    address_source: "registered_office",
    denomination_source: "company",
    payroll_order: "alphabetical",
    journey_register_mode: "blank",
    show_collection_method: true,
    show_age: false,
    show_contract_end: true,
    show_irpf_accumulated: true,
    group_concepts: false,
    group_only_self_employed: false,
    show_time_register: false,
    show_amount_breakdown: true,
    group_monthly: false,
    group_monthly_by_ccc: false,
    print_contribution_only: false,
    mask_iban: true,
    show_center: true,
    show_agreement_category: true,
    simulation_watermark: true,
    footer_text: "Documento de simulación educativa sin validez administrativa",
  },
  corporate_identity: {
    logo_data_url: "",
    logo_name: "",
    signature_data_url: "",
    signature_name: "",
    show_logo: true,
    show_signature: false,
  },
  language: {
    default_language: "es",
  },
};

function mergePreferences(data) {
  return {
    ...data,
    general: { ...DEFAULTS.general, ...(data?.general || {}) },
    contribution: { ...DEFAULTS.contribution, ...(data?.contribution || {}) },
    withholding: { ...DEFAULTS.withholding, ...(data?.withholding || {}) },
    payroll: { ...DEFAULTS.payroll, ...(data?.payroll || {}) },
    documents: { ...DEFAULTS.documents, ...(data?.documents || {}) },
    corporate_identity: { ...DEFAULTS.corporate_identity, ...(data?.corporate_identity || {}) },
    language: { ...DEFAULTS.language, ...(data?.language || {}) },
    inherited_from_company_id: data?.inherited_from_company_id || "",
    effective_from: data?.effective_from || "",
    updated_by: data?.updated_by || "Administrador",
  };
}

function Field({ label, children, wide = false, hint = "" }) {
  return (
    <label style={wide ? styles.fieldWide : styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
      {hint && <span style={styles.hint}>{hint}</span>}
    </label>
  );
}

function Toggle({ label, checked, onChange, hint = "" }) {
  return (
    <label style={styles.toggleRow}>
      <span>
        <strong style={styles.toggleLabel}>{label}</strong>
        {hint && <small style={styles.toggleHint}>{hint}</small>}
      </span>
      <input type="checkbox" checked={!!checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SectionCard({ title, description, children }) {
  return (
    <section style={styles.sectionCard}>
      <div style={styles.sectionHeading}>
        <h3 style={styles.sectionTitle}>{title}</h3>
        {description && <p style={styles.sectionDescription}>{description}</p>}
      </div>
      {children}
    </section>
  );
}

function SourceSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} style={styles.input}>
      <option value="agreement">Aplicar convenio</option>
      <option value="company">Configuración propia de empresa</option>
    </select>
  );
}

export default function CompanyPreferencesPanel({
  companies,
  selectedCompanyId,
  onSelectedCompanyChange,
}) {
  const [activeTab, setActiveTab] = useState("general");
  const [form, setForm] = useState(() => mergePreferences({}));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company.id) === String(selectedCompanyId)),
    [companies, selectedCompanyId]
  );

  useEffect(() => {
    if (!selectedCompanyId) {
      setForm(mergePreferences({}));
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setSuccess("");

    fetchCompanyPreferences(selectedCompanyId)
      .then((data) => {
        if (!cancelled) setForm(mergePreferences(data));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "No se pudieron cargar las preferencias");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId]);

  const updateSection = (section, key, value) => {
    setForm((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
    setSuccess("");
  };

  const updateRoot = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccess("");
  };

  const readImage = (file, dataKey, nameKey) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateSection("corporate_identity", dataKey, reader.result || "");
      updateSection("corporate_identity", nameKey, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!selectedCompanyId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        general: form.general,
        contribution: form.contribution,
        withholding: form.withholding,
        payroll: form.payroll,
        documents: form.documents,
        corporate_identity: form.corporate_identity,
        language: form.language,
        inherited_from_company_id: form.inherited_from_company_id ? Number(form.inherited_from_company_id) : null,
        effective_from: form.effective_from || null,
        updated_by: form.updated_by || "Administrador",
      };
      const saved = await updateCompanyPreferences(selectedCompanyId, payload);
      setForm(mergePreferences(saved));
      setSuccess("Preferencias guardadas correctamente.");
    } catch (err) {
      setError(err.message || "No se pudieron guardar las preferencias");
    } finally {
      setSaving(false);
    }
  };

  const renderGeneral = () => (
    <>
      <SectionCard title="Aplicación de la configuración" description="Define si la empresa usa valores propios o hereda la configuración de otra empresa del grupo.">
        <div style={styles.grid}>
          <Field label="Modo de configuración">
            <select value={form.general.configuration_mode} onChange={(event) => updateSection("general", "configuration_mode", event.target.value)} style={styles.input}>
              <option value="own">Preferencias propias</option>
              <option value="inherit">Heredar del grupo o empresa</option>
              <option value="inherit_overrides">Heredar y personalizar excepciones</option>
            </select>
          </Field>
          <Field label="Heredar de">
            <select value={form.inherited_from_company_id} onChange={(event) => updateRoot("inherited_from_company_id", event.target.value)} style={styles.input} disabled={form.general.configuration_mode === "own"}>
              <option value="">Sin herencia</option>
              {companies.filter((company) => String(company.id) !== String(selectedCompanyId)).map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Fecha de efecto">
            <input type="date" value={form.effective_from} onChange={(event) => updateRoot("effective_from", event.target.value)} style={styles.input} />
          </Field>
          <Field label="Confección predeterminada">
            <select value={form.general.processing_mode} onChange={(event) => updateSection("general", "processing_mode", event.target.value)} style={styles.input}>
              <option value="general">Procesos generales</option>
              <option value="individual">Proceso individual</option>
            </select>
          </Field>
          <Field label="Código pagador predeterminado">
            <input value={form.general.default_payment_code} onChange={(event) => updateSection("general", "default_payment_code", event.target.value)} style={styles.input} />
          </Field>
          <Field label="Modalidad de cobro predeterminada">
            <select value={form.general.default_collection_method} onChange={(event) => updateSection("general", "default_collection_method", event.target.value)} style={styles.input}>
              <option value="bank_transfer">Transferencia bancaria</option>
              <option value="cash">Efectivo</option>
              <option value="cheque">Cheque</option>
            </select>
          </Field>
        </div>
      </SectionCard>
    </>
  );

  const renderContribution = () => (
    <>
      <SectionCard title="Cotización y SILTRA" description="Configuración predeterminada para ejercicios y ficheros simulados. No realiza envíos reales.">
        <div style={styles.toggleGrid}>
          <Toggle label="Generar simulación SILTRA" checked={form.contribution.siltra_enabled} onChange={(value) => updateSection("contribution", "siltra_enabled", value)} />
          <Toggle label="Relación contable" checked={form.contribution.accounting_relation} onChange={(value) => updateSection("contribution", "accounting_relation", value)} />
          <Toggle label="Cotización con pago centralizado" checked={form.contribution.centralized_payment} onChange={(value) => updateSection("contribution", "centralized_payment", value)} />
          <Toggle label="Identificación mediante membrete" checked={form.contribution.letterhead_identification} onChange={(value) => updateSection("contribution", "letterhead_identification", value)} />
        </div>
        <div style={styles.grid}>
          <Field label="Modalidad de pago">
            <select value={form.contribution.payment_mode} onChange={(event) => updateSection("contribution", "payment_mode", event.target.value)} style={styles.input}>
              <option value="direct_debit">Cargo en cuenta</option>
              <option value="electronic_payment">Pago electrónico</option>
            </select>
          </Field>
          <Field label="Nº de autorización"><input value={form.contribution.authorization_number} onChange={(event) => updateSection("contribution", "authorization_number", event.target.value)} style={styles.input} /></Field>
          <Field label="Fecha de autorización"><input type="date" value={form.contribution.authorization_date} onChange={(event) => updateSection("contribution", "authorization_date", event.target.value)} style={styles.input} /></Field>
          <Field label="Datos impresos en boletines">
            <select value={form.contribution.bulletin_data_source} onChange={(event) => updateSection("contribution", "bulletin_data_source", event.target.value)} style={styles.input}>
              <option value="company">De la empresa</option>
              <option value="registered_office">Del domicilio social</option>
            </select>
          </Field>
          <Field label="Bonificación sectorial">
            <select value={form.contribution.sector_bonus} onChange={(event) => updateSection("contribution", "sector_bonus", event.target.value)} style={styles.input}>
              <option value="">Sin bonificación sectorial</option>
              <option value="textile">Industria textil</option>
              <option value="furniture">Mueble</option>
              <option value="leather_goods">Marroquinería</option>
              <option value="toy">Juguetería</option>
              <option value="research">Investigación</option>
              <option value="tourism">Turismo</option>
              <option value="sports_club">Club deportivo</option>
            </select>
          </Field>
        </div>
      </SectionCard>
      <SectionCard title="Exclusiones y particularidades">
        <div style={styles.toggleGrid}>
          <Toggle label="Exclusión I.T." checked={form.contribution.exclusion_it} onChange={(value) => updateSection("contribution", "exclusion_it", value)} />
          <Toggle label="Exclusión FOGASA" checked={form.contribution.exclusion_fogasa} onChange={(value) => updateSection("contribution", "exclusion_fogasa", value)} />
          <Toggle label="Exclusión funcionarios integrados" checked={form.contribution.exclusion_integrated_officials} onChange={(value) => updateSection("contribution", "exclusion_integrated_officials", value)} />
          <Toggle label="Resolución 25/05/2010" checked={form.contribution.resolution_2010_05_25} onChange={(value) => updateSection("contribution", "resolution_2010_05_25", value)} />
          <Toggle label="Bonificación Ceuta/Melilla" checked={form.contribution.ceuta_melilla_bonus} onChange={(value) => updateSection("contribution", "ceuta_melilla_bonus", value)} />
          <Toggle label="Plus trabajadores" checked={form.contribution.worker_surcharge} onChange={(value) => updateSection("contribution", "worker_surcharge", value)} />
          <Toggle label="Supresión extra Navidad" checked={form.contribution.christmas_extra_suppression} onChange={(value) => updateSection("contribution", "christmas_extra_suppression", value)} />
          <Toggle label="Policías locales" checked={form.contribution.local_police} onChange={(value) => updateSection("contribution", "local_police", value)} />
          <Toggle label="PD 1" checked={form.contribution.pd_1} onChange={(value) => updateSection("contribution", "pd_1", value)} />
          <Toggle label="PD 2" checked={form.contribution.pd_2} onChange={(value) => updateSection("contribution", "pd_2", value)} />
          <Toggle label="IT" checked={form.contribution.it} onChange={(value) => updateSection("contribution", "it", value)} />
          <Toggle label="Trimestral" checked={form.contribution.quarterly} onChange={(value) => updateSection("contribution", "quarterly", value)} />
          <Toggle label="No enviar horas de formación" checked={form.contribution.skip_training_hours} onChange={(value) => updateSection("contribution", "skip_training_hours", value)} />
        </div>
      </SectionCard>
    </>
  );

  const renderWithholding = () => (
    <SectionCard title="Retenciones" description="Valores predeterminados para simulaciones de los modelos 111 y 190.">
      <div style={styles.grid}>
        <Field label="Periodicidad Modelo 111">
          <select value={form.withholding.periodicity} onChange={(event) => updateSection("withholding", "periodicity", event.target.value)} style={styles.input}>
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
          </select>
        </Field>
      </div>
      <div style={styles.toggleGrid}>
        <Toggle label="Modelo 111 agrupado mismo NIF" checked={form.withholding.model_111_same_nif} onChange={(value) => updateSection("withholding", "model_111_same_nif", value)} />
        <Toggle label="Modelo 190 agrupado mismo NIF" checked={form.withholding.model_190_same_nif} onChange={(value) => updateSection("withholding", "model_190_same_nif", value)} />
        <Toggle label="190 soporte colectivo" checked={form.withholding.model_190_collective_media} onChange={(value) => updateSection("withholding", "model_190_collective_media", value)} />
        <Toggle label="Ingreso a cuenta imputable a empresa" checked={form.withholding.company_assumes_payment_on_account} onChange={(value) => updateSection("withholding", "company_assumes_payment_on_account", value)} />
        <Toggle label="111 fichero por domiciliación" checked={form.withholding.model_111_direct_debit_file} onChange={(value) => updateSection("withholding", "model_111_direct_debit_file", value)} />
        <Toggle label="190: conceptos solo cotizar como otras rentas exentas" checked={form.withholding.model_190_other_exempt_income} onChange={(value) => updateSection("withholding", "model_190_other_exempt_income", value)} />
        <Toggle label="Cálculo IRPF agrupado distinto NIF" checked={form.withholding.grouped_irpf_different_nif} onChange={(value) => updateSection("withholding", "grouped_irpf_different_nif", value)} />
      </div>
    </SectionCard>
  );

  const renderPayroll = () => (
    <>
      <SectionCard title="Reglas de confección" description="Las reglas particulares de empresa prevalecen sobre el convenio cuando se seleccionan expresamente.">
        <div style={styles.grid}>
          <Field label="Confeccionar en procesos">
            <select value={form.payroll.preparation_mode} onChange={(event) => updateSection("payroll", "preparation_mode", event.target.value)} style={styles.input}>
              <option value="general">Generales</option>
              <option value="individual">Individual</option>
            </select>
          </Field>
          <Field label="Antigüedad"><SourceSelect value={form.payroll.seniority_source} onChange={(value) => updateSection("payroll", "seniority_source", value)} /></Field>
          <Field label="Vacaciones"><SourceSelect value={form.payroll.holidays_source} onChange={(value) => updateSection("payroll", "holidays_source", value)} /></Field>
          <Field label="Pagas extras"><SourceSelect value={form.payroll.extra_pay_source} onChange={(value) => updateSection("payroll", "extra_pay_source", value)} /></Field>
          <Field label="Indemnizaciones"><SourceSelect value={form.payroll.indemnities_source} onChange={(value) => updateSection("payroll", "indemnities_source", value)} /></Field>
          <Field label="Complementos I.T."><SourceSelect value={form.payroll.it_complements_source} onChange={(value) => updateSection("payroll", "it_complements_source", value)} /></Field>
          <Field label="Día de cierre de incidencias"><input type="number" min="1" max="31" value={form.payroll.incident_closing_day} onChange={(event) => updateSection("payroll", "incident_closing_day", Number(event.target.value))} style={styles.input} /></Field>
          <Field label="Método de redondeo">
            <select value={form.payroll.rounding_mode} onChange={(event) => updateSection("payroll", "rounding_mode", event.target.value)} style={styles.input}>
              <option value="two_decimals">Dos decimales</option>
              <option value="commercial">Redondeo comercial</option>
              <option value="truncate">Truncar</option>
            </select>
          </Field>
          <Field label="Tratamiento de retroactivos">
            <select value={form.payroll.retroactive_mode} onChange={(event) => updateSection("payroll", "retroactive_mode", event.target.value)} style={styles.input}>
              <option value="separate_payroll">Nómina separada</option>
              <option value="current_payroll">Integrar en nómina actual</option>
            </select>
          </Field>
        </div>
      </SectionCard>
      <SectionCard title="Opciones de cálculo">
        <div style={styles.toggleGrid}>
          <Toggle label="Prorratear pagas extras en nuevas contrataciones" checked={form.payroll.prorate_extra_pay_new_hires} onChange={(value) => updateSection("payroll", "prorate_extra_pay_new_hires", value)} />
          <Toggle label="Particularizar denominación de percepciones" checked={form.payroll.individualize_earning_names} onChange={(value) => updateSection("payroll", "individualize_earning_names", value)} />
          <Toggle label="Permitir recálculo de nóminas" checked={form.payroll.allow_recalculation} onChange={(value) => updateSection("payroll", "allow_recalculation", value)} />
          <Toggle label="Bloquear después del cierre" checked={form.payroll.block_after_closure} onChange={(value) => updateSection("payroll", "block_after_closure", value)} />
        </div>
      </SectionCard>
    </>
  );

  const renderDocuments = () => (
    <>
      <SectionCard title="Impresión del recibo de salarios">
        <div style={styles.grid}>
          <Field label="Domicilio mostrado">
            <select value={form.documents.address_source} onChange={(event) => updateSection("documents", "address_source", event.target.value)} style={styles.input}>
              <option value="registered_office">Domicilio social</option>
              <option value="center">Domicilio del centro</option>
            </select>
          </Field>
          <Field label="Denominación mostrada">
            <select value={form.documents.denomination_source} onChange={(event) => updateSection("documents", "denomination_source", event.target.value)} style={styles.input}>
              <option value="company">Empresa</option>
              <option value="registered_office">Domicilio social</option>
            </select>
          </Field>
          <Field label="Orden de emisión">
            <select value={form.documents.payroll_order} onChange={(event) => updateSection("documents", "payroll_order", event.target.value)} style={styles.input}>
              <option value="alphabetical">Alfabético</option>
              <option value="number">Número</option>
            </select>
          </Field>
          <Field label="Registro de jornada">
            <select value={form.documents.journey_register_mode} onChange={(event) => updateSection("documents", "journey_register_mode", event.target.value)} style={styles.input}>
              <option value="blank">En blanco</option>
              <option value="days">Número de días</option>
            </select>
          </Field>
          <Field label="Texto del pie" wide>
            <textarea value={form.documents.footer_text} onChange={(event) => updateSection("documents", "footer_text", event.target.value)} style={styles.textarea} />
          </Field>
        </div>
      </SectionCard>
      <SectionCard title="Información visible">
        <div style={styles.toggleGrid}>
          <Toggle label="Modalidad de cobro" checked={form.documents.show_collection_method} onChange={(value) => updateSection("documents", "show_collection_method", value)} />
          <Toggle label="Edad" checked={form.documents.show_age} onChange={(value) => updateSection("documents", "show_age", value)} />
          <Toggle label="Fin de contrato" checked={form.documents.show_contract_end} onChange={(value) => updateSection("documents", "show_contract_end", value)} />
          <Toggle label="Acumulados de IRPF" checked={form.documents.show_irpf_accumulated} onChange={(value) => updateSection("documents", "show_irpf_accumulated", value)} />
          <Toggle label="Conceptos agrupados" checked={form.documents.group_concepts} onChange={(value) => updateSection("documents", "group_concepts", value)} />
          <Toggle label="Agrupar solo autónomos" checked={form.documents.group_only_self_employed} onChange={(value) => updateSection("documents", "group_only_self_employed", value)} />
          <Toggle label="Registro horario" checked={form.documents.show_time_register} onChange={(value) => updateSection("documents", "show_time_register", value)} />
          <Toggle label="Desglose del importe" checked={form.documents.show_amount_breakdown} onChange={(value) => updateSection("documents", "show_amount_breakdown", value)} />
          <Toggle label="Mensuales agrupados" checked={form.documents.group_monthly} onChange={(value) => updateSection("documents", "group_monthly", value)} />
          <Toggle label="Mensuales agrupados por CCC" checked={form.documents.group_monthly_by_ccc} onChange={(value) => updateSection("documents", "group_monthly_by_ccc", value)} />
          <Toggle label="Imprimir solo cotizar" checked={form.documents.print_contribution_only} onChange={(value) => updateSection("documents", "print_contribution_only", value)} />
          <Toggle label="Enmascarar IBAN" checked={form.documents.mask_iban} onChange={(value) => updateSection("documents", "mask_iban", value)} />
          <Toggle label="Mostrar centro" checked={form.documents.show_center} onChange={(value) => updateSection("documents", "show_center", value)} />
          <Toggle label="Mostrar convenio y categoría" checked={form.documents.show_agreement_category} onChange={(value) => updateSection("documents", "show_agreement_category", value)} />
          <Toggle label="Marca de agua de simulación" checked={form.documents.simulation_watermark} onChange={(value) => updateSection("documents", "simulation_watermark", value)} />
        </div>
      </SectionCard>
    </>
  );

  const renderCorporateIdentity = () => (
    <SectionCard title="Anagrama y firma" description="Los recursos se guardan en la configuración de esta empresa y se muestran en la vista previa.">
      <div style={styles.assetGrid}>
        <div style={styles.assetCard}>
          <strong>Anagrama</strong>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readImage(event.target.files?.[0], "logo_data_url", "logo_name")} />
          <span style={styles.hint}>{form.corporate_identity.logo_name || "Sin archivo"}</span>
          {form.corporate_identity.logo_data_url && <img src={form.corporate_identity.logo_data_url} alt="Anagrama" style={styles.logoPreview} />}
          <Toggle label="Mostrar en documentos" checked={form.corporate_identity.show_logo} onChange={(value) => updateSection("corporate_identity", "show_logo", value)} />
        </div>
        <div style={styles.assetCard}>
          <strong>Firma</strong>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readImage(event.target.files?.[0], "signature_data_url", "signature_name")} />
          <span style={styles.hint}>{form.corporate_identity.signature_name || "Sin archivo"}</span>
          {form.corporate_identity.signature_data_url && <img src={form.corporate_identity.signature_data_url} alt="Firma" style={styles.signaturePreview} />}
          <Toggle label="Mostrar en documentos" checked={form.corporate_identity.show_signature} onChange={(value) => updateSection("corporate_identity", "show_signature", value)} />
        </div>
      </div>
      <div style={styles.documentPreview}>
        <div style={styles.previewHeader}>
          {form.corporate_identity.show_logo && form.corporate_identity.logo_data_url ? <img src={form.corporate_identity.logo_data_url} alt="" style={styles.previewLogo} /> : <div style={styles.previewPlaceholder}>ANAGRAMA</div>}
          <div><strong>{selectedCompany?.name || "Empresa"}</strong><small style={styles.previewText}>Recibo de salarios · Documento de simulación</small></div>
        </div>
        <div style={styles.previewLines}><span /><span /><span /></div>
        {form.corporate_identity.show_signature && form.corporate_identity.signature_data_url && <img src={form.corporate_identity.signature_data_url} alt="" style={styles.previewSignature} />}
      </div>
    </SectionCard>
  );

  const renderLanguage = () => (
    <SectionCard title="Idioma predeterminado" description="Se aplicará a documentos y pantallas configurables de esta empresa.">
      <div style={styles.grid}>
        <Field label="Idioma">
          <select value={form.language.default_language} onChange={(event) => updateSection("language", "default_language", event.target.value)} style={styles.input}>
            <option value="es">Castellano</option>
            <option value="ca">Catalán</option>
            <option value="eu">Euskera</option>
            <option value="gl">Gallego</option>
            <option value="en">Inglés</option>
          </select>
        </Field>
      </div>
    </SectionCard>
  );

  const tabContent = {
    general: renderGeneral,
    contribution: renderContribution,
    withholding: renderWithholding,
    payroll: renderPayroll,
    documents: renderDocuments,
    corporate_identity: renderCorporateIdentity,
    language: renderLanguage,
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <div style={styles.companySelector}>
          <label style={styles.label}>Empresa</label>
          <select value={selectedCompanyId || ""} onChange={(event) => onSelectedCompanyChange(event.target.value)} style={styles.companySelect}>
            <option value="">Selecciona una empresa</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name} · {company.cif}</option>)}
          </select>
        </div>
        <div style={styles.toolbarMeta}>
          {selectedCompany && <span style={styles.statusPill}>{form.general.configuration_mode === "own" ? "Configuración propia" : "Configuración heredada"}</span>}
          {form.updated_at && <small>Actualizado: {new Date(form.updated_at).toLocaleString("es-ES")}</small>}
          <button type="button" onClick={handleSave} disabled={!selectedCompanyId || saving || loading} style={styles.saveButton}>{saving ? "Guardando..." : "Guardar cambios"}</button>
        </div>
      </div>

      {!selectedCompanyId && <div style={styles.emptyState}>Selecciona una empresa para consultar o modificar sus preferencias.</div>}
      {selectedCompanyId && (
        <div style={styles.contentLayout}>
          <nav style={styles.sideTabs}>
            {TABS.map(([key, label]) => (
              <button key={key} type="button" onClick={() => setActiveTab(key)} style={activeTab === key ? styles.sideTabActive : styles.sideTab}>{label}</button>
            ))}
          </nav>
          <div style={styles.content}>
            {loading ? <div style={styles.emptyState}>Cargando preferencias...</div> : tabContent[activeTab]()}
            {error && <p style={styles.error}>{error}</p>}
            {success && <p style={styles.success}>{success}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "18px" },
  toolbar: { display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-end", padding: "16px", border: "1px solid #e5e7eb", borderRadius: "10px", backgroundColor: "#f9fafb", flexWrap: "wrap" },
  companySelector: { display: "flex", flexDirection: "column", gap: "6px", minWidth: "340px", flex: 1 },
  companySelect: { width: "100%", minHeight: "40px", border: "1px solid #cbd5e1", borderRadius: "7px", padding: "8px 10px", backgroundColor: "#fff" },
  toolbarMeta: { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
  statusPill: { padding: "5px 9px", borderRadius: "999px", backgroundColor: "#fef3c7", color: "#92400e", fontWeight: 800, fontSize: "12px" },
  saveButton: { border: "1px solid #111827", backgroundColor: "#111827", color: "#fff", borderRadius: "7px", padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
  contentLayout: { display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: "18px", alignItems: "start" },
  sideTabs: { display: "flex", flexDirection: "column", gap: "5px", border: "1px solid #e5e7eb", borderRadius: "9px", padding: "8px", backgroundColor: "#fff", position: "sticky", top: "16px" },
  sideTab: { textAlign: "left", border: "0", borderRadius: "6px", padding: "10px 12px", backgroundColor: "transparent", color: "#475569", cursor: "pointer", fontWeight: 800 },
  sideTabActive: { textAlign: "left", border: "0", borderRadius: "6px", padding: "10px 12px", backgroundColor: "#111827", color: "#fff", cursor: "pointer", fontWeight: 900 },
  content: { minWidth: 0, display: "flex", flexDirection: "column", gap: "14px" },
  sectionCard: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "18px", backgroundColor: "#fff", display: "flex", flexDirection: "column", gap: "16px" },
  sectionHeading: { borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" },
  sectionTitle: { margin: 0, fontSize: "17px", color: "#111827" },
  sectionDescription: { margin: "5px 0 0", color: "#64748b", fontSize: "13px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "14px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 },
  fieldWide: { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0, gridColumn: "1 / -1" },
  label: { fontSize: "12px", fontWeight: 900, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" },
  hint: { fontSize: "12px", color: "#64748b" },
  input: { minHeight: "38px", width: "100%", border: "1px solid #cbd5e1", borderRadius: "7px", padding: "8px 10px", backgroundColor: "#fff", boxSizing: "border-box" },
  textarea: { minHeight: "86px", width: "100%", border: "1px solid #cbd5e1", borderRadius: "7px", padding: "9px 10px", resize: "vertical", boxSizing: "border-box" },
  toggleGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "8px" },
  toggleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 12px", backgroundColor: "#f8fafc" },
  toggleLabel: { display: "block", color: "#334155", fontSize: "13px" },
  toggleHint: { display: "block", color: "#64748b", marginTop: "3px" },
  assetGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" },
  assetCard: { border: "1px solid #e5e7eb", borderRadius: "9px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" },
  logoPreview: { maxWidth: "180px", maxHeight: "90px", objectFit: "contain", alignSelf: "center" },
  signaturePreview: { maxWidth: "220px", maxHeight: "90px", objectFit: "contain", alignSelf: "center" },
  documentPreview: { marginTop: "4px", minHeight: "220px", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "20px", backgroundColor: "#fff", position: "relative" },
  previewHeader: { display: "flex", gap: "16px", alignItems: "center", borderBottom: "2px solid #111827", paddingBottom: "12px" },
  previewLogo: { width: "90px", height: "50px", objectFit: "contain" },
  previewPlaceholder: { width: "90px", height: "50px", display: "grid", placeItems: "center", border: "1px dashed #94a3b8", fontSize: "10px", color: "#64748b" },
  previewText: { display: "block", color: "#64748b", marginTop: "4px" },
  previewLines: { display: "flex", flexDirection: "column", gap: "14px", marginTop: "28px" },
  previewSignature: { position: "absolute", right: "28px", bottom: "22px", maxWidth: "150px", maxHeight: "65px", objectFit: "contain" },
  emptyState: { padding: "34px", border: "1px dashed #cbd5e1", borderRadius: "10px", textAlign: "center", color: "#64748b", backgroundColor: "#f8fafc" },
  error: { margin: 0, padding: "10px 12px", borderRadius: "7px", backgroundColor: "#fef2f2", color: "#b91c1c", fontWeight: 700 },
  success: { margin: 0, padding: "10px 12px", borderRadius: "7px", backgroundColor: "#f0fdf4", color: "#166534", fontWeight: 700 },
};
