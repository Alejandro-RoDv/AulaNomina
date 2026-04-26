export default function CompanyForm({ form, onChange, onSubmit, error, success, submitting }) {
  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Nombre</label>
          <input name="name" value={form.name} onChange={onChange} required style={styles.input} />
        </div>

        <div style={styles.formGroup}>
          <label>CIF</label>
          <input name="cif" value={form.cif} onChange={onChange} required style={styles.input} />
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
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <button type="submit" disabled={submitting} style={styles.button}>
        {submitting ? "Guardando..." : "Crear empresa"}
      </button>
    </form>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "12px 18px", cursor: "pointer", width: "fit-content" },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" },
};
