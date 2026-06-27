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
  const selectedEmployeeName = selectedEmployee ? employeeLabel(selectedEmployee) : "";
  const contextReady = Boolean(companyId && employeeId);

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.headerLead}>
          <span style={styles.stepBadge}>1</span>
          <div>
            <h3 style={styles.title}>Selecciona el contexto</h3>
            <p style={styles.subtitle}>Elige una empresa y después el trabajador cuyos embargos vas a gestionar.</p>
          </div>
        </div>
        <span style={{ ...styles.statusBadge, ...(contextReady ? styles.statusReady : {}) }}>
          {contextReady ? "Contexto preparado" : "Pendiente de selección"}
        </span>
      </div>

      <div style={styles.body}>
        <div style={styles.selectors}>
          <label style={styles.field}>
            <span style={styles.label}>Empresa</span>
            <select value={companyId} disabled={disabled} onChange={(event) => onCompanyChange(event.target.value)} style={{ ...styles.input, ...(disabled ? styles.disabledInput : {}) }}>
              <option value="">Selecciona una empresa</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Trabajador</span>
            <select value={employeeId} disabled={disabled || !companyId} onChange={(event) => onEmployeeChange(event.target.value)} style={{ ...styles.input, ...((disabled || !companyId) ? styles.disabledInput : {}) }}>
              <option value="">Selecciona un trabajador</option>
              {availableEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>)}
            </select>
          </label>
        </div>

        {contextReady ? (
          <div style={styles.selectedContext}>
            <div style={styles.avatar}>{selectedEmployeeName.slice(0, 2).toUpperCase()}</div>
            <div style={styles.selectedIdentity}>
              <span style={styles.selectedKicker}>Trabajador seleccionado</span>
              <strong style={styles.selectedName}>{selectedEmployeeName}</strong>
              <span style={styles.selectedCompany}>{selectedCompany?.name}</span>
            </div>
            <div style={styles.activeMetric}>
              <strong style={styles.metricValue}>{activeCount}</strong>
              <span style={styles.metricLabel}>Embargos activos</span>
            </div>
            {disabled && <button type="button" onClick={onReleaseContext} style={styles.releaseButton}>Cerrar expediente</button>}
          </div>
        ) : (
          <div style={styles.helperCard}>
            <strong>Empieza por la empresa</strong>
            <span>La lista de trabajadores se filtrará automáticamente.</span>
          </div>
        )}
      </div>
    </section>
  );
}

const styles = {
  panel: { border: "1px solid #d4d4d8", borderRadius: "12px", backgroundColor: "#ffffff", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)", overflow: "hidden" },
  header: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "14px", padding: "18px 20px", borderBottom: "1px solid #e4e4e7", background: "linear-gradient(90deg, #fffdf0 0%, #ffffff 72%)" },
  headerLead: { display: "flex", alignItems: "center", gap: "12px" },
  stepBadge: { width: "34px", height: "34px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", backgroundColor: "#111827", color: "#ffffff", fontSize: "14px", fontWeight: 900 },
  title: { margin: 0, color: "#111827", fontSize: "16px", fontWeight: 900 },
  subtitle: { margin: "4px 0 0", color: "#64748b", fontSize: "12px", fontWeight: 600 },
  statusBadge: { border: "1px solid #d4d4d8", borderRadius: "999px", backgroundColor: "#f4f4f5", color: "#71717a", padding: "7px 11px", fontSize: "10px", fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.04em" },
  statusReady: { borderColor: "#b8a91d", backgroundColor: "#f7ef91", color: "#111827" },
  body: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "18px", alignItems: "stretch", padding: "20px" },
  selectors: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" },
  field: { display: "flex", flexDirection: "column", gap: "7px", minWidth: 0 },
  label: { color: "#334155", fontSize: "11px", fontWeight: 850 },
  input: { width: "100%", minHeight: "44px", border: "1px solid #a1a1aa", borderRadius: "8px", backgroundColor: "#ffffff", color: "#111827", padding: "9px 11px", boxSizing: "border-box", fontSize: "13px", fontWeight: 700, outline: "none" },
  disabledInput: { backgroundColor: "#f4f4f5", color: "#9ca3af", cursor: "not-allowed" },
  selectedContext: { display: "grid", gridTemplateColumns: "48px minmax(140px, 1fr) auto auto", gap: "12px", alignItems: "center", border: "1px solid #e6d85c", borderRadius: "10px", backgroundColor: "#fffdf0", padding: "14px" },
  avatar: { width: "46px", height: "46px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", backgroundColor: "#111827", color: "#ffffff", fontSize: "14px", fontWeight: 900 },
  selectedIdentity: { display: "flex", flexDirection: "column", minWidth: 0 },
  selectedKicker: { color: "#78716c", fontSize: "9px", fontWeight: 850, textTransform: "uppercase" },
  selectedName: { color: "#111827", fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  selectedCompany: { color: "#64748b", fontSize: "11px", fontWeight: 650 },
  activeMetric: { minWidth: "92px", display: "flex", flexDirection: "column", alignItems: "center", borderLeft: "1px solid #d6d3d1", paddingLeft: "12px" },
  metricValue: { fontSize: "20px", lineHeight: 1 },
  metricLabel: { marginTop: "4px", color: "#64748b", fontSize: "9px", fontWeight: 800, textTransform: "uppercase", textAlign: "center" },
  helperCard: { display: "flex", flexDirection: "column", justifyContent: "center", gap: "5px", border: "1px dashed #cbd5e1", borderRadius: "10px", backgroundColor: "#f8fafc", color: "#475569", padding: "16px", fontSize: "12px" },
  releaseButton: { border: "1px solid #111827", borderRadius: "7px", backgroundColor: "#ffffff", color: "#111827", padding: "8px 10px", fontSize: "10px", fontWeight: 850, cursor: "pointer" },
};
