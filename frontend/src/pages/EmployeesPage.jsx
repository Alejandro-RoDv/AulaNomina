import PageCard from "../components/layout/PageCard";
import EmployeeForm from "../components/employees/EmployeeForm";
import EmployeeTable from "../components/employees/EmployeeTable";

export default function EmployeesPage({
  loading,
  employees,
  employeeForm,
  onEmployeeChange,
  onEmployeeSubmit,
  onDeleteEmployee,
  employeeError,
  employeeSuccess,
  employeeSubmitting,
}) {
  return (
    <div style={styles.wrapper}>
      <PageCard
        title="Nuevo trabajador"
        subtitle="Crea un trabajador para vincularlo después a contratos, nóminas e incidencias."
      >
        <EmployeeForm
          form={employeeForm}
          onChange={onEmployeeChange}
          onSubmit={onEmployeeSubmit}
          error={employeeError}
          success={employeeSuccess}
          submitting={employeeSubmitting}
        />
      </PageCard>

      <PageCard
        title="Listado de trabajadores"
        subtitle="Trabajadores registrados actualmente en AulaNomina."
      >
        <EmployeeTable
          loading={loading}
          employees={employees}
          onDeleteEmployee={onDeleteEmployee}
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
};
