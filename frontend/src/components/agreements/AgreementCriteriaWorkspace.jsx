import { lazy, Suspense, useState } from "react";

const AgreementCriteriaPanel = lazy(() => import("./AgreementCriteriaPanel"));
const AgreementSeniorityPanel = lazy(() => import("./AgreementSeniorityPanel"));
const IncidentRuleManager = lazy(() => import("./IncidentRuleManager"));

const SECTIONS = [
  {
    id: "criteria",
    label: "Criterios generales",
    title: "Criterios laborales",
    description: "SMI e IPREM, pagas, atrasos, contratación, período de prueba y complementos de IT.",
  },
  {
    id: "incident-rules",
    label: "Reglas de incidencias",
    title: "Motor de incidencias",
    description: "Reglas por convenio, vigencias, prioridades, bandas de IT y tratamiento de cotización.",
  },
  {
    id: "seniority",
    label: "Antigüedad y vencimientos",
    title: "Antigüedad y vencimientos",
    description: "Reglas de trienios, quinquenios, importes y aplicación por contrato.",
  },
];

export default function AgreementCriteriaWorkspace({
  agreement,
  onAgreementChanged,
  onOpenManagementTab,
}) {
  const [activeSection, setActiveSection] = useState("criteria");
  const section = SECTIONS.find((item) => item.id === activeSection) || SECTIONS[0];

  function handleCriteriaNavigation(target) {
    if (target === "seniority") {
      setActiveSection("seniority");
      return;
    }

    onOpenManagementTab?.(target);
  }

  function refreshAgreement() {
    return onAgreementChanged?.({ agreementId: agreement.id });
  }

  return (
    <section style={styles.wrapper}>
      <nav style={styles.tabs} aria-label="Apartados de criterios laborales">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveSection(item.id)}
            style={activeSection === item.id ? styles.tabActive : styles.tab}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <header style={styles.header}>
        <div>
          <h3 style={styles.title}>{section.title}</h3>
          <p style={styles.description}>{section.description}</p>
        </div>
        <div style={styles.status}>
          <span>Carga</span>
          <strong>Bajo demanda</strong>
        </div>
      </header>

      <Suspense fallback={<div style={styles.loading}>Cargando apartado laboral…</div>}>
        <div key={`${agreement.id}:${activeSection}`} style={styles.content}>
          {activeSection === "criteria" && (
            <AgreementCriteriaPanel
              agreement={agreement}
              categories={agreement.professional_categories || []}
              onOpenTab={handleCriteriaNavigation}
            />
          )}

          {activeSection === "incident-rules" && (
            <IncidentRuleManager agreement={agreement} />
          )}

          {activeSection === "seniority" && (
            <AgreementSeniorityPanel
              agreement={agreement}
              onChanged={refreshAgreement}
            />
          )}
        </div>
      </Suspense>
    </section>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    border: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    padding: "6px",
  },
  tab: {
    minHeight: "34px",
    border: "1px solid transparent",
    backgroundColor: "transparent",
    color: "#4b5563",
    padding: "0 12px",
    fontSize: "12px",
    fontWeight: 750,
    cursor: "pointer",
  },
  tabActive: {
    minHeight: "34px",
    border: "1px solid #d1d5db",
    borderBottomColor: "#eab308",
    backgroundColor: "#fff",
    color: "#111827",
    padding: "0 12px",
    fontSize: "12px",
    fontWeight: 850,
    cursor: "pointer",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    border: "1px solid #e5e7eb",
    borderLeft: "3px solid #facc15",
    backgroundColor: "#fff",
    padding: "11px 13px",
  },
  title: {
    margin: 0,
    color: "#111827",
    fontSize: "15px",
    fontWeight: 850,
  },
  description: {
    margin: "3px 0 0",
    color: "#6b7280",
    fontSize: "12px",
  },
  status: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    color: "#6b7280",
    fontSize: "11px",
  },
  loading: {
    border: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    color: "#4b5563",
    padding: "14px",
    fontSize: "12px",
    fontWeight: 750,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
};
