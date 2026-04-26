export default function Header({ title, subtitle }) {
  return (
    <header style={styles.header}>
      <div style={styles.topBar}>
        <div style={styles.userBox}>Usuario demo · Docente</div>
        <div style={styles.statusBox}>Demo MVP</div>
      </div>

      <div style={styles.titleBlock}>
        <p style={styles.kicker}>Módulo actual</p>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
      </div>
    </header>
  );
}

const styles = {
  header: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderBottom: "2px solid #111111",
  },
  topBar: {
    minHeight: "54px",
    background: "linear-gradient(90deg, #f7d000 0%, #ffe25a 55%, #fff3a6 100%)",
    borderBottom: "2px solid #111111",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 34px",
    boxSizing: "border-box",
  },
  userBox: {
    color: "#111111",
    fontSize: "15px",
    fontWeight: 900,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  },
  statusBox: {
    color: "#111111",
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    border: "1px solid rgba(0, 0, 0, 0.35)",
    padding: "5px 10px",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
  },
  titleBlock: {
    padding: "24px 34px 20px",
    boxSizing: "border-box",
  },
  kicker: {
    color: "#9a7b00",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    marginTop: "6px",
    color: "#111111",
    fontSize: "32px",
    lineHeight: 1.1,
    fontWeight: 900,
  },
  subtitle: {
    marginTop: "6px",
    color: "#4b5563",
    fontSize: "14px",
    fontWeight: 600,
  },
};
