const PAYROLL_STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "calculated", label: "Calculada" },
  { value: "closed", label: "Cerrada" },
];

const MONTH_OPTIONS = [
  { value: "1", label: "01 - Enero" },
  { value: "2", label: "02 - Febrero" },
  { value: "3", label: "03 - Marzo" },
  { value: "4", label: "04 - Abril" },
  { value: "5", label: "05 - Mayo" },
  { value: "6", label: "06 - Junio" },
  { value: "7", label: "07 - Julio" },
  { value: "8", label: "08 - Agosto" },
  { value: "9", label: "09 - Septiembre" },
  { value: "10", label: "10 - Octubre" },
  { value: "11", label: "11 - Noviembre" },
  { value: "12", label: "12 - Diciembre" },
  { value: "13", label: "Paga extra julio" },
  { value: "14", label: "Paga extra diciembre" },
  { value: "15", label: "Paga extra complementaria" },
];

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function getPayScheduleLabel(value) {
  if (value === "prorated_12") return "12 pagas prorrateadas";
  return "14 pagas no prorrateadas";
}

function calculateBaseSalary(contract, periodMonth) {
  const annualSalary = Number(contract?.salary_base || 0);
  const paySchedule = contract?.pay_schedule || "not_prorated_14";
  const month = Number(periodMonth || 0);

  if (month === 15) return 0;
  if (month === 13 || month === 14) return annualSalary / 14;
  if (paySchedule === "prorated_12") return annualSalary / 12;
  return annualSalary / 14;
}

function calculateExtraPayProration(contract, periodMonth) {
  const annualSalary = Number(contract?.salary_base || 0);
  const paySchedule = contract?.pay_schedule || "not_prorated_14";
  const month = Number(periodMonth || 0);

  if (month < 1 || month > 12) return 0;
  if (paySchedule !== "prorated_12") return 0;
  return ((annualSalary / 14) * 2) / 12;
}

function calculatePreview(form, contract) {
  const baseSalary = calculateBaseSalary(contract, form.period_month);
  const supplements = Number(form.salary_supplements || 0);
  const extraPay = calculateExtraPayProration(contract, form.period_month);
  const irpfPercentage = Number(form.irpf_percentage || 0);
  const grossSalary = baseSalary + supplements + extraPay;
  const socialSecurity = grossSalary * 0.0647;
  const irpf = grossSalary * (irpfPercentage / 100);
  const totalDeductions = socialSecurity + irpf;
  const netSalary = grossSalary - totalDeductions;

  return {
    baseSalary,
    extraPay,
    grossSalary,
    socialSecurity,
    irpf,
    totalDeductions,
    netSalary,
  };
}

export default function PayrollForm({
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
  const availableContracts = contracts.filter(
    (contract) => String(contract.employee_id) === String(form.employee_id)
  );

  const selectedContract = contracts.find(
    (contract) => String(contract.id) === String(form.contract_id)
  );

  const selectedCompany = companies.find(
    (company) => String(company.id) === String(form.company_id)
  );

  const preview = calculatePreview(form, selectedContract);

  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Trabajador</label>
          <select name="employee_id" value={form.employee_id} onChange={onChange} required style={styles.input}>
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
                #{contract.id} · {contract.contract_type} · {contract.start_date} · {formatCurrency(contract.salary_base || 0)} · {getPayScheduleLabel(contract.pay_schedule)}
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

        <div style={styles.formGroupSmall}>
          <label>Periodo</label>
          <select name="period_month" value={form.period_month} onChange={onChange} required style={styles.input}>
            <option value="">Periodo</option>
            {MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </div>

        <div style={styles.formGroupSmall}>
          <label>Año</label>
          <input type="number" name="period_year" value={form.period_year} onChange={onChange} min="2000" max="2100" required style={styles.input} />
        </div>
      </div>

      {selectedContract && (
        <div style={styles.calculationInfo}>
          <div><span>Salario anual</span><strong>{formatCurrency(selectedContract.salary_base || 0)}</strong></div>
          <div><span>Sistema de pagas</span><strong>{getPayScheduleLabel(selectedContract.pay_schedule)}</strong></div>
          <div><span>Salario base calculado</span><strong>{formatCurrency(preview.baseSalary)}</strong></div>
          <div><span>Prorrata extra calculada</span><strong>{formatCurrency(preview.extraPay)}</strong></div>
        </div>
      )}

      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Complementos salariales</label>
          <input type="number" step="0.01" name="salary_supplements" value={form.salary_supplements} onChange={onChange} min="0" style={styles.input} />
        </div>

        <div style={styles.formGroupSmall}>
          <label>IRPF %</label>
          <input type="number" step="0.01" name="irpf_percentage" value={form.irpf_percentage} onChange={onChange} min="0" max="100" style={styles.input} />
        </div>

        <div style={styles.formGroupSmall}>
          <label>Estado</label>
          <select name="status" value={form.status} onChange={onChange} style={styles.input}>
            {PAYROLL_STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.previewPanel}>
        <div><span>Bruto</span><strong>{formatCurrency(preview.grossSalary)}</strong></div>
        <div><span>Seg. Social</span><strong>{formatCurrency(preview.socialSecurity)}</strong></div>
        <div><span>IRPF</span><strong>{formatCurrency(preview.irpf)}</strong></div>
        <div><span>Neto</span><strong>{formatCurrency(preview.netSalary)}</strong></div>
      </div>

      {form.employee_id && availableContracts.length === 0 && <div style={styles.warning}>Este trabajador no tiene contratos disponibles.</div>}
      {selectedContract && !selectedContract.company_id && <div style={styles.warning}>El contrato seleccionado no tiene empresa vinculada.</div>}
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <button type="submit" disabled={submitting} style={styles.button}>
        {submitting ? "Generando..." : "Generar nómina"}
      </button>
    </form>
  );
}

export { PAYROLL_STATUS_OPTIONS, MONTH_OPTIONS, formatCurrency, calculateBaseSalary, calculateExtraPayProration };

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupSmall: { width: "160px", minWidth: "140px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  readOnlyInput: { backgroundColor: "#f3f4f6", color: "#6b7280", cursor: "not-allowed", fontWeight: 700 },
  calculationInfo: { display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: "10px", border: "1px solid #e6d85c", borderRadius: "10px", backgroundColor: "#fefce8", padding: "10px" },
  previewPanel: { display: "grid", gridTemplateColumns: "repeat(4, minmax(110px, 1fr))", gap: "8px", border: "1px solid #e5e7eb", borderRadius: "10px", backgroundColor: "#f9fafb", padding: "10px" },
  button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "12px 18px", fontSize: "14px", cursor: "pointer", width: "fit-content", fontWeight: 800 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" },
  warning: { backgroundColor: "#fef3c7", color: "#92400e", padding: "10px 12px", borderRadius: "8px", fontWeight: 700 },
};
