export default function PageCard({ title, subtitle, children }) {
  return (
    <section style={styles.card}>
      {(title || subtitle) && (
        <div style={styles.header}>
          {title && <h2 style={styles.title}>{title}</h2>}
          {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        </div>
      )}

      {children}
    </section>
  );
}

const styles = {
  card: {
    backgroundColor: "#ffffff",
    padding: "22px",
    borderRadius: "0",
    border: "2px solid #111111",
    boxShadow: "6px 6px 0 #fff36b",
  },
  header: {
    marginBottom: "16px",
    borderBottom: "1px solid #eee3a0",
    paddingBottom: "10px",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 900,
    color: "#111111",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: "13px",
    color: "#5f6368",
    fontWeight: 600,
  },
};
