export default function Header({ title, subtitle }) {
  return (
    <header style={styles.header}>
      <div style={styles.topBar}>
        <div style={styles.userBox}>Usuario demo · Docente</div>
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
    backgroundColor: "#ffffff",
    borderBottom: "2px solid #111111",
  },
  topBar: {
    minHeight: "52px",
    backgroundColor: "#ffe600",
    borderBottom: "2px solid #111111",
    display: "flex",
    alignItems: "center",
    padding: "0 28px",
    boxSizing: "border-box",
  },
  userBox: {
    color: "#111111",
    fontSize: "14px",
    fontWeight: 800,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
  },
  titleBlock: {
    padding: "22px 32px 18px",
    boxSizing: "border-box",
  },
  kicker: {
    margin: 0,
    color: "#9a7b00",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "6px 0 0",
    color: "#111111",
    fontSize: "30px",
    lineHeight: 1.1,
    fontWeight: 900,
  },
  subtitle: {
    margin: "5px 0 0",
    color: "#4b5563",
    fontSize: "14px",
    fontWeight: 600,
  },
};
