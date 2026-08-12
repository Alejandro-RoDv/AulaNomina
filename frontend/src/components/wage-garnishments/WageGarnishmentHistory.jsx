import { useMemo, useState } from "react";

import { formatEuro } from "../../utils/embargoCalculator";

const STATUS_LABELS = {
  draft: "Borrador",
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

function statusClass(status) {
  return `wg-status wg-status--${status || "completed"}`;
}

export default function WageGarnishmentHistory({ records = [], loading = false, onView, onEdit, onDelete }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const visibleRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesStatus = !status || record.status === status;
      const haystack = `${record.reference || ""} ${record.issuing_body || ""} ${record.creditor || ""}`.toLowerCase();
      return matchesStatus && (!normalizedSearch || haystack.includes(normalizedSearch));
    });
  }, [records, search, status]);

  const activeRecords = visibleRecords.filter((record) => record.status === "active").length;
  const monthlyTotal = visibleRecords
    .filter((record) => record.status === "active")
    .reduce((total, record) => total + Number(record.monthly_garnishable || 0), 0);

  return (
    <div className="wg-history">
      <header className="wg-history__header">
        <div>
          <span className="wg-kicker">Consulta y seguimiento</span>
          <h3 className="wg-history__title">Expedientes del trabajador</h3>
          <p className="wg-history__subtitle">Los embargos activos se ordenan por prioridad de aplicación.</p>
        </div>
        <div className="wg-history__filters">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por referencia, órgano o acreedor" className="wg-input" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="wg-select">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </header>

      <div className="wg-history__metrics">
        <div className="wg-history__metric"><span>Expedientes visibles</span><strong>{visibleRecords.length}</strong></div>
        <div className="wg-history__metric"><span>Embargos activos</span><strong>{activeRecords}</strong></div>
        <div className="wg-history__metric wg-history__metric--accent"><span>Retención mensual activa</span><strong>{formatEuro(monthlyTotal)}</strong></div>
      </div>

      <div className="wg-history__table-wrap">
        <table className="wg-history__table">
          <thead>
            <tr>
              <th>Prioridad</th>
              <th>Referencia</th>
              <th>Órgano emisor</th>
              <th>Fecha inicio</th>
              <th>Estado</th>
              <th>Embargo mensual</th>
              <th>Pendiente</th>
              <th>Mov.</th>
              <th>Docs.</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="10" className="wg-history__empty">Cargando embargos…</td></tr>}
            {!loading && visibleRecords.length === 0 && <tr><td colSpan="10" className="wg-history__empty">No hay embargos para el trabajador seleccionado.</td></tr>}
            {!loading && visibleRecords.map((record) => (
              <tr key={record.id}>
                <td className="wg-history__priority">{record.priority || 1}</td>
                <td className="wg-history__reference">{record.reference}</td>
                <td>{record.issuing_body}</td>
                <td>{formatDate(record.start_date)}</td>
                <td><span className={statusClass(record.status)}>{STATUS_LABELS[record.status] || record.status}</span></td>
                <td className="wg-history__money">{formatEuro(record.monthly_garnishable)}</td>
                <td className="wg-history__money">{record.remaining_debt === null ? "—" : formatEuro(record.remaining_debt)}</td>
                <td className="wg-history__count">{record.movement_count || 0}</td>
                <td className="wg-history__count">{record.document_count || 0}</td>
                <td>
                  <div className="wg-history__actions">
                    <button type="button" onClick={() => onView(record)} className="wg-action">Consultar</button>
                    <button type="button" onClick={() => onEdit(record)} className="wg-action">Editar</button>
                    <button type="button" onClick={() => onDelete(record)} className={`wg-action ${record.status === "draft" ? "wg-action--danger" : "wg-action--warning"}`}>
                      {record.status === "draft" ? "Eliminar" : "Archivar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
