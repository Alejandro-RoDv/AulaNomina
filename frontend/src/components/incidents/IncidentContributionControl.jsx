import { Database, ShieldCheck } from "lucide-react";

import { money, sourceLabel } from "./incidentPayrollUi";

const BASE_ROWS = [
  ["common_contingencies_base", "Contingencias comunes"],
  ["professional_contingencies_base", "Contingencias profesionales"],
  ["unemployment_training_fogasa_base", "Desempleo, formación y FOGASA"],
];

export default function IncidentContributionControl({
  resolution,
  overrides,
  setOverrides,
  onSubmit,
  onClear,
  saving,
  version,
}) {
  const automatic = resolution?.automatic || {};
  const resolved = resolution?.resolved || {};
  const sources = resolution?.sources || {};

  return <section className="incident-engine-grid">
    <article className="incident-engine-panel">
      <header>
        <div>
          <span className="incident-panel-kicker"><Database size={15} /> Bases de cotización</span>
          <h3>Origen y valor aplicado</h3>
        </div>
        <span className="incident-version-badge">Vista previa v{version}</span>
      </header>
      <div className="incident-base-list">
        {BASE_ROWS.map(([key, label]) => <div key={key}>
          <div><strong>{label}</strong><small>{sourceLabel(sources[key])}</small></div>
          <span>{money(automatic[key])}<small>automática</small></span>
          <b>{money(resolved[key])}<small>aplicada</small></b>
        </div>)}
      </div>
    </article>

    <article className="incident-engine-panel">
      <header><div><span className="incident-panel-kicker"><ShieldCheck size={15} /> Control manual</span><h3>Overrides explícitos</h3></div></header>
      <form className="incident-override-form" onSubmit={onSubmit}>
        <label>Contingencias comunes<input type="number" min="0" step="0.01" value={overrides.common} onChange={(event) => setOverrides((current) => ({ ...current, common: event.target.value }))} placeholder="Automática" /></label>
        <label>Contingencias profesionales<input type="number" min="0" step="0.01" value={overrides.professional} onChange={(event) => setOverrides((current) => ({ ...current, professional: event.target.value }))} placeholder="Automática" /></label>
        <label>Desempleo, formación y FOGASA<input type="number" min="0" step="0.01" value={overrides.unemployment} onChange={(event) => setOverrides((current) => ({ ...current, unemployment: event.target.value }))} placeholder="Automática" /></label>
        <p>Vacío significa cálculo automático. Cada cambio genera una nueva versión y snapshot.</p>
        <div><button type="button" onClick={onClear} className="incident-button-quiet">Restablecer campos</button><button type="submit" disabled={saving} className="incident-button-primary">{saving ? "Guardando…" : "Aplicar y recalcular"}</button></div>
      </form>
    </article>
  </section>;
}
