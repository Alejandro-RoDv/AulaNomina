import { useMemo } from "react";

import "./wageGarnishmentWorkspace.css";

function employeeLabel(employee) {
  return `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || `Trabajador ${employee.id}`;
}

export default function WageGarnishmentContextSelector({
  companies = [],
  employees = [],
  companyId,
  employeeId,
  onCompanyChange,
  onEmployeeChange,
  disabled = false,
  activeCount = 0,
  onReleaseContext,
}) {
  const availableEmployees = useMemo(
    () => employees.filter((employee) => !companyId || String(employee.company_id) === String(companyId)),
    [employees, companyId]
  );
  const selectedCompany = companies.find((company) => String(company.id) === String(companyId));
  const selectedEmployee = employees.find((employee) => String(employee.id) === String(employeeId));
  const selectedEmployeeName = selectedEmployee ? employeeLabel(selectedEmployee) : "";
  const contextReady = Boolean(companyId && employeeId);

  return (
    <section className="wg-context">
      <header className="wg-context__header">
        <div>
          <span className="wg-kicker">Contexto del expediente</span>
          <h2 className="wg-context__title">Empresa y trabajador</h2>
          <p className="wg-context__subtitle">Selecciona el ámbito de trabajo antes de crear o consultar embargos.</p>
        </div>
        <span className={`wg-context__status${contextReady ? " is-ready" : ""}`}>
          {contextReady ? "Contexto preparado" : "Pendiente de selección"}
        </span>
      </header>

      <div className="wg-context__body">
        <div className="wg-context__selectors">
          <label className="wg-field">
            <span className="wg-label">Empresa</span>
            <select
              value={companyId}
              disabled={disabled}
              onChange={(event) => onCompanyChange(event.target.value)}
              className="wg-select"
            >
              <option value="">Selecciona una empresa</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>

          <label className="wg-field">
            <span className="wg-label">Trabajador</span>
            <select
              value={employeeId}
              disabled={disabled || !companyId}
              onChange={(event) => onEmployeeChange(event.target.value)}
              className="wg-select"
            >
              <option value="">Selecciona un trabajador</option>
              {availableEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>)}
            </select>
          </label>
        </div>

        {contextReady ? (
          <div className="wg-context__summary">
            <div className="wg-context__avatar">{selectedEmployeeName.slice(0, 2).toUpperCase()}</div>
            <div className="wg-context__identity">
              <small>Trabajador seleccionado</small>
              <strong>{selectedEmployeeName}</strong>
              <span>{selectedCompany?.name}</span>
            </div>
            <div className="wg-context__metric">
              <strong>{activeCount}</strong>
              <span>Embargos activos</span>
            </div>
            {disabled && <button type="button" onClick={onReleaseContext} className="wg-context__release">Cerrar expediente</button>}
          </div>
        ) : (
          <div className="wg-context__helper">
            <strong>Selecciona primero una empresa</strong>
            <span>Después se mostrarán únicamente sus trabajadores.</span>
          </div>
        )}
      </div>
    </section>
  );
}
