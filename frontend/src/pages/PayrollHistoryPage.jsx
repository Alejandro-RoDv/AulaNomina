import { useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import PayrollTable from "../components/payrolls/PayrollTable";
import { fetchPayrolls } from "../services/payrollApi";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getMonthLabel(month) {
  const labels = {
    1: "Enero",
    2: "Febrero",
    3: "Marzo",
    4: "Abril",
    5: "Mayo",
    6: "Junio",
    7: "Julio",
    8: "Agosto",
    9: "Septiembre",
    10: "Octubre",
    11: "Noviembre",
    12: "Diciembre",
    13: "Extra julio",
    14: "Extra diciembre",
  };
  return labels[Number(month)] || month;
}

export default function PayrollHistoryPage({
  loading,
  payrolls = [],
  contracts = [],
  employees = [],
  companies = [],
  workCenters = [],
  onUpdatePayroll,
  onDeletePayroll,
  payrollSubmitting,
}) {
  const [localPayrolls, setLocalPayrolls] = useState(payrolls);
  const [refreshingPayrolls, setRefreshingPayrolls] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [filters, setFilters] = useState({
    employee: "",
    company: "",
    year: "",
    month: "",
    status: "",
  });

  useEffect(() => {
    setLocalPayrolls(payrolls);
  }, [payrolls]);

  async function refreshPayrollList() {
    try {
      setRefreshingPayrolls(true);
      const data = await fetchPayrolls();
      setLocalPayrolls(data);
      setRefreshMessage("Histórico de nóminas actualizado.");
    } catch {
      setRefreshMessage("No se pudo refrescar el histórico automáticamente.");
    } finally {
      setRefreshingPayrolls(false);
    }
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function clearFilters() {
    setFilters({ employee: "", company: "", year: "", month: "", status: "" });
  }

  function getEmployeeSearchText(payroll) {
    const employee = employees.find((item) => Number(item.id) === Number(payroll.employee_id));
    return `${payroll.employee_name || ""} ${employee?.first_name || ""} ${employee?.last_name || ""} ${employee?.dni || ""} ${employee?.employee_code || ""} ${payroll.employee_id || ""}`;
  }

  function getCompanySearchText(payroll) {
    const company = companies.find((item) => Number(item.id) === Number(payroll.company_id));
    const center = workCenters.find((item) => Number(item.id) === Number(payroll.center_id));
    return `${payroll.company_name || ""} ${company?.name || ""} ${company?.cif || ""} ${company?.ccc || ""} ${center?.name || ""}`;
  }

  const availableYears = useMemo(() => {
    return [...new Set(localPayrolls.map((payroll) => payroll.period_year).filter(Boolean))].sort((a, b) => b - a);
  }, [localPayrolls]);

  const filteredPayrolls = useMemo(() => {
    const employeeFilter = normalizeText(filters.employee);
    const companyFilter = normalizeText(filters.company);
    return localPayrolls.filter((payroll) => {
      const matchesEmployee = !employeeFilter || normalizeText(getEmployeeSearchText(payroll)).includes(employeeFilter);
      const matchesCompany = !companyFilter || normalizeText(getCompanySearchText(payroll)).includes(companyFilter);
      const matchesYear = !filters.year || String(payroll.period_year) === String(filters.year);
      const matchesMonth = !filters.month || String(payroll.period_month) === String(filters.month);
      const matchesStatus = !filters.status || String(payroll.status) === String(filters.status);
      return matchesEmployee && matchesCompany && matchesYear && matchesMonth && matchesStatus;
    });
  }, [localPayrolls, filters, employees, companies, workCenters]);

  const totals = useMemo(() => {
    return filteredPayrolls.reduce((acc, payroll) => {
      acc.gross += Number(payroll.gross_salary || 0);
      acc.deductions += Number(payroll.total_deductions || 0);
      acc.net += Number(payroll.net_salary || 0);
      return acc;
    }, { gross: 0, deductions: 0, net: 0 });
  }, [filteredPayrolls]);

  return (
    <div style={styles.wrapper}>
      <PageCard
        title="Histórico de nóminas"
        subtitle="Consulta de nóminas generadas, revisión de conceptos, detalle de recibo y anulación."
      >
        <div style={styles.kpiGrid}>
          <div style={styles.kpi}><span>Nóminas</span><strong>{filteredPayrolls.length}</strong></div>
          <div style={styles.kpi}><span>Bruto filtrado</span><strong>{totals.gross.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong></div>
          <div style={styles.kpi}><span>Neto filtrado</span><strong>{totals.net.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong></div>
        </div>

        <div style={styles.filtersBox}>
          <div style={styles.filtersHeader}>
            <h3 style={styles.blockTitle}>Filtros</h3>
            <div style={styles.actions}> 
              <button type="button" onClick={refreshPayrollList} style={styles.secondaryButton}>{refreshingPayrolls ? "Actualizando..." : "Actualizar"}</button>
              <button type="button" onClick={clearFilters} style={styles.clearButton}>Limpiar filtros</button>
            </div>
          </div>
          <div style={styles.filtersGrid}>
            <label style={styles.field}>Trabajador
              <input name="employee" value={filters.employee} onChange={handleFilterChange} placeholder="Nombre, DNI o código" style={styles.input} />
            </label>
            <label style={styles.field}>Empresa / centro
              <input name="company" value={filters.company} onChange={handleFilterChange} placeholder="Empresa, centro, CIF o CCC" style={styles.input} />
            </label>
            <label style={styles.field}>Año
              <select name="year" value={filters.year} onChange={handleFilterChange} style={styles.input}>
                <option value="">Todos</option>
                {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label style={styles.field}>Mes
              <select name="month" value={filters.month} onChange={handleFilterChange} style={styles.input}>
                <option value="">Todos</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map((month) => <option key={month} value={month}>{getMonthLabel(month)}</option>)}
              </select>
            </label>
            <label style={styles.field}>Estado
              <select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}>
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="calculated">Calculada</option>
                <option value="reviewed">Revisada</option>
                <option value="closed">Cerrada</option>
                <option value="cancelled">Anulada</option>
              </select>
            </label>
          </div>
        </div>

        {refreshMessage && <div style={styles.notice}>{refreshMessage}</div>}
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
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", marginBottom: "16px" },
  kpi: { border: "2px solid #111827", borderRadius: "12px", padding: "11px 12px", backgroundColor: "#fffdf0", display: "flex", justifyContent: "space-between", gap: "12px", fontWeight: 900 },
  filtersBox: { border: "2px solid #111827", borderRadius: "14px", padding: "14px", backgroundColor: "#ffffff", marginBottom: "16px", boxShadow: "3px 3px 0 #e6d85c" },
  filtersHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "12px" },
  blockTitle: { margin: 0, fontSize: "17px", fontWeight: 900, color: "#111827" },
  actions: { display: "flex", gap: "8px", alignItems: "center" },
  filtersGrid: { display: "grid", gridTemplateColumns: "1.2fr 1.4fr 120px 150px 150px", gap: "12px", alignItems: "end" },
  field: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 900, color: "#374151" },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "2px solid #d1d5db", borderRadius: "8px", fontSize: "14px", fontWeight: 700 },
  secondaryButton: { backgroundColor: "#e6d85c", color: "#111827", border: "2px solid #111827", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontWeight: 900 },
  clearButton: { backgroundColor: "#ffffff", color: "#111827", border: "2px solid #111827", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontWeight: 900 },
  resultInfo: { marginBottom: "16px", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  notice: { marginBottom: "12px", backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px", fontWeight: 800 },
};
