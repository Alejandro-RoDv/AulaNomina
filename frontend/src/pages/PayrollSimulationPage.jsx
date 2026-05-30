import PageCard from "../components/layout/PageCard";
import FuturePayrollSimulator from "../components/payrolls/FuturePayrollSimulator";

export default function PayrollSimulationPage({ employees = [], contracts = [] }) {
  return (
    <div style={styles.wrapper}>
      <PageCard
        title="Simulación de nóminas"
        subtitle="Escenarios futuros de bruto, Seguridad Social, IRPF y neto sin generar nóminas reales."
      >
        <div style={styles.infoGrid}>
          <div><strong>Uso recomendado</strong><span>Probar cambios salariales, variables futuras o escenarios antes de generar nóminas.</span></div>
          <div><strong>No genera histórico</strong><span>Los resultados son previsiones didácticas, no nóminas guardadas.</span></div>
        </div>
        <FuturePayrollSimulator employees={employees} contracts={contracts} />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px", marginBottom: "18px" },
};
