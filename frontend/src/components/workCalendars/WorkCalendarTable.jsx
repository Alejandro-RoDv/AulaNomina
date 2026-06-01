function formatPeriod(calendar) {
  if (calendar.period_type === "verano_invierno") return "Verano / invierno";
  return "Todo el año";
}

function formatRest(calendar) {
  if (calendar.rest_type === "intermedio") return "Intermedio";
  return "Semanal";
}

function formatShifts(calendar) {
  if (!calendar.shifts_enabled) return "No";
  return [calendar.shift_1, calendar.shift_2, calendar.shift_3, calendar.shift_4].filter(Boolean).join(" · ") || "Sí";
}

export default function WorkCalendarTable({ loading, calendars }) {
  if (loading) return <p>Cargando calendarios...</p>;

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Calendario</th>
            <th style={styles.th}>Periodo</th>
            <th style={styles.th}>Descanso</th>
            <th style={styles.th}>Días descanso</th>
            <th style={styles.th}>Turnos</th>
            <th style={styles.th}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {calendars.map((calendar) => (
            <tr key={calendar.id}>
              <td style={styles.td}>{calendar.name}</td>
              <td style={styles.td}>{formatPeriod(calendar)}</td>
              <td style={styles.td}>{formatRest(calendar)}</td>
              <td style={styles.td}>{calendar.rest_days || "-"}</td>
              <td style={styles.td}>{formatShifts(calendar)}</td>
              <td style={styles.td}>{calendar.is_active ? "Activo" : "Inactivo"}</td>
            </tr>
          ))}
          {calendars.length === 0 && (
            <tr>
              <td colSpan="6" style={styles.emptyCell}>No hay calendarios laborales creados todavía.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "12px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  td: { padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  emptyCell: { padding: "18px", color: "#6b7280", textAlign: "center", borderBottom: "1px solid #eee" },
};
