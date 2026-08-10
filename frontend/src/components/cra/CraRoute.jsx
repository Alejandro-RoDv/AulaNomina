import { useEffect, useState } from "react";

import CraFilesPage from "../../pages/CraFilesPage";
import { fetchCompanies } from "../../services/companyApi";
import "./craModuleClosure.css";
import "./craModuleRefresh.css";

function isCraRoute() {
  return window.location.hash === "#cra-files";
}

function closeCraRoute() {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  window.dispatchEvent(new Event("aulanomina-route-change"));
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
          <span style={styles.eyebrow}>Seguridad Social</span>
          <h1 style={styles.title}>Conceptos Retributivos Abonados (CRA)</h1>
          <p style={styles.subtitle}>Configuración, generación, validación y comunicaciones CRA mediante SILTRA simulado</p>
        </div>
        <button type="button" onClick={closeCraRoute} style={styles.backButton}>Volver a Seguros Sociales</button>
      </header>
      <main style={styles.main}>
        {error && <div style={styles.error}>{error}</div>}
        {loading
          ? <div style={styles.loading}>Cargando empresas y configuración CRA...</div>
          : <CraFilesPage companies={companies} />}
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
    backgroundColor: "#f7f9fc",
    overflowY: "auto",
  },
  header: {
    borderBottom: "1px solid #dbe3ed",
    backgroundColor: "#ffffff",
    padding: "22px 32px 18px",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
  },
  eyebrow: {
    display: "block",
    marginBottom: "5px",
    color: "#64748b",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    color: "#172033",
    fontSize: "28px",
    lineHeight: 1.15,
    fontWeight: 800,
  },
  subtitle: {
    margin: "7px 0 0",
    color: "#53627a",
    fontSize: "13px",
    fontWeight: 400,
  },
  backButton: {
    border: "1px solid #cbd6e3",
    borderRadius: "7px",
    backgroundColor: "#ffffff",
    color: "#344258",
    padding: "9px 13px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
  },
  main: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "1380px",
    margin: "0 auto",
    padding: "28px 32px 48px",
  },
  error: {
    border: "1px solid #fecaca",
    borderRadius: "7px",
    backgroundColor: "#fef2f2",
    color: "#991b1b",
    padding: "11px 13px",
    marginBottom: "16px",
    fontSize: "12px",
    fontWeight: 700,
  },
  loading: {
    border: "1px solid #dbe3ed",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    padding: "18px",
    color: "#60708a",
    fontSize: "12px",
    fontWeight: 600,
  },
};
