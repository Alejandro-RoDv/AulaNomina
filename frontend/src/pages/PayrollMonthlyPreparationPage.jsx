import PageCard from "../components/layout/PageCard";
import MonthlyPayrollPreparation from "../components/payrolls/MonthlyPayrollPreparation";

function openSocialSecuritySettlements() {
  window.location.hash = "#social-security-settlements";
  window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: "payrolls" } }));
  window.dispatchEvent(new Event("aulanomina-route-change"));
}

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
        <div style={styles.nextStep}>
          <div>
            <strong>Siguiente paso: Seguros Sociales</strong>
            <span>Cuando las nóminas estén preparadas, agrúpalas por CCC y genera la liquidación.</span>
          </div>
          <button type="button" onClick={openSocialSecuritySettlements} style={styles.button}>
            Abrir liquidaciones
          </button>
        </div>
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  processBox: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", marginBottom: "18px" },
  step: { border: "2px solid #111827", borderRadius: "12px", backgroundColor: "#fffdf0", padding: "12px", display: "flex", alignItems: "center", gap: "10px", fontWeight: 800 },
  nextStep: { marginTop: "20px", border: "2px solid #111111", backgroundColor: "#f8f3b5", boxShadow: "4px 4px 0 #111111", padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" },
  button: { backgroundColor: "#111827", color: "#ffffff", border: "2px solid #111827", borderRadius: "8px", padding: "11px 16px", cursor: "pointer", fontWeight: 900 },
};
