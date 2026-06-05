import { useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import ContractForm from "../components/ContractForm";
import ContractTable from "../components/ContractTable";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getStoredMode() {
  return window.sessionStorage.getItem("aulanomina:contractsMode") || "new";
}

function buildContractsWithDisplayCodes(contracts, employees) {
  const employeeCodeById = employees.reduce((acc, employee) => {
    acc[employee.id] = employee.employee_code || String(employee.id);
    return acc;
  }, {});

  const countersByEmployee = {};

  return [...contracts]
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((contract) => {
      const employeeId = contract.employee_id;
      countersByEmployee[employeeId] = (countersByEmployee[employeeId] || 0) + 1;

      return {
        ...contract,
        contract_display_code: `${employeeCodeById[employeeId] || employeeId}.${countersByEmployee[employeeId]}`,
      };
    });
}

export default function ContractsPage({
  mode = null,
  loading,
  contracts,
  employees,
  companies,
  workCenters,
  collectiveAgreements = [],
  contractForm,
  onContractChange,
  onContractSubmit,
  onUpdateContract,
  onDeleteContract,
  contractError,
  contractSuccess,
  contractSubmitting,
}) {
  const [contractMode, setContractMode] = useState(getStoredMode);
  const [filters, setFilters] = useState({
    id: "",
    employee: "",
    company: "",
    contractType: "",
    status: "",
  });

  useEffect(() => {
    const syncContractMode = () => setContractMode(getStoredMode());
    window.addEventListener("aulanomina-contract-mode", syncContractMode);
    return () => window.removeEventListener("aulanomina-contract-mode", syncContractMode);
  }, []);

  const contractsWithDisplayCodes = useMemo(
    () => buildContractsWithDisplayCodes(contracts, employees),
    [contracts, employees]
  );

  const activeContractsCount = contractsWithDisplayCodes.filter((contract) => contract.status === "active").length;
  const transformedContractsCount = contractsWithDisplayCodes.filter((contract) => contract.status === "transformed" || contract.transformation_from_contract_id).length;
  const bonifiedContractsCount = contractsWithDisplayCodes.filter((contract) => contract.bonus_type).length;

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ id: "", employee: "", company: "", contractType: "", status: "" });
  };

  const getEmployeeText = (contract) => {
    if (contract.employee_name) return contract.employee_name;
    const employee = employees.find((item) => Number(item.id) === Number(contract.employee_id));
    if (!employee) return String(contract.employee_id || "");
    return `${employee.first_name || ""} ${employee.last_name || ""} ${employee.dni || ""} ${employee.employee_code || ""} ${employee.id || ""}`;
  };

  const getCompanyText = (contract) => {
    const company = companies.find((item) => Number(item.id) === Number(contract.company_id));
    const center = workCenters.find((item) => Number(item.id) === Number(contract.center_id));
    const companyName = contract.company_name || company?.name || "";
    const centerName = center?.name || "";
    const companyCcc = company?.ccc || "";
    const companyCif = company?.cif || "";
    return `${companyName} ${centerName} ${companyCcc} ${companyCif} ${contract.company_id || ""} ${contract.center_id || ""}`;
  };

  const filteredContracts = useMemo(() => {
    const idFilter = normalizeText(filters.id);
    const employeeFilter = normalizeText(filters.employee);
    const companyFilter = normalizeText(filters.company);
    const contractTypeFilter = normalizeText(filters.contractType);
    const statusFilter = normalizeText(filters.status);

    return contractsWithDisplayCodes.filter((contract) => {
      const contractId = normalizeText(`${contract.contract_display_code} ${contract.id} ${contract.contract_code || ""}`);
      const employeeText = normalizeText(getEmployeeText(contract));
      const companyText = normalizeText(getCompanyText(contract));
      const contractType = normalizeText(contract.contract_type);
      const status = normalizeText(contract.status);

      const matchesId = !idFilter || contractId.includes(idFilter);
      const matchesEmployee = !employeeFilter || employeeText.includes(employeeFilter);
      const matchesCompany = !companyFilter || companyText.includes(companyFilter);
      const matchesContractType = !contractTypeFilter || contractType === contractTypeFilter;
      const matchesStatus = !statusFilter || status === statusFilter;

      return matchesId && matchesEmployee && matchesCompany && matchesContractType && matchesStatus;
    });
  }, [contractsWithDisplayCodes, employees, companies, workCenters, filters]);

  const isHistory = (mode || contractMode) === "history";

  return (
    <div style={styles.wrapper}>
      <div style={styles.moduleHeader}>
        <div>
          <h2 style={styles.title}>{isHistory ? "Historial de contratos" : "Nuevo contrato"}</h2>
          <p style={styles.subtitle}>{isHistory ? "Consulta contratos anteriores, activos, transformados, bonificaciones e inactividad registrada." : "Alta contractual, transformación, jornada, bonificaciones, afiliación y registro."}</p>
        </div>
        <div style={styles.statsGrid}>
          <Metric label="Contratos" value={contractsWithDisplayCodes.length} />
          <Metric label="Activos" value={activeContractsCount} />
          <Metric label="Transformaciones" value={transformedContractsCount} />
          <Metric label="Bonificados" value={bonifiedContractsCount} />
        </div>
      </div>

      {!isHistory && (
        <PageCard title="Nuevo contrato" subtitle="Registra un contrato laboral simulado con datos de afiliación, jornada, bonificación y registro.">
          <ContractForm
            form={contractForm}
            employees={employees}
            companies={companies}
            workCenters={workCenters}
            contracts={contracts}
            collectiveAgreements={collectiveAgreements}
            onChange={onContractChange}
            onSubmit={onContractSubmit}
            error={contractError}
            success={contractSuccess}
            submitting={contractSubmitting}
          />
        </PageCard>
      )}

      {isHistory && (
        <PageCard title="Historial de contratos" subtitle="Consulta contratos anteriores, activos, transformados, bonificaciones e inactividad registrada.">
          <div style={styles.filters}>
            <div style={styles.filterGroupCode}>
              <label>Código</label>
              <input name="id" value={filters.id} onChange={handleFilterChange} placeholder="Ej. 1.1 o 402" style={styles.input} />
            </div>
            <div style={styles.filterGroupEmployee}>
              <label>Empleado</label>
              <input name="employee" value={filters.employee} onChange={handleFilterChange} placeholder="Nombre, DNI o ID" style={styles.input} />
            </div>
            <div style={styles.filterGroupCompany}>
              <label>Empresa / centro / CCC</label>
              <input name="company" value={filters.company} onChange={handleFilterChange} placeholder="Empresa, centro, CIF o CCC" style={styles.input} />
            </div>
            <div style={styles.filterGroupType}>
              <label>Tipo</label>
              <select name="contractType" value={filters.contractType} onChange={handleFilterChange} style={styles.input}>
                <option value="">Todos</option>
                <option value="indefinido">Indefinido</option>
                <option value="temporal">Temporal</option>
                <option value="practicas">Prácticas</option>
                <option value="formacion">Formación</option>
                <option value="sustitucion">Sustitución</option>
              </select>
            </div>
            <div style={styles.filterGroupStatus}>
              <label>Estado</label>
              <select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}>
                <option value="">Todos</option>
                <option value="active">Activo</option>
                <option value="ended">Finalizado</option>
                <option value="transformed">Transformado</option>
                <option value="replaced">Sustituido</option>
                <option value="cancelled">Anulado</option>
              </select>
            </div>
            <button type="button" onClick={clearFilters} style={styles.clearButton}>Limpiar filtros</button>
          </div>

          <ContractTable
            loading={loading}
            contracts={filteredContracts}
            employees={employees}
            companies={companies}
            workCenters={workCenters}
            onUpdateContract={onUpdateContract}
            onDeleteContract={onDeleteContract}
            submitting={contractSubmitting}
          />
        </PageCard>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return <div style={styles.metric}><span>{label}</span><strong>{value}</strong></div>;
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  moduleHeader: { display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "flex-start", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "18px", backgroundColor: "#ffffff" },
  title: { margin: 0, fontSize: "24px", color: "#111827" },
  subtitle: { margin: "6px 0 0", color: "#6b7280", fontSize: "14px", maxWidth: "760px" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(100px, 1fr))", gap: "10px" },
  metric: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "4px", minWidth: "96px" },
  filters: { display: "grid", gridTemplateColumns: "86px 250px minmax(300px, 1fr) 150px 150px 124px", columnGap: "14px", rowGap: "10px", alignItems: "end", marginBottom: "18px" },
  filterGroupCode: { minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupEmployee: { minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupCompany: { minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupType: { minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupStatus: { minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  clearButton: { width: "100%", backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 700 },
};
