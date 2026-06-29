import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Database,
  FileClock,
  ShieldCheck,
} from "lucide-react";

import { formatDate, money } from "./incidentPayrollUi";

function Metric({ icon: Icon, label, value, note, tone = "" }) {
  return <article className={`incident-engine-metric ${tone}`}>
    <span className="incident-engine-metric-icon"><Icon size={18} /></span>
    <div><small>{label}</small><strong>{value}</strong><p>{note}</p></div>
  </article>;
}

export function IncidentPayrollError({ error }) {
  if (!error || error.code === "incident_overlap_conflict") return null;
  return <div className="incident-engine-error">
    <AlertTriangle size={18} />
    <div><strong>No se ha podido completar la operación</strong><span>{error.message}</span></div>
  </div>;
}

export function IncidentOverlapConflicts({ error }) {
  const conflicts = error?.detail?.conflicts || [];
  if (error?.code !== "incident_overlap_conflict") return null;
  return <section className="incident-conflict-panel">
    <header>
      <AlertTriangle size={20} />
      <div><strong>Cálculo bloqueado por incidencias incompatibles</strong><p>Corrige los solapamientos antes de procesar la nómina.</p></div>
    </header>
    <div className="incident-conflict-list">
      {conflicts.map((conflict, index) => <article key={`${conflict.start_date}-${index}`}>
        <span>{formatDate(conflict.start_date)} — {formatDate(conflict.end_date)}</span>
        <strong>{(conflict.incident_types || []).join(" + ")}</strong>
        <small>Incidencias: {(conflict.incident_ids || []).join(", ")}</small>
      </article>)}
    </div>
  </section>;
}

export function IncidentPayrollMetrics({ preview }) {
  if (!preview) return null;
  return <section className="incident-engine-metrics">
    <Metric icon={CalendarDays} label="Días trabajados" value={preview.worked_days} note={`${preview.incident_days} días con incidencia`} />
    <Metric icon={ShieldCheck} label="Días de cotización" value={preview.contribution_days} note={`${preview.non_contribution_days} sin cotización`} tone="success" />
    <Metric icon={FileClock} label="Días IT" value={preview.it_days} note="Procesos médicos del periodo" tone={preview.it_days ? "warning" : ""} />
    <Metric icon={Database} label="Deducciones" value={money(preview.salary_deductions)} note="Reducción salarial calculada" tone={Number(preview.salary_deductions) ? "critical" : ""} />
    <Metric icon={CheckCircle2} label="Horas extraordinarias" value={money(preview.overtime_amount)} note="Devengo adicional" />
  </section>;
}
