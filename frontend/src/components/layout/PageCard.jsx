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
    padding: "24px",
    borderRadius: "16px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
    border: "1px solid #eef0f4",
  },
  header: {
    marginBottom: "16px",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 800,
    color: "#111827",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: "13px",
    color: "#6b7280",
  },
};
