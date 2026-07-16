import { useEffect, useState } from "react";

import CraFilesPage from "../../pages/CraFilesPage";
import { fetchCompanies } from "../../services/companyApi";

function isCraRoute() {
  return window.location.hash === "#cra-files";
}

export default function CraRoute() {
  const [active, setActive] = useState(isCraRoute());
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleRouteChange = () => setActive(isCraRoute());
    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("aulanomina-route-change", handleRouteChange);
    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("aulanomina-route-change", handleRouteChange);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let mounted = true;
    setLoading(true);
    setError("");
    fetchCompanies()
      .then((data) => { if (mounted) setCompanies(data || []); })
      .catch((requestError) => { if (mounted) setError(requestError.message || "Error cargando empresas"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [active]);

  if (!active) return null;

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Ficheros CRA</h1>
          <p style={styles.subtitle}>Conceptos retributivos abonados y envío educativo mediante SILTRA.</p>
        </div>
      </header>
      <main style={styles.main}>
        {error && <div style={styles.error}>{error}</div>}
        {loading ? <div style={styles.loading}>Cargando empresas...</div> : <CraFilesPage companies={companies} />}
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
  title: { margin: 0, color: "#111111", fontSize: "32px", fontWeight: 950 },
  subtitle: { margin: "6px 0 0", color: "#4b5563", fontSize: "15px", fontWeight: 700 },
  main: { padding: "26px 42px 48px 32px", boxSizing: "border-box", maxWidth: "1320px", width: "100%" },
  error: { border: "1px solid #fca5a5", backgroundColor: "#fef2f2", color: "#991b1b", padding: "12px", marginBottom: "18px", fontWeight: 800 },
  loading: { border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "18px", color: "#4b5563", fontWeight: 800 },
};
