import PageCard from "../components/layout/PageCard";

export default function Dashboard({ companies, employees, contracts }) {
  const activeCompanies = companies?.length || 0;
  const registeredEmployees = employees?.length || 0;
  const totalContracts = contracts?.length || 0;

  const stats = [
    {
      label: "Empresas activas",
      value: activeCompanies,
      description: "Centros disponibles para simulaciones",
    },
    {
      label: "Empleados registrados",
      value: registeredEmployees,
      description: "Trabajadores creados en el sistema",
    },
    {
      label: "Contratos creados",
      value: totalContracts,
      description: "Contratos registrados en el sistema",
    },
    {
      label: "Módulos activos",
      value: 3,
      description: "Empresas, empleados y contratos",
    },
  ];

  const processes = [
    {
      title: "Alta de empresa",
      description: "Registro de nuevo centro de trabajo para prácticas.",
    },
    {
      title: "Alta de trabajador",
      description: "Creación de trabajadores para vincularlos al flujo laboral.",
    },
    {
      title: "Creación de contrato",
      description: "Simulación de contratación vinculada a un trabajador.",
    },
  ];

  return (
    <div style={styles.wrapper}>
      <div style={styles.grid}>
        {stats.map((stat) => (
          <PageCard key={stat.label}>
            <p style={styles.label}>{stat.label}</p>
            <p style={styles.value}>{stat.value}</p>
            <p style={styles.description}>{stat.description}</p>
          </PageCard>
        ))}
      </div>

      <div style={styles.columns}>
        <PageCard title="Últimos procesos" subtitle="Actividad reciente del entorno de prácticas">
          <div style={styles.processList}>
            {processes.map((process) => (
              <div key={process.title} style={styles.processItem}>
                <div style={styles.processMarker} />
                <div>
                  <p style={styles.processTitle}>{process.title}</p>
                  <p style={styles.processDescription}>{process.description}</p>
                </div>
              </div>
            ))}
          </div>
        </PageCard>

        <PageCard title="Estado del MVP" subtitle="Resumen funcional actual">
          <div style={styles.statusBlock}>
            <div>
              <p style={styles.statusTitle}>Disponible</p>
              <p style={styles.statusText}>Empresas, trabajadores, contratos y navegación modular.</p>
            </div>
            <div>
              <p style={styles.statusTitle}>Siguiente fase</p>
              <p style={styles.statusText}>Nómina simulada, incidencias laborales y casos prácticos.</p>
            </div>
          </div>
        </PageCard>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "16px",
  },
  label: {
    margin: 0,
    fontSize: "13px",
    color: "#6b7280",
    fontWeight: 700,
  },
  value: {
    margin: "10px 0 0",
    fontSize: "34px",
    lineHeight: 1,
    fontWeight: 900,
    color: "#111827",
  },
  description: {
    margin: "10px 0 0",
    fontSize: "12px",
    color: "#6b7280",
  },
  columns: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "16px",
    alignItems: "start",
  },
  processList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  processItem: {
    display: "flex",
    gap: "12px",
    padding: "14px",
    border: "1px solid #edf0f5",
    borderRadius: "12px",
    backgroundColor: "#fafafa",
  },
  processMarker: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    backgroundColor: "#f4c430",
    marginTop: "5px",
    flexShrink: 0,
  },
  processTitle: {
    margin: 0,
    fontWeight: 800,
    color: "#111827",
  },
  processDescription: {
    margin: "4px 0 0",
    fontSize: "13px",
    color: "#6b7280",
  },
  statusBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  statusTitle: {
    margin: 0,
    fontWeight: 800,
    color: "#111827",
  },
  statusText: {
    margin: "4px 0 0",
    fontSize: "13px",
    color: "#6b7280",
  },
};
