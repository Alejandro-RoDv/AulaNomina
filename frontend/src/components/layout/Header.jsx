export default function Header({
  title,
  subtitle,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
  onResetDemo,
  resetDemoLoading,
  resetDemoMessage,
  resetDemoError,
}) {
  return (
    <header style={styles.header}>
      <div style={styles.topBar}>
        <div style={styles.userBox}>Usuario demo · Docente</div>
        <div style={styles.headerActions}>
          <div style={styles.statusBox}>Demo MVP</div>
          <button type="button" style={styles.settingsButton} onClick={onOpenSettings}>
            Ajustes
          </button>
        </div>
      </div>

      <div style={styles.titleBlock}>
        <p style={styles.kicker}>Módulo actual</p>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
      </div>

      {settingsOpen && (
        <div style={styles.modalOverlay}>
          <section style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.modalKicker}>Configuración</p>
                <h2 style={styles.modalTitle}>Ajustes de demo</h2>
              </div>
              <button type="button" style={styles.closeButton} onClick={onCloseSettings}>
                Cerrar
              </button>
            </div>

            <div style={styles.warningBox}>
              <strong>Reset demo</strong>
              <p style={styles.warningText}>
                Reinicia únicamente los datos controlados de Fundación AulaNomina. No borra empresas,
                trabajadores ni contratos creados fuera de la demo.
              </p>
            </div>

            {resetDemoError && <p style={styles.errorMessage}>{resetDemoError}</p>}
            {resetDemoMessage && <p style={styles.successMessage}>{resetDemoMessage}</p>}

            <div style={styles.modalActions}>
              <button
                type="button"
                style={{ ...styles.resetButton, opacity: resetDemoLoading ? 0.7 : 1 }}
                onClick={onResetDemo}
                disabled={resetDemoLoading}
              >
                {resetDemoLoading ? "Reiniciando..." : "Reset demo"}
              </button>
            </div>
          </section>
        </div>
      )}
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
    background: "linear-gradient(90deg, #e6d85c 0%, #f5ef9c 55%, #ffffff 100%)",
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
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  statusBox: {
    color: "#111111",
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    border: "1px solid rgba(0, 0, 0, 0.25)",
    padding: "5px 10px",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
  },
  settingsButton: {
    color: "#111111",
    backgroundColor: "#ffffff",
    border: "1px solid #111111",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    cursor: "pointer",
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
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.35)",
    padding: "72px 34px",
    boxSizing: "border-box",
  },
  modalBox: {
    width: "420px",
    backgroundColor: "#ffffff",
    border: "2px solid #111111",
    boxShadow: "0 18px 40px rgba(0, 0, 0, 0.22)",
    padding: "22px",
    boxSizing: "border-box",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "18px",
  },
  modalKicker: {
    margin: 0,
    color: "#9a7b00",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  modalTitle: {
    margin: "4px 0 0",
    color: "#111111",
    fontSize: "22px",
    fontWeight: 900,
  },
  closeButton: {
    color: "#111111",
    backgroundColor: "#f3f4f6",
    border: "1px solid #9ca3af",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  warningBox: {
    border: "1px solid #d1d5db",
    backgroundColor: "#f9fafb",
    padding: "14px",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 700,
  },
  warningText: {
    margin: "8px 0 0",
    color: "#4b5563",
    fontSize: "13px",
    lineHeight: 1.45,
    fontWeight: 600,
  },
  errorMessage: {
    marginTop: "14px",
    color: "#991b1b",
    backgroundColor: "#fee2e2",
    border: "1px solid #fecaca",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 800,
  },
  successMessage: {
    marginTop: "14px",
    color: "#166534",
    backgroundColor: "#dcfce7",
    border: "1px solid #bbf7d0",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 800,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "18px",
  },
  resetButton: {
    color: "#ffffff",
    backgroundColor: "#111111",
    border: "2px solid #111111",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 900,
    textTransform: "uppercase",
    cursor: "pointer",
  },
};
