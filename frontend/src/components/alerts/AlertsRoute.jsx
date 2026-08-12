import { useEffect, useState } from "react";

import AlertsPage from "../../pages/AlertsPage";
import { fetchContracts } from "../../services/api";
import { fetchCompanies } from "../../services/companyApi";
import { fetchDocuments } from "../../services/documentApi";
import { fetchAllEmployees } from "../../services/employeeApi";
import { fetchIncidents } from "../../services/incidentApi";
import { fetchPayrolls } from "../../services/payrollApi";
import { fetchWorkCenters } from "../../services/workCenterApi";
import "./alertsModern.css";

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
    <div className="alerts-route">
      <header className="alerts-route__header">
        <span className="alerts-route__eyebrow">Centro de avisos</span>
        <h1 className="alerts-route__title">Alertas laborales</h1>
        <p className="alerts-route__subtitle">
          Vencimientos, pendientes y revisiones generadas automáticamente desde los módulos de AulaNomina.
        </p>
      </header>

      <main className="alerts-route__main">
        {error && <div className="alerts-route__message alerts-route__message--error">{error}</div>}
        {loading && <div className="alerts-route__message">Cargando alertas…</div>}
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
