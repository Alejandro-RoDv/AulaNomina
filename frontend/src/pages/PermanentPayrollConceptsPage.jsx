import { useEffect, useMemo, useState } from "react";

import BulkContractPayrollConceptsPanel from "../components/contracts/BulkContractPayrollConceptsPanel";
import ContractPayrollConceptsPanel from "../components/contracts/ContractPayrollConceptsPanel";
import PageCard from "../components/layout/PageCard";
import "../components/payrolls/salaryConceptsSplit42.css";

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

export default function PermanentPayrollConceptsPage({ contracts = [], employees = [], companies = [], workCenters = [] }) {
  const [filters, setFilters] = useState({ company: "", center: "", status: "active", search: "" });
  const [selectedContractId, setSelectedContractId] = useState("");
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRevision, setBulkRevision] = useState(0);

  const contractsWithDisplayCodes = useMemo(
    () => buildContractsWithDisplayCodes(contracts, employees),
    [contracts, employees]
  );

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [String(employee.id), employee])),
    [employees]
  );
  const companyById = useMemo(
    () => new Map(companies.map((company) => [String(company.id), company])),
    [companies]
  );
  const centerById = useMemo(
    () => new Map(workCenters.map((center) => [String(center.id), center])),
    [workCenters]
  );

  function employeeName(contract) {
    if (contract.employee_name) return contract.employee_name;
    const employee = employeeById.get(String(contract.employee_id));
    if (!employee) return `Trabajador ${contract.employee_id}`;
    return [employee.first_name, employee.last_name, employee.second_last_name].filter(Boolean).join(" ");
  }

  function companyCenter(contract) {
    const company = companyById.get(String(contract.company_id));
    const center = centerById.get(String(contract.center_id));
    const companyName = contract.company_name || company?.name || "Sin empresa";
    return center?.name ? `${companyName} · ${center.name}` : companyName;
  }

  const availableCenters = useMemo(() => {
    if (!filters.company) return workCenters;
    return workCenters.filter((center) => String(center.company_id) === String(filters.company));
  }, [workCenters, filters.company]);

  const filteredContracts = useMemo(() => {
    const query = normalizeText(filters.search);
    return contractsWithDisplayCodes.filter((contract) => {
      if (filters.company && String(contract.company_id) !== String(filters.company)) return false;
      if (filters.center && String(contract.center_id) !== String(filters.center)) return false;
      if (filters.status === "active" && contract.status !== "active") return false;
      if (filters.status === "inactive" && contract.status === "active") return false;

      if (query) {
        const employee = employeeById.get(String(contract.employee_id));
        const company = companyById.get(String(contract.company_id));
        const center = centerById.get(String(contract.center_id));
        const searchable = normalizeText([
          employeeName(contract),
          employee?.dni,
          employee?.employee_code,
          contract.contract_display_code,
          contract.contract_code,
          contract.contract_type,
          contract.contract_code_description,
          company?.name,
          company?.cif,
          company?.ccc,
          center?.name,
          center?.center_code,
        ].filter(Boolean).join(" "));
        if (!searchable.includes(query)) return false;
      }
      return true;
    });
  }, [contractsWithDisplayCodes, filters, employeeById, companyById, centerById]);

  const selectedContract = useMemo(
    () => contractsWithDisplayCodes.find((contract) => String(contract.id) === String(selectedContractId)) || null,
    [contractsWithDisplayCodes, selectedContractId]
  );

  useEffect(() => {
    const visibleIds = new Set(filteredContracts.map((contract) => Number(contract.id)));
    setBulkSelectedIds((current) => current.filter((id) => visibleIds.has(Number(id))));
    if (selectedContractId && !visibleIds.has(Number(selectedContractId))) setSelectedContractId("");
  }, [filteredContracts, selectedContractId]);

  const visibleIds = filteredContracts.map((contract) => Number(contract.id));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => bulkSelectedIds.includes(id));

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => {
      const next = { ...current, [name]: value };
      if (name === "company") next.center = "";
      return next;
    });
  }

  function clearFilters() {
    setFilters({ company: "", center: "", status: "active", search: "" });
  }

  function toggleBulk(contractId) {
    const id = Number(contractId);
    setBulkSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function toggleVisible() {
    setBulkSelectedIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function openContract(contractId) {
    setSelectedContractId(String(contractId));
  }

  return (
    <div className="permanent-concepts">
      <PageCard
        title="Conceptos permanentes"
        subtitle="Gestiona importes recurrentes por contrato y aplica el mismo concepto a varios trabajadores cuando corresponda."
        actions={(
          <button
            type="button"
            className="sc-button sc-button--primary"
            disabled={!bulkSelectedIds.length}
            onClick={() => setBulkOpen(true)}
          >
            Asignar a seleccionados{bulkSelectedIds.length ? ` (${bulkSelectedIds.length})` : ""}
          </button>
        )}
      >
        <div className="sc-metrics sc-metrics--three">
          <div className="sc-metric"><span>Contratos</span><strong>{contractsWithDisplayCodes.length}</strong></div>
          <div className="sc-metric"><span>Resultados</span><strong>{filteredContracts.length}</strong></div>
          <div className="sc-metric"><span>Selección masiva</span><strong>{bulkSelectedIds.length}</strong></div>
        </div>

        <div className="sc-filters">
          <div className="sc-filters__grid sc-filters__grid--permanent">
            <label className="sc-field">Buscar trabajador o contrato
              <input
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Nombre, DNI, código, empresa, CCC o tipo de contrato"
              />
            </label>
            <label className="sc-field">Empresa
              <select name="company" value={filters.company} onChange={handleFilterChange}>
                <option value="">Todas las empresas</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <label className="sc-field">Centro
              <select name="center" value={filters.center} onChange={handleFilterChange}>
                <option value="">Todos los centros</option>
                {availableCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
              </select>
            </label>
            <label className="sc-field">Estado del contrato
              <select name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="active">Activos</option>
                <option value="inactive">Finalizados</option>
                <option value="">Todos</option>
              </select>
            </label>
          </div>
          <div className="sc-filters__footer">
            <span className="sc-result-info">La búsqueda sustituye al desplegable de trabajadores y filtra directamente la tabla.</span>
            <button type="button" className="sc-button sc-button--ghost sc-button--small" onClick={clearFilters}>Limpiar filtros</button>
          </div>
        </div>

        <div className="sc-selection-bar">
          <div className="sc-selection-bar__summary">
            <strong>{bulkSelectedIds.length}</strong>
            <span>contratos seleccionados para operación masiva</span>
          </div>
          <div className="sc-actions">
            <button type="button" className="sc-button sc-button--secondary sc-button--small" onClick={toggleVisible} disabled={!visibleIds.length}>
              {allVisibleSelected ? "Deseleccionar visibles" : "Seleccionar visibles"}
            </button>
            <button type="button" className="sc-button sc-button--ghost sc-button--small" onClick={() => setBulkSelectedIds([])} disabled={!bulkSelectedIds.length}>
              Limpiar selección
            </button>
          </div>
        </div>

        {bulkOpen && (
          <BulkContractPayrollConceptsPanel
            contractIds={bulkSelectedIds}
            onClose={() => setBulkOpen(false)}
            onCompleted={() => setBulkRevision((value) => value + 1)}
          />
        )}

        <div className="sc-table-wrap">
          <table className="sc-table">
            <thead>
              <tr>
                <th aria-label="Selección masiva"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /></th>
                <th>Trabajador</th>
                <th>Empresa / centro</th>
                <th>Contrato</th>
                <th>Tipo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.map((contract) => {
                const employee = employeeById.get(String(contract.employee_id));
                const isOpen = String(selectedContractId) === String(contract.id);
                const isChecked = bulkSelectedIds.includes(Number(contract.id));
                return (
                  <tr
                    key={contract.id}
                    className={isOpen ? "is-active-row" : ""}
                    onClick={() => openContract(contract.id)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openContract(contract.id);
                      }
                    }}
                  >
                    <td onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleBulk(contract.id)} aria-label={`Seleccionar ${employeeName(contract)}`} />
                    </td>
                    <td>
                      <span className="sc-table__primary">{employeeName(contract)}</span>
                      <span className="sc-table__secondary">{employee?.employee_code || contract.employee_id} · {employee?.dni || "Sin documento"}</span>
                    </td>
                    <td><span className="sc-table__primary">{companyCenter(contract)}</span></td>
                    <td>
                      <span className="sc-table__primary">{contract.contract_display_code}</span>
                      <span className="sc-table__secondary">{contract.contract_code || "Sin código oficial"}</span>
                    </td>
                    <td><span className="sc-table__primary">{contract.contract_code_description || contract.contract_type || "Contrato"}</span></td>
                    <td><span className={`sc-badge ${contract.status === "active" ? "sc-badge--active" : "sc-badge--inactive"}`}>{contract.status === "active" ? "Activo" : "Finalizado"}</span></td>
                  </tr>
                );
              })}
              {!filteredContracts.length && <tr><td colSpan="6" className="sc-empty">No hay contratos que coincidan con los filtros.</td></tr>}
            </tbody>
          </table>
        </div>

        {selectedContract ? (
          <>
            <div className="sc-contract-context">
              <div className="sc-context-item"><span>Trabajador</span><strong>{employeeName(selectedContract)}</strong></div>
              <div className="sc-context-item"><span>Empresa / centro</span><strong>{companyCenter(selectedContract)}</strong></div>
              <div className="sc-context-item"><span>Contrato</span><strong>{selectedContract.contract_display_code}</strong></div>
              <div className="sc-context-item"><span>Tipo</span><strong>{selectedContract.contract_code_description || selectedContract.contract_type || "-"}</strong></div>
            </div>
            <ContractPayrollConceptsPanel contract={selectedContract} refreshKey={bulkRevision} />
          </>
        ) : (
          <div className="sc-empty">Haz clic en un trabajador de la tabla para gestionar sus conceptos permanentes. Usa las casillas únicamente para operaciones masivas.</div>
        )}
      </PageCard>
    </div>
  );
}
