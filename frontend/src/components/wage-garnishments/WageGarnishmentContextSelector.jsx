import { useMemo } from "react";

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
  const contextReady = Boolean(companyId && employeeId);

  return (
    <section style={styles.panel}>
      <div style={styles.headingRow}>
        <div>
          <h3 style={styles.title}>Contexto de trabajo</h3>
          <p style={styles.subtitle}>Selecciona primero la empresa y el trabajador sobre el que vas a operar.</p>
        </div>
        {contextReady && <span style={styles.contextStatus}>CONTEXTO ACTIVO</span>}
      </div>

      <div style={styles.selectorGrid}>
        <label style={styles.field}>
          <span style={styles.label}>Empresa *</span>
          <select
            value={companyId}
            disabled={disabled}
            onChange={(event) => onCompanyChange(event.target.value)}
            style={{ ...styles.input, ...(disabled ? styles.disabledInput : {}) }}
          >
            <option value="">Selecciona una empresa</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Trabajador *</span>
          <select
            value={employeeId}
            disabled={disabled || !companyId}
            onChange={(event) => onEmployeeChange(event.target.value)}
            style={{ ...styles.input, ...((disabled || !companyId) ? styles.disabledInput : {}) }}
          >
            <option value="">Selecciona un trabajador</option>
            {availableEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>
            ))}
          </select>
        </label>

        <div style={styles.summaryBox}>
          <span style={styles.summaryLabel}>Empresa seleccionada</span>
          <strong style={styles.summaryValue}>{selectedCompany?.name || "Pendiente"}</strong>
        </div>

        <div style={styles.summaryBox}>
          <span style={styles.summaryLabel}>Trabajador seleccionado</span>
          <strong style={styles.summaryValue}>{selectedEmployee ? employeeLabel(selectedEmployee) : "Pendiente"}</strong>
        </div>

        <div style={styles.summaryBoxSmall}>
          <span style={styles.summaryLabel}>Embargos activos</span>
          <strong style={styles.countValue}>{contextReady ? activeCount : "—"}</strong>
        </div>
      </div>

      {disabled && (
        <div style={styles.lockedRow}>
          <span>El contexto queda bloqueado mientras consultas o editas un expediente.</span>
          <button type="button" onClick={onReleaseContext} style={styles.releaseButton}>Cerrar expediente</button>
        </div>
      )}
    </section>
  );
}

const styles = {
  panel: { border: "2px solid #111111", backgroundColor: "#ffffff" },
  headingRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "14px 16px", borderBottom: "2px solid #111111", backgroundColor: "#fffef2" },
  title: { margin: 0, fontSize: "15px", fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.03em" },
  subtitle: { margin: "4px 0 0", fontSize: "12px", color: "#4b5563", fontWeight: 650 },
  contextStatus: { border: "2px solid #111111", backgroundColor: "#f5ef9c", padding: "7px 10px", fontSize: "11px", fontWeight: 950, whiteSpace: "nowrap" },
  selectorGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", alignItems: "end", padding: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 },
  label: { fontSize: "11px", fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.03em" },
  input: { width: "100%", minHeight: "40px", border: "2px solid #111111", borderRadius: 0, backgroundColor: "#ffffff", padding: "8px 10px", boxSizing: "border-box", fontSize: "13px", fontWeight: 750 },
  disabledInput: { backgroundColor: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" },
  summaryBox: { minHeight: "40px", border: "1px solid #111111", backgroundColor: "#f9fafb", padding: "7px 10px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "2px", boxSizing: "border-box" },
  summaryBoxSmall: { minHeight: "40px", border: "1px solid #111111", backgroundColor: "#f5ef9c", padding: "7px 10px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", boxSizing: "border-box" },
  summaryLabel: { fontSize: "9px", fontWeight: 900, color: "#4b5563", textTransform: "uppercase" },
  summaryValue: { fontSize: "12px", color: "#111111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  countValue: { fontSize: "18px", lineHeight: 1, color: "#111111" },
  lockedRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", borderTop: "1px solid #111111", backgroundColor: "#f3f4f6", padding: "9px 16px", fontSize: "11px", fontWeight: 700, color: "#4b5563" },
  releaseButton: { border: "2px solid #111111", backgroundColor: "#ffffff", padding: "6px 10px", fontSize: "11px", fontWeight: 900, cursor: "pointer", textTransform: "uppercase" },
};
