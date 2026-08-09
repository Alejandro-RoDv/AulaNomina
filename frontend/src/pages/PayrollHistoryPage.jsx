import { useEffect, useMemo, useState } from "react";

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

function filtersFromCaseContext(context = {}) {
  const period = String(context.period || "");
  const [year = "", month = ""] = period.includes("-") ? period.split("-", 2) : ["", ""];
  return {
    employee: context.employeeName || context.employeeId || "",
    company: context.company || context.center || context.companyName || context.companyId || "",
    year,
    month: month ? String(Number(month)) : "",
    status: context.status || "",
  };
}

function getInitialFilters() {
  if (typeof window === "undefined") return filtersFromCaseContext();
  const params = new URLSearchParams(window.location.search);
  const urlContext = {
    employeeName: params.get("employee"),
    employeeId: params.get("employeeId"),
    company: params.get("company"),
    center: params.get("center"),
    companyId: params.get("companyId"),
    period: params.get("period"),
    status: params.get("status"),
  };
  if (Object.values(urlContext).some(Boolean)) return filtersFromCaseContext(urlContext);
  try {
    const stored = JSON.parse(window.sessionStorage.getItem("aulanomina:active-case-context") || "null");
    return filtersFromCaseContext(stored || {});
  } catch {
    return filtersFromCaseContext();
  }
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
  const [filters, setFilters] = useState(getInitialFilters);

  useEffect(() => {
    setLocalPayrolls(payrolls);
  }, [payrolls]);

  useEffect(() => {
    const applyCaseContext = (event) => {
      const context = event.detail || {};
      if (context.page !== "payroll-history") return;
      setFilters(filtersFromCaseContext(context));
    };
    window.addEventListener("aulanomina-case-context", applyCaseContext);
    return () => window.removeEventListener("aulanomina-case-context", applyCaseContext);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("period") || params.get("employee") || params.get("company")) {
      refreshPayrollList();
    }
  }, []);

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
    <div className="payroll-s42 payroll-s42--history">
      <section className="payroll-s42__kpi-grid" aria-label="Resumen del histórico">
        <div className="payroll-s42__kpi"><span>Nóminas</span><strong>{filteredPayrolls.length}</strong></div>
        <div className="payroll-s42__kpi"><span>Bruto filtrado</span><strong>{totals.gross.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong></div>
        <div className="payroll-s42__kpi"><span>Neto filtrado</span><strong>{totals.net.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong></div>
      </section>

      <section className="payroll-s42__filters">
        <div className="payroll-s42__filters-header">
          <h2>Filtros</h2>
          <div className="payroll-s42__filters-actions">
            <button type="button" onClick={refreshPayrollList} className="payroll-s42__primary">
              {refreshingPayrolls ? "Actualizando..." : "Actualizar"}
            </button>
            <button type="button" onClick={clearFilters} className="payroll-s42__secondary">Limpiar filtros</button>
          </div>
        </div>

        <div className="payroll-s42__filters-grid">
          <label className="payroll-s42__field">Trabajador
            <input name="employee" value={filters.employee} onChange={handleFilterChange} placeholder="Nombre, DNI o código" />
          </label>
          <label className="payroll-s42__field">Empresa / centro
            <input name="company" value={filters.company} onChange={handleFilterChange} placeholder="Empresa, centro, CIF o CCC" />
          </label>
          <label className="payroll-s42__field">Año
            <select name="year" value={filters.year} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label className="payroll-s42__field">Mes
            <select name="month" value={filters.month} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map((month) => <option key={month} value={month}>{getMonthLabel(month)}</option>)}
            </select>
          </label>
          <label className="payroll-s42__field">Estado
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="calculated">Calculada</option>
              <option value="reviewed">Revisada</option>
              <option value="closed">Cerrada</option>
              <option value="cancelled">Anulada</option>
            </select>
          </label>
        </div>
      </section>

      {refreshMessage && <div className="payroll-s42__message">{refreshMessage}</div>}
      <div className="payroll-s42__result-info">
        {refreshingPayrolls ? "Actualizando listado..." : `${filteredPayrolls.length} resultados de ${localPayrolls.length}`}
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
    </div>
  );
}
