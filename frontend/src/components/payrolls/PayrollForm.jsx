import { fetchEmployeeTaxProfile } from "../../services/taxProfileApi";

const PAYROLL_STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "pending", label: "Pendiente" },
  { value: "calculated", label: "Calculada" },
  { value: "reviewed", label: "Revisada" },
  { value: "closed", label: "Cerrada" },
  { value: "cancelled", label: "Anulada" },
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

function getSalarySupplementsTotal(form) {
  return (
    Number(form.salary_supplement_1 || 0) +
    Number(form.salary_supplement_2 || 0) +
    Number(form.salary_supplement_3 || 0)
  );
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
  const supplements = getSalarySupplementsTotal(form);
  const variableIncentives = Number(form.variable_incentives || 0);
  const extraPay = calculateExtraPayProration(contract, form.period_month);
  const irpfPercentage = Number(form.irpf_percentage || 0);
  const grossSalary = baseSalary + supplements + variableIncentives + extraPay;
  const socialSecurity = grossSalary * 0.0647;
  const irpf = grossSalary * (irpfPercentage / 100);
  const totalDeductions = socialSecurity + irpf;
  const netSalary = grossSalary - totalDeductions;

  return {
    baseSalary,
    supplements,
    variableIncentives,
    extraPay,
    grossSalary,
    socialSecurity,
    irpf,
    totalDeductions,
    netSalary,
  };
}

function getActiveContractForEmployee(contracts, employeeId) {
  return contracts.find(
    (contract) =>
      String(contract.employee_id) === String(employeeId) &&
      contract.status === "active"
  );
}

function AmountPreviewItem({ label, amount }) {
  return (
    <div style={styles.previewItem}>
      <span>{label}</span>
      <strong>{formatCurrency(amount)}</strong>
    </div>
  );
}

export default function PayrollForm({
  form,
  employees,
  contracts,
  companies,
  workCenters = [],
  onChange,
  onSubmit,
  error,
  success,
  submitting,
}) {
  const selectedEmployee = employees.find((employee) => String(employee.id) === String(form.employee_id));
  const selectedContract = contracts.find((contract) => String(contract.id) === String(form.contract_id));
  const selectedCompany = companies.find((company) => String(company.id) === String(form.company_id));
  const selectedCenter = workCenters.find((center) => String(center.id) === String(form.center_id));
  const hasEmployeeWithoutActiveContract = Boolean(form.employee_id && !selectedContract);

  const preview = calculatePreview(form, selectedContract);

  const handleEmployeeChange = async (event) => {
    const employeeId = event.target.value;
    const activeContract = getActiveContractForEmployee(contracts, employeeId);

    onChange({ target: { name: "employee_id", value: employeeId } });
    onChange({ target: { name: "contract_id", value: activeContract ? String(activeContract.id) : "" } });
    onChange({ target: { name: "company_id", value: activeContract?.company_id ? String(activeContract.company_id) : "" } });
    onChange({ target: { name: "center_id", value: activeContract?.center_id ? String(activeContract.center_id) : "" } });

    if (!employeeId) return;

    try {
      const taxProfile = await fetchEmployeeTaxProfile(employeeId);
      if (taxProfile?.voluntary_irpf !== null && taxProfile?.voluntary_irpf !== undefined) {
        onChange({ target: { name: "irpf_percentage", value: String(taxProfile.voluntary_irpf) } });
      }
    } catch (err) {
      console.warn("No se pudo cargar el IRPF guardado del trabajador", err);
    }
  };

  const isSubmitDisabled = submitting || hasEmployeeWithoutActiveContract;

  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label>Trabajador</label>
          <select name="employee_id" value={form.employee_id} onChange={handleEmployeeChange} required style={styles.input}>
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
              {selectedContract
                ? `${formatCurrency(selectedContract.salary_base || 0)} · ${getPayScheduleLabel(selectedContract.pay_schedule)}`
                : "Solo se permite contrato activo"}
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
          <input type="hidden" name="company_id" value={form.company_id} />
          <input type="hidden" name="center_id" value={form.center_id || ""} />
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
          <div><span>Salario de referencia</span><strong>{formatCurrency(selectedContract.salary_base || 0)}</strong></div>
          <div><span>Sistema de pagas</span><strong>{getPayScheduleLabel(selectedContract.pay_schedule)}</strong></div>
          <div><span>Salario base calculado</span><strong>{formatCurrency(preview.baseSalary)}</strong></div>
          <div><span>Prorrata extra calculada</span><strong>{formatCurrency(preview.extraPay)}</strong></div>
        </div>
      )}

      <div style={styles.supplementsGrid}>
        <div style={styles.formGroup}>
          <label>Complemento salarial 1</label>
          <input type="number" step="0.01" name="salary_supplement_1" value={form.salary_supplement_1} onChange={onChange} min="0" style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label>Complemento salarial 2</label>
          <input type="number" step="0.01" name="salary_supplement_2" value={form.salary_supplement_2} onChange={onChange} min="0" style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label>Complemento salarial 3</label>
          <input type="number" step="0.01" name="salary_supplement_3" value={form.salary_supplement_3} onChange={onChange} min="0" style={styles.input} />
        </div>
      </div>

      <div style={styles.formRow}>
        <div style={styles.formGroupSmall}>
          <label>Variables / incentivos</label>
          <input type="number" step="0.01" name="variable_incentives" value={form.variable_incentives ?? "0"} onChange={onChange} min="0" style={styles.input} />
        </div>

        <div style={styles.formGroupSmall}>
          <label>IRPF %</label>
          <input type="number" step="0.01" name="irpf_percentage" value={form.irpf_percentage} onChange={onChange} min="0" max="100" style={styles.input} />
        </div>

        <div style={styles.formGroupSmall}>
          <label>Estado</label>
          <select name="status" value={form.status} onChange={onChange} style={styles.input}>
            {PAYROLL_STATUS_OPTIONS.filter((status) => status.value !== "cancelled").map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>

        <div style={styles.totalSupplementsBox}>
          <span>Total complementos</span>
          <strong>{formatCurrency(preview.supplements)}</strong>
        </div>
      </div>

      <div style={styles.devengoPreviewPanel}>
        <AmountPreviewItem label="Salario base" amount={preview.baseSalary} />
        <AmountPreviewItem label="Prorrata extra" amount={preview.extraPay} />
        <AmountPreviewItem label="Complementos" amount={preview.supplements} />
        <AmountPreviewItem label="Variables" amount={preview.variableIncentives} />
        <AmountPreviewItem label="Total devengado" amount={preview.grossSalary} />
      </div>

      <div style={styles.previewPanel}>
        <AmountPreviewItem label="Total devengado" amount={preview.grossSalary} />
        <AmountPreviewItem label="Seg. Social" amount={preview.socialSecurity} />
        <AmountPreviewItem label="IRPF" amount={preview.irpf} />
        <AmountPreviewItem label="Neto" amount={preview.netSalary} />
      </div>

      {selectedEmployee && hasEmployeeWithoutActiveContract && <div style={styles.warning}>Este trabajador no tiene contrato activo. No se puede generar nómina.</div>}
      {selectedContract && !selectedContract.company_id && <div style={styles.warning}>El contrato activo no tiene empresa vinculada.</div>}
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <button type="submit" disabled={isSubmitDisabled} style={{ ...styles.button, opacity: isSubmitDisabled ? 0.65 : 1 }}>
        {submitting ? "Generando..." : "Generar nómina"}
      </button>
    </form>
  );
}

