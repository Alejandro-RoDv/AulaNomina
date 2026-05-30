import PageCard from "../components/layout/PageCard";
import PayrollForm from "../components/payrolls/PayrollForm";

export default function PayrollIndividualPage({
  payrollForm,
  employees = [],
  contracts = [],
  companies = [],
  workCenters = [],
  onPayrollChange,
  onPayrollSubmit,
  payrollError,
  payrollSuccess,
  payrollSubmitting,
}) {
  return (
    <div style={styles.wrapper}>
      <PageCard
        title="Nómina individual"
        subtitle="Alta manual de una nómina concreta para pruebas, correcciones o ejercicios puntuales."
      >
        <div style={styles.infoBox}>
          Usa esta pantalla cuando no quieras lanzar el proceso mensual completo. Para completar el desglose, crea la nómina y después gestiónala desde el histórico.
        </div>
        <PayrollForm
          form={payrollForm}
          employees={employees}
          contracts={contracts}
          companies={companies}
          workCenters={workCenters}
          onChange={onPayrollChange}
          onSubmit={onPayrollSubmit}
          error={payrollError}
          success={payrollSuccess}
          submitting={payrollSubmitting}
        />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  infoBox: { border: "2px solid #111827", borderRadius: "12px", backgroundColor: "#fffdf0", padding: "12px", marginBottom: "18px", fontWeight: 800, color: "#374151" },
};
