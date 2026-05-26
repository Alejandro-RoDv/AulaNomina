import { useEffect, useMemo, useState } from "react";

import { createCompany } from "../../services/companyApi";
import { createWorkCenter } from "../../services/workCenterApi";

const initialCompany = {
  name: "",
  cif: "",
  ccc: "",
  address: "",
  city: "",
  province: "",
};

const initialCenter = {
  company_id: "",
  name: "",
  general_ccc: "",
  main_ccc: "",
  address: "",
  city: "",
  province: "",
};

function buildCompanyPayload(form) {
  return {
    name: form.name,
    cif: form.cif,
    ccc: form.ccc || null,
    address: form.address || null,
    city: form.city || null,
    province: form.province || null,
  };
}

function getNextCenterCode(companyId, workCenters) {
  if (!companyId) return "";
  const centersInCompany = workCenters.filter((center) => String(center.company_id) === String(companyId));
  return `${companyId}.${centersInCompany.length + 1}`;
}

function buildCenterPayload(form, company, workCenters) {
  return {
    company_id: Number(form.company_id),
    center_code: getNextCenterCode(form.company_id, workCenters),
    name: form.name,
    general_ccc: form.general_ccc || company?.ccc || null,
    main_ccc: form.main_ccc || null,
    address: form.address || company?.address || null,
    city: form.city || company?.city || null,
    province: form.province || company?.province || null,
  };
}