export { PAYROLL_STATUS_OPTIONS, MONTH_OPTIONS, formatCurrency, calculateBaseSalary, calculateExtraPayProration };

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  supplementsGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px", width: "100%" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupSmall: { width: "180px", minWidth: "140px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  readOnlyBox: { minHeight: "42px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "8px", backgroundColor: "#f9fafb" },
  readOnlyMain: { color: "#111827", fontWeight: 800, fontSize: "14px" },
  readOnlyMeta: { marginTop: "2px", color: "#6b7280", fontWeight: 600, fontSize: "12px" },
  calculationInfo: { display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: "10px", border: "1px solid #e6d85c", borderRadius: "10px", backgroundColor: "#fefce8", padding: "10px" },
  devengoPreviewPanel: { display: "grid", gridTemplateColumns: "repeat(5, minmax(110px, 1fr))", gap: "14px", border: "2px solid #111827", borderRadius: "10px", backgroundColor: "#ffffff", padding: "10px 14px" },
  previewPanel: { display: "grid", gridTemplateColumns: "repeat(4, minmax(110px, 1fr))", gap: "14px", border: "1px solid #e5e7eb", borderRadius: "10px", backgroundColor: "#f9fafb", padding: "10px 14px" },
  previewItem: { display: "flex", justifyContent: "center", alignItems: "baseline", gap: "8px", minWidth: 0 },
  totalSupplementsBox: { flex: 1, minWidth: "220px", border: "1px solid #e5e7eb", borderRadius: "10px", backgroundColor: "#f9fafb", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800 },
  button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "12px 18px", fontSize: "14px", cursor: "pointer", width: "fit-content", fontWeight: 800 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" },
  warning: { backgroundColor: "#fef3c7", color: "#92400e", padding: "10px 12px", borderRadius: "8px", fontWeight: 700 },
};
