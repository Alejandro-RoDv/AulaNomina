import { useEffect, useState } from "react";

import CaseStudiesPage from "../../pages/CaseStudiesPage";

function isCaseStudiesRoute() {
  return window.location.hash === "#case-studies";
}

export default function CaseStudiesRoute() {
  const [visible, setVisible] = useState(isCaseStudiesRoute());

  useEffect(() => {
    const handleRouteChange = () => setVisible(isCaseStudiesRoute());

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("aulanomina-route-change", handleRouteChange);

    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("aulanomina-route-change", handleRouteChange);
    };
  }, []);

  if (!visible) return null;

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Casos prácticos</h1>
          <p style={styles.subtitle}>Creación y seguimiento manual de ejercicios docentes dentro del ERP.</p>
        </div>
      </header>
      <main style={styles.main}>
        <CaseStudiesPage />
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
};