export default function CompanyCenterSplitForm({ companies, workCenters = [], initialSection = "companies", onReloadData }) {
  const [section, setSection] = useState(initialSection);
  const [companyForm, setCompanyForm] = useState(initialCompany);
  const [centerForm, setCenterForm] = useState(initialCenter);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const activeCompanies = companies.filter((company) => company.is_active);
  const selectedCompany = useMemo(
    () => activeCompanies.find((company) => String(company.id) === String(centerForm.company_id)),
    [activeCompanies, centerForm.company_id]
  );

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const reloadData = async () => {
    if (onReloadData) await onReloadData();
  };

  const handleSectionChange = (event) => {
    setSection(event.target.value);
    resetMessages();
  };

  const handleCompanyChange = (event) => {
    const { name, value } = event.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCenterChange = (event) => {
    const { name, value } = event.target;

    if (name === "company_id") {
      const company = activeCompanies.find((item) => String(item.id) === String(value));
      setCenterForm((prev) => ({
        ...prev,
        company_id: value,
        general_ccc: company?.ccc || "",
        address: company?.address || "",
        city: company?.city || "",
        province: company?.province || "",
      }));
      return;
    }

    setCenterForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateCompany = async (event) => {
    event.preventDefault();
    resetMessages();

    try {
      setSubmitting(true);
      await createCompany(buildCompanyPayload(companyForm));
      setCompanyForm(initialCompany);
      setSuccess("Empresa creada correctamente");
      await reloadData();
    } catch (err) {
      setError(err.message || "Error al crear empresa");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCenter = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!selectedCompany) {
      setError("Selecciona una empresa ya creada antes de crear el centro.");
      return;
    }

    try {
      setSubmitting(true);
      await createWorkCenter(buildCenterPayload(centerForm, selectedCompany, workCenters));
      setCenterForm(initialCenter);
      setSuccess("Centro creado correctamente");
      await reloadData();
    } catch (err) {
      setError(err.message || "Error al crear centro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.selectorRow}>
        <label style={styles.selectorGroup}>
          Sección
          <select value={section} onChange={handleSectionChange} style={styles.input}>
            <option value="companies">Empresas</option>
            <option value="centers">Centros</option>
          </select>
        </label>
        <p style={styles.helperText}>
          En Empresas creas la empresa. En Centros creas un centro asociado. El código interno del centro se genera automáticamente.
        </p>
      </div>

      {section === "companies" ? (
        <form onSubmit={handleCreateCompany} style={styles.form}>
          <h3 style={styles.sectionTitle}>Nueva empresa</h3>
          <div style={styles.formRow}>
            <label style={styles.formGroup}>
              Nombre empresa
              <input name="name" value={companyForm.name} onChange={handleCompanyChange} required style={styles.input} />
            </label>
            <label style={styles.formGroupSmall}>
              CIF
              <input name="cif" value={companyForm.cif} onChange={handleCompanyChange} required style={styles.input} />
            </label>
            <label style={styles.formGroupSmall}>
              CCC empresa
              <input name="ccc" value={companyForm.ccc} onChange={handleCompanyChange} style={styles.input} />
            </label>
          </div>

          <label style={styles.formGroupWide}>
            Dirección empresa
            <input name="address" value={companyForm.address} onChange={handleCompanyChange} style={styles.input} />
          </label>

          <div style={styles.formRow}>
            <label style={styles.formGroup}>
              Ciudad
              <input name="city" value={companyForm.city} onChange={handleCompanyChange} style={styles.input} />
            </label>
            <label style={styles.formGroup}>
              Provincia
              <input name="province" value={companyForm.province} onChange={handleCompanyChange} style={styles.input} />
            </label>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? "Guardando..." : "Crear empresa"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCreateCenter} style={styles.form}>
          <h3 style={styles.sectionTitle}>Nuevo centro</h3>
          <label style={styles.formGroupWide}>
            Empresa asociada
            <select name="company_id" value={centerForm.company_id} onChange={handleCenterChange} required style={styles.input}>
              <option value="">Seleccionar empresa existente</option>
              {activeCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} · {company.cif}{company.ccc ? ` · CCC ${company.ccc}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.formGroupWide}>
            Nombre centro
            <input name="name" value={centerForm.name} onChange={handleCenterChange} required placeholder="Ej. Colegio San Rafael" style={styles.input} />
          </label>

          <div style={styles.formRow}>
            <label style={styles.formGroup}>
              CCC empresa
              <input name="general_ccc" value={centerForm.general_ccc} onChange={handleCenterChange} placeholder="Se copia de la empresa" style={styles.input} />
            </label>
            <label style={styles.formGroup}>
              CCC centro
              <input name="main_ccc" value={centerForm.main_ccc} onChange={handleCenterChange} placeholder="CCC propia del centro" style={styles.input} />
            </label>
          </div>

          <label style={styles.formGroupWide}>
            Dirección centro
            <input name="address" value={centerForm.address} onChange={handleCenterChange} placeholder="Por defecto, dirección de empresa" style={styles.input} />
          </label>

          <div style={styles.formRow}>
            <label style={styles.formGroup}>
              Ciudad
              <input name="city" value={centerForm.city} onChange={handleCenterChange} style={styles.input} />
            </label>
            <label style={styles.formGroup}>
              Provincia
              <input name="province" value={centerForm.province} onChange={handleCenterChange} style={styles.input} />
            </label>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? "Guardando..." : "Crear centro"}
          </button>
        </form>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "18px" },
  selectorRow: { display: "flex", gap: "16px", alignItems: "end", flexWrap: "wrap", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px" },
  selectorGroup: { width: "240px", display: "flex", flexDirection: "column", gap: "6px", fontWeight: 900, color: "#111827" },
  helperText: { margin: 0, color: "#4b5563", fontSize: "13px", fontWeight: 700, maxWidth: "680px" },
  form: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "14px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px", fontWeight: 800, color: "#111827" },
  formGroupSmall: { width: "190px", flex: "0 0 190px", display: "flex", flexDirection: "column", gap: "6px", fontWeight: 800, color: "#111827" },
  formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px", fontWeight: 800, color: "#111827" },
  sectionTitle: { margin: 0, fontSize: "15px", fontWeight: 900, color: "#111827" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "12px 18px", cursor: "pointer", width: "fit-content", fontWeight: 800 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" },
};
