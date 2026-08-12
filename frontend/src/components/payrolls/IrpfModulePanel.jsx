import { useEffect, useMemo, useState } from "react";

import EmployeeIrpfPanel from "../employees/EmployeeIrpfPanel";
import { fetchEmployeeTaxProfile } from "../../services/taxProfileApi";
import { getEmployeeVisibleCode } from "../../utils/visibleCodes";
import "./irpfWorkspace.css";

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
  return workCenters.find((center) => Number(center.id) === Number(employee?.center_id))?.name || "Sin centro";
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
  const [selectorOpen, setSelectorOpen] = useState(true);
  const [filters, setFilters] = useState({ code: "", name: "", dni: "", company: "" });

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.id) === String(employeeId)) || null,
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
    if (!employeeId && employees[0]?.id) {
      setEmployeeId(String(employees[0].id));
      setSelectorOpen(false);
    }
  }, [employees, employeeId]);

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
    setSelectorOpen(false);
  };

  if (!employees.length) {
    return <div className="irpf-empty-state">No hay trabajadores activos para mostrar el módulo IRPF.</div>;
  }

  const selectedCompanyName = getCompanyName(selectedEmployee, companies);
  const selectedCenterName = getCenterName(selectedEmployee, workCenters);

  return (
    <div className="irpf-workspace">
      {selectedEmployee && (
        <section className="irpf-worker-context">
          <div className="irpf-worker-context__identity">
            <span className="irpf-eyebrow">Trabajador seleccionado</span>
            <strong>{getEmployeeVisibleCode(selectedEmployee, employees, contracts)} · {getEmployeeName(selectedEmployee)}</strong>
            <small>DNI {selectedEmployee.dni || "-"}</small>
          </div>
          <div className="irpf-worker-context__meta">
            <span><b>Empresa</b>{selectedCompanyName}</span>
            <span><b>Centro</b>{selectedCenterName}</span>
            <span><b>Contrato</b>{activeContract?.contract_type || "Sin contrato"}</span>
            <span><b>Bruto anual</b>{formatSalary(activeContract?.salary_base)}</span>
          </div>
          <button type="button" className="irpf-btn irpf-btn--secondary" onClick={() => setSelectorOpen((value) => !value)}>
            {selectorOpen ? "Cerrar selección" : "Cambiar trabajador"}
          </button>
        </section>
      )}

      {selectorOpen && (
        <section className="irpf-selector-panel">
          <div className="irpf-section-heading">
            <div>
              <span className="irpf-eyebrow">Gestión fiscal del trabajador</span>
              <h2>Selecciona un trabajador</h2>
              <p>Busca por código, nombre, DNI, empresa, centro o contrato.</p>
            </div>
          </div>

          <div className="irpf-filter-grid">
            <label>Código / ID<input name="code" value={filters.code} onChange={handleFilterChange} placeholder="Ej. 1.2" /></label>
            <label>Nombre y apellidos<input name="name" value={filters.name} onChange={handleFilterChange} placeholder="Nombre o apellidos" /></label>
            <label>DNI<input name="dni" value={filters.dni} onChange={handleFilterChange} placeholder="DNI" /></label>
            <label>Empresa / centro<input name="company" value={filters.company} onChange={handleFilterChange} placeholder="Empresa, centro o contrato" /></label>
            <button type="button" className="irpf-btn irpf-btn--secondary" onClick={clearFilters}>Limpiar</button>
          </div>

          <div className="irpf-result-count">{filteredEmployees.length} de {employees.length} trabajadores</div>

          <div className="irpf-table-shell irpf-table-shell--selector">
            <table className="irpf-table irpf-table--compact">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Trabajador</th>
                  <th>DNI</th>
                  <th>Empresa / centro</th>
                  <th>Contrato</th>
                  <th className="is-number">Bruto anual</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => {
                  const contract = getActiveContract(employee.id, contracts);
                  const selected = String(employee.id) === String(employeeId);
                  return (
                    <tr key={employee.id} className={selected ? "is-selected" : ""}>
                      <td className="is-code">{getEmployeeVisibleCode(employee, employees, contracts)}</td>
                      <td><strong>{getEmployeeName(employee)}</strong></td>
                      <td>{employee.dni || "-"}</td>
                      <td><strong>{getCompanyName(employee, companies)}</strong><small>{getCenterName(employee, workCenters)}</small></td>
                      <td><strong>{contract?.contract_type || "-"}</strong><small>{formatPaySchedule(contract?.pay_schedule)}</small></td>
                      <td className="is-number">{formatSalary(contract?.salary_base)}</td>
                      <td className="is-action"><button type="button" className="irpf-btn irpf-btn--small" onClick={() => selectEmployee(employee)}>{selected ? "Seleccionado" : "Abrir"}</button></td>
                    </tr>
                  );
                })}
                {filteredEmployees.length === 0 && <tr><td colSpan="7" className="irpf-table-empty">No hay trabajadores con esos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {error && <div className="irpf-banner irpf-banner--error">{error}</div>}
      {loadingProfile && <div className="irpf-banner irpf-banner--info">Cargando ficha fiscal...</div>}

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
