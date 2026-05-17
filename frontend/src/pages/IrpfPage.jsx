import PageCard from "../components/layout/PageCard";
import IrpfModulePanel from "../components/payrolls/IrpfModulePanel";

export default function IrpfPage({ employees, contracts, onRefresh }) {
  return (
    <div style={styles.wrapper}>
      <PageCard
        title="IRPF"
        subtitle="Cálculo anual del trabajador, previsión mensual, IRPF voluntario, recálculo y variables futuras."
      >
        <IrpfModulePanel employees={employees} contracts={contracts} onRefresh={onRefresh} />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
};
