import { useEffect, useState } from "react";

import AgreementCriteriaWorkspace from "../components/agreements/AgreementCriteriaWorkspace";
import AgreementSalaryWorkspace from "../components/agreements/AgreementSalaryWorkspace";
import "../components/agreements/agreementSplit42Refinements.css";
import { useAgreementWorkspace } from "../hooks/useAgreementWorkspace";
import CollectiveAgreementsManagementPage from "./CollectiveAgreementsManagementPage.jsx";

const VIEW_COPY = {
  criteria: {
    title: "Criterios laborales del convenio",
    subtitle: "Configura las reglas laborales y condiciones aplicables al convenio.",
  },
  salary: {
    title: "Estructura salarial del convenio",
    subtitle: "Gestiona conceptos, revisiones, activaciones, atrasos y pagas del convenio.",
  },
};

export default function CollectiveAgreementsWorkspacePage(props) {
  const agreements = props.collectiveAgreements || [];
  const [view, setView] = useState("management");
  const [managementTab, setManagementTab] = useState("overview");
  const {
    selected,
    setSelectedId,
    agreement,
    loading,
    error,
    refreshAgreement,
    retryAgreement,
  } = useAgreementWorkspace({
    collectiveAgreements: agreements,
    onAgreementListChanged: props.onAgreementListChanged,
    onDataChanged: props.onDataChanged,
  });

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("aulanomina-header-context", {
      detail: {
        eyebrow: "Organización",
        title: "Convenios",
        subtitle: "Gestión de convenios colectivos, estructura salarial y criterios laborales",
      },
    }));
  }, []);

  function openManagementTab(targetTab) {
    setManagementTab(targetTab || "overview");
    setView("management");
  }

  const copy = VIEW_COPY[view];

  return (
    <div className="agreement-workspace" style={styles.wrapper}>
      <nav style={styles.tabs} aria-label="Áreas del convenio">
        <button type="button" onClick={() => setView("management")} style={view === "management" ? styles.tabActive : styles.tab}>Gestión del convenio</button>
        <button type="button" onClick={() => setView("salary")} style={view === "salary" ? styles.tabActive : styles.tab}>Estructura salarial</button>
        <button type="button" onClick={() => setView("criteria")} style={view === "criteria" ? styles.tabActive : styles.tab}>Criterios laborales</button>
      </nav>

      {error && (
        <div style={styles.errorRow}>
          <span>{error}</span>
          <button type="button" onClick={retryAgreement} style={styles.retryButton}>Reintentar carga</button>
        </div>
      )}

      {view === "management" && (
        <CollectiveAgreementsManagementPage
          key={selected?.id || "sin-convenio"}
          loading={props.loading || loading}
          collectiveAgreements={agreements}
          selectedAgreement={agreement}
          selectedAgreementId={selected?.id || ""}
          onSelectedAgreementIdChange={setSelectedId}
          activeTab={managementTab}
          onActiveTabChange={setManagementTab}
          onAgreementChanged={refreshAgreement}
        />
      )}

      {view !== "management" && (
        <div style={styles.workspaceArea}>
          <section style={styles.header}>
            <div>
              <h2 style={styles.title}>{copy.title}</h2>
              <p style={styles.subtitle}>{copy.subtitle}</p>
            </div>
            <label style={styles.label}>Convenio
              <select value={selected?.id || ""} onChange={(event) => setSelectedId(event.target.value)} style={styles.select}>
                {!agreements.length && <option value="">Sin convenios</option>}
                {agreements.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.agreement_code || "sin código"}</option>)}
              </select>
            </label>
          </section>

          {loading && <div style={styles.notice}>Cargando convenio…</div>}
          {!loading && !agreement && !error && <div style={styles.notice}>Selecciona o crea un convenio.</div>}
          {!loading && agreement && (
            <>
              <section style={styles.summary}>
                <Summary label="Convenio" value={agreement.name} />
                <Summary label="Código" value={agreement.agreement_code || "—"} />
                <Summary label="Sector" value={agreement.sector || "—"} />
                <Summary label="Ámbito" value={agreement.territorial_scope || "—"} />
              </section>
              {view === "criteria" && (
                <AgreementCriteriaWorkspace
                  key={agreement.id}
                  agreement={agreement}
                  onAgreementChanged={refreshAgreement}
                  onOpenManagementTab={openManagementTab}
                />
              )}
              {view === "salary" && (
                <AgreementSalaryWorkspace
                  key={agreement.id}
                  agreement={agreement}
                  onAgreementChanged={refreshAgreement}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }) {
  return <div style={styles.summaryItem}><span>{label}</span><strong>{value}</strong></div>;
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "22px" },
  tabs: { display: "flex", flexWrap: "wrap", gap: "24px", borderBottom: "1px solid #e2e8f0", background: "transparent" },
  tab: { border: 0, borderBottom: "2px solid transparent", background: "transparent", padding: "0 0 12px", color: "#64748b", fontSize: "13px", fontWeight: 700, cursor: "pointer" },
  tabActive: { border: 0, borderBottom: "2px solid #2563eb", background: "transparent", padding: "0 0 12px", color: "#1d4ed8", fontSize: "13px", fontWeight: 800, cursor: "pointer" },
  workspaceArea: { display: "flex", flexDirection: "column", gap: "22px" },
  header: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 0.8fr)", gap: "28px", alignItems: "end", borderBottom: "1px solid #e2e8f0", padding: "0 0 20px" },
  title: { margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a" },
  subtitle: { margin: "6px 0 0", maxWidth: "62ch", color: "#64748b", fontSize: "13px", lineHeight: 1.5 },
  label: { display: "flex", flexDirection: "column", gap: "6px", color: "#475569", fontSize: "12px", fontWeight: 700 },
  select: { width: "100%", minHeight: "40px", border: "1px solid #cbd5e1", borderRadius: "7px", background: "#fff", padding: "7px 10px", fontSize: "13px", color: "#0f172a" },
  summary: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "24px", borderBottom: "1px solid #e2e8f0", padding: "0 0 18px" },
  summaryItem: { display: "flex", flexDirection: "column", gap: "4px", color: "#64748b", fontSize: "12px" },
  notice: { border: "1px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc", color: "#475569", padding: "12px 14px", fontSize: "12px", fontWeight: 700 },
  errorRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", border: "1px solid #fecaca", borderRadius: "8px", background: "#fef2f2", color: "#991b1b", padding: "10px 12px", fontSize: "12px", fontWeight: 700 },
  retryButton: { minHeight: "32px", border: "1px solid #fecaca", borderRadius: "6px", background: "#fff", color: "#991b1b", padding: "5px 10px", fontSize: "12px", fontWeight: 700, cursor: "pointer" },
};
