import { useMemo, useState } from "react";

import ContractPayrollConceptsPanel from "../components/contracts/ContractPayrollConceptsPanel";
import PageCard from "../components/layout/PageCard";

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
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [contractStatus, setContractStatus] = useState("active");

  const contractsWithDisplayCodes = useMemo(
    () => buildContractsWithDisplayCodes(contracts, employees),
    [contracts, employees]
  );

  function getEmployeeName(contract) {
    if (contract.employee_name) return contract.employee_name;
    const employee = employees.find((item) => Number(item.id) === Number(contract.employee_id));
    if (!employee) return contract.employee_id || "-";
    return `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
  }

  function getEmployeeSearchText(contract) {
    const employee = employees.find((item) => Number(item.id) === Number(contract.employee_id));
    return `${getEmployeeName(contract)} ${employee?.dni || ""} ${employee?.employee_code || ""} ${contract.employee_id || ""}`;
  }

  function getCompanyAndCenterName(contract) {
    const company = companies.find((item) => Number(item.id) === Number(contract.company_id));
    const center = workCenters.find((item) => Number(item.id) === Number(contract.center_id));
    const companyName = contract.company_name || company?.name || "Sin empresa";
    return center?.name ? `${companyName} · ${center.name}` : companyName;
  }

  function getCompanySearchText(contract) {
    const company = companies.find((item) => Number(item.id) === Number(contract.company_id));
    const center = workCenters.find((item) => Number(item.id) === Number(contract.center_id));
    return `${getCompanyAndCenterName(contract)} ${company?.cif || ""} ${company?.ccc || ""} ${center?.center_code || ""}`;
  }

  const availableCenters = useMemo(() => {
    if (!selectedCompanyId) return [];
    return workCenters.filter((center) => String(center.company_id) === String(selectedCompanyId));
  }, [workCenters, selectedCompanyId]);

  const contractsAfterCompany = useMemo(() => {
    return contractsWithDisplayCodes.filter((contract) => {
      const matchesCompany = !selectedCompanyId || String(contract.company_id) === String(selectedCompanyId);
      const matchesCenter = !selectedCenterId || String(contract.center_id) === String(selectedCenterId);
      const matchesStatus = !contractStatus || contract.status === contractStatus;
      const query = normalizeText(quickSearch);
      const matchesSearch = !query || normalizeText(`${getEmployeeSearchText(contract)} ${getCompanySearchText(contract)} ${contract.contract_display_code}`).includes(query);
      return matchesCompany && matchesCenter && matchesStatus && matchesSearch;
    });
  }, [contractsWithDisplayCodes, selectedCompanyId, selectedCenterId, contractStatus, quickSearch]);

  const availableEmployees = useMemo(() => {
    const ids = new Set(contractsAfterCompany.map((contract) => Number(contract.employee_id)));
    return employees
      .filter((employee) => ids.has(Number(employee.id)))
      .sort((a, b) => `${a.last_name || ""} ${a.first_name || ""}`.localeCompare(`${b.last_name || ""} ${b.first_name || ""}`));
  }, [employees, contractsAfterCompany]);

  const filteredContracts = useMemo(() => {
    return contractsAfterCompany.filter((contract) => !selectedEmployeeId || String(contract.employee_id) === String(selectedEmployeeId));
  }, [contractsAfterCompany, selectedEmployeeId]);

  const selectedContract = useMemo(
    () => filteredContracts.find((contract) => String(contract.id) === String(selectedContractId)) || null,
    [filteredContracts, selectedContractId]
  );

  function getContractOptionLabel(contract) {
    return `${contract.contract_display_code} · ${getEmployeeName(contract)} · ${contract.contract_type || "Contrato"}`;
  }

  function handleCompanyChange(event) {
    setSelectedCompanyId(event.target.value);
    setSelectedCenterId("");
    setSelectedEmployeeId("");
    setSelectedContractId("");
  }

  function handleCenterChange(event) {
    setSelectedCenterId(event.target.value);
    setSelectedEmployeeId("");
    setSelectedContractId("");
  }

  function handleEmployeeChange(event) {
    setSelectedEmployeeId(event.target.value);
    setSelectedContractId("");
  }

  function handleContractStatusChange(event) {
    setContractStatus(event.target.value);
    setSelectedEmployeeId("");
    setSelectedContractId("");
  }

  function handleQuickSearchChange(event) {
    setQuickSearch(event.target.value);
    setSelectedEmployeeId("");
    setSelectedContractId("");
  }

  function clearFilters() {
    setSelectedCompanyId("");
    setSelectedCenterId("");
    setSelectedEmployeeId("");
    setSelectedContractId("");
    setQuickSearch("");
    setContractStatus("active");
  }

  return (
    <div style={styles.wrapper}>
      <PageCard
        title="Conceptos permanentes"
        subtitle="Configura conceptos recurrentes asociados a un contrato: antigüedad, complemento convenio, mejora voluntaria, pluses fijos, etc."
      >
        <div style={styles.kpiGrid}>
          <div style={styles.kpi}><span>Contratos disponibles</span><strong>{contractsWithDisplayCodes.length}</strong></div>
          <div style={styles.kpi}><span>Filtrados</span><strong>{filteredContracts.length}</strong></div>
          <div style={styles.kpi}><span>Seleccionado</span><strong>{selectedContract ? selectedContract.contract_display_code : "-"}</strong></div>
        </div>

        <div style={styles.guidedBox}>
          <div style={styles.filtersHeader}>
            <h3 style={styles.blockTitle}>Selección guiada</h3>
            <button type="button" onClick={clearFilters} style={styles.clearButton}>Limpiar selección</button>
          </div>

          <div style={styles.stepGrid}>
            <label style={styles.field}>1. Empresa
              <select value={selectedCompanyId} onChange={handleCompanyChange} style={styles.input}>
                <option value="">Todas las empresas</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>

            <label style={styles.field}>2. Centro
              <select value={selectedCenterId} onChange={handleCenterChange} style={styles.input} disabled={!selectedCompanyId}>
                <option value="">Todos los centros</option>
                {availableCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
              </select>
            </label>

            <label style={styles.field}>Estado contrato
              <select value={contractStatus} onChange={handleContractStatusChange} style={styles.input}>
                <option value="active">Activos</option>
                <option value="ended">Finalizados</option>
                <option value="">Todos</option>
              </select>
            </label>
          </div>

          <div style={styles.stepGridSecond}>
            <label style={styles.field}>3. Trabajador
              <select value={selectedEmployeeId} onChange={handleEmployeeChange} style={styles.input}>
                <option value="">Todos los trabajadores filtrados</option>
                {availableEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.employee_code || employee.id} · {employee.first_name} {employee.last_name}</option>
                ))}
              </select>
            </label>

            <label style={styles.field}>Búsqueda rápida
              <input value={quickSearch} onChange={handleQuickSearchChange} placeholder="Nombre, DNI, empresa, CCC o código" style={styles.input} />
            </label>
          </div>
        </div>

        <div style={styles.selectorBlock}>
          <label style={styles.selectorGroup}>
            4. Contrato
            <select value={selectedContractId} onChange={(event) => setSelectedContractId(event.target.value)} style={styles.contractSelect}>
              <option value="">Selecciona un contrato</option>
              {filteredContracts.map((contract) => (
                <option key={contract.id} value={contract.id}>{getContractOptionLabel(contract)}</option>
              ))}
            </select>
          </label>

          {selectedContract && (
            <div style={styles.contextBox}>
              <div style={styles.contextCard}><span>Trabajador</span><strong>{getEmployeeName(selectedContract)}</strong></div>
              <div style={styles.contextCard}><span>Empresa / centro</span><strong>{getCompanyAndCenterName(selectedContract)}</strong></div>
              <div style={styles.contextCard}><span>Contrato</span><strong>{selectedContract.contract_display_code}</strong></div>
              <div style={styles.contextCard}><span>Tipo</span><strong>{selectedContract.contract_type || "-"}</strong></div>
            </div>
          )}
        </div>

        {selectedContract ? (
          <ContractPayrollConceptsPanel contract={selectedContract} />
        ) : (
          <p style={styles.empty}>Selecciona empresa, trabajador y contrato para ver o añadir sus conceptos permanentes.</p>
        )}
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", marginBottom: "16px" },
  kpi: { border: "2px solid #111827", borderRadius: "12px", padding: "11px 12px", backgroundColor: "#fffdf0", display: "flex", justifyContent: "space-between", gap: "12px", fontWeight: 900 },
  guidedBox: { border: "2px solid #111827", borderRadius: "14px", padding: "14px", backgroundColor: "#ffffff", marginBottom: "16px", boxShadow: "3px 3px 0 #e6d85c" },
  filtersHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "12px" },
  blockTitle: { margin: 0, fontSize: "17px", fontWeight: 900, color: "#111827" },
  stepGrid: { display: "grid", gridTemplateColumns: "1.4fr 1.4fr 180px", gap: "12px", alignItems: "end", marginBottom: "12px" },
  stepGridSecond: { display: "grid", gridTemplateColumns: "1.3fr 1.7fr", gap: "12px", alignItems: "end" },
  selectorBlock: { display: "flex", flexDirection: "column", gap: "12px" },
  selectorGroup: { display: "flex", flexDirection: "column", gap: "6px", fontWeight: 900, color: "#374151" },
  field: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 900, color: "#374151" },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "2px solid #d1d5db", borderRadius: "8px", fontSize: "14px", fontWeight: 700 },
  contractSelect: { width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "2px solid #111827", borderRadius: "8px", fontSize: "15px", fontWeight: 900, backgroundColor: "#f9fafb" },
  clearButton: { backgroundColor: "#ffffff", color: "#111827", border: "2px solid #111827", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontWeight: 900 },
  contextBox: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" },
  contextCard: { border: "2px solid #111827", borderRadius: "12px", padding: "10px 12px", backgroundColor: "#fffdf0", display: "flex", flexDirection: "column", gap: "4px" },
  empty: { margin: "14px 0 0", color: "#6b7280", fontWeight: 700 },
};
