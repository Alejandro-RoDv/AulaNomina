import { useMemo, useState } from "react";

import { formatEuro } from "../../utils/embargoCalculator";

const STATUS_LABELS = {
  active: "Activo",
  suspended: "Suspendido",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

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

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <div>
          <h3 style={styles.title}>Historial del trabajador</h3>
          <p style={styles.subtitle}>Solo se muestran los embargos de la empresa y trabajador seleccionados.</p>
        </div>
        <div style={styles.filters}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar referencia, órgano o acreedor"
            style={styles.searchInput}
          />
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={styles.select}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <div style={styles.resultBar}>
        <span>{visibleRecords.length} expediente{visibleRecords.length === 1 ? "" : "s"}</span>
        <span>{visibleRecords.filter((record) => record.status === "active").length} activo{visibleRecords.filter((record) => record.status === "active").length === 1 ? "" : "s"}</span>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Referencia</th>
              <th style={styles.th}>Órgano emisor</th>
              <th style={styles.th}>Inicio</th>
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
                <td style={styles.td}>{record.start_date}</td>
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
    border: "1px solid #111111",
    backgroundColor,
    padding: "5px 8px",
    textAlign: "center",
    fontSize: "10px",
    fontWeight: 900,
    textTransform: "uppercase",
  };
}

const styles = {
  wrapper: { border: "2px solid #111111", backgroundColor: "#ffffff" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "end", gap: "18px", padding: "16px", borderBottom: "1px solid #111111", backgroundColor: "#fffef2" },
  title: { margin: 0, fontSize: "14px", fontWeight: 950, textTransform: "uppercase" },
  subtitle: { margin: "4px 0 0", color: "#4b5563", fontSize: "11px", fontWeight: 650 },
  filters: { display: "grid", gridTemplateColumns: "minmax(250px, 1fr) 180px", gap: "10px", minWidth: "470px" },
  searchInput: { minHeight: "38px", border: "2px solid #111111", borderRadius: 0, padding: "8px 10px", fontSize: "12px", fontWeight: 700 },
  select: { minHeight: "38px", border: "2px solid #111111", borderRadius: 0, padding: "8px 10px", fontSize: "12px", fontWeight: 700, backgroundColor: "#ffffff" },
  resultBar: { display: "flex", justifyContent: "space-between", gap: "12px", padding: "8px 12px", borderBottom: "2px solid #111111", backgroundColor: "#f3f4f6", fontSize: "10px", fontWeight: 900, textTransform: "uppercase" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "980px" },
  th: { backgroundColor: "#f5ef9c", borderBottom: "2px solid #111111", borderRight: "1px solid #111111", padding: "10px", fontSize: "10px", textAlign: "left", textTransform: "uppercase" },
  td: { borderBottom: "1px solid #111111", borderRight: "1px solid #111111", padding: "9px", fontSize: "11px", fontWeight: 650 },
  referenceCell: { borderBottom: "1px solid #111111", borderRight: "1px solid #111111", padding: "9px", fontSize: "11px", fontWeight: 900 },
  moneyCell: { borderBottom: "1px solid #111111", borderRight: "1px solid #111111", padding: "9px", fontSize: "11px", fontWeight: 900, textAlign: "right" },
  actions: { borderBottom: "1px solid #111111", padding: "7px", display: "flex", gap: "6px", whiteSpace: "nowrap" },
  actionButton: { border: "1px solid #111111", backgroundColor: "#ffffff", padding: "6px 8px", fontSize: "10px", fontWeight: 850, cursor: "pointer", textTransform: "uppercase" },
  deleteButton: { border: "1px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "6px 8px", fontSize: "10px", fontWeight: 850, cursor: "pointer", textTransform: "uppercase" },
  emptyCell: { padding: "36px", textAlign: "center", color: "#6b7280", fontSize: "12px", fontWeight: 750 },
};
