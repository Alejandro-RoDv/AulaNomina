import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  RefreshCw,
} from "lucide-react";

import { INCIDENT_CATEGORY_TABS } from "../../utils/incidentCategories";
import {
  buildIncidentAlerts,
  countIncidentsByTypes,
  incidentOverlapsMonth,
} from "../../utils/incidentWorkspace";
import { INCIDENT_TYPES } from "./IncidentForm";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const labelOf = (value) => INCIDENT_TYPES.find((item) => item.value === value)?.label || value;
const dateOf = (value) => value
  ? String(value).slice(0, 10).split("-").reverse().join("/")
  : "—";

function DashboardMetric({ icon, label, value, note, tone = "" }) {
  return <article className={`incident-metric ${value ? tone : ""}`}>
    <span className="incident-metric-icon">{icon}</span>
    <div><small>{label}</small><strong>{value}</strong><p>{note}</p></div>
  </article>;
}

export default function IncidentDashboard({ incidents, onOpenCategory }) {
  const today = new Date();
  const [period, setPeriod] = useState({
    month: String(today.getMonth() + 1),
    year: String(today.getFullYear()),
  });
  const years = [...new Set([
    today.getFullYear(),
    ...incidents
      .map((item) => Number(String(item.start_date || "").slice(0, 4)))
      .filter(Boolean),
  ])].sort((a, b) => b - a);
  const monthly = useMemo(
    () => incidents.filter((item) => incidentOverlapsMonth(item, period.year, period.month)),
    [incidents, period]
  );
  const active = monthly.filter((item) => !item.is_cancelled);
  const alerts = useMemo(() => buildIncidentAlerts(monthly), [monthly]);
  const recent = [...monthly]
    .sort((left, right) => String(right.start_date || "").localeCompare(String(left.start_date || "")))
    .slice(0, 6);

  const metrics = [
    { label: "Incidencias del mes", value: monthly.length, note: "Incluye anuladas", icon: <ClipboardList size={18} /> },
    {
      label: "Pendientes",
      value: active.filter((item) => ["draft", "open", "pending"].includes(item.status) && !item.processed_payroll_id).length,
      note: "Sin procesar en nómina",
      tone: "warning",
      icon: <CalendarClock size={18} />,
    },
    {
      label: "Procesadas",
      value: active.filter((item) => item.processed_payroll_id || item.status === "processed").length,
      note: "Vinculadas a nómina",
      tone: "success",
      icon: <CheckCircle2 size={18} />,
    },
    {
      label: "Recálculo",
      value: active.filter((item) => item.requires_recalculation).length,
      note: "Resultado económico afectado",
      tone: "warning",
      icon: <RefreshCw size={18} />,
    },
    {
      label: "Regularización",
      value: active.filter((item) => item.requires_regularization).length,
      note: "Nómina cerrada",
      tone: "critical",
      icon: <AlertTriangle size={18} />,
    },
  ];

  return <div className="incident-dashboard">
    <section className="incident-dashboard-header">
      <div>
        <span className="incident-panel-kicker">Resumen operativo</span>
        <h2>Actividad mensual</h2>
        <p>Situación global, alertas y accesos directos a los procesos con impacto en nómina.</p>
      </div>
      <div className="incident-period-controls">
        <label>Mes<select value={period.month} onChange={(event) => setPeriod({ ...period, month: event.target.value })}>
          {MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
        </select></label>
        <label>Año<select value={period.year} onChange={(event) => setPeriod({ ...period, year: event.target.value })}>
          {years.map((year) => <option key={year}>{year}</option>)}
        </select></label>
      </div>
    </section>

    <section className="incident-metrics">
      {metrics.map((metric) => <DashboardMetric key={metric.label} {...metric} />)}
    </section>

    <section className="incident-dashboard-columns">
      <article className="incident-workspace-panel incident-category-panel">
        <header><div><span className="incident-panel-kicker">Registro rápido</span><h3>Procesos disponibles</h3><p>Abre directamente el formulario adaptado a cada categoría.</p></div></header>
        <div className="incident-category-cards">
          {INCIDENT_CATEGORY_TABS.filter((tab) => tab.kind === "form").map((tab) => <button key={tab.value} type="button" onClick={() => onOpenCategory(tab.value)}>
            <span>{tab.shortLabel || tab.label}</span>
            <strong>{countIncidentsByTypes(monthly, tab.types)}</strong>
            <small>Abrir proceso</small>
            <ArrowRight size={15} />
          </button>)}
        </div>
        <button type="button" className="incident-payroll-cta" onClick={() => onOpenCategory("payroll")}>
          <CircleDollarSign size={19} />
          <div><strong>Revisar impacto en nómina</strong><span>Vista previa, segmentos, bases y conflictos</span></div>
          <ArrowRight size={18} />
        </button>
      </article>

      <article className="incident-workspace-panel">
        <header><div><span className="incident-panel-kicker">Atención requerida</span><h3>Alertas del mes</h3><p>Pendientes, recálculos y regularizaciones.</p></div><b className="incident-alert-count">{alerts.length}</b></header>
        <div className="incident-alert-list">
          {alerts.slice(0, 8).map(({ incident, reasons, severity }) => <div key={incident.id} className={`incident-alert ${severity}`}>
            <div><strong>{incident.employee_name}</strong><span>{labelOf(incident.incident_type)}</span></div>
            <p>{reasons.join(" ")}</p>
            <small>{dateOf(incident.start_date)} · {incident.company_name}</small>
          </div>)}
          {!alerts.length && <div className="incident-empty">No hay alertas para este periodo.</div>}
        </div>
      </article>
    </section>

    <section className="incident-workspace-panel">
      <header><div><span className="incident-panel-kicker">Últimos movimientos</span><h3>Incidencias recientes</h3><p>Últimos registros dentro del periodo seleccionado.</p></div><button type="button" className="incident-button-secondary" onClick={() => onOpenCategory("history")}>Ver historial <ArrowRight size={15} /></button></header>
      <div className="incident-recent-list">
        {recent.map((incident) => <div className="incident-recent-row" key={incident.id}>
          <div><strong>{incident.employee_name}</strong><small>{incident.employee_code}</small></div>
          <span className="incident-type-pill">{labelOf(incident.incident_type)}</span>
          <div><strong>{dateOf(incident.start_date)}</strong><small>{incident.company_name}</small></div>
          <span className={`incident-status-text ${incident.status}`}>{incident.status}</span>
        </div>)}
        {!recent.length && <div className="incident-empty">No hay incidencias registradas en el periodo.</div>}
      </div>
    </section>
  </div>;
}
