import { useState } from "react";

import PageCard from "../components/layout/PageCard";
import FuturePayrollSimulator from "../components/payrolls/FuturePayrollSimulator";
import EmbargoCalculatorPage from "./EmbargoCalculatorPage";

export default function PayrollSimulationPage({ employees = [], contracts = [] }) {
  const [activeTool, setActiveTool] = useState("payroll");

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolTabs}>
        <button
          type="button"
          onClick={() => setActiveTool("payroll")}
          style={activeTool === "payroll" ? styles.activeTab : styles.tab}
        >
          Simulación de nómina
        </button>
        <button
          type="button"
          onClick={() => setActiveTool("embargo")}
          style={activeTool === "embargo" ? styles.activeTab : styles.tab}
        >
          Embargos judiciales
        </button>
      </div>

      {activeTool === "payroll" ? (
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
      ) : (
        <EmbargoCalculatorPage />
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  toolTabs: { display: "flex", flexWrap: "wrap", gap: "10px" },
  tab: { border: "2px solid #111111", borderRadius: 0, backgroundColor: "#ffffff", color: "#111111", padding: "9px 14px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer" },
  activeTab: { border: "2px solid #111111", borderRadius: 0, backgroundColor: "#f5ef9c", color: "#111111", boxShadow: "3px 3px 0 #111111", padding: "9px 14px", fontSize: "12px", fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer" },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px", marginBottom: "18px" },
};
