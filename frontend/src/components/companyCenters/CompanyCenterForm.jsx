import { useMemo, useState } from "react";

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
  center_code: "",
  name: "",
  general_ccc: "",
  main_ccc: "",
  address: "",
  city: "",
  province: "",
};

function buildCompanyPayload(company) {
  return {
    name: company.name,
    cif: company.cif,
    ccc: company.ccc || null,
    address: company.address || null,
    city: company.city || null,
    province: company.province || null,
  };
}

function buildCenterPayload(center, company, companyId) {
  return {
    company_id: Number(companyId),
    center_code: center.center_code,
    name: center.name,
    general_ccc: center.general_ccc || company.ccc || null,
    main_ccc: center.main_ccc || null,
    address: center.address || company.address || null,
    city: center.city || company.city || null,
    province: center.province || company.province || null,
  };
}

export default function CompanyCenterForm({ companies, onReloadData }) {
  const [mode, setMode] = useState("new");
  const [company, setCompany] = useState(initialCompany);
  const [center, setCenter] = useState(initialCenter);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCompany = useMemo(
    () => companies.find((item) => String(item.id) === String(center.company_id)),
    [companies, center.company_id]
  );

  const activeCompanies = companies.filter((item) => item.is_active);

  const handleModeChange = (event) => {
    const nextMode = event.target.value;
    setMode(nextMode);
    setError("");
    setSuccess("");
    setCompany(initialCompany);
    setCenter(initialCenter);
  };

  const handleCompanyChange = (event) => {
    const { name, value } = event.target;

    setCompany((prev) => ({ ...prev, [name]: value }));

    if (name === "ccc") {
      setCenter((prev) => ({ ...prev, general_ccc: value }));
    }

    if (["address", "city", "province"].includes(name)) {
      setCenter((prev) => ({ ...prev, [name]: prev[name] || value }));
    }
  };

  const handleCenterChange = (event) => {
    const { name, value } = event.target;

    if (name === "company_id") {
      const existingCompany = companies.find((item) => String(item.id) === String(value));
      setCenter((prev) => ({
        ...prev,
        company_id: value,
        general_ccc: existingCompany?.ccc || "",
        address: existingCompany?.address || "",
        city: existingCompany?.city || "",
        province: existingCompany?.province || "",
      }));
      return;
    }

    setCenter((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      setSubmitting(true);

      let companyId = center.company_id;
      let companyForDefaults = selectedCompany || company;

      if (mode === "new") {
        const createdCompany = await createCompany(buildCompanyPayload(company));
        companyId = createdCompany.id;
        companyForDefaults = createdCompany;
      }

      await createWorkCenter(buildCenterPayload(center, companyForDefaults, companyId));

      if (onReloadData) {
        await onReloadData();
      }

      setCompany(initialCompany);
      setCenter(initialCenter);
      setSuccess(mode === "new" ? "Empresa y centro creados correctamente" : "Centro añadido correctamente");
    } catch (err) {
      setError(err.message || "Error al guardar empresa y centro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.modeBox}>
        <label style={styles.radioLabel}>
          <input type="radio" name="mode" value="new" checked={mode === "new"} onChange={handleModeChange} />
          Nueva empresa + primer centro
        </label>
        <label style={styles.radioLabel}>
          <input type="radio" name="mode" value="existing" checked={mode === "existing"} onChange={handleModeChange} />
          Añadir centro a empresa ya creada
        </label>
      </div>

      {mode === "new" && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Empresa</h3>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label>Nombre empresa</label>
              <input name="name" value={company.name} onChange={handleCompanyChange} required style={styles.input} />
            </div>
            <div style={styles.formGroupSmall}>
              <label>CIF</label>
              <input name="cif" value={company.cif} onChange={handleCompanyChange} required style={styles.input} />
            </div>
            <div style={styles.formGroupSmall}>
              <label>CCC empresa</label>
              <input name="ccc" value={company.ccc} onChange={handleCompanyChange} required style={styles.input} />
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroupWide}>
              <label>Dirección empresa</label>
              <input name="address" value={company.address} onChange={handleCompanyChange} style={styles.input} />
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label>Ciudad</label>
              <input name="city" value={company.city} onChange={handleCompanyChange} style={styles.input} />
            </div>
            <div style={styles.formGroup}>
              <label>Provincia</label>
              <input name="province" value={company.province} onChange={handleCompanyChange} style={styles.input} />
            </div>
          </div>
        </section>
      )}

      {mode === "existing" && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Empresa existente</h3>
          <div style={styles.formRow}>
            <div style={styles.formGroupWide}>
              <label>Seleccionar por CCC / empresa</label>
              <select name="company_id" value={center.company_id} onChange={handleCenterChange} required style={styles.input}>
                <option value="">Seleccionar empresa existente</option>
                {activeCompanies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.ccc || "Sin CCC"} · {item.name} · {item.cif}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Centro</h3>
        <div style={styles.formRow}>
          <div style={styles.formGroupSmall}>
            <label>Código centro</label>
            <input name="center_code" value={center.center_code} onChange={handleCenterChange} required placeholder="Ej. 1.1" style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label>Nombre centro</label>
            <input name="name" value={center.name} onChange={handleCenterChange} required placeholder="Ej. Colegio San Rafael" style={styles.input} />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label>CCC empresa</label>
            <input name="general_ccc" value={center.general_ccc} onChange={handleCenterChange} placeholder="Se copia de la empresa" style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label>CCC centro</label>
            <input name="main_ccc" value={center.main_ccc} onChange={handleCenterChange} placeholder="CCC propia del centro" style={styles.input} />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroupWide}>
            <label>Dirección centro</label>
            <input name="address" value={center.address} onChange={handleCenterChange} placeholder="Por defecto, dirección de empresa" style={styles.input} />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label>Ciudad</label>
            <input name="city" value={center.city} onChange={handleCenterChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label>Provincia</label>
            <input name="province" value={center.province} onChange={handleCenterChange} style={styles.input} />
          </div>
        </div>
      </section>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <button type="submit" disabled={submitting} style={styles.button}>
        {submitting ? "Guardando..." : mode === "new" ? "Crear empresa y centro" : "Añadir centro"}
      </button>
    </form>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "18px" },
  modeBox: { display: "flex", gap: "18px", flexWrap: "wrap", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px" },
  radioLabel: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#111827" },
  section: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "14px" },
  sectionTitle: { margin: 0, fontSize: "15px", fontWeight: 900, color: "#111827" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupSmall: { width: "190px", flex: "0 0 190px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "12px 18px", cursor: "pointer", width: "fit-content", fontWeight: 800 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" },
};
