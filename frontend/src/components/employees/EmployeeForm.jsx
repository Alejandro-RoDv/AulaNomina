import { useState } from "react";

import { fetchEmployeesByDocument } from "../../services/employeeApi";
import { EDUCATION_LEVEL_OPTIONS } from "../../utils/employeePayloads";

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

export default function EmployeeForm({
  form,
  companies,
  workCenters,
  employees = [],
  contracts,
  onChange,
  onSubmit,
  onPrefillEmployee,
  error,
  success,
  submitting,
}) {
  const [documentMatches, setDocumentMatches] = useState([]);
  const [documentLookupLoading, setDocumentLookupLoading] = useState(false);
  const [documentLookupError, setDocumentLookupError] = useState("");

  const filteredCenters = workCenters.filter(
    (center) => String(center.company_id) === String(form.company_id)
  );

  const visibleEmployeeCode = form.company_id
    ? `${form.company_id}.${employees.filter((employee) => String(employee.company_id) === String(form.company_id)).length + 1}`
    : "Selecciona empresa";

  const handleDocumentBlur = async () => {
    const document = String(form.dni || "").trim();
    setDocumentMatches([]);
    setDocumentLookupError("");

    if (document.length < 5 || !onPrefillEmployee) return;

    try {
      setDocumentLookupLoading(true);
      const matches = await fetchEmployeesByDocument(document);
      setDocumentMatches(matches || []);
    } catch (err) {
      setDocumentLookupError(err.message || "No se pudo comprobar el documento");
    } finally {
      setDocumentLookupLoading(false);
    }
  };

  const handlePrefill = (employee) => {
    onPrefillEmployee?.(employee, "Datos personales cargados desde un trabajador ya registrado. Selecciona empresa/centro y guarda el alta.");
    setDocumentMatches([]);
  };

  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <Section title="Asignación inicial">
        <div style={styles.formRow}>
          <div style={styles.formGroupCode}>
            <label>Código trabajador</label>
            <input value={visibleEmployeeCode} readOnly disabled style={{ ...styles.input, ...styles.readOnlyInput }} />
            <small style={styles.helpText}>Código funcional previsto.</small>
          </div>
          <div style={styles.formGroup}>
            <label>Empresa</label>
            <select name="company_id" value={form.company_id} onChange={onChange} required style={styles.input}>
              <option value="">Seleccionar empresa</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label>Centro</label>
            <select name="center_id" value={form.center_id} onChange={onChange} required disabled={!form.company_id} style={styles.input}>
              <option value="">{form.company_id ? "Seleccionar centro" : "Selecciona empresa primero"}</option>
              {filteredCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Identificación personal">
        <div style={styles.formRowTop}>
          <div style={styles.formGroupSmall}>
            <label>Tipo documento</label>
            <select name="document_type" value={form.document_type} onChange={onChange} required style={styles.input}>
              <option value="DNI">DNI</option>
              <option value="NIE">NIE</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </div>
          <div style={styles.formGroupDniWide}>
            <label>{form.document_type === "PASAPORTE" ? "Pasaporte" : "Documento"}</label>
            <input name="dni" value={form.dni} onChange={onChange} onBlur={handleDocumentBlur} required style={styles.input} placeholder="Ej. 56070451W" />
            {documentLookupLoading && <small style={styles.helpText}>Comprobando documento...</small>}
          </div>
          <div style={styles.formGroupNaf}>
            <label>NAF</label>
            <input name="naf" value={form.naf} onChange={onChange} style={styles.input} />
          </div>
        </div>

        {documentLookupError && <div style={styles.warning}>{documentLookupError}</div>}
        {!!documentMatches.length && (
          <div style={styles.duplicateNotice}>
            <strong>Documento ya registrado.</strong>
            <span> Puedes cargar sus datos personales para darlo de alta en otra empresa.</span>
            <div style={styles.matchList}>
              {documentMatches.map((employee) => (
                <button key={employee.id} type="button" onClick={() => handlePrefill(employee)} style={styles.matchButton}>
                  Cargar datos de {employee.first_name} {employee.last_name} · {employee.dni}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={styles.formRow}>
          <div style={styles.formGroup}><label>Nombre</label><input name="first_name" value={form.first_name} onChange={onChange} required style={styles.input} /></div>
          <div style={styles.formGroup}><label>Primer apellido</label><input name="last_name" value={form.last_name} onChange={onChange} required style={styles.input} /></div>
          <div style={styles.formGroup}><label>Segundo apellido</label><input name="second_last_name" value={form.second_last_name} onChange={onChange} style={styles.input} /></div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroupSmall}>
            <label>Sexo</label>
            <select name="sex" value={form.sex} onChange={onChange} style={styles.input}>
              <option value="">No indicado</option><option value="Hombre">Hombre</option><option value="Mujer">Mujer</option><option value="Otro">Otro / no especificado</option>
            </select>
          </div>
          <div style={styles.formGroupSmall}><label>Fecha nacimiento</label><input name="birth_date" type="date" value={form.birth_date} onChange={onChange} style={styles.input} /></div>
          <div style={styles.formGroup}><label>Nacionalidad</label><input name="nationality" value={form.nationality} onChange={onChange} style={styles.input} /></div>
          <div style={styles.formGroup}><label>Lugar de nacimiento</label><input name="birth_place" value={form.birth_place} onChange={onChange} style={styles.input} /></div>
        </div>
      </Section>

      <Section title="Contacto y domicilio">
        <div style={styles.formRow}><div style={styles.formGroupWide}><label>Domicilio</label><input name="domicile" value={form.domicile} onChange={onChange} style={styles.input} /></div></div>
        <div style={styles.formRow}><div style={styles.formGroupWide}><label>Dirección</label><input name="address" value={form.address} onChange={onChange} style={styles.input} /></div></div>
        <div style={styles.formRow}>
          <div style={styles.formGroup}><label>Ciudad</label><input name="city" value={form.city} onChange={onChange} style={styles.input} /></div>
          <div style={styles.formGroup}><label>Provincia</label><input name="province" value={form.province} onChange={onChange} style={styles.input} /></div>
          <div style={styles.formGroupSmall}><label>Código postal</label><input name="postal_code" value={form.postal_code} onChange={onChange} style={styles.input} /></div>
        </div>
        <div style={styles.formRow}>
          <div style={styles.formGroupSmall}><label>Teléfono fijo</label><input name="landline_phone" value={form.landline_phone} onChange={onChange} style={styles.input} /></div>
          <div style={styles.formGroupSmall}><label>Móvil</label><input name="mobile_phone" value={form.mobile_phone} onChange={onChange} style={styles.input} /></div>
          <div style={styles.formGroupSmall}><label>Teléfono general</label><input name="phone" value={form.phone} onChange={onChange} style={styles.input} /></div>
          <div style={styles.formGroupSmall}><label>Fax</label><input name="fax" value={form.fax} onChange={onChange} style={styles.input} /></div>
        </div>
        <div style={styles.formRow}>
          <div style={styles.formGroup}><label>Correo electrónico</label><input name="email" type="email" value={form.email} onChange={onChange} style={styles.input} /></div>
          <div style={styles.formGroup}><label>Web</label><input name="website" value={form.website} onChange={onChange} style={styles.input} /></div>
        </div>
      </Section>

      <Section title="Formación y perfil profesional">
        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label>Nivel formativo</label>
            <select name="education_level" value={form.education_level} onChange={onChange} style={styles.input}>
              <option value="">Seleccionar nivel</option>
              {EDUCATION_LEVEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div style={styles.formGroup}><label>Título académico</label><input name="academic_title" value={form.academic_title} onChange={onChange} style={styles.input} /></div>
          <div style={styles.formGroupSmall}><label>Fecha concesión</label><input name="academic_title_date" type="date" value={form.academic_title_date} onChange={onChange} style={styles.input} /></div>
        </div>
        <div style={styles.formRow}><div style={styles.formGroup}><label>Profesión principal</label><input name="main_profession" value={form.main_profession} onChange={onChange} style={styles.input} /></div></div>
        <div style={styles.formRow}>
          <div style={styles.formGroupTextarea}><label>Otros cursos</label><textarea name="other_courses" value={form.other_courses} onChange={onChange} style={styles.textarea} /></div>
          <div style={styles.formGroupTextarea}><label>Acreditaciones</label><textarea name="accreditations" value={form.accreditations} onChange={onChange} style={styles.textarea} /></div>
          <div style={styles.formGroupTextarea}><label>Idiomas</label><textarea name="languages" value={form.languages} onChange={onChange} style={styles.textarea} /></div>
        </div>
      </Section>

      <Section title="Representante y observaciones">
        <div style={styles.formRow}>
          <div style={styles.formGroup}><label>Representante en calidad de</label><input name="representative_role" value={form.representative_role} onChange={onChange} style={styles.input} /></div>
          <div style={styles.formGroupSmall}><label>NIF representante</label><input name="representative_nif" value={form.representative_nif} onChange={onChange} style={styles.input} /></div>
          <div style={styles.formGroup}><label>Nombre y apellidos representante</label><input name="representative_full_name" value={form.representative_full_name} onChange={onChange} style={styles.input} /></div>
        </div>
        <div style={styles.formRow}><div style={styles.formGroupWide}><label>Observaciones</label><textarea name="observations" value={form.observations} onChange={onChange} style={styles.textareaLarge} /></div></div>
      </Section>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}
      <button type="submit" disabled={submitting} style={styles.button}>{submitting ? "Guardando..." : "Crear trabajador"}</button>
    </form>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "18px" },
  section: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#ffffff" },
  sectionTitle: { margin: "0 0 14px", fontSize: "15px", fontWeight: 900, color: "#111827" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" },
  formRowTop: { display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start", marginBottom: "12px" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupTextarea: { flex: 1, minWidth: "260px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupCode: { width: "220px", flex: "0 0 220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupDniWide: { width: "360px", flex: "0 0 360px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupNaf: { width: "240px", flex: "0 0 240px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupSmall: { width: "220px", flex: "0 0 220px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px" },
  textarea: { minHeight: "86px", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", resize: "vertical" },
  textareaLarge: { minHeight: "110px", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", resize: "vertical" },
  readOnlyInput: { backgroundColor: "#f3f4f6", color: "#111827", cursor: "not-allowed", fontWeight: 900 },
  helpText: { color: "#6b7280", fontSize: "12px" },
  warning: { backgroundColor: "#fef3c7", color: "#92400e", padding: "10px 12px", borderRadius: "8px" },
  duplicateNotice: { border: "1px solid #fde68a", backgroundColor: "#fffbeb", color: "#78350f", padding: "12px", borderRadius: "10px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" },
  matchList: { display: "flex", flexWrap: "wrap", gap: "8px" },
  matchButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", borderRadius: "8px", padding: "8px 10px", cursor: "pointer", fontWeight: 800 },
  button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "12px 18px", cursor: "pointer", width: "fit-content", fontWeight: 800 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" },
};
