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
  onCancel,
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
    <section className="documents-form-card">
      <div className="documents-form-card__header">
        <div>
          <span className="documents-section-kicker">Alta documental</span>
          <h2>Nuevo documento</h2>
          <p>Registra documentación laboral simulada asociada a un trabajador.</p>
        </div>
        {onCancel && (
          <button type="button" className="documents-form-card__close" onClick={onCancel}>
            Cerrar
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="documents-form">
        <label className="documents-field">
          <span>Trabajador</span>
          <select name="employee_id" value={form.employee_id} onChange={handleEmployeeChange} required>
            <option value="">Seleccionar trabajador</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employee_code} · {employee.first_name} {employee.last_name}
              </option>
            ))}
          </select>
        </label>

        <label className="documents-field">
          <span>Empresa</span>
          <select name="company_id" value={form.company_id} onChange={onChange} required>
            <option value="">Seleccionar empresa</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </label>

        <label className="documents-field">
          <span>Centro</span>
          <select name="center_id" value={form.center_id} onChange={onChange}>
            <option value="">Sin centro</option>
            {workCenters
              .filter((center) => !form.company_id || String(center.company_id) === String(form.company_id))
              .map((center) => (
                <option key={center.id} value={center.id}>{center.name}</option>
              ))}
          </select>
        </label>

        {selectedEmployee && (
          <div className="documents-form-context">
            <span><small>Trabajador</small>{selectedEmployee.first_name} {selectedEmployee.last_name}</span>
            <span><small>Empresa</small>{selectedCompany?.name || "Sin empresa"}</span>
            <span><small>Centro</small>{selectedCenter?.name || "Sin centro"}</span>
          </div>
        )}

        <label className="documents-field">
          <span>Tipo documental</span>
          <select name="document_type" value={form.document_type} onChange={onChange} required>
            <option value="">Seleccionar tipo</option>
            {documentTypes.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="documents-field">
          <span>Nombre del documento</span>
          <input name="document_name" value={form.document_name} onChange={onChange} required />
        </label>

        <label className="documents-field">
          <span>Estado</span>
          <select name="status" value={form.status} onChange={onChange} required>
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="documents-field">
          <span>Fecha de emisión</span>
          <input type="date" name="issue_date" value={form.issue_date} onChange={onChange} />
        </label>

        <label className="documents-field">
          <span>Caducidad</span>
          <input type="date" name="expiry_date" value={form.expiry_date} onChange={onChange} />
        </label>

        <label className="documents-field documents-field--wide">
          <span>Notas</span>
          <textarea name="notes" value={form.notes} onChange={onChange} rows={3} />
        </label>

        <div className="documents-form-actions">
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={submitting}>
              Cancelar
            </button>
          )}
          <button type="submit" disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar documento"}
          </button>
        </div>
      </form>
    </section>
  );
}
