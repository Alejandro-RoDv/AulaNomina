export default function DocumentChecklistPanel({
  selectedEmployee,
  checklistLoading,
  checklistMessage,
  checklistError,
  onGenerateChecklist,
}) {
  return (
    <section style={styles.panel}>
      <div>
        <h3 style={styles.title}>Checklist documental</h3>
        <p style={styles.muted}>
          Genera los documentos básicos pendientes para el trabajador seleccionado sin volver a buscarlo.
        </p>
      </div>

      <button
        type="button"
        onClick={onGenerateChecklist}
        disabled={!selectedEmployee || checklistLoading}
        style={styles.button}
      >
        {checklistLoading ? "Generando..." : "Generar checklist"}
      </button>

      {checklistMessage ? <p style={styles.success}>{checklistMessage}</p> : null}
      {checklistError ? <p style={styles.error}>{checklistError}</p> : null}
    </section>
  );
}

const styles = {
  panel: {
    border: "2px solid #111",
    background: "#fff7c2",
    padding: "14px",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "12px",
    alignItems: "center",
    marginBottom: "14px",
  },
  title: { margin: "0 0 6px", fontSize: "16px", fontWeight: 900, color: "#111" },
  muted: { margin: 0, color: "#4b5563", fontWeight: 700 },
  button: {
    border: "3px solid #111",
    background: "#f0df62",
    padding: "9px 14px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "3px 3px 0 #111",
  },
  success: {
    gridColumn: "1 / -1",
    background: "#dcfce7",
    border: "2px solid #166534",
    color: "#166534",
    padding: "10px",
    fontWeight: 800,
    margin: 0,
  },
  error: {
    gridColumn: "1 / -1",
    background: "#fee2e2",
    border: "2px solid #991b1b",
    color: "#991b1b",
    padding: "10px",
    fontWeight: 800,
    margin: 0,
  },
};
