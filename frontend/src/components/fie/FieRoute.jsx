import { useEffect, useState } from "react";

import FieInboxPage from "../../pages/FieInboxPage";
import { fetchCompanies } from "../../services/companyApi";
import { fetchEmployees } from "../../services/employeeApi";
import { generatePendingFieCommunications } from "../../services/fieApi";

function isFieRoute() {
  return window.location.hash === "#fie-inss";
}

function closeFieRoute() {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  window.dispatchEvent(new Event("aulanomina-route-change"));
}

export default function FieRoute() {
  const [active, setActive] = useState(isFieRoute());
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleRouteChange = () => setActive(isFieRoute());
    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("aulanomina-route-change", handleRouteChange);
    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("aulanomina-route-change", handleRouteChange);
    };
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    let mounted = true;

    const loadModule = async () => {
      setLoading(true);
      setError("");
      try {
        const [companyData, employeeData] = await Promise.all([fetchCompanies(), fetchEmployees()]);
        try {
          await generatePendingFieCommunications({ limit: 50 });
        } catch (pendingError) {
          if (mounted) setError(pendingError.message || "No se han podido consultar nuevas comunicaciones automáticas");
        }
        if (!mounted) return;
        setCompanies(companyData || []);
        setEmployees(employeeData || []);
      } catch (requestError) {
        if (mounted) setError(requestError.message || "Error cargando el módulo FIE");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadModule();
    return () => { mounted = false; };
  }, [active]);

  if (!active) return null;

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <span style={styles.eyebrow}>Seguros sociales · SILTRA simulado</span>
          <h1 style={styles.title}>FIE / INSS Empresas</h1>
          <p style={styles.subtitle}>Recepción, conciliación y aplicación educativa de bajas, confirmaciones, altas, modificaciones, anulaciones y recaídas.</p>
        </div>
        <button type="button" onClick={closeFieRoute} style={styles.backButton}>Volver a Seguros Sociales</button>
      </header>
      <main style={styles.main}>
        {error && <div style={styles.error}>{error}</div>}
        {loading
          ? <div style={styles.loading}>Consultando INSS simulado y cargando la bandeja FIE...</div>
          : <FieInboxPage companies={companies} employees={employees} />}
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
    zIndex: 21,
    backgroundColor: "#ffffff",
    overflowY: "auto",
  },
  header: {
    borderBottom: "3px solid #111111",
    backgroundColor: "#ffffff",
    padding: "22px 42px 16px 32px",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
  },
  eyebrow: { display: "block", marginBottom: "4px", color: "#1d4ed8", fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" },
  title: { margin: 0, color: "#111111", fontSize: "30px", fontWeight: 950 },
  subtitle: { margin: "6px 0 0", color: "#4b5563", fontSize: "14px", fontWeight: 700, maxWidth: "980px" },
  backButton: { border: "1px solid #111827", borderRadius: "5px", backgroundColor: "#ffffff", color: "#111827", padding: "9px 13px", cursor: "pointer", fontWeight: 900 },
  main: { padding: "24px 42px 48px 32px", boxSizing: "border-box", maxWidth: "1680px", width: "100%" },
  error: { border: "1px solid #fca5a5", backgroundColor: "#fef2f2", color: "#991b1b", padding: "12px", marginBottom: "18px", fontWeight: 800 },
  loading: { border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "18px", color: "#4b5563", fontWeight: 800 },
};
