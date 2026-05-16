import { useEffect, useState } from "react";

import ReportsPage from "../../pages/ReportsPage";
import { fetchContracts } from "../../services/api";
import { fetchCompanies } from "../../services/companyApi";
import { fetchAllEmployees } from "../../services/employeeApi";
import { fetchIncidents } from "../../services/incidentApi";
import { fetchPayrolls } from "../../services/payrollApi";
import { fetchWorkCenters } from "../../services/workCenterApi";

function isReportsRoute() {
  return window.location.hash === "#reports";
}

export default function ReportsRoute() {
  const [active, setActive] = useState(isReportsRoute());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    employees: [],
    companies: [],
    workCenters: [],
    contracts: [],
    incidents: [],
    payrolls: [],
  });

  useEffect(() => {
    const handleRouteChange = () => setActive(isReportsRoute());

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("aulanomina-route-change", handleRouteChange);

    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("aulanomina-route-change", handleRouteChange);
    };
  }, []);

  useEffect(() => {
    if (!active) return;

    async function loadReportsData() {
      try {
        setLoading(true);
        setError("");
        const [contracts, employees, companies, workCenters, incidents, payrolls] = await Promise.all([
          fetchContracts(),
          fetchAllEmployees(),
          fetchCompanies(),
          fetchWorkCenters(),
          fetchIncidents(),
          fetchPayrolls(),
        ]);

        setData({ contracts, employees, companies, workCenters, incidents, payrolls });
      } catch (err) {
        setError(err.message || "Error cargando informes");
      } finally {
        setLoading(false);
      }
    }

    loadReportsData();
  }, [active]);

  if (!active) return null;

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Informes</h1>
          <p style={styles.subtitle}>Documentos HTML imprimibles y listados exportables tipo Excel.</p>
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
    top: 0,
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
