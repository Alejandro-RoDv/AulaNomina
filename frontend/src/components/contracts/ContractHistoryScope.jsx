import { useMemo, useState } from "react";

import ContractTable from "../ContractTable";

export default function ContractHistoryScope({
  loading,
  contracts,
  employees,
  companies,
  workCenters,
  onUpdateContract,
  onDeleteContract,
  submitting,
}) {
  const [companyId, setCompanyId] = useState("");

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company.id) === String(companyId)) || null,
    [companies, companyId]
  );

  const scopedContracts = useMemo(
    () => (companyId
      ? contracts.filter((contract) => String(contract.company_id || "") === String(companyId))
      : []),
    [contracts, companyId]
  );

  const scopedEmployees = useMemo(
    () => (companyId
      ? employees.filter((employee) => String(employee.company_id || "") === String(companyId))
      : []),
    [employees, companyId]
  );

  const scopedCenters = useMemo(
    () => (companyId
      ? workCenters.filter((center) => String(center.company_id || "") === String(companyId))
      : []),
    [workCenters, companyId]
  );

  return (
    <div className="contract-history-scope">
      <div className="contract-history-scope__bar">
        <div className="contract-history-scope__copy">
          <strong>Empresa</strong>
          <span>Selecciona una empresa para consultar únicamente sus contratos.</span>
        </div>
        <select
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
          aria-label="Seleccionar empresa para historial de contratos"
        >
          <option value="">Seleccionar empresa</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
      </div>

      {!companyId && (
        <div className="contract-history-scope__empty">
          <strong>Selecciona una empresa</strong>
          <span>El historial no muestra contratos globales para evitar mezclar plantillas de distintas empresas.</span>
        </div>
      )}

      {companyId && (
        <>
          <div className="contract-history-scope__summary">
            <strong>{selectedCompany?.name || "Empresa seleccionada"}</strong>
            <span>{scopedContracts.length} contratos encontrados</span>
          </div>
          <section className="contract-history-workspace" aria-label={`Historial de contratos de ${selectedCompany?.name || "la empresa"}`}>
            <ContractTable
              loading={loading}
              contracts={scopedContracts}
              employees={scopedEmployees}
              companies={selectedCompany ? [selectedCompany] : []}
              workCenters={scopedCenters}
              onUpdateContract={onUpdateContract}
              onDeleteContract={onDeleteContract}
              submitting={submitting}
            />
          </section>
        </>
      )}
    </div>
  );
}
