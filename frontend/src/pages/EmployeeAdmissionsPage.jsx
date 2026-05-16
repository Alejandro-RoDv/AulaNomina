import PageCard from "../components/layout/PageCard";
import EmployeeForm from "../components/employees/EmployeeForm";

function getEmployeeName(employee) {
  return `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || `Trabajador ${employee.id}`;
}

function getCompanyName(companies, employee) {
  return companies.find((company) => Number(company.id) === Number(employee.company_id))?.name || "-";
}

function getCenterName(workCenters, employee) {
  return workCenters.find((center) => Number(center.id) === Number(employee.center_id))?.name || "-";
}

export default function EmployeeAdmissionsPage({
  loading,
  employees,
  companies,
  workCenters,
  employeeForm,
  onEmployeeChange,
  onEmployeeSubmit,
  onReactivateEmployee,
  onDeleteEmployee,
  employeeError,
  employeeSuccess,
  employeeSubmitting,
}) {
  const activeEmployees = employees.filter((employee) => employee.is_active);
  const inactiveEmployees = employees.filter((employee) => !employee.is_active);

  return (
    <div style={styles.wrapper}>
      <div style={styles.kpiGrid}>
        <div style={styles.kpi}><span>Trabajadores alta</span><strong>{activeEmployees.length}</strong></div>
        <div style={styles.kpi}><span>Trabajadores baja</span><strong>{inactiveEmployees.length}</strong></div>
        <div style={styles.kpi}><span>Empresas activas</span><strong>{companies.filter((company) => company.is_active).length}</strong></div>
        <div style={styles.kpi}><span>Centros activos</span><strong>{workCenters.filter((center) => center.is_active).length}</strong></div>
      </div>

      <PageCard
        title="Alta de trabajador"
        subtitle="Pantalla operativa para registrar trabajadores antes de vincular contratos, documentación, incidencias y nóminas."
      >
        <EmployeeForm
          form={employeeForm}
          companies={companies.filter((company) => company.is_active)}
          workCenters={workCenters.filter((center) => center.is_active)}
          onChange={onEmployeeChange}
          onSubmit={onEmployeeSubmit}
          error={employeeError}
          success={employeeSuccess}
          submitting={employeeSubmitting}
        />
      </PageCard>

      <PageCard title="Altas y bajas" subtitle="Control rápido de estado del trabajador dentro del entorno demo.">
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Trabajador</th>
                  <th style={styles.th}>DNI</th>
                  <th style={styles.th}>Empresa</th>
                  <th style={styles.th}>Centro</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td style={styles.tdStrong}>{employee.employee_code || employee.id}</td>
                    <td style={styles.td}>{getEmployeeName(employee)}</td>
                    <td style={styles.td}>{employee.dni || "-"}</td>
                    <td style={styles.td}>{getCompanyName(companies, employee)}</td>
                    <td style={styles.td}>{getCenterName(workCenters, employee)}</td>
                    <td style={styles.td}>
                      <span style={employee.is_active ? styles.activeBadge : styles.inactiveBadge}>
                        {employee.is_active ? "Alta" : "Baja"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {employee.is_active ? (
                        <button type="button" onClick={() => onDeleteEmployee(employee.id)} disabled={employeeSubmitting} style={styles.dangerButton}>Dar baja</button>
                      ) : (
                        <button type="button" onClick={() => onReactivateEmployee(employee)} disabled={employeeSubmitting} style={styles.primaryButton}>Reactivar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" },
  kpi: { border: "2px solid #111", backgroundColor: "#fff", boxShadow: "4px 4px 0 #f5ef9c", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { textAlign: "left", borderBottom: "2px solid #111", padding: "10px", backgroundColor: "#f8f3b5", fontWeight: 900 },
  td: { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "middle" },
  tdStrong: { borderBottom: "1px solid #e5e7eb", padding: "10px", fontWeight: 900, verticalAlign: "middle" },
  activeBadge: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", padding: "4px 8px", fontWeight: 900 },
  inactiveBadge: { backgroundColor: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db", padding: "4px 8px", fontWeight: 900 },
  primaryButton: { backgroundColor: "#111", color: "#fff", border: "2px solid #111", padding: "7px 10px", fontWeight: 900, cursor: "pointer" },
  dangerButton: { backgroundColor: "#fff", color: "#991b1b", border: "2px solid #991b1b", padding: "7px 10px", fontWeight: 900, cursor: "pointer" },
};
