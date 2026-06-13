import { useEffect, useMemo, useState } from "react";

import AgreementCriteriaPanel from "../components/agreements/AgreementCriteriaPanel";
import { fetchCollectiveAgreement } from "../services/collectiveAgreementApi";
import CollectiveAgreementsManagementPage from "./CollectiveAgreementsPage.jsx";

const MANAGEMENT_TAB_LABELS = {
  seniority: "Antigüedad",
  rules: "Jornada y permisos",
};

export default function CollectiveAgreementsWorkspacePage(props) {
  const agreements = props.collectiveAgreements || [];
  const [view, setView] = useState("management");
  const [selectedId, setSelectedId] = useState("");
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(() => {
    if (!agreements.length) return null;
    return agreements.find((item) => String(item.id) === String(selectedId)) || agreements[0];
  }, [agreements, selectedId]);

  useEffect(() => {
    if (view !== "criteria") return;
    if (!selected?.id) {
      setAgreement(null);
      setLoading(false);
      return;
    }

    let active = true;
    setAgreement(null);
    setLoading(true);
    setError("");
    fetchCollectiveAgreement(selected.id)
      .then((data) => active && setAgreement(data))
      .catch((err) => active && setError(err.message || "No se pudo cargar el convenio."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [view, selected?.id]);

  function openManagementTab(targetTab) {
    setView("management");
    const targetLabel = MANAGEMENT_TAB_LABELS[targetTab];
    if (!targetLabel) return;
    window.setTimeout(() => {
      const button = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === targetLabel);
      button?.click();
    }, 0);
  }

  return (
    <div style={styles.wrapper}>
      <nav style={styles.tabs}>
        <button type="button" onClick={() => setView("management")} style={view === "management" ? styles.tabActive : styles.tab}>Gestión del convenio</button>
        <button type="button" onClick={() => setView("criteria")} style={view === "criteria" ? styles.tabActive : styles.tab}>Criterios laborales</button>
      </nav>

      {view === "management" && <CollectiveAgreementsManagementPage {...props} />}

      {view === "criteria" && (
        <div style={styles.criteriaArea}>
          <section style={styles.header}>
            <div>
              <h2 style={styles.title}>Criterios laborales del convenio</h2>
              <p style={styles.subtitle}>Parámetros organizados por materia laboral, sin códigos ni estructuras técnicas.</p>
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
              <AgreementCriteriaPanel agreement={agreement} categories={agreement.professional_categories || []} onOpenTab={openManagementTab} />
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
  criteriaArea: { display: "flex", flexDirection: "column", gap: "10px" },
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
