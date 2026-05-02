export default function EmployeeForm({ form, companies, onChange, onSubmit, error, success, submitting }) {
  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <div style={styles.formRow}>
        <div style={styles.formGroupCode}>
          <label>Código trabajador</label>
          <input
            name="employee_code"
            value={form.employee_code}
            readOnly
            disabled
            style={{ ...styles.input, ...styles.readOnlyInput }}
          />
          <small style={styles.helpText}>Automático.</small>
        </div>

        <div style={styles.formGroupDni}>
          <label>DNI</label>
          <input name="dni" value={form.dni} onChange={onChange} required style={styles.input} />
        </div>

        <div style={styles.formGroupNaf}>
          <label>NAF</label>
          <input name="naf" value={form.naf} onChange={onChange} style={styles.input} />
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Nombre</label>
          <input
            name="first_name"
            value={form.first_name}
            onChange={onChange}
            required
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label>Apellidos</label>
          <input
            name="last_name"
            value={form.last_name}
            onChange={onChange}
            required
            style={styles.input}
          />
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Empresa / Centro</label>
          <select name="company_id" value={form.company_id} onChange={onChange} style={styles.input}>
            <option value="">Sin asignar</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Email</label>
          <input name="email" type="email" value={form.email} onChange={onChange} style={styles.input} />
        </div>

        <div style={styles.formGroup}>
          <label>Teléfono</label>
          <input name="phone" value={form.phone} onChange={onChange} style={styles.input} />
        </div>

        <div style={styles.formGroup}>
          <label>Fecha nacimiento</label>
          <input
            name="birth_date"
            type="date"
            value={form.birth_date}
            onChange={onChange}
            style={styles.input}
          />
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
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

        <div style={styles.formGroup}>
          <label>Código postal</label>
          <input name="postal_code" value={form.postal_code} onChange={onChange} style={styles.input} />
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <button type="submit" disabled={submitting} style={styles.button}>
        {submitting ? "Guardando..." : "Crear trabajador"}
      </button>
    </form>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupCode: { width: "150px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupDni: { width: "190px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupNaf: { width: "230px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  readOnlyInput: { backgroundColor: "#f3f4f6", color: "#6b7280", cursor: "not-allowed", fontWeight: 800 },
  helpText: { color: "#6b7280", fontSize: "12px" },
  button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "12px 18px", cursor: "pointer", width: "fit-content" },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" },
};
