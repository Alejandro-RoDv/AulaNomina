import { useEffect, useMemo, useState } from "react";

import EmployeeIrpfPanel from "../employees/EmployeeIrpfPanel";
import { fetchEmployeeTaxProfile } from "../../services/taxProfileApi";
import { getEmployeeVisibleCode } from "../../utils/visibleCodes";

function getEmployeeName(employee) {
  return `${employee?.first_name || ""} ${employee?.last_name || ""}`.trim();
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getCompanyName(employee, companies) {
  return companies.find((company) => Number(company.id) === Number(employee?.company_id))?.name || "-";
}

function getCenterName(employee, workCenters) {
  return workCenters.find((center) => Number(center.id) === Number(employee?.center_id))?.name || "-";
}

function getActiveContract(employeeId, contracts) {
  const employeeContracts = contracts.filter((contract) => String(contract.employee_id) === String(employeeId));
  return employeeContracts.find((contract) => contract.status === "active") || employeeContracts[0] || null;
}

function formatSalary(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function formatPaySchedule(value) {
  if (value === "prorated_12") return "12 pagas prorrateadas";
  if (value === "not_prorated_14") return "14 pagas";
  return "-";
}

export default function IrpfModulePanel({ employees = [], contracts = [], companies = [], workCenters = [], onRefresh }) {
  const [employeeId, setEmployeeId] = useState("");
  const [taxProfile, setTaxProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ code: "", name: "", dni: "", company: "" });

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.id) === String(employeeId)),
    [employees, employeeId]
  );

  const activeContract = useMemo(() => getActiveContract(employeeId, contracts), [contracts, employeeId]);

  const filteredEmployees = useMemo(() => {
    const codeFilter = normalizeText(filters.code);
    const nameFilter = normalizeText(filters.name);
    const dniFilter = normalizeText(filters.dni);
    const companyFilter = normalizeText(filters.company);

    return employees.filter((employee) => {
      const visibleCode = normalizeText(getEmployeeVisibleCode(employee, employees, contracts));
      const backendId = normalizeText(employee.id);
      const employeeCode = normalizeText(employee.employee_code);
      const name = normalizeText(getEmployeeName(employee));
      const dni = normalizeText(employee.dni);
      const company = normalizeText(getCompanyName(employee, companies));
      const center = normalizeText(getCenterName(employee, workCenters));
      const contract = getActiveContract(employee.id, contracts);
      const contractText = normalizeText(`${contract?.contract_type || ""} ${contract?.status || ""} ${contract?.salary_base || ""}`);

      return (
        (!codeFilter || visibleCode.includes(codeFilter) || backendId.includes(codeFilter) || employeeCode.includes(codeFilter)) &&
        (!nameFilter || name.includes(nameFilter)) &&
        (!dniFilter || dni.includes(dniFilter)) &&
        (!companyFilter || company.includes(companyFilter) || center.includes(companyFilter) || contractText.includes(companyFilter))
      );
    });
  }, [employees, contracts, companies, workCenters, filters]);

  useEffect(() => {
    if (!employeeId && filteredEmployees[0]?.id) {
      setEmployeeId(String(filteredEmployees[0].id));
    }
  }, [filteredEmployees, employeeId]);

  const loadTaxProfile = async () => {
    if (!employeeId) return;
    try {
      setLoadingProfile(true);
      setError("");
      setTaxProfile(await fetchEmployeeTaxProfile(employeeId));
    } catch (err) {
      if (String(err.message || "").includes("404")) {
        setTaxProfile(null);
      } else {
        setError(err.message || "Error al cargar ficha fiscal del trabajador");
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadTaxProfile();
  }, [employeeId]);

  const handleRefresh = async () => {
    await loadTaxProfile();
    await onRefresh?.();
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ code: "", name: "", dni: "", company: "" });
  };

  const selectEmployee = (employee) => {
    setEmployeeId(String(employee.id));
  };

  if (!employees.length) {
    return <p style={styles.empty}>No hay trabajadores activos para mostrar el módulo IRPF.</p>;
  }

  const selectedCompanyName = getCompanyName(selectedEmployee, companies);
  const selectedCenterName = getCenterName(selectedEmployee, workCenters);

  return (
    <div style={styles.wrapper}>
      <div style={styles.selectorBox}>
        <div style={styles.selectorHeader}>
          <div>
            <p style={styles.eyebrow}>MÓDULO IRPF</p>
            <h3 style={styles.title}>IRPF del trabajador</h3>
            <p style={styles.subtitle}>Busca por código, nombre, DNI, empresa o centro. La selección carga su ficha fiscal y su previsión anual.</p>
          </div>

          {selectedEmployee && (
            <div style={styles.selectedCard}>
              <span>Trabajador seleccionado</span>
              <strong>{getEmployeeVisibleCode(selectedEmployee, employees, contracts)} · {getEmployeeName(selectedEmployee)}</strong>
              <small>DNI {selectedEmployee.dni || "-"} · {selectedCompanyName} · {selectedCenterName}</small>
              <small>{activeContract ? `${activeContract.contract_type || "Contrato"} · ${formatPaySchedule(activeContract.pay_schedule)} · ${formatSalary(activeContract.salary_base)}` : "Sin contrato localizado"}</small>
            </div>
          )}
        </div>

        <div style={styles.filters}>
          <label style={styles.field}>Código / ID
            <input name="code" value={filters.code} onChange={handleFilterChange} placeholder="Ej. 1.2" style={styles.input} />
          </label>
          <label style={styles.field}>Nombre y apellidos
            <input name="name" value={filters.name} onChange={handleFilterChange} placeholder="Nombre o apellidos" style={styles.input} />
          </label>
          <label style={styles.field}>DNI
            <input name="dni" value={filters.dni} onChange={handleFilterChange} placeholder="DNI" style={styles.input} />
          </label>
          <label style={styles.field}>Empresa / centro
            <input name="company" value={filters.company} onChange={handleFilterChange} placeholder="Empresa o centro" style={styles.input} />
          </label>
          <button type="button" onClick={clearFilters} style={styles.clearButton}>Limpiar filtros</button>
        </div>

        <div style={styles.resultInfo}>Mostrando {filteredEmployees.length} de {employees.length} trabajadores</div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Código</th>
                <th style={styles.th}>Trabajador</th>
                <th style={styles.th}>DNI</th>
                <th style={styles.th}>Empresa</th>
                <th style={styles.th}>Centro</th>
                <th style={styles.th}>Contrato</th>
                <th style={styles.thAmount}>Bruto anual</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => {
                const contract = getActiveContract(employee.id, contracts);
                const selected = String(employee.id) === String(employeeId);
                return (
                  <tr key={employee.id} style={selected ? styles.selectedRow : undefined}>
                    <td style={styles.tdStrong}>{getEmployeeVisibleCode(employee, employees, contracts)}</td>
                    <td style={styles.td}>{getEmployeeName(employee)}</td>
                    <td style={styles.td}>{employee.dni || "-"}</td>
                    <td style={styles.td}>{getCompanyName(employee, companies)}</td>
                    <td style={styles.td}>{getCenterName(employee, workCenters)}</td>
                    <td style={styles.td}>{contract ? `${contract.contract_type || "-"} · ${formatPaySchedule(contract.pay_schedule)}` : "-"}</td>
                    <td style={styles.tdAmount}>{formatSalary(contract?.salary_base)}</td>
                    <td style={styles.tdRight}>
                      <button type="button" onClick={() => selectEmployee(employee)} style={selected ? styles.selectedButton : styles.smallButton}>
                        {selected ? "Seleccionado" : "Seleccionar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredEmployees.length === 0 && <tr><td style={styles.td} colSpan="8">No hay trabajadores con esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {loadingProfile && <div style={styles.warning}>Cargando ficha fiscal...</div>}

      {selectedEmployee && (
        <EmployeeIrpfPanel
          employee={selectedEmployee}
          taxProfile={taxProfile}
          activeContract={activeContract}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "16px" },
  selectorBox: { border: "2px solid #111", backgroundColor: "#fffdf0", boxShadow: "4px 4px 0 #111", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" },
  selectorHeader: { display: "grid", gridTemplateColumns: "1fr minmax(340px, 480px)", gap: "18px", alignItems: "start" },
  eyebrow: { margin: "0 0 6px", fontSize: "11px", fontWeight: 950, letterSpacing: "0.08em", color: "#92400e" },
  title: { margin: 0, color: "#111", fontSize: "22px", fontWeight: 950 },
  subtitle: { margin: "6px 0 0", color: "#4b5563", fontSize: "13px", fontWeight: 750 },
  selectedCard: { border: "1px solid #111", backgroundColor: "#ffffff", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" },
  filters: { display: "grid", gridTemplateColumns: "130px minmax(220px, 1fr) 160px minmax(220px, 1fr) 130px", gap: "12px", alignItems: "end" },
  field: { display: "flex", flexDirection: "column", gap: "6px", color: "#374151", fontSize: "13px", fontWeight: 850 },
  input: { height: "39px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box", width: "100%" },
  clearButton: { height: "39px", backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", cursor: "pointer", fontWeight: 900 },
  resultInfo: { color: "#6b7280", fontSize: "13px", fontWeight: 800 },
  tableWrapper: { maxHeight: "280px", overflow: "auto", border: "1px solid #e5e7eb", backgroundColor: "#fff" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { textAlign: "left", borderBottom: "2px solid #111", padding: "9px", backgroundColor: "#f8f3b5", fontWeight: 950, position: "sticky", top: 0, zIndex: 1 },
  thAmount: { textAlign: "right", borderBottom: "2px solid #111", padding: "9px", backgroundColor: "#f8f3b5", fontWeight: 950, position: "sticky", top: 0, zIndex: 1 },
  td: { borderBottom: "1px solid #e5e7eb", padding: "9px", verticalAlign: "middle" },
  tdStrong: { borderBottom: "1px solid #e5e7eb", padding: "9px", verticalAlign: "middle", fontWeight: 950 },
  tdAmount: { borderBottom: "1px solid #e5e7eb", padding: "9px", textAlign: "right", whiteSpace: "nowrap" },
  tdRight: { borderBottom: "1px solid #e5e7eb", padding: "9px", textAlign: "right" },
  selectedRow: { backgroundColor: "#fff7cc" },
  smallButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", borderRadius: "7px", padding: "7px 10px", cursor: "pointer", fontWeight: 850 },
  selectedButton: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: "7px", padding: "7px 10px", cursor: "pointer", fontWeight: 900 },
  empty: { margin: 0, color: "#6b7280", fontWeight: 750 },
  error: { color: "#991b1b", backgroundColor: "#fee2e2", border: "1px solid #fecaca", padding: "9px", fontWeight: 800 },
  warning: { color: "#92400e", backgroundColor: "#fef3c7", border: "1px solid #fde68a", padding: "9px", fontWeight: 800 },
};