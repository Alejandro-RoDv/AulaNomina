import { useMemo, useState } from "react";

import { MONTH_OPTIONS, formatCurrency } from "./PayrollForm";
import { simulateFuturePayrolls } from "../../services/payrollApi";

const DEFAULT_MONTHS = [6, 7, 9, 12];

function getActiveContractForEmployee(contracts, employeeId) {
  return contracts.find(
    (contract) => String(contract.employee_id) === String(employeeId) && contract.status === "active"
  );
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function getMonthLabel(month) {
  return MONTH_OPTIONS.find((item) => Number(item.value) === Number(month))?.label || String(month).padStart(2, "0");
}

function getProrationSourceLabel(source) {
  if (source === "configured") return "Convenio";
  if (source === "legacy") return "Histórica";
  return "No aplica";
}

function buildEmptyIncentive() {
  return {
    period_month: "9",
    period_year: String(new Date().getFullYear()),
    amount: "0",
    description: "Variable futura",
  };
}

export default function FuturePayrollSimulator({ employees = [], contracts = [] }) {
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    employee_id: "",
    contract_id: "",
    period_year: String(currentYear),
    periods: DEFAULT_MONTHS.map(String),
    salary_increase: "0",
    irpf_mode: "auto",
    incentives: [],
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedEmployee = employees.find((employee) => String(employee.id) === String(form.employee_id));
  const selectedContract = contracts.find((contract) => String(contract.id) === String(form.contract_id));

  const activeContracts = useMemo(() => {
    if (!form.employee_id) return [];
    return contracts.filter(
      (contract) => String(contract.employee_id) === String(form.employee_id) && contract.status === "active"
    );
  }, [contracts, form.employee_id]);

  const totals = useMemo(() => {
    const items = result?.items || [];
    return items.reduce(
      (acc, item) => ({
        gross: acc.gross + Number(item.gross_salary || 0),
        seniority: acc.seniority + Number(item.seniority_amount || 0),
        proration: acc.proration + Number(item.extra_pay_proration || 0),
        ss: acc.ss + Number(item.employee_social_security || 0),
        irpf: acc.irpf + Number(item.irpf || 0),
        net: acc.net + Number(item.net_salary || 0),
      }),
      { gross: 0, seniority: 0, proration: 0, ss: 0, irpf: 0, net: 0 }
    );
  }, [result]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmployeeChange = (event) => {
    const employeeId = event.target.value;
    const activeContract = getActiveContractForEmployee(contracts, employeeId);
    setForm((prev) => ({
      ...prev,
      employee_id: employeeId,
      contract_id: activeContract ? String(activeContract.id) : "",
    }));
    setResult(null);
  };

  const handlePeriodToggle = (month) => {
    setForm((prev) => {
      const value = String(month);
      const exists = prev.periods.includes(value);
      const periods = exists ? prev.periods.filter((item) => item !== value) : [...prev.periods, value];
      return { ...prev, periods: periods.sort((a, b) => Number(a) - Number(b)) };
    });
  };

  const addIncentive = () => {
    setForm((prev) => ({
      ...prev,
      incentives: [...prev.incentives, { ...buildEmptyIncentive(), period_year: prev.period_year }],
    }));
  };

  const updateIncentive = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      incentives: prev.incentives.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeIncentive = (index) => {
    setForm((prev) => ({
      ...prev,
      incentives: prev.incentives.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!form.employee_id || !form.contract_id) {
      setError("Selecciona trabajador y contrato activo");
      return;
    }
    if (!form.periods.length) {
      setError("Selecciona al menos un mes para simular");
      return;
    }

    const payload = {
      employee_id: Number(form.employee_id),
      contract_id: Number(form.contract_id),
      periods: form.periods.map(Number),
      period_year: Number(form.period_year),
      salary_increase: Number(form.salary_increase || 0),
      irpf_mode: form.irpf_mode,
      incentives: form.incentives
        .filter((item) => Number(item.amount || 0) !== 0)
        .map((item) => ({
          period_month: Number(item.period_month),
          period_year: Number(item.period_year || form.period_year),
          amount: Number(item.amount || 0),
          description: item.description || "Variable futura",
        })),
    };

    try {
      setSubmitting(true);
      setResult(await simulateFuturePayrolls(payload));
    } catch (err) {
      setError(err.message || "Error al simular nóminas futuras");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGrid}>
          <label style={styles.field}>Trabajador
            <select name="employee_id" value={form.employee_id} onChange={handleEmployeeChange} required style={styles.input}>
              <option value="">Selecciona trabajador</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employee_code || employee.id} · {employee.first_name} {employee.last_name}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>Contrato activo
            <select name="contract_id" value={form.contract_id} onChange={handleChange} required style={styles.input}>
              <option value="">Selecciona contrato</option>
              {activeContracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.contract_type} · {formatCurrency(contract.salary_base || 0)} · {contract.start_date}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>Año simulación
            <input name="period_year" type="number" min="2000" max="2100" value={form.period_year} onChange={handleChange} style={styles.input} />
          </label>

          <label style={styles.field}>Subida mensual simulada
            <input name="salary_increase" type="number" step="0.01" value={form.salary_increase} onChange={handleChange} style={styles.input} />
          </label>

          <label style={styles.field}>Modo IRPF
            <select name="irpf_mode" value={form.irpf_mode} onChange={handleChange} style={styles.input}>
              <option value="auto">Automático</option>
              <option value="voluntary">Voluntario</option>
              <option value="manual">Manual</option>
            </select>
          </label>
        </div>

        {selectedEmployee && !selectedContract && <div style={styles.warning}>Este trabajador no tiene contrato activo seleccionado.</div>}

        <div style={styles.monthBlock}>
          <div style={styles.blockHeader}>
            <strong>Meses a simular</strong>
            <span>Marca los meses que quieras proyectar.</span>
          </div>
          <div style={styles.monthGrid}>
            {MONTH_OPTIONS.filter((item) => Number(item.value) <= 14).map((month) => (
              <label key={month.value} style={form.periods.includes(month.value) ? styles.monthSelected : styles.monthOption}>
                <input type="checkbox" checked={form.periods.includes(month.value)} onChange={() => handlePeriodToggle(month.value)} />
                {month.label}
              </label>
            ))}
          </div>
        </div>

        <div style={styles.incentiveBlock}>
          <div style={styles.blockHeaderRow}>
            <div>
              <strong>Variables futuras</strong>
              <span>Productividad, bonus, atrasos simples o complementos previstos.</span>
            </div>
            <button type="button" onClick={addIncentive} style={styles.secondaryButton}>Añadir variable</button>
          </div>

          {form.incentives.length === 0 && <p style={styles.emptyText}>Sin variables futuras añadidas.</p>}

          {form.incentives.map((item, index) => (
            <div key={`incentive-${index}`} style={styles.incentiveRow}>
              <select value={item.period_month} onChange={(event) => updateIncentive(index, "period_month", event.target.value)} style={styles.input}>
                {MONTH_OPTIONS.filter((month) => Number(month.value) <= 12).map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
              </select>
              <input type="number" value={item.period_year} onChange={(event) => updateIncentive(index, "period_year", event.target.value)} style={styles.input} />
              <input type="number" step="0.01" value={item.amount} onChange={(event) => updateIncentive(index, "amount", event.target.value)} placeholder="Importe" style={styles.input} />
              <input value={item.description} onChange={(event) => updateIncentive(index, "description", event.target.value)} placeholder="Descripción" style={styles.input} />
              <button type="button" onClick={() => removeIncentive(index)} style={styles.dangerButton}>Quitar</button>
            </div>
          ))}
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" disabled={submitting} style={styles.primaryButton}>
          {submitting ? "Simulando..." : "Simular próximos meses"}
        </button>
      </form>

      {result && (
        <div style={styles.results}>
          <div style={styles.kpiGrid}>
            <div style={styles.kpi}><span>Bruto previsto</span><strong>{formatCurrency(totals.gross)}</strong></div>
            <div style={styles.kpi}><span>Antigüedad prevista</span><strong>{formatCurrency(totals.seniority)}</strong></div>
            <div style={styles.kpi}><span>Prorrata prevista</span><strong>{formatCurrency(totals.proration)}</strong></div>
            <div style={styles.kpi}><span>Seguridad Social</span><strong>{formatCurrency(totals.ss)}</strong></div>
            <div style={styles.kpi}><span>IRPF previsto</span><strong>{formatCurrency(totals.irpf)}</strong></div>
            <div style={styles.kpi}><span>Neto previsto</span><strong>{formatCurrency(totals.net)}</strong></div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Periodo</th>
                  <th style={styles.thAmount}>Base</th>
                  <th style={styles.thAmount}>Complementos</th>
                  <th style={styles.thAmount}>Antigüedad</th>
                  <th style={styles.thAmount}>Prorrata extra</th>
                  <th style={styles.th}>Origen</th>
                  <th style={styles.thAmount}>Bruto</th>
                  <th style={styles.thAmount}>SS</th>
                  <th style={styles.thAmount}>IRPF %</th>
                  <th style={styles.thAmount}>IRPF</th>
                  <th style={styles.thAmount}>Neto</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={`${item.period_year}-${item.period_month}`}>
                    <td style={styles.tdStrong}>{getMonthLabel(item.period_month)} {item.period_year}</td>
                    <td style={styles.tdAmount}>{formatCurrency(item.base_salary)}</td>
                    <td style={styles.tdAmount}>{formatCurrency(item.salary_supplements)}</td>
                    <td style={styles.tdAmount}>{formatCurrency(item.seniority_amount)}</td>
                    <td style={styles.tdAmount}>{formatCurrency(item.extra_pay_proration)}</td>
                    <td style={styles.td}>{getProrationSourceLabel(item.extra_pay_proration_source)}</td>
                    <td style={styles.tdAmount}>{formatCurrency(item.gross_salary)}</td>
                    <td style={styles.tdAmount}>{formatCurrency(item.employee_social_security)}</td>
                    <td style={styles.tdAmount}>{formatPercent(item.irpf_percentage)}</td>
                    <td style={styles.tdAmount}>{formatCurrency(item.irpf)}</td>
                    <td style={styles.tdAmountStrong}>{formatCurrency(item.net_salary)}</td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr><td colSpan="11" style={styles.td}>No hay periodos válidos para este contrato.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "18px" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", color: "#374151", fontSize: "13px", fontWeight: 850 },
  input: { height: "38px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box", width: "100%" },
  monthBlock: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px", backgroundColor: "#f9fafb" },
  blockHeader: { display: "flex", flexDirection: "column", gap: "3px", marginBottom: "10px", color: "#374151" },
  blockHeaderRow: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", color: "#374151" },
  monthGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px" },
  monthOption: { display: "flex", gap: "8px", alignItems: "center", padding: "8px", border: "1px solid #d1d5db", borderRadius: "8px", backgroundColor: "#fff", fontWeight: 750, fontSize: "13px" },
  monthSelected: { display: "flex", gap: "8px", alignItems: "center", padding: "8px", border: "1px solid #111827", borderRadius: "8px", backgroundColor: "#fffdf0", fontWeight: 900, fontSize: "13px" },
  incentiveBlock: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px", backgroundColor: "#ffffff" },
  incentiveRow: { display: "grid", gridTemplateColumns: "170px 90px 120px 1fr 80px", gap: "8px", alignItems: "center", marginTop: "10px" },
  emptyText: { margin: "10px 0 0", color: "#6b7280", fontWeight: 750, fontSize: "13px" },
  primaryButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", borderRadius: "8px", padding: "11px 14px", cursor: "pointer", fontWeight: 900, width: "fit-content" },
  secondaryButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  dangerButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "8px 10px", cursor: "pointer", fontWeight: 900 },
  warning: { backgroundColor: "#fef3c7", color: "#92400e", padding: "10px 12px", borderRadius: "8px", fontWeight: 800 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", fontWeight: 800 },
  results: { display: "flex", flexDirection: "column", gap: "14px" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" },
  kpi: { border: "2px solid #111", backgroundColor: "#fff", boxShadow: "3px 3px 0 #f5ef9c", padding: "12px", display: "flex", flexDirection: "column", gap: "5px" },
  tableWrapper: { overflowX: "auto", width: "100%" },
  table: { width: "100%", minWidth: "1240px", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px", borderBottom: "2px solid #111", backgroundColor: "#f8f3b5", fontWeight: 900 },
  thAmount: { textAlign: "right", padding: "10px", borderBottom: "2px solid #111", backgroundColor: "#f8f3b5", fontWeight: 900 },
  td: { padding: "10px", borderBottom: "1px solid #e5e7eb" },
  tdStrong: { padding: "10px", borderBottom: "1px solid #e5e7eb", fontWeight: 900 },
  tdAmount: { padding: "10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", whiteSpace: "nowrap" },
  tdAmountStrong: { padding: "10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", whiteSpace: "nowrap", fontWeight: 950 },
};
