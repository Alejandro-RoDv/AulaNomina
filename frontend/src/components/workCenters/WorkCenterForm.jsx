export default function WorkCenterForm({
  form,
  companies,
  onChange,
  onSubmit,
  error,
  success,
  submitting,
}) {
  const selectedCompany = companies.find(
    (company) => String(company.id) === String(form.company_id)
  );

  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Empresa madre</label>
          <select
            name="company_id"
            value={form.company_id}
            onChange={onChange}
            required
            style={styles.input}
          >
            <option value="">Seleccionar empresa</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formGroupSmall}>
          <label>Código centro</label>
          <input
            name="center_code"
            value={form.center_code}
            onChange={onChange}
            required
            placeholder="Ej. 1.1"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label>Nombre del centro</label>
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            required
            placeholder="Ej. Colegio San Rafael"
            style={styles.input}
          />
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>CCC general</label>
          <input
            name="general_ccc"
            value={form.general_ccc}
            onChange={onChange}
            placeholder={selectedCompany?.ccc || "CCC de la empresa madre"}
            style={styles.input}
          />
          <small style={styles.helpText}>
            Normalmente coincide con la CCC de la empresa madre.
          </small>
        </div>

        <div style={styles.formGroup}>
          <label>CCC principal del centro</label>
          <input
            name="main_ccc"
            value={form.main_ccc}
            onChange={onChange}
            placeholder="CCC propia del centro"
            style={styles.input}
          />
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroupWide}>
          <label>Dirección</label>
          <input name="address" value={form.address} onChange={onChange} style={styles.input} />
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Ciudad</label>
          <input name="city" value={form.city} onChange={onChange} style={styles.input} />
        </div>

        <div style={styles.formGroup}>
          <label>Provincia</label>
          <input name="province" value={form.province} onChange={onChange} style={styles.input} />
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <button type="submit" disabled={submitting} style={styles.button}>
        {submitting ? "Guardando..." : "Crear centro"}
      </button>
    </form>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupSmall: { width: "170px", flex: "0 0 170px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  helpText: { color: "#6b7280", fontSize: "12px" },
  button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "12px 18px", cursor: "pointer", width: "fit-content", fontWeight: 800 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" },
};
