import { useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import PayrollForm, { PAYROLL_STATUS_OPTIONS } from "../components/payrolls/PayrollForm";
import PayrollTable from "../components/payrolls/PayrollTable";
import MonthlyPayrollPreparation from "../components/payrolls/MonthlyPayrollPreparation";
import { fetchPayrolls } from "../services/payrollApi";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getPeriodValue(payroll) {
  return Number(`${payroll.period_year}${String(payroll.period_month).padStart(2, "0")}`);
}

export default function PayrollsPage({
  loading,
  payrolls,
  employees,
  contracts,
  companies,
  workCenters,
  payrollForm,
  onPayrollChange,
  onPayrollSubmit,
  onUpdatePayroll,
  onDeletePayroll,
  payrollError,
  payrollSuccess,
  payrollSubmitting,
}) {
  const [filters, setFilters] = useState({
    employee: "",
    company: "",
    status: "",
    periodFrom: "",
    periodTo: "",
  });
  const [localPayrolls, setLocalPayrolls] = useState(payrolls);
  const [refreshingPayrolls, setRefreshingPayrolls] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");

  useEffect(() => {
    setLocalPayrolls(payrolls);
  }, [payrolls]);

  const refreshPayrollList = async () => {
    try {
      setRefreshingPayrolls(true);
      setRefreshMessage("");
      const data = await fetchPayrolls();
      setLocalPayrolls(data);
      setRefreshMessage("Listado de nóminas actualizado");
    } catch {
      setRefreshMessage("Las nóminas se han preparado, pero no se pudo refrescar el listado automáticamente");
    } finally {
      setRefreshingPayrolls(false);
    }
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      employee: "",
      company: "",
      status: "",
      periodFrom: "",
      periodTo: "",
    });
  };

  const filteredPayrolls = useMemo(() => {
    const employeeFilter = normalizeText(filters.employee);
    const companyFilter = normalizeText(filters.company);
    const statusFilter = normalizeText(filters.status);
    const fromPeriod = filters.periodFrom ? Number(filters.periodFrom.replace("-", "")) : null;
    const toPeriod = filters.periodTo ? Number(filters.periodTo.replace("-", "")) : null;

    return localPayrolls.filter((payroll) => {
      const employeeText = normalizeText(`${payroll.employee_name || ""} ${payroll.employee_id || ""}`);
      const companyText = normalizeText(`${payroll.company_name || ""} ${payroll.company_id || ""}`);
      const statusText = normalizeText(payroll.status);
      const payrollPeriod = getPeriodValue(payroll);

      const matchesEmployee = !employeeFilter || employeeText.includes(employeeFilter);
      const matchesCompany = !companyFilter || companyText.includes(companyFilter);
      const matchesStatus = !statusFilter || statusText === statusFilter;
      const matchesFromPeriod = !fromPeriod || payrollPeriod >= fromPeriod;
      const matchesToPeriod = !toPeriod || payrollPeriod <= toPeriod;

      return matchesEmployee && matchesCompany && matchesStatus && matchesFromPeriod && matchesToPeriod;
    });
  }, [localPayrolls, filters]);

  return (
    <div style={styles.wrapper}>
      <PageCard
        title="Preparar nóminas mensuales"
        subtitle="Selecciona una o varias empresas, opcionalmente un centro, y prepara todas las nóminas del periodo."
      >
        <MonthlyPayrollPreparation
          companies={companies}
          workCenters={workCenters}
          onPrepared={refreshPayrollList}
        />
      </PageCard>

      <details style={styles.details}>
        <summary style={styles.summary}>Crear nómina individual manual</summary>
        <PageCard title="Nueva nómina simulada" subtitle="Uso manual para pruebas puntuales fuera del proceso mensual.">
          <PayrollForm
            form={payrollForm}
            employees={employees}
            contracts={contracts}
            companies={companies}
            onChange={onPayrollChange}
            onSubmit={onPayrollSubmit}
            error={payrollError}
            success={payrollSuccess}
            submitting={payrollSubmitting}
          />
        </PageCard>
      </details>

      <PageCard title="Listado de nóminas" subtitle="Nóminas simuladas generadas en el sistema.">
        {refreshMessage && (
          <div style={refreshMessage.includes("no se pudo") ? styles.warning : styles.success}>
            {refreshMessage}
          </div>
        )}

        <div style={styles.filters}>
          <div style={styles.filterGroupWide}>
            <label style={styles.label}>Trabajador</label>
            <input
              name="employee"
              value={filters.employee}
              onChange={handleFilterChange}
              placeholder="Nombre o código"
              style={styles.input}
            />
          </div>

          <div style={styles.filterGroupWide}>
            <label style={styles.label}>Empresa</label>
            <input
              name="company"
              value={filters.company}
              onChange={handleFilterChange}
              placeholder="Empresa o ID"
              style={styles.input}
            />
          </div>

          <div style={styles.filterGroupSmall}>
            <label style={styles.label}>Estado</label>
            <select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}>
              <option value="">Todos</option>
              {PAYROLL_STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroupMonth}>
            <label style={styles.label}>Desde</label>
            <input type="month" name="periodFrom" value={filters.periodFrom} onChange={handleFilterChange} style={styles.input} />
          </div>

          <div style={styles.filterGroupMonth}>
            <label style={styles.label}>Hasta</label>
            <input type="month" name="periodTo" value={filters.periodTo} onChange={handleFilterChange} style={styles.input} />
          </div>

          <button type="button" onClick={clearFilters} style={styles.clearButton}>
            Limpiar
          </button>
        </div>

        <div style={styles.resultInfo}>
          {refreshingPayrolls ? "Actualizando listado..." : `Mostrando ${filteredPayrolls.length} de ${localPayrolls.length} nóminas`}
        </div>

        <PayrollTable
          loading={loading || refreshingPayrolls}
          payrolls={filteredPayrolls}
          contracts={contracts}
          employees={employees}
          onUpdatePayroll={onUpdatePayroll}
          onDeletePayroll={onDeletePayroll}
          submitting={payrollSubmitting}
        />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  details: { display: "flex", flexDirection: "column", gap: "12px" },
  summary: { cursor: "pointer", fontWeight: 900, color: "#111827", padding: "10px 0" },
  filters: { display: "grid", gridTemplateColumns: "minmax(190px, 1.2fr) minmax(190px, 1.2fr) 130px 132px 132px 86px", columnGap: "10px", rowGap: "10px", alignItems: "end", marginBottom: "10px", width: "100%" },
  filterGroupWide: { minWidth: 0, display: "flex", flexDirection: "column", gap: "5px" },
  filterGroupSmall: { minWidth: 0, display: "flex", flexDirection: "column", gap: "5px" },
  filterGroupMonth: { minWidth: 0, display: "flex", flexDirection: "column", gap: "5px" },
  label: { fontSize: "13px", fontWeight: 700, color: "#374151" },
  input: { width: "100%", height: "36px", boxSizing: "border-box", padding: "7px 9px", border: "1px solid #ccc", borderRadius: "7px", fontSize: "13px" },
  clearButton: { width: "86px", height: "36px", backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "7px 8px", cursor: "pointer", fontWeight: 800, fontSize: "12px", whiteSpace: "nowrap" },
  resultInfo: { marginBottom: "16px", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  success: { marginBottom: "12px", backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px", fontWeight: 800 },
  warning: { marginBottom: "12px", backgroundColor: "#fef3c7", color: "#92400e", padding: "10px 12px", borderRadius: "8px", fontWeight: 800 },
};
