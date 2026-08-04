import { useState } from "react";

import Model190AnnualPanel from "./Model190AnnualPanel";
import Model190DeclarationsPanel from "./Model190DeclarationsPanel";
import Model190DemoPanel from "./Model190DemoPanel";
import "./Model190Workspace.css";
import "./Model190Route.css";

const TABS = [
  ["annual", "Cálculo anual", "Resumen, perceptores, conciliación y validaciones"],
  ["declarations", "Declaraciones y documentos", "Generación, presentación, justificantes y certificados"],
  ["demo", "Caso guiado", "Escenario práctico completo del cierre anual"],
];

export default function Model190Workspace({ companies = [] }) {
  const [activeTab, setActiveTab] = useState("annual");

  return (
    <section className="m190-workspace">
      <nav className="m190-workspace__tabs" aria-label="Espacios del Modelo 190">
        {TABS.map(([id, label, description]) => (
          <button
            type="button"
            key={id}
            className={activeTab === id ? "is-active" : ""}
            onClick={() => setActiveTab(id)}
          >
            <b>{label}</b>
            <span>{description}</span>
          </button>
        ))}
      </nav>

      <div className="m190-workspace__content">
        {activeTab === "annual" ? <Model190AnnualPanel companies={companies} /> : null}
        {activeTab === "declarations" ? <Model190DeclarationsPanel companies={companies} /> : null}
        {activeTab === "demo" ? <Model190DemoPanel companies={companies} /> : null}
      </div>
    </section>
  );
}
