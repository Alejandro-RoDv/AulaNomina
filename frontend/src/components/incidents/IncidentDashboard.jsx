import { useMemo, useState } from "react";
import { INCIDENT_CATEGORY_TABS } from "../../utils/incidentCategories";
import { buildIncidentAlerts, countIncidentsByTypes, incidentOverlapsMonth } from "../../utils/incidentWorkspace";
import { INCIDENT_TYPES } from "./IncidentForm";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const labelOf = (value) => INCIDENT_TYPES.find((item) => item.value === value)?.label || value;
const dateOf = (value) => value ? String(value).slice(0, 10).split("-").reverse().join("/") : "—";

export default function IncidentDashboard({ incidents, onOpenCategory }) {
  const today = new Date();
  const [period, setPeriod] = useState({ month: String(today.getMonth() + 1), year: String(today.getFullYear()) });
  const years = [...new Set([today.getFullYear(), ...incidents.map((item) => Number(String(item.start_date || "").slice(0, 4))).filter(Boolean)])].sort((a, b) => b - a);
  const monthly = useMemo(() => incidents.filter((item) => incidentOverlapsMonth(item, period.year, period.month)), [incidents, period]);
  const active = monthly.filter((item) => !item.is_cancelled);
  const alerts = useMemo(() => buildIncidentAlerts(monthly), [monthly]);
  const metrics = [
    ["Incidencias del mes", monthly.length, "Incluye anuladas", ""],
    ["Pendientes", active.filter((item) => ["draft", "open", "pending"].includes(item.status) && !item.processed_payroll_id).length, "Sin procesar", "warning"],
    ["Procesadas", active.filter((item) => item.processed_payroll_id || item.status === "processed").length, "Vinculadas a nómina", "success"],
    ["Recálculo", active.filter((item) => item.requires_recalculation).length, "Resultado afectado", "warning"],
    ["Regularización", active.filter((item) => item.requires_regularization).length, "Nómina cerrada", "critical"],
  ];

  return <div className="incident-dashboard">
    <section className="incident-dashboard-header"><div><h2>Resumen mensual de incidencias</h2><p>Situación global y alertas con impacto en nómina.</p></div><div className="incident-period-controls"><label>Mes<select value={period.month} onChange={(event) => setPeriod({ ...period, month: event.target.value })}>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label><label>Año<select value={period.year} onChange={(event) => setPeriod({ ...period, year: event.target.value })}>{years.map((year) => <option key={year}>{year}</option>)}</select></label></div></section>
    <section className="incident-metrics">{metrics.map(([label, value, note, tone]) => <div key={label} className={`incident-metric ${value ? tone : ""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}</section>
    <section className="incident-dashboard-columns">
      <article className="incident-workspace-panel"><header><div><h3>Distribución por categoría</h3><p>Acceso directo al alta de cada grupo.</p></div></header><div className="incident-category-cards">{INCIDENT_CATEGORY_TABS.filter((tab) => tab.kind === "form").map((tab) => <button key={tab.value} type="button" onClick={() => onOpenCategory(tab.value)}><span>{tab.label}</span><strong>{countIncidentsByTypes(monthly, tab.types)}</strong><small>Abrir módulo</small></button>)}</div></article>
      <article className="incident-workspace-panel"><header><div><h3>Alertas del mes</h3><p>Pendientes, recálculos y regularizaciones.</p></div><b className="incident-alert-count">{alerts.length}</b></header><div className="incident-alert-list">{alerts.slice(0, 8).map(({ incident, reasons, severity }) => <div key={incident.id} className={`incident-alert ${severity}`}><div><strong>{incident.employee_name}</strong><span>{labelOf(incident.incident_type)}</span></div><p>{reasons.join(" ")}</p><small>{dateOf(incident.start_date)} · {incident.company_name}</small></div>)}{!alerts.length && <div className="incident-empty">No hay alertas para este periodo.</div>}</div></article>
    </section>
    <button type="button" className="incident-primary-action incident-history-link" onClick={() => onOpenCategory("history")}>Abrir historial completo</button>
  </div>;
}
