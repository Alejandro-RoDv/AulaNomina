import { useEffect, useMemo, useState } from "react";

import { createWorkCenter } from "../../services/workCenterApi";

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
    <form onSubmit={submit} style={styles.form}>
      <div style={styles.grid}>
        <Field label="Empresa asociada" wide>
          <select value={selectedCompanyId || ""} onChange={changeCompany} required style={styles.input}>
            <option value="">Seleccionar empresa</option>
            {activeCompanies.map((company) => (
              <option key={company.id} value={company.id}>{company.name} · {company.cif}</option>
            ))}
          </select>
        </Field>
        <Field label="Nombre del centro" wide>
          <input name="name" value={form.name} onChange={change} required placeholder="Ej. Colegio San Rafael" style={styles.input} />
        </Field>
        <Field label="Convenio aplicable" wide>
          <select name="collective_agreement" value={form.collective_agreement} onChange={change} style={styles.input}>
            <option value="">Heredar convenio de la empresa</option>
            {agreements.map((agreement) => (
              <option key={agreement.id} value={agreement.name}>{agreementLabel(agreement)}</option>
            ))}
          </select>
          <small style={styles.help}>Por defecto se propone el convenio principal de la empresa.</small>
        </Field>
        <Field label="CCC de empresa"><input name="general_ccc" value={form.general_ccc} onChange={change} style={styles.input} /></Field>
        <Field label="CCC del centro"><input name="main_ccc" value={form.main_ccc} onChange={change} style={styles.input} /></Field>
        <Field label="Domicilio del centro" wide><input name="address" value={form.address} onChange={change} style={styles.input} /></Field>
        <Field label="Localidad"><input name="city" value={form.city} onChange={change} style={styles.input} /></Field>
        <Field label="Provincia"><input name="province" value={form.province} onChange={change} style={styles.input} /></Field>
        <Field label="Teléfono"><input name="phone" value={form.phone} onChange={change} style={styles.input} /></Field>
        <Field label="Móvil"><input name="mobile" value={form.mobile} onChange={change} style={styles.input} /></Field>
        <Field label="Correo electrónico"><input type="email" name="email" value={form.email} onChange={change} style={styles.input} /></Field>
        <Field label="Sitio web"><input name="website" value={form.website} onChange={change} style={styles.input} /></Field>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}
      <div style={styles.actions}>
        <button type="submit" disabled={submitting || !selectedCompanyId} style={styles.button}>
          {submitting ? "Guardando..." : "Crear centro"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, wide = false, children }) {
  return <label style={wide ? styles.fieldWide : styles.field}><span>{label}</span>{children}</label>;
}

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", color: "#374151", fontSize: "13px", fontWeight: 800 },
  fieldWide: { display: "flex", flexDirection: "column", gap: "6px", color: "#374151", fontSize: "13px", fontWeight: 800, gridColumn: "1 / -1" },
  input: { minHeight: "40px", border: "1px solid #cbd5e1", borderRadius: "7px", padding: "8px 10px", backgroundColor: "#fff", boxSizing: "border-box", width: "100%" },
  help: { color: "#64748b", fontWeight: 600 },
  actions: { display: "flex", justifyContent: "flex-end" },
  button: { border: "1px solid #111827", borderRadius: "8px", backgroundColor: "#111827", color: "#fff", padding: "10px 16px", fontWeight: 900, cursor: "pointer" },
  error: { padding: "10px 12px", borderRadius: "8px", backgroundColor: "#fef2f2", color: "#b91c1c", fontWeight: 800 },
  success: { padding: "10px 12px", borderRadius: "8px", backgroundColor: "#f0fdf4", color: "#166534", fontWeight: 800 },
};
