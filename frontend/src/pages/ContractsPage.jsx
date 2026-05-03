import { useMemo, useState } from "react";

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
  loading,
  contracts,
  employees,
  companies,
  contractForm,
  onContractChange,
  onContractSubmit,
  onUpdateContract,
  onDeleteContract,
  contractError,
  contractSuccess,
  contractSubmitting,
}) {
  const [filters, setFilters] = useState({
    id: "",
    employee: "",
    company: "",
    contractType: "",
    status: "",
  });

  const contractsWithDisplayCodes = useMemo(
    () => buildContractsWithDisplayCodes(contracts, employees),
    [contracts, employees]
  );

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      id: "",
      employee: "",
      company: "",
      contractType: "",
      status: "",
    });
  };

  const getEmployeeText = (contract) => {
    if (contract.employee_name) return contract.employee_name;
    const employee = employees.find((item) => Number(item.id) === Number(contract.employee_id));
    if (!employee) return String(contract.employee_id || "");
    return `${employee.first_name || ""} ${employee.last_name || ""} ${employee.dni || ""} ${employee.employee_code || ""} ${employee.id || ""}`;
  };

  const getCompanyText = (contract) => {
    const company = companies.find((item) => Number(item.id) === Number(contract.company_id));
    const companyName = contract.company_name || company?.name || "";
    const companyCcc = company?.ccc || "";
    const companyCif = company?.cif || "";
    return `${companyName} ${companyCcc} ${companyCif} ${contract.company_id || ""}`;
  };

  const filteredContracts = useMemo(() => {
    const idFilter = normalizeText(filters.id);
    const employeeFilter = normalizeText(filters.employee);
    const companyFilter = normalizeText(filters.company);
    const contractTypeFilter = normalizeText(filters.contractType);
    const statusFilter = normalizeText(filters.status);

    return contractsWithDisplayCodes.filter((contract) => {
      const contractId = normalizeText(`${contract.contract_display_code} ${contract.id}`);
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
  }, [contractsWithDisplayCodes, employees, companies, filters]);

  return (
    <div style={styles.wrapper}>
      <PageCard title="Nuevo contrato" subtitle="Registra un contrato laboral simulado.">
        <ContractForm
          form={contractForm}
          employees={employees}
          companies={companies}
          onChange={onContractChange}
          onSubmit={onContractSubmit}
          error={contractError}
          success={contractSuccess}
          submitting={contractSubmitting}
        />
      </PageCard>

      <PageCard title="Listado de contratos" subtitle="Contratos creados en el sistema.">
        <div style={styles.filters}>
          <div style={styles.filterGroupId}>
            <label>Código</label>
            <input
              name="id"
              value={filters.id}
              onChange={handleFilterChange}
              placeholder="Ej. 1.1"
              style={styles.input}
            />
          </div>

          <div style={styles.filterGroupEmployee}>
            <label>Empleado</label>
            <input
              name="employee"
              value={filters.employee}
              onChange={handleFilterChange}
              placeholder="Nombre, DNI o ID"
              style={styles.input}
            />
          </div>

          <div style={styles.filterGroupCompany}>
            <label>Empresa / centro / CCC</label>
            <input
              name="company"
              value={filters.company}
              onChange={handleFilterChange}
              placeholder="Empresa, centro, CIF o CCC"
              style={styles.input}
            />
          </div>

          <div style={styles.filterGroupSelect}>
            <label>Tipo</label>
            <select
              name="contractType"
              value={filters.contractType}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todos</option>
              <option value="indefinido">Indefinido</option>
              <option value="temporal">Temporal</option>
              <option value="practicas">Prácticas</option>
              <option value="formacion">Formación</option>
            </select>
          </div>

          <div style={styles.filterGroupSelect}>
            <label>Estado</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todos</option>
              <option value="active">Activo</option>
              <option value="ended">Finalizado</option>
            </select>
          </div>

          <button type="button" onClick={clearFilters} style={styles.clearButton}>
            Limpiar filtros
          </button>
        </div>

        <ContractTable
          loading={loading}
          contracts={filteredContracts}
          employees={employees}
          companies={companies}
          onUpdateContract={onUpdateContract}
          onDeleteContract={onDeleteContract}
          submitting={contractSubmitting}
        />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  filters: {
    display: "flex",
    gap: "14px",
    alignItems: "end",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  filterGroupId: {
    width: "110px",
    flex: "0 0 110px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  filterGroupEmployee: {
    width: "230px",
    flex: "0 0 230px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  filterGroupCompany: {
    width: "310px",
    flex: "1 1 310px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  filterGroupSelect: {
    width: "150px",
    flex: "0 0 150px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "14px",
  },
  clearButton: {
    backgroundColor: "#f3f4f6",
    color: "#111827",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
};
