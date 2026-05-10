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

function getActiveContractForEmployee(contracts, employeeId) {
  return contracts.find(
    (contract) =>
      String(contract.employee_id) === String(employeeId) &&
      contract.status === "active"
  );
}

export default function IncidentForm({
  form,
  employees,
  contracts,
  companies,
  workCenters,
  onChange,
  onSubmit,
  error,
  success,
  submitting,
}) {
  const selectedEmployeeId = form.employee_id;

  const selectedEmployee = employees.find(
    (employee) => String(employee.id) === String(selectedEmployeeId)
  );

  const selectedContract = contracts.find(
    (contract) => String(contract.id) === String(form.contract_id)
  );

  const selectedCompany = companies.find(
    (company) => String(company.id) === String(form.company_id)
  );

  const selectedCenter = workCenters.find(
    (center) => String(center.id) === String(form.center_id)
  );

  const hasEmployeeWithoutActiveContract = Boolean(selectedEmployeeId && !selectedContract);

  const handleEmployeeChange = (event) => {
    const employeeId = event.target.value;
    const activeContract = getActiveContractForEmployee(contracts, employeeId);

    onChange({ target: { name: "employee_id", value: employeeId } });
    onChange({ target: { name: "contract_id", value: activeContract ? String(activeContract.id) : "" } });
    onChange({ target: { name: "company_id", value: activeContract?.company_id ? String(activeContract.company_id) : "" } });
    onChange({ target: { name: "center_id", value: activeContract?.center_id ? String(activeContract.center_id) : "" } });
  };

  const isSubmitDisabled = submitting || hasEmployeeWithoutActiveContract;

  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Trabajador</label>
          <select
            name="employee_id"
            value={form.employee_id}
            onChange={handleEmployeeChange}
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
          <label>Contrato activo</label>
          <div style={styles.readOnlyBox}>
            <div style={styles.readOnlyMain}>
              {selectedContract
                ? `${selectedContract.contract_type} · ${selectedContract.start_date}${selectedContract.end_date ? ` a ${selectedContract.end_date}` : ""}`
                : "Se completará al seleccionar trabajador"}
            </div>
            <div style={styles.readOnlyMeta}>
              {selectedContract ? `Contrato #${selectedContract.id}` : "Solo se permite contrato activo"}
            </div>
          </div>
          <input type="hidden" name="contract_id" value={form.contract_id} required />
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Empresa y centro</label>
          <div style={styles.readOnlyBox}>
            <div style={styles.readOnlyMain}>
              {selectedCompany?.name || "Se completará según el contrato activo"}
            </div>
            <div style={styles.readOnlyMeta}>
              {selectedCenter?.name || "Centro pendiente"}
              {selectedCompany?.ccc ? ` · CCC ${selectedCompany.ccc}` : ""}
            </div>
          </div>
          <input type="hidden" name="company_id" value={form.company_id} required />
          <input type="hidden" name="center_id" value={form.center_id || ""} />
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

      {selectedEmployee && hasEmployeeWithoutActiveContract && (
        <div style={styles.warning}>
          Este trabajador no tiene contrato activo. No se puede crear la incidencia.
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <button type="submit" disabled={isSubmitDisabled} style={{ ...styles.button, opacity: isSubmitDisabled ? 0.65 : 1 }}>
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
  readOnlyBox: {
    minHeight: "42px",
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    backgroundColor: "#f9fafb",
  },
  readOnlyMain: {
    color: "#111827",
    fontWeight: 800,
    fontSize: "14px",
  },
  readOnlyMeta: {
    marginTop: "2px",
    color: "#6b7280",
    fontWeight: 600,
    fontSize: "12px",
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
