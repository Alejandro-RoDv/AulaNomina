import { Calculator, Eye } from "lucide-react";

import { formatDate, money } from "./incidentPayrollUi";

export function IncidentSegmentTable({ segments = [] }) {
  return <section className="incident-engine-panel incident-segments-panel">
    <header>
      <div><span className="incident-panel-kicker"><Eye size={15} /> Explicación del cálculo</span><h3>Segmentos del periodo</h3><p>Cada tramo muestra el tratamiento salarial y de cotización aplicado.</p></div>
      <strong>{segments.length} segmentos</strong>
    </header>
    <div className="incident-segment-table-wrap"><table className="incident-segment-table">
      <thead><tr><th>Periodo</th><th>Segmento</th><th>Días nómina</th><th>Salario</th><th>Prestación</th><th>Complemento</th><th>Deducción</th><th>Cotización</th></tr></thead>
      <tbody>
        {segments.map((segment) => <tr key={segment.segment_key}>
          <td>{formatDate(segment.start_date)}<small>{formatDate(segment.end_date)}</small></td>
          <td><strong>{segment.segment_type}</strong><small>Incidencia {segment.incident_id || "normal"}</small></td>
          <td>{segment.payroll_days}</td>
          <td>{money(segment.salary_amount)}</td>
          <td>{money(segment.benefit_amount)}</td>
          <td>{money(segment.complement_amount)}</td>
          <td>{money(segment.deduction_amount)}</td>
          <td><span className={`incident-source-pill ${segment.contribution_treatment}`}>{segment.contribution_treatment}</span></td>
        </tr>)}
        {!segments.length && <tr><td colSpan="8">No hay segmentos disponibles.</td></tr>}
      </tbody>
    </table></div>
  </section>;
}

export function IncidentComponentAdjustments({ adjustments = [] }) {
  return <section className="incident-engine-panel">
    <header><div><span className="incident-panel-kicker"><Calculator size={15} /> Conceptos sensibles</span><h3>Ajustes aplicados</h3></div><strong>{adjustments.length} conceptos</strong></header>
    <div className="incident-adjustment-grid">
      {adjustments.map((item) => <article key={item.field}>
        <span>{item.field.replaceAll("_", " ")}</span>
        <strong>{money(item.adjusted_amount)}</strong>
        <small>{money(item.original_amount)} × {Number(item.factor).toLocaleString("es-ES", { maximumFractionDigits: 4 })}</small>
        <b>Reducción {money(item.reduction_amount)}</b>
      </article>)}
      {!adjustments.length && <div className="incident-empty">No hay ajustes de conceptos para este periodo.</div>}
    </div>
  </section>;
}
