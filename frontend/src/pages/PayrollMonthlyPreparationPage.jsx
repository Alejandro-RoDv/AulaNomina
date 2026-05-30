import PageCard from "../components/layout/PageCard";
import MonthlyPayrollPreparation from "../components/payrolls/MonthlyPayrollPreparation";

export default function PayrollMonthlyPreparationPage({ companies = [], workCenters = [], onPrepared }) {
  return (
    <div style={styles.wrapper}>
      <PageCard
        title="Preparar nóminas mensuales"
        subtitle="Proceso masivo por empresa, centro y periodo. Simula el trabajo mensual de preparación de nóminas."
      >
        <div style={styles.processBox}>
          <div style={styles.step}><strong>1</strong><span>Selecciona empresa y centro</span></div>
          <div style={styles.step}><strong>2</strong><span>Indica mes y año</span></div>
          <div style={styles.step}><strong>3</strong><span>Genera nóminas de contratos activos</span></div>
        </div>
        <MonthlyPayrollPreparation companies={companies} workCenters={workCenters} onPrepared={onPrepared} />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  processBox: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", marginBottom: "18px" },
  step: { border: "2px solid #111827", borderRadius: "12px", backgroundColor: "#fffdf0", padding: "12px", display: "flex", alignItems: "center", gap: "10px", fontWeight: 800 },
};
