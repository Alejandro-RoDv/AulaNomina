import { useEffect, useState } from "react";

import AlertsPage from "../../pages/AlertsPage";
import { fetchContracts } from "../../services/api";
import { fetchCompanies } from "../../services/companyApi";
import { fetchDocuments } from "../../services/documentApi";
import { fetchAllEmployees } from "../../services/employeeApi";
import { fetchIncidents } from "../../services/incidentApi";
import { fetchPayrolls } from "../../services/payrollApi";
import { fetchWorkCenters } from "../../services/workCenterApi";

function isAlertsRoute() {
  return window.location.hash === "#alerts";
}

export default function AlertsRoute() {
  const [active, setActive] = useState(isAlertsRoute());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    documents: [],
    contracts: [],
    incidents: [],
    payrolls: [],
    employees: [],
    companies: [],
    workCenters: [],
  });

  useEffect(() => {
    const handleRouteChange = () => setActive(isAlertsRoute());

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("aulanomina-route-change", handleRouteChange);

    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("aulanomina-route-change", handleRouteChange);
    };
  }, []);

  useEffect(() => {
    if (!active) return;

    const loadAlertsData = async () => {
      try {
        setLoading(true);
        setError("");
        const [documents, contracts, incidents, payrolls, employees, companies, workCenters] = await Promise.all([
          fetchDocuments(),
          fetchContracts(),
          fetchIncidents(),
          fetchPayrolls(),
          fetchAllEmployees(),
          fetchCompanies(),
          fetchWorkCenters(),
        ]);

        setData({ documents, contracts, incidents, payrolls, employees, companies, workCenters });
      } catch (err) {
        setError(err.message || "Error cargando alertas");
      } finally {
        setLoading(false);
      }
    };

    loadAlertsData();
  }, [active]);

  const openEmployeeRecord = (employeeId) => {
    if (!employeeId) return;
    window.location.hash = "employee-record";
    window.dispatchEvent(new CustomEvent("aulanomina-open-employee-record", { detail: { employeeId } }));
    window.dispatchEvent(new Event("aulanomina-route-change"));
  };

  if (!active) return null;

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Alertas laborales</h1>
          <p style={styles.subtitle}>Vencimientos, pendientes y revisiones laborales generadas desde el ERP educativo.</p>
        </div>
      </header>

      <main style={styles.main}>
        {error && <div style={styles.error}>{error}</div>}
        {loading && <div style={styles.loading}>Cargando alertas...</div>}
        {!loading && (
          <AlertsPage
            documents={data.documents}
            contracts={data.contracts}
            incidents={data.incidents}
            payrolls={data.payrolls}
            employees={data.employees}
            companies={data.companies}
            workCenters={data.workCenters}
            onOpenEmployeeRecord={openEmployeeRecord}
          />
        )}
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
  loading: {
    border: "1px solid #d1d5db",
    backgroundColor: "#f9fafb",
    padding: "14px",
    color: "#374151",
    fontWeight: 800,
  },
  error: {
    border: "1px solid #fecaca",
    backgroundColor: "#fee2e2",
    padding: "14px",
    color: "#991b1b",
    fontWeight: 800,
    marginBottom: "16px",
  },
};
