import { useMemo, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Field,
  Form,
  FormActions,
  FormGrid,
  FormOption,
  FormOptions,
  FormPresetBar,
  FormSection,
  Input,
  Select,
} from "../ui";
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

function TextInput({ name, form, onChange, type = "text", required = false }) {
  return (
    <Input
      name={name}
      value={form[name] || ""}
      onChange={onChange}
      type={type}
      required={required}
    />
  );
}

function MutualSelect({ name, value, onChange }) {
  return (
    <Select name={name} value={value} onChange={onChange}>
      <option value="">Seleccionar mutua</option>
      {MUTUALS.map((mutual) => (
        <option key={mutual} value={mutual}>{mutual}</option>
      ))}
    </Select>
  );
}

export default function CompanyMasterCreateForm({ collectiveAgreements = [], onCreated, onOpenPreferences }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdCompany, setCreatedCompany] = useState(null);

  const agreementOptions = useMemo(
    () => collectiveAgreements.filter((agreement) => agreement.is_active !== false),
    [collectiveAgreements]
  );

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
    <Form onSubmit={handleSubmit}>
      <FormSection
        eyebrow="Alta de empresa"
        title="Ficha maestra"
        description="Introduce primero los datos estructurales. Los parámetros de cálculo, SILTRA, retenciones e impresión se completan después en Preferencias."
        actions={<Badge tone="brand">Datos maestros</Badge>}
      >
        <FormPresetBar>
          {Object.entries(DEMOS).map(([key, demo]) => (
            <Button key={key} type="button" variant="secondary" size="sm" onClick={() => loadDemo(key)}>
              {demo.label}
            </Button>
          ))}
        </FormPresetBar>
      </FormSection>

      <FormSection
        title="Identificación y estado"
        description="Datos necesarios para reconocer la empresa y situarla dentro del entorno laboral."
      >
        <FormGrid columns={3}>
          <Field label="Nombre de empresa" required>
            <TextInput name="name" form={form} onChange={handleChange} required />
          </Field>
          <Field label="CIF" required>
            <TextInput name="cif" form={form} onChange={handleChange} required />
          </Field>
          <Field label="Estado">
            <Select name="status" value={form.status} onChange={handleChange}>
              <option value="alta">Alta</option>
              <option value="baja_temporal">Baja temporal</option>
              <option value="baja_definitiva">Baja definitiva</option>
            </Select>
          </Field>
          <Field label="Fecha de alta">
            <TextInput name="registration_date" form={form} onChange={handleChange} type="date" />
          </Field>
          <Field label="Fecha de baja">
            <TextInput name="deregistration_date" form={form} onChange={handleChange} type="date" />
          </Field>
          <Field label="Tipo de empresa">
            <Select name="company_type" value={form.company_type} onChange={handleChange}>
              <option value="privada">Privada</option>
              <option value="publica">Pública</option>
              <option value="privada_sin_lucro">Privada sin lucro</option>
              <option value="corporaciones">Corporaciones</option>
              <option value="ett">ETT</option>
              <option value="sociedad_laboral_privada">Sociedad laboral privada</option>
            </Select>
          </Field>
          <Field label="CCC régimen" hint="Régimen general habitual: 0111.">
            <TextInput name="ccc_regime" form={form} onChange={handleChange} />
          </Field>
          <Field label="CCC código">
            <TextInput name="ccc_code" form={form} onChange={handleChange} />
          </Field>
          <Field
            label="Convenio principal"
            hint="Solo se muestran convenios ya creados en el módulo de Convenios."
            className="an-form-field--wide"
          >
            <Select name="main_collective_agreement" value={form.main_collective_agreement} onChange={handleChange}>
              <option value="">Sin convenio asignado</option>
              {agreementOptions.map((agreement) => (
                <option key={agreement.id} value={agreement.name}>
                  {agreement.name}{agreement.agreement_code ? ` · ${agreement.agreement_code}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>

        <FormOptions>
          <FormOption
            name="is_cooperative"
            checked={form.is_cooperative}
            onChange={handleChange}
            label="Sociedad cooperativa"
            description="Activa el tratamiento específico de esta forma jurídica."
          />
          <FormOption
            name="special_work_income_withholding"
            checked={form.special_work_income_withholding}
            onChange={handleChange}
            label="Cálculo especial de retenciones"
            description="Marca empresas con reglas particulares sobre rendimientos del trabajo."
          />
        </FormOptions>
      </FormSection>

      <FormSection
        title="Domicilio social y contacto"
        description="Información corporativa utilizada en documentos, comunicaciones y fichas de empresa."
      >
        <FormGrid columns={3}>
          <Field label="Domicilio social" className="an-form-field--wide">
            <TextInput name="address" form={form} onChange={handleChange} />
          </Field>
          <Field label="Localidad">
            <TextInput name="city" form={form} onChange={handleChange} />
          </Field>
          <Field label="Provincia">
            <TextInput name="province" form={form} onChange={handleChange} />
          </Field>
          <Field label="Teléfono">
            <TextInput name="company_phone" form={form} onChange={handleChange} />
          </Field>
          <Field label="Correo electrónico">
            <TextInput name="company_email" form={form} onChange={handleChange} type="email" />
          </Field>
          <Field label="Sitio web">
            <TextInput name="company_website" form={form} onChange={handleChange} />
          </Field>
          <Field label="Persona de contacto">
            <TextInput name="company_contact_person" form={form} onChange={handleChange} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection
        title="Representante legal y actividad"
        description="Representación de la entidad y clasificación de su actividad económica."
      >
        <FormGrid columns={3}>
          <Field label="Nombre y apellidos">
            <TextInput name="legal_representative_name" form={form} onChange={handleChange} />
          </Field>
          <Field label="DNI">
            <TextInput name="legal_representative_dni" form={form} onChange={handleChange} />
          </Field>
          <Field label="Puesto">
            <TextInput name="legal_representative_position" form={form} onChange={handleChange} />
          </Field>
          <Field label="CNAE 2009 código">
            <TextInput name="cnae_2009_code" form={form} onChange={handleChange} />
          </Field>
          <Field label="CNAE 2009 denominación" className="an-form-field--span-2">
            <TextInput name="cnae_2009_name" form={form} onChange={handleChange} />
          </Field>
          <Field label="CNAE 2025 código">
            <TextInput name="cnae_2025_code" form={form} onChange={handleChange} />
          </Field>
          <Field label="CNAE 2025 denominación" className="an-form-field--span-2">
            <TextInput name="cnae_2025_name" form={form} onChange={handleChange} />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection
        title="Mutuas, seguros y previsión social"
        description="Coberturas asociadas a contingencias profesionales, incapacidad temporal y beneficios colectivos."
      >
        <FormGrid columns={3}>
          <Field label="Mutua contingencias profesionales">
            <MutualSelect
              name="professional_contingencies_mutual"
              value={form.professional_contingencies_mutual}
              onChange={handleChange}
            />
          </Field>
          <Field label="Nº póliza CP">
            <TextInput name="professional_contingencies_policy" form={form} onChange={handleChange} />
          </Field>
          <Field label="Fecha efecto CP">
            <TextInput name="professional_contingencies_effective_date" form={form} onChange={handleChange} type="date" />
          </Field>
          <Field label="Mutua incapacidad temporal">
            <MutualSelect name="common_it_mutual" value={form.common_it_mutual} onChange={handleChange} />
          </Field>
          <Field label="Nº póliza IT">
            <TextInput name="common_it_policy" form={form} onChange={handleChange} />
          </Field>
          <Field label="Fecha efecto IT">
            <TextInput name="common_it_effective_date" form={form} onChange={handleChange} type="date" />
          </Field>
        </FormGrid>

        <FormOptions>
          <FormOption
            name="collective_insurance_enabled"
            checked={form.collective_insurance_enabled}
            onChange={handleChange}
            label="Seguro colectivo de convenio"
            description="Muestra los datos de aseguradora, póliza y capital."
          />
          <FormOption
            name="pension_plan_enabled"
            checked={form.pension_plan_enabled}
            onChange={handleChange}
            label="Plan de pensiones"
            description="Muestra los datos de la entidad gestora y del plan."
          />
        </FormOptions>

        {form.collective_insurance_enabled && (
          <FormGrid columns={3}>
            <Field label="Aseguradora">
              <TextInput name="collective_insurance_company" form={form} onChange={handleChange} />
            </Field>
            <Field label="Nº póliza">
              <TextInput name="collective_insurance_policy" form={form} onChange={handleChange} />
            </Field>
            <Field label="Capital asegurado">
              <TextInput name="collective_insurance_capital" form={form} onChange={handleChange} />
            </Field>
          </FormGrid>
        )}

        {form.pension_plan_enabled && (
          <FormGrid columns={3}>
            <Field label="Clave entidad gestora">
              <TextInput name="pension_manager_key" form={form} onChange={handleChange} />
            </Field>
            <Field label="Número entidad gestora">
              <TextInput name="pension_manager_entity_number" form={form} onChange={handleChange} />
            </Field>
            <Field label="Denominación del plan">
              <TextInput name="pension_plan_name" form={form} onChange={handleChange} />
            </Field>
          </FormGrid>
        )}
      </FormSection>

      <FormSection
        title="Calendario y datos financieros"
        description="Configuración inicial de calendario, domiciliación y régimen fiscal."
      >
        <FormGrid columns={2}>
          <Field label="Modo de calendario">
            <Select name="work_calendar_mode" value={form.work_calendar_mode} onChange={handleChange}>
              <option value="new">Calendario propio</option>
              <option value="existing">Calendario existente</option>
            </Select>
          </Field>
          <Field label="Nombre del calendario">
            <TextInput name="work_calendar_name" form={form} onChange={handleChange} />
          </Field>
          <Field label="IBAN">
            <TextInput name="bank_iban" form={form} onChange={handleChange} />
          </Field>
          <Field label="Régimen fiscal">
            <Select name="fiscal_regime" value={form.fiscal_regime} onChange={handleChange}>
              <option value="estimacion_directa">Estimación directa</option>
              <option value="modulos">Módulos</option>
              <option value="plan_general_contable">Plan general contable</option>
            </Select>
          </Field>
        </FormGrid>
      </FormSection>

      {error && (
        <Alert tone="danger" title="No se ha podido crear la empresa">
          {error}
        </Alert>
      )}

      {createdCompany && (
        <Alert
          tone="success"
          title="Empresa creada"
          actions={(
            <Button type="button" variant="secondary" size="sm" onClick={() => onOpenPreferences?.(createdCompany)}>
              Configurar preferencias
            </Button>
          )}
        >
          {createdCompany.name} ya está disponible en el entorno.
        </Alert>
      )}

      <FormActions note="Los campos marcados como obligatorios deben completarse antes de guardar." sticky>
        <Button type="submit" loading={submitting}>
          Crear empresa
        </Button>
      </FormActions>
    </Form>
  );
}
