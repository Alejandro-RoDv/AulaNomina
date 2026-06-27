import { useMemo, useState } from "react";

import { formatEuro } from "../../utils/embargoCalculator";

const STATUS_LABELS = {
  active: "Activo",
  suspended: "Suspendido",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export default function WageGarnishmentHistory({
  records = [],
  loading = false,
  onView,
  onEdit,
  onDelete,
}) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const visibleRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesStatus = !status || record.status === status;
      const haystack = `${record.reference || ""} ${record.issuing_body || ""} ${record.creditor || ""}`.toLowerCase();
      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [records, search, status]);

  const activeRecords = visibleRecords.filter((record) => record.status === "active").length;
  const monthlyTotal = visibleRecords
    .filter((record) => record.status === "active")
    .reduce((total, record) => total + Number(record.monthly_garnishable || 0), 0);

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Expedientes del trabajador</h3>
          <p style={styles.subtitle}>Consulta, edita o elimina los embargos asociados al contexto seleccionado.</p>
        </div>
        <div style={styles.filters}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por referencia, órgano o acreedor" style={styles.searchInput} />
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={styles.select}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <div style={styles.metrics}>
        <div style={styles.metricCard}>
          <span>Expedientes visibles</span>
          <strong>{visibleRecords.length}</strong>
        </div>
        <div style={styles.metricCard}>
          <span>Embargos activos</span>
          <strong>{activeRecords}</strong>
        </div>
        <div style={styles.metricCardAccent}>
          <span>Retención mensual activa</span>
          <strong>{formatEuro(monthlyTotal)}</strong>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Referencia</th>
              <th style={styles.th}>Órgano emisor</th>
              <th style={styles.th}>Fecha inicio</th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>Embargo mensual</th>
              <th style={styles.th}>Deuda pendiente</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="7" style={styles.emptyCell}>Cargando embargos…</td></tr>}
            {!loading && visibleRecords.length === 0 && (
              <tr><td colSpan="7" style={styles.emptyCell}>No hay embargos para el trabajador seleccionado.</td></tr>
            )}
            {!loading && visibleRecords.map((record) => (
              <tr key={record.id}>
                <td style={styles.referenceCell}>{record.reference}</td>
                <td style={styles.td}>{record.issuing_body}</td>
                <td style={styles.dateCell}>{formatDate(record.start_date)}</td>
                <td style={styles.td}><span style={statusStyle(record.status)}>{STATUS_LABELS[record.status] || record.status}</span></td>
                <td style={styles.moneyCell}>{formatEuro(record.monthly_garnishable)}</td>
                <td style={styles.moneyCell}>{record.remaining_debt === null ? "—" : formatEuro(record.remaining_debt)}</td>
                <td style={styles.actions}>
                  <button type="button" onClick={() => onView(record)} style={styles.actionButton}>Consultar</button>
                  <button type="button" onClick={() => onEdit(record)} style={styles.actionButton}>Editar</button>
                  <button type="button" onClick={() => onDelete(record)} style={styles.deleteButton}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusStyle(status) {
  const backgroundColor = status === "active"
    ? "#dcfce7"
    : status === "suspended"
      ? "#fef3c7"
      : status === "cancelled"
        ? "#fee2e2"
        : "#e5e7eb";

  return {
    display: "inline-block",
    minWidth: "78px",
    borderRadius: "999px",
    backgroundColor,
    padding: "6px 9px",
    textAlign: "center",
    fontSize: "10px",
    fontWeight: 850,
  };
}

const styles = {
  wrapper: { border: "1px solid #d4d4d8", borderRadius: "12px", backgroundColor: "#ffffff", boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)", overflow: "hidden" },
  header: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "end", gap: "18px", padding: "18px 20px", borderBottom: "1px solid #e4e4e7", background: "linear-gradient(90deg, #fffdf0 0%, #ffffff 75%)" },
  title: { margin: 0, color: "#111827", fontSize: "16px", fontWeight: 900 },
  subtitle: { margin: "4px 0 0", color: "#64748b", fontSize: "11px", fontWeight: 600 },
  filters: { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 180px", gap: "10px", flex: "1 1 480px", maxWidth: "620px" },
  searchInput: { minHeight: "42px", border: "1px solid #a1a1aa", borderRadius: "8px", padding: "9px 11px", fontSize: "12px", fontWeight: 650 },
  select: { minHeight: "42px", border: "1px solid #a1a1aa", borderRadius: "8px", padding: "9px 11px", fontSize: "12px", fontWeight: 650, backgroundColor: "#ffffff" },
  metrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", padding: "14px 18px", borderBottom: "1px solid #e4e4e7", backgroundColor: "#f8fafc" },
  metricCard: { display: "flex", flexDirection: "column", gap: "3px", border: "1px solid #e2e8f0", borderRadius: "9px", backgroundColor: "#ffffff", padding: "11px 12px", color: "#475569", fontSize: "10px", fontWeight: 750 },
  metricCardAccent: { display: "flex", flexDirection: "column", gap: "3px", border: "1px solid #d8ca3f", borderRadius: "9px", backgroundColor: "#fffbea", padding: "11px 12px", color: "#475569", fontSize: "10px", fontWeight: 750 },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "980px" },
  th: { backgroundColor: "#111827", color: "#ffffff", borderRight: "1px solid #374151", padding: "11px 10px", fontSize: "10px", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.03em" },
  td: { borderBottom: "1px solid #e4e4e7", padding: "11px 10px", fontSize: "11px", fontWeight: 650, color: "#334155" },
  referenceCell: { borderBottom: "1px solid #e4e4e7", padding: "11px 10px", fontSize: "11px", fontWeight: 900, color: "#111827" },
  dateCell: { borderBottom: "1px solid #e4e4e7", padding: "11px 10px", fontSize: "11px", fontWeight: 700, color: "#334155", whiteSpace: "nowrap" },
  moneyCell: { borderBottom: "1px solid #e4e4e7", padding: "11px 10px", fontSize: "11px", fontWeight: 850, color: "#111827", textAlign: "right" },
  actions: { borderBottom: "1px solid #e4e4e7", padding: "8px 10px", display: "flex", gap: "6px", whiteSpace: "nowrap" },
  actionButton: { border: "1px solid #94a3b8", borderRadius: "6px", backgroundColor: "#ffffff", color: "#334155", padding: "6px 8px", fontSize: "10px", fontWeight: 800, cursor: "pointer" },
  deleteButton: { border: "1px solid #fca5a5", borderRadius: "6px", backgroundColor: "#fff1f2", color: "#991b1b", padding: "6px 8px", fontSize: "10px", fontWeight: 800, cursor: "pointer" },
  emptyCell: { padding: "42px", textAlign: "center", color: "#64748b", fontSize: "12px", fontWeight: 700 },
};
