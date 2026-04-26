export default function ContractForm({
  form,
  employees,
  onChange,
  onSubmit,
  error,
  success,
  submitting,
}) {
  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Empleado</label>
          <select
            name="employee_id"
            value={form.employee_id}
            onChange={onChange}
            required
            style={styles.input}
          >
            <option value="">Selecciona un empleado</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label>Tipo de contrato</label>
          <select
            name="contract_type"
            value={form.contract_type}
            onChange={onChange}
            required
            style={styles.input}
          >
            <option value="">Selecciona tipo</option>
            <option value="indefinido">Indefinido</option>
            <option value="temporal">Temporal</option>
            <option value="practicas">Prácticas</option>
            <option value="formacion">Formación</option>
          </select>
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Fecha inicio</label>
          <input
            type="date"
            name="start_date"
            value={form.start_date}
            onChange={onChange}
            required
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label>Fecha fin</label>
          <input
            type="date"
            name="end_date"
            value={form.end_date}
            onChange={onChange}
            style={styles.input}
          />
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Salario base</label>
          <input
            type="number"
            name="salary_base"
            value={form.salary_base}
            onChange={onChange}
            placeholder="Ej. 18000"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label>Estado</label>
          <select
            name="status"
            value={form.status}
            onChange={onChange}
            style={styles.input}
          >
            <option value="active">Activo</option>
            <option value="ended">Finalizado</option>
          </select>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <button type="submit" disabled={submitting} style={styles.button}>
        {submitting ? "Guardando..." : "Crear contrato"}
      </button>
    </form>
  );
}

const styles = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  formRow: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
  },
  formGroup: {
    flex: 1,
    minWidth: "220px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "14px",
  },
  button: {
    backgroundColor: "#111827",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "12px 18px",
    fontSize: "14px",
    cursor: "pointer",
    width: "fit-content",
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    padding: "10px 12px",
    borderRadius: "8px",
  },
  success: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    padding: "10px 12px",
    borderRadius: "8px",
  },
};
