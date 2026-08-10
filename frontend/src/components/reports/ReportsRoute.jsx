import { useEffect, useState } from "react";

import Model190Workspace from "../model190/Model190Workspace";
import Model111Page from "../../pages/Model111Page";
import "../../pages/Model111Page.css";
import "./FiscalTabsPolish.css";
import "./ReportsPolish.css";
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
    const handleDemoSeeded = (event) => {
      const company = event.detail?.company;
      if (!company?.id) return;
      setData((current) => ({
        ...current,
        companies: [
          ...current.companies.filter((item) => item.id !== company.id),
          company,
        ],
      }));
    };

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("aulanomina-route-change", handleRouteChange);
    window.addEventListener("aulanomina-model190-demo-seeded", handleDemoSeeded);

    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("aulanomina-route-change", handleRouteChange);
      window.removeEventListener("aulanomina-model190-demo-seeded", handleDemoSeeded);
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
            <span style={styles.eyebrow}>FISCALIDAD</span>
            <h1 style={styles.title}>{isModel190 ? "Modelo 190" : "Modelo 111"}</h1>
            <p style={styles.subtitle}>
              {isModel190
                ? "Cierre anual, conciliación, declaraciones y práctica guiada."
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
            <button type="button" style={styles.secondaryButton} onClick={() => { window.location.hash = ""; }}>Volver al panel</button>
          </div>
        </header>
        <main style={styles.main}>
          {error ? <div style={styles.error}>{error}</div> : null}
          {isModel190 ? <Model190Workspace companies={data.companies} /> : <Model111Page companies={data.companies} />}
        </main>
      </div>
    );
  }

  return (
    <div className="reports-route" style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <span style={styles.eyebrow}>DOCUMENTACIÓN</span>
          <h1 style={styles.title}>Informes</h1>
          <p style={styles.subtitle}>Documentos HTML imprimibles y listados exportables para Excel o LibreOffice.</p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.switchButton} onClick={() => { window.location.hash = "#model-190"; }}>Abrir Modelo 190</button>
          <button type="button" style={styles.switchButton} onClick={() => { window.location.hash = "#model-111"; }}>Abrir Modelo 111</button>
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
    backgroundColor: "#f8fafc",
    overflowY: "auto",
  },
  header: {
    borderBottom: "1px solid #dbe3ee",
    backgroundColor: "#ffffff",
    padding: "22px 42px 18px 32px",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
  },
  eyebrow: {
    display: "block",
    marginBottom: "6px",
    color: "#64748b",
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: ".08em",
  },
  headerActions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
  },
  switchButton: {
    minHeight: "38px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    background: "#ffffff",
    color: "#334155",
    padding: "8px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    minHeight: "38px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    background: "#f8fafc",
    color: "#334155",
    padding: "8px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  title: {
    margin: 0,
    color: "#172033",
    fontSize: "30px",
    fontWeight: 900,
    letterSpacing: "-.025em",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 500,
  },
  main: {
    padding: "28px 42px 48px 32px",
    boxSizing: "border-box",
    maxWidth: "1360px",
    width: "100%",
  },
  error: {
    border: "1px solid #f1c2c2",
    borderRadius: "7px",
    backgroundColor: "#fff8f8",
    color: "#991b1b",
    padding: "11px 12px",
    marginBottom: "18px",
    fontWeight: 750,
  },
};
