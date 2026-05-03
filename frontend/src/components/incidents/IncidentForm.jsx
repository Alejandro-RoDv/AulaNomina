const INCIDENT_TYPES = [
  { value: "IT", label: "IT / baja médica" },
  { value: "RECAIDA", label: "Recaída" },
  { value: "VACACIONES", label: "Vacaciones" },
  { value: "AUSENCIA", label: "Ausencia" },
  { value: "PERMISO_RETRIBUIDO", label: "Permiso retribuido" },
  { value: "PERMISO_NO_RETRIBUIDO", label: "Permiso no retribuido" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Abierta" },
  { value: "closed", label: "Cerrada" },
];

export default function IncidentForm({
  form,
  employees,
  contracts,
  companies,
  onChange,
  onSubmit,
  error,
  success,
  submitting,
}) {
  const selectedEmployeeId = form.employee_id;

  const availableContracts = contracts.filter(
    (contract) => String(contract.employee_id) === String(selectedEmployeeId)
  );

  const selectedContract = contracts.find(
    (contract) => String(contract.id) === String(form.contract_id)
  );

  const selectedCompany = companies.find(
    (company) => String(company.id) === String(form.company_id)
  );

  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Trabajador</label>
          <select
            name="employee_id"
            value={form.employee_id}
            onChange={onChange}
            required
            style={styles.input}
          >
            <option value="">Selecciona trabajador</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employee_code || employee.id} · {employee.first_name} {employee.last_name} · {employee.dni}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label>Contrato del trabajador</label>
          <select
            name="contract_id"
            value={form.contract_id}
            onChange={onChange}
            required
            disabled={!form.employee_id}
            style={styles.input}
          >
            <option value="">Selecciona contrato</option>
            {availableContracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                #{contract.id} · {contract.contract_type} · {contract.start_date} {contract.end_date ? `a ${contract.end_date}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Empresa / centro</label>
          <input
            value={selectedCompany?.name || "Se autocompleta según el contrato"}
            readOnly
            disabled
            style={{ ...styles.input, ...styles.readOnlyInput }}
          />
          <input type="hidden" name="company_id" value={form.company_id} />
        </div>

        <div style={styles.formGroup}>
          <label>Tipo de incidencia</label>
          <select
            name="incident_type"
            value={form.incident_type}
            onChange={onChange}
            required
            style={styles.input}
          >
            <option value="">Selecciona tipo</option>
            {INCIDENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
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

        <div style={styles.formGroup}>
          <label>Estado</label>
          <select name="status" value={form.status} onChange={onChange} style={styles.input}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.formGroupFull}>
        <label>Descripción</label>
        <textarea
          name="description"
          value={form.description}
          onChange={onChange}
          placeholder="Detalle de la incidencia, observaciones o instrucciones del caso práctico"
          rows="3"
          style={styles.textarea}
        />
      </div>

      {selectedEmployeeId && availableContracts.length === 0 && (
        <div style={styles.warning}>Este trabajador no tiene contratos disponibles.</div>
      )}

      {selectedContract && !selectedContract.company_id && (
        <div style={styles.warning}>El contrato seleccionado no tiene empresa vinculada.</div>
      )}

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <button type="submit" disabled={submitting} style={styles.button}>
        {submitting ? "Guardando..." : "Crear incidencia"}
      </button>
    </form>
  );
}

export { INCIDENT_TYPES, STATUS_OPTIONS };

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
  formGroupFull: {
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
  textarea: {
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "14px",
    resize: "vertical",
    fontFamily: "inherit",
  },
  readOnlyInput: {
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
    cursor: "not-allowed",
    fontWeight: 700,
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
    fontWeight: 800,
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
  warning: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
    padding: "10px 12px",
    borderRadius: "8px",
    fontWeight: 700,
  },
};
