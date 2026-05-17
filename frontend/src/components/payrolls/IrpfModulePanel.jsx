import { useEffect, useMemo, useState } from "react";

import EmployeeIrpfPanel from "../employees/EmployeeIrpfPanel";
import { fetchEmployeeTaxProfile } from "../../services/taxProfileApi";

function getEmployeeName(employee) {
  return `${employee?.first_name || ""} ${employee?.last_name || ""}`.trim();
}

export default function IrpfModulePanel({ employees = [], contracts = [], onRefresh }) {
  const [employeeId, setEmployeeId] = useState("");
  const [taxProfile, setTaxProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState("");

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.id) === String(employeeId)),
    [employees, employeeId]
  );

  const activeContract = useMemo(() => {
    if (!employeeId) return null;
    const employeeContracts = contracts.filter((contract) => String(contract.employee_id) === String(employeeId));
    return employeeContracts.find((contract) => contract.status === "active") || employeeContracts[0] || null;
  }, [contracts, employeeId]);

  useEffect(() => {
    if (!employeeId && employees[0]?.id) {
      setEmployeeId(String(employees[0].id));
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

  if (!employees.length) {
    return <p style={styles.empty}>No hay trabajadores activos para mostrar el módulo IRPF.</p>;
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.selectorBox}>
        <div>
          <p style={styles.eyebrow}>MÓDULO IRPF</p>
          <h3 style={styles.title}>IRPF del trabajador</h3>
          <p style={styles.subtitle}>Selecciona un trabajador para ver cálculo anual, previsión mensual, variables futuras e IRPF voluntario.</p>
        </div>

        <label style={styles.field}>Trabajador
          <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} style={styles.input}>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employee_code || employee.id} · {getEmployeeName(employee)} · {employee.dni || "sin DNI"}
              </option>
            ))}
          </select>
        </label>
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
  selectorBox: { border: "2px solid #111", backgroundColor: "#fffdf0", boxShadow: "4px 4px 0 #111", padding: "16px", display: "grid", gridTemplateColumns: "1fr minmax(340px, 480px)", gap: "18px", alignItems: "end" },
  eyebrow: { margin: "0 0 6px", fontSize: "11px", fontWeight: 950, letterSpacing: "0.08em", color: "#92400e" },
  title: { margin: 0, color: "#111", fontSize: "22px", fontWeight: 950 },
  subtitle: { margin: "6px 0 0", color: "#4b5563", fontSize: "13px", fontWeight: 750 },
  field: { display: "flex", flexDirection: "column", gap: "6px", color: "#374151", fontSize: "13px", fontWeight: 850 },
  input: { height: "39px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box", width: "100%" },
  empty: { margin: 0, color: "#6b7280", fontWeight: 750 },
  error: { color: "#991b1b", backgroundColor: "#fee2e2", border: "1px solid #fecaca", padding: "9px", fontWeight: 800 },
  warning: { color: "#92400e", backgroundColor: "#fef3c7", border: "1px solid #fde68a", padding: "9px", fontWeight: 800 },
};
