import { useEffect, useState } from "react";

import Model190DeclarationsPanel from "../model190/Model190DeclarationsPanel";
import Model190DemoPanel from "../model190/Model190DemoPanel";
import Model111Page from "../../pages/Model111Page";
import "../../pages/Model111Page.css";
import Model190Page from "../../pages/Model190Page";
import "../../pages/Model190Page.css";
import ReportsPage from "../../pages/ReportsPage";
import { fetchContracts } from "../../services/api";
import { fetchCompanies } from "../../services/companyApi";
import { fetchDocuments } from "../../services/documentApi";
import { fetchAllEmployees } from "../../services/employeeApi";
import { fetchIncidents } from "../../services/incidentApi";
import { fetchPayrolls } from "../../services/payrollApi";
import { fetchWorkCenters } from "../../services/workCenterApi";

function getRoute() {
  if (window.location.hash === "#model-111") return "model-111";
  if (window.location.hash === "#model-190") return "model-190";
  if (window.location.hash === "#reports") return "reports";
  return null;
}

export default function ReportsRoute() {
  const [route, setRoute] = useState(getRoute());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    employees: [],
    companies: [],
    workCenters: [],
    contracts: [],
    incidents: [],
    payrolls: [],
    documents: [],
  });

  useEffect(() => {
    const handleRouteChange = () => setRoute(getRoute());

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("aulanomina-route-change", handleRouteChange);

    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("aulanomina-route-change", handleRouteChange);
    };
  }, []);

  useEffect(() => {
    if (!route) return;

    async function loadRouteData() {
      try {
        setLoading(true);
        setError("");
        if (route === "model-111" || route === "model-190") {
          const companies = await fetchCompanies();
          setData((current) => ({ ...current, companies }));
          return;
        }

        const [contracts, employees, companies, workCenters, incidents, payrolls, documents] = await Promise.all([
          fetchContracts(),
          fetchAllEmployees(),
          fetchCompanies(),
          fetchWorkCenters(),
          fetchIncidents(),
          fetchPayrolls(),
          fetchDocuments(),
        ]);

        setData({ contracts, employees, companies, workCenters, incidents, payrolls, documents });
      } catch (err) {
        setError(err.message || "Error cargando el módulo");
      } finally {
        setLoading(false);
      }
    }

    loadRouteData();
  }, [route]);

  if (!route) return null;

  if (route === "model-111" || route === "model-190") {
    const isModel190 = route === "model-190";
    return (
      <div className={isModel190 ? "model190-route" : "model111-route"} style={styles.wrapper}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>{isModel190 ? "Modelo 190" : "Modelo 111"}</h1>
            <p style={styles.subtitle}>
              {isModel190
                ? "Cierre anual nominativo, conciliación 111/190, caso práctico guiado, ficheros, presentación y certificados."
                : "Retenciones de trabajo y actividades económicas, conciliación y presentación AEAT simulada."}
            </p>
          </div>
          <div style={styles.headerActions}>
            <button
              type="button"
              style={styles.switchButton}
              onClick={() => { window.location.hash = isModel190 ? "#model-111" : "#model-190"; }}
            >
              {isModel190 ? "Abrir Modelo 111" : "Abrir Modelo 190"}
            </button>
            <button type="button" style={styles.headerButton} onClick={() => { window.location.hash = ""; }}>Volver al panel</button>
          </div>
        </header>
        <main style={styles.main}>
          {error ? <div style={styles.error}>{error}</div> : null}
          {isModel190 ? (
            <>
              <Model190DemoPanel companies={data.companies} />
              <Model190DeclarationsPanel companies={data.companies} />
              <Model190Page companies={data.companies} />
            </>
          ) : <Model111Page companies={data.companies} />}
        </main>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Informes</h1>
          <p style={styles.subtitle}>Documentos HTML imprimibles y listados exportables tipo Excel.</p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.switchButton} onClick={() => { window.location.hash = "#model-190"; }}>Abrir Modelo 190</button>
          <button type="button" style={styles.headerButton} onClick={() => { window.location.hash = "#model-111"; }}>Abrir Modelo 111</button>
        </div>
      </header>
      <main style={styles.main}>
        {error && <div style={styles.error}>{error}</div>}
        <ReportsPage loading={loading} {...data} />
      </main>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "fixed",
    top: "56px",
    left: "272px",
    right: 0,
    bottom: 0,
    zIndex: 20,
    backgroundColor: "#ffffff",
    overflowY: "auto",
  },
  header: {
    borderBottom: "3px solid #111111",
    backgroundColor: "#ffffff",
    padding: "24px 42px 18px 32px",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
  },
  headerActions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "10px",
  },
  headerButton: {
    border: "3px solid #111111",
    background: "#f8f3b5",
    color: "#111111",
    boxShadow: "3px 3px 0 #111111",
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  switchButton: {
    border: "2px solid #111111",
    background: "#ffffff",
    color: "#111111",
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  title: {
    margin: 0,
    color: "#111111",
    fontSize: "32px",
    fontWeight: 950,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#4b5563",
    fontSize: "15px",
    fontWeight: 700,
  },
  main: {
    padding: "26px 42px 48px 32px",
    boxSizing: "border-box",
    maxWidth: "1320px",
    width: "100%",
  },
  error: {
    border: "1px solid #fca5a5",
    backgroundColor: "#fef2f2",
    color: "#991b1b",
    padding: "12px",
    marginBottom: "18px",
    fontWeight: 800,
  },
};
