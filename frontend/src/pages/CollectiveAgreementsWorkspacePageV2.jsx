import { useEffect, useRef, useState } from "react";

import AgreementCriteriaPanel from "../components/agreements/AgreementCriteriaPanel";
import AgreementExtraPayPanelV2 from "../components/agreements/AgreementExtraPayPanelV2";
import AgreementSalaryStructurePanel from "../components/agreements/AgreementSalaryStructurePanel";
import AgreementSeniorityPanel from "../components/agreements/AgreementSeniorityPanel";
import ContractExtraPaySimulationPanel from "../components/agreements/ContractExtraPaySimulationPanel";
import SalaryRegularizationPanel from "../components/agreements/SalaryRegularizationPanel";
import SalaryTableActivationPanel from "../components/agreements/SalaryTableActivationPanel";
import SalaryTableRevisionPanel from "../components/agreements/SalaryTableRevisionPanel";
import { useAgreementWorkspace } from "../hooks/useAgreementWorkspace";
import CollectiveAgreementsManagementPage from "./CollectiveAgreementsManagementPageV2.jsx";

const VIEW_COPY = {
  criteria: {
    title: "Criterios laborales del convenio",
    subtitle: "Parámetros organizados por materia laboral, sin códigos ni estructuras técnicas.",
  },
  salary: {
    title: "Estructura salarial del convenio",
    subtitle: "Conceptos retributivos versionados por tabla anual y categoría profesional.",
  },
};

export default function CollectiveAgreementsWorkspacePageV2(props) {
  const agreements = props.collectiveAgreements || [];
  const [view, setView] = useState("management");
  const [managementTab, setManagementTab] = useState("overview");
  const [pendingFocus, setPendingFocus] = useState("");
  const seniorityRef = useRef(null);
  const {
    selected,
    setSelectedId,
    agreement,
    loading,
    error,
    refreshAgreement,
  } = useAgreementWorkspace({
    collectiveAgreements: agreements,
    onDataChanged: props.onDataChanged,
  });

  useEffect(() => {
    if (view !== "criteria" || pendingFocus !== "seniority" || loading || !agreement) return;
    const timer = window.setTimeout(() => {
      seniorityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingFocus("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [agreement, loading, pendingFocus, view]);

  function openLinkedSection(targetTab) {
    if (targetTab === "seniority") {
      setView("criteria");
      setPendingFocus("seniority");
      return;
    }
    setManagementTab(targetTab || "overview");
    setView("management");
  }

  const copy = VIEW_COPY[view];

  return (
    <div style={styles.wrapper}>
      <nav style={styles.tabs}>
        <button type="button" onClick={() => setView("management")} style={view === "management" ? styles.tabActive : styles.tab}>Gestión del convenio</button>
        <button type="button" onClick={() => setView("salary")} style={view === "salary" ? styles.tabActive : styles.tab}>Estructura salarial</button>
        <button type="button" onClick={() => setView("criteria")} style={view === "criteria" ? styles.tabActive : styles.tab}>Criterios laborales</button>
      </nav>

      {view === "management" && (
        <CollectiveAgreementsManagementPage
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

          {error && <div style={styles.error}>{error}</div>}
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
                <>
                  <AgreementCriteriaPanel agreement={agreement} categories={agreement.professional_categories || []} onOpenTab={openLinkedSection} />
                  <div ref={seniorityRef}>
                    <AgreementSeniorityPanel agreement={agreement} onChanged={() => refreshAgreement({ agreementId: agreement.id })} />
                  </div>
                </>
              )}
              {view === "salary" && (
                <>
                  <SalaryTableRevisionPanel agreement={agreement} onCompleted={() => refreshAgreement({ agreementId: agreement.id })} />
                  <SalaryTableActivationPanel agreement={agreement} onChanged={() => refreshAgreement({ agreementId: agreement.id })} />
                  <SalaryRegularizationPanel agreement={agreement} onGenerated={() => refreshAgreement({ agreementId: agreement.id })} />
                  <AgreementExtraPayPanelV2 agreement={agreement} onChanged={() => refreshAgreement({ agreementId: agreement.id })} />
                  <ContractExtraPaySimulationPanel agreement={agreement} />
                  <AgreementSalaryStructurePanel agreement={agreement} />
                </>
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
  wrapper: { display: "flex", flexDirection: "column", gap: "12px" },
  tabs: { display: "flex", flexWrap: "wrap", gap: "2px", borderBottom: "1px solid #d1d5db", background: "#fff" },
  tab: { border: 0, borderBottom: "3px solid transparent", background: "transparent", padding: "10px 14px", color: "#4b5563", fontSize: "13px", fontWeight: 750, cursor: "pointer" },
  tabActive: { border: 0, borderBottom: "3px solid #facc15", background: "#fff", padding: "10px 14px", color: "#111827", fontSize: "13px", fontWeight: 850, cursor: "pointer" },
  workspaceArea: { display: "flex", flexDirection: "column", gap: "10px" },
  header: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "18px", alignItems: "end", border: "1px solid #e5e7eb", background: "#fff", padding: "14px" },
  title: { margin: 0, fontSize: "20px", fontWeight: 850, color: "#111827" },
  subtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "12px", fontWeight: 600 },
  label: { display: "flex", flexDirection: "column", gap: "5px", color: "#374151", fontSize: "12px", fontWeight: 800 },
  select: { width: "100%", height: "36px", border: "1px solid #d1d5db", background: "#fff", padding: "6px 9px", fontSize: "13px" },
  summary: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", border: "1px solid #e5e7eb", borderLeft: "3px solid #facc15", background: "#fff", padding: "10px 12px" },
  summaryItem: { display: "flex", flexDirection: "column", gap: "2px", color: "#374151", fontSize: "12px" },
  notice: { border: "1px solid #e5e7eb", background: "#f9fafb", color: "#4b5563", padding: "12px", fontSize: "12px", fontWeight: 750 },
  error: { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: "10px", fontSize: "12px", fontWeight: 750 },
};
