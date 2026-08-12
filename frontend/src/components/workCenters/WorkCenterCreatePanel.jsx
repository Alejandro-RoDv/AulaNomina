import { useEffect, useMemo, useState } from "react";

import { createWorkCenter } from "../../services/workCenterApi";
import "./workCenterSplit42.css";

const EMPTY_FORM = {
  name: "",
  general_ccc: "",
  main_ccc: "",
  address: "",
  city: "",
  province: "",
  collective_agreement: "",
  phone: "",
  fax: "",
  mobile: "",
  email: "",
  website: "",
};

function nextCenterCode(companyId, workCenters) {
  const companyCenters = workCenters.filter((center) => String(center.company_id) === String(companyId));
  const usedSuffixes = companyCenters
    .map((center) => Number(String(center.center_code || "").split(".").pop()))
    .filter((value) => Number.isFinite(value));
  const suffix = usedSuffixes.length ? Math.max(...usedSuffixes) + 1 : 1;
  return `${companyId}.${suffix}`;
}

function agreementLabel(agreement) {
  return `${agreement.name}${agreement.agreement_code ? ` · ${agreement.agreement_code}` : ""}`;
}

export default function WorkCenterCreatePanel({
  companies,
  workCenters,
  collectiveAgreements = [],
  selectedCompanyId,
  onSelectedCompanyChange,
  onCreated,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeCompanies = useMemo(
    () => companies.filter((company) => company.is_active !== false),
    [companies]
  );
  const agreements = useMemo(
    () => collectiveAgreements.filter((agreement) => agreement.is_active !== false),
    [collectiveAgreements]
  );
  const selectedCompany = activeCompanies.find(
    (company) => String(company.id) === String(selectedCompanyId)
  );

  useEffect(() => {
    if (!selectedCompany) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm((current) => ({
      ...current,
      general_ccc: current.general_ccc || selectedCompany.ccc || "",
      address: current.address || selectedCompany.address || "",
      city: current.city || selectedCompany.city || "",
      province: current.province || selectedCompany.province || "",
      collective_agreement: current.collective_agreement || selectedCompany.main_collective_agreement || "",
    }));
  }, [selectedCompany]);

  const changeCompany = (event) => {
    setError("");
    setSuccess("");
    setForm(EMPTY_FORM);
    onSelectedCompanyChange?.(event.target.value);
  };

  const change = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setSuccess("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedCompany) {
      setError("Selecciona una empresa antes de crear el centro.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const center = await createWorkCenter({
        company_id: Number(selectedCompany.id),
        center_code: nextCenterCode(selectedCompany.id, workCenters),
        name: form.name.trim(),
        general_ccc: form.general_ccc || selectedCompany.ccc || null,
        main_ccc: form.main_ccc || null,
        address: form.address || selectedCompany.address || null,
        city: form.city || selectedCompany.city || null,
        province: form.province || selectedCompany.province || null,
        collective_agreement: form.collective_agreement || selectedCompany.main_collective_agreement || null,
        phone: form.phone || null,
        fax: form.fax || null,
        mobile: form.mobile || null,
        email: form.email || null,
        website: form.website || null,
      });
      setSuccess(`Centro creado: ${center.name}.`);
      setForm({
        ...EMPTY_FORM,
        general_ccc: selectedCompany.ccc || "",
        address: selectedCompany.address || "",
        city: selectedCompany.city || "",
        province: selectedCompany.province || "",
        collective_agreement: selectedCompany.main_collective_agreement || "",
      });
      await onCreated?.(center, selectedCompany.id);
    } catch (requestError) {
      setError(requestError.message || "No se pudo crear el centro de trabajo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="work-center-create-form">
      <div className="work-center-create-form__grid">
        <Field label="Empresa asociada" span="6">
          <select value={selectedCompanyId || ""} onChange={changeCompany} required>
            <option value="">Seleccionar empresa</option>
            {activeCompanies.map((company) => (
              <option key={company.id} value={company.id}>{company.name} · {company.cif}</option>
            ))}
          </select>
        </Field>

        <Field label="Nombre del centro" span="6">
          <input name="name" value={form.name} onChange={change} required placeholder="Ej. Colegio San Rafael" />
        </Field>

        <Field label="Convenio aplicable" span="6">
          <select name="collective_agreement" value={form.collective_agreement} onChange={change}>
            <option value="">Heredar convenio de la empresa</option>
            {agreements.map((agreement) => (
              <option key={agreement.id} value={agreement.name}>{agreementLabel(agreement)}</option>
            ))}
          </select>
          <small>Por defecto se propone el convenio principal de la empresa.</small>
        </Field>

        <Field label="CCC de empresa" span="3">
          <input name="general_ccc" value={form.general_ccc} onChange={change} />
        </Field>

        <Field label="CCC del centro" span="3">
          <input name="main_ccc" value={form.main_ccc} onChange={change} />
        </Field>

        <div className="work-center-create-form__divider" aria-hidden="true" />

        <div className="work-center-create-form__section-heading">
          <strong>Ubicación y contacto</strong>
          <span>Datos propios del centro de trabajo.</span>
        </div>

        <Field label="Domicilio del centro" span="12">
          <input name="address" value={form.address} onChange={change} />
        </Field>
        <Field label="Localidad" span="2"><input name="city" value={form.city} onChange={change} /></Field>
        <Field label="Provincia" span="2"><input name="province" value={form.province} onChange={change} /></Field>
        <Field label="Teléfono" span="2"><input name="phone" value={form.phone} onChange={change} /></Field>
        <Field label="Móvil" span="2"><input name="mobile" value={form.mobile} onChange={change} /></Field>
        <Field label="Correo electrónico" span="2"><input type="email" name="email" value={form.email} onChange={change} /></Field>
        <Field label="Sitio web" span="2"><input name="website" value={form.website} onChange={change} /></Field>
      </div>

      {error && <div className="work-center-create-form__error">{error}</div>}
      {success && <div className="work-center-create-form__success">{success}</div>}

      <div className="work-center-create-form__actions">
        <button type="submit" disabled={submitting || !selectedCompanyId}>
          {submitting ? "Guardando..." : "Crear centro"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, span = "3", children }) {
  return (
    <label className={`work-center-create-form__field work-center-create-form__field--span-${span}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
