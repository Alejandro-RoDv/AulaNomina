import { useEffect, useState } from "react";

import CaseStudiesPage from "../../pages/CaseStudiesPage";
import CorrectionsPage from "../../pages/CorrectionsPage";
import StudentsPage from "../../pages/StudentsPage";
import StudentGroupsPage from "../../pages/StudentGroupsPage";
import ProgressPage from "../../pages/ProgressPage";

function getTeachingRoute() {
  if (window.location.hash === "#case-studies") return "case-studies";
  if (window.location.hash === "#corrections") return "corrections";
  if (window.location.hash === "#students") return "students";
  if (window.location.hash === "#groups") return "groups";
  if (window.location.hash === "#progress") return "progress";
  return null;
}

function getRouteTitle(route) {
  if (route === "corrections") return "Correcciones";
  if (route === "students") return "Alumnos";
  if (route === "groups") return "Grupos";
  if (route === "progress") return "Progreso";
  return "Casos prácticos";
}

function getRouteSubtitle(route) {
  if (route === "corrections") return "Revisión manual de entregas, notas y feedback del profesor.";
  if (route === "students") return "Gestión básica de alumnos para la simulación docente.";
  if (route === "groups") return "Organización de alumnos por curso, centro o programa formativo.";
  if (route === "progress") return "Seguimiento intuitivo del avance de casos, tareas, alumnos y correcciones.";
  return "Creación y edición de ejercicios docentes dentro del ERP.";
}

export default function CaseStudiesRoute() {
  const [route, setRoute] = useState(getTeachingRoute());

  useEffect(() => {
    const handleRouteChange = () => setRoute(getTeachingRoute());

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("aulanomina-route-change", handleRouteChange);

    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("aulanomina-route-change", handleRouteChange);
    };
  }, []);

  if (!route) return null;

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>{getRouteTitle(route)}</h1>
          <p style={styles.subtitle}>{getRouteSubtitle(route)}</p>
        </div>
      </header>
      <main style={styles.main}>
        {route === "corrections" && <CorrectionsPage />}
        {route === "students" && <StudentsPage />}
        {route === "groups" && <StudentGroupsPage />}
        {route === "progress" && <ProgressPage />}
        {route === "case-studies" && <CaseStudiesPage />}
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
