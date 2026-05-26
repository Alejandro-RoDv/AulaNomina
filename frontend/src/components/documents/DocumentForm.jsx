const documentTypes = [
  ["DNI_NIE", "DNI / NIE"],
  ["NAF", "NAF"],
  ["SIGNED_CONTRACT", "Contrato firmado"],
  ["MODEL_145", "Modelo 145"],
  ["SEXUAL_OFFENCES_CERTIFICATE", "Certificado delitos sexuales"],
  ["CONFIDENTIALITY_COMMITMENT", "Compromiso confidencialidad"],
  ["DATA_CONSENT", "Consentimiento datos"],
  ["DEGREE_CERTIFICATE", "Titulación"],
  ["OTHER", "Otros"],
];

const statuses = [
  ["pending", "Pendiente"],
  ["received", "Entregado"],
  ["expired", "Caducado"],
  ["not_applicable", "No aplica"],
];

function findSelectedEmployee(employees, employeeId) {
  return employees.find((employee) => String(employee.id) === String(employeeId));
}

export default function DocumentForm({
  form,
  employees,
  companies,
  workCenters,
  onChange,
  onSubmit,
  submitting,
}) {
  const selectedEmployee = findSelectedEmployee(employees, form.employee_id);
  const selectedCompany = companies.find((company) => String(company.id) === String(form.company_id));
  const selectedCenter = workCenters.find((center) => String(center.id) === String(form.center_id));

  const handleEmployeeChange = (event) => {
    const employeeId = event.target.value;
    const employee = findSelectedEmployee(employees, employeeId);

    onChange({ target: { name: "employee_id", value: employeeId } });
    onChange({ target: { name: "company_id", value: employee?.company_id ? String(employee.company_id) : "" } });
    onChange({ target: { name: "center_id", value: employee?.center_id ? String(employee.center_id) : "" } });
  };

  return (
    <section style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Nuevo documento</h2>
          <p style={styles.subtitle}>Registra documentación laboral simulada asociada a un trabajador.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} style={styles.form}>
        <label style={styles.label}>
          Trabajador
          <select name="employee_id" value={form.employee_id} onChange={handleEmployeeChange} required style={styles.input}>
            <option value="">Seleccionar trabajador</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employee_code} · {employee.first_name} {employee.last_name}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Empresa
          <select name="company_id" value={form.company_id} onChange={onChange} required style={styles.input}>
            <option value="">Empresa</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Centro
          <select name="center_id" value={form.center_id} onChange={onChange} style={styles.input}>
            <option value="">Sin centro</option>
            {workCenters
              .filter((center) => !form.company_id || String(center.company_id) === String(form.company_id))
              .map((center) => (
                <option key={center.id} value={center.id}>{center.name}</option>
              ))}
          </select>
        </label>

        {selectedEmployee && (
          <div style={styles.employeeContext}>
            <span><strong>Trabajador:</strong> {selectedEmployee.first_name} {selectedEmployee.last_name}</span>
            <span><strong>Empresa:</strong> {selectedCompany?.name || "Sin empresa"}</span>
            <span><strong>Centro:</strong> {selectedCenter?.name || "Sin centro"}</span>
          </div>
        )}

        <label style={styles.label}>
          Tipo documental
          <select name="document_type" value={form.document_type} onChange={onChange} required style={styles.input}>
            <option value="">Tipo</option>
            {documentTypes.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Nombre documento
          <input name="document_name" value={form.document_name} onChange={onChange} required style={styles.input} />
        </label>

        <label style={styles.label}>
          Estado
          <select name="status" value={form.status} onChange={onChange} required style={styles.input}>
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Fecha emisión
          <input type="date" name="issue_date" value={form.issue_date} onChange={onChange} style={styles.input} />
        </label>

        <label style={styles.label}>
          Caducidad
          <input type="date" name="expiry_date" value={form.expiry_date} onChange={onChange} style={styles.input} />
        </label>

        <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
          Notas
          <textarea name="notes" value={form.notes} onChange={onChange} style={{ ...styles.input, minHeight: "74px" }} />
        </label>

        <div style={styles.actions}>
          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? "Guardando..." : "Guardar documento"}
          </button>
        </div>
      </form>
    </section>
  );
}

const styles = {
  card: { border: "2px solid #111", background: "#fff", padding: "18px", boxShadow: "5px 5px 0 #f0df62", marginBottom: "22px" },
  headerRow: { display: "flex", justifyContent: "space-between", gap: "18px", marginBottom: "14px" },
  title: { margin: 0, fontSize: "22px", fontWeight: 900, color: "#111" },
  subtitle: { margin: "4px 0 0", color: "#4b5563", fontSize: "13px", fontWeight: 600 },
  form: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" },
  label: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#111" },
  input: { border: "2px solid #111", padding: "9px 10px", fontSize: "14px", fontWeight: 700, background: "#fff", color: "#111" },
  employeeContext: { gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", border: "2px solid #111", background: "#fffdf0", padding: "10px 12px", fontWeight: 800 },
  actions: { gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" },
  button: { border: "3px solid #111", background: "#f0df62", padding: "10px 16px", fontWeight: 900, cursor: "pointer", boxShadow: "3px 3px 0 #111" },
};
