import PageCard from "../components/layout/PageCard";

export default function Dashboard({ companies, contracts }) {
  const activeCompanies = companies?.length || 0;
  const totalContracts = contracts?.length || 0;

  return (
    <div style={styles.wrapper}>
      <div style={styles.grid}>
        <PageCard>
          <p style={styles.label}>Empresas activas</p>
          <p style={styles.value}>{activeCompanies}</p>
        </PageCard>

        <PageCard>
          <p style={styles.label}>Contratos creados</p>
          <p style={styles.value}>{totalContracts}</p>
        </PageCard>

        <PageCard>
          <p style={styles.label}>Módulos activos</p>
          <p style={styles.value}>2</p>
        </PageCard>

        <PageCard>
          <p style={styles.label}>Módulos pendientes</p>
          <p style={styles.value}>4</p>
        </PageCard>
      </div>

      <PageCard title="Últimos procesos" subtitle="Actividad reciente">
        <ul style={styles.list}>
          <li>Alta de empresa</li>
          <li>Creación de contrato</li>
          <li>Preparación de módulos</li>
        </ul>
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
  },
  label: {
    fontSize: "13px",
    color: "#6b7280",
  },
  value: {
    fontSize: "28px",
    fontWeight: 900,
    marginTop: "6px",
  },
  list: {
    paddingLeft: "18px",
  },
};
