export default function Header({ title, subtitle }) {
  return (
    <header style={styles.header}>
      <div>
        <p style={styles.kicker}>Panel docente · Demo MVP</p>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
      </div>

      <div style={styles.badge}>Split 5 · Layout ERP</div>
    </header>
  );
}

const styles = {
  header: {
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    padding: "24px 34px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
  },
  kicker: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#a16207",
  },
  title: {
    margin: "6px 0 0",
    fontSize: "30px",
    color: "#111827",
    fontWeight: 900,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#6b7280",
    fontSize: "14px",
  },
  badge: {
    backgroundColor: "#111827",
    color: "#ffffff",
    padding: "10px 14px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
};
