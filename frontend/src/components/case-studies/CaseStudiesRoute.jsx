import { useEffect, useState } from "react";

import TeacherDashboardPage from "../../pages/TeacherDashboardPage";
import CaseStudiesPage from "../../pages/CaseStudiesPage";
import CaseAssignmentsPage from "../../pages/CaseAssignmentsPage";
import CorrectionsPage from "../../pages/CorrectionsPage";
import StudentsPage from "../../pages/StudentsPage";
import StudentGroupsPage from "../../pages/StudentGroupsPage";
import ProgressPage from "../../pages/ProgressPage";
import StudentDemoViewPage from "../../pages/StudentDemoViewPage";
import TeachingAlertsPage from "../../pages/TeachingAlertsPage";

function getTeachingRoute() {
  if (window.location.hash === "#teacher-dashboard") return "teacher-dashboard";
  if (window.location.hash === "#case-studies") return "case-studies";
  if (window.location.hash === "#assignments") return "assignments";
  if (window.location.hash === "#corrections") return "corrections";
  if (window.location.hash === "#students") return "students";
  if (window.location.hash === "#groups") return "groups";
  if (window.location.hash === "#progress") return "progress";
  if (window.location.hash === "#student-demo") return "student-demo";
  if (window.location.hash === "#teaching-alerts") return "teaching-alerts";
  return null;
}

function getRouteTitle(route) {
  if (route === "teacher-dashboard") return "Panel del profesor";
  if (route === "assignments") return "Asignar caso";
  if (route === "corrections") return "Correcciones";
  if (route === "students") return "Alumnos";
  if (route === "groups") return "Grupos";
  if (route === "progress") return "Progreso";
  if (route === "student-demo") return "Vista alumno";
  if (route === "teaching-alerts") return "Alertas docentes";
  return "Casos practicos";
}

function getRouteSubtitle(route) {
  if (route === "teacher-dashboard") return "Resumen docente de casos, asignaciones, entregas, correcciones y vencimientos.";
  if (route === "assignments") return "Vista rapida para asignar casos practicos a grupos o alumnos concretos.";
  if (route === "corrections") return "Revision manual de entregas, notas y feedback del profesor.";
  if (route === "students") return "Gestion basica de alumnos para la simulacion docente.";
  if (route === "groups") return "Organizacion de alumnos por curso, centro o programa formativo.";
  if (route === "progress") return "Seguimiento intuitivo del avance de casos, tareas, alumnos y correcciones.";
  if (route === "student-demo") return "Simulacion del portal del alumno sin autenticacion real.";
  if (route === "teaching-alerts") return "Vencimientos y avisos docentes derivados de casos, entregas y documentacion.";
  return "Creacion y edicion de ejercicios docentes dentro del ERP.";
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
        {route === "teacher-dashboard" && <TeacherDashboardPage />}
        {route === "assignments" && <CaseAssignmentsPage />}
        {route === "corrections" && <CorrectionsPage />}
        {route === "students" && <StudentsPage />}
        {route === "groups" && <StudentGroupsPage />}
        {route === "progress" && <ProgressPage />}
        {route === "student-demo" && <StudentDemoViewPage />}
        {route === "teaching-alerts" && <TeachingAlertsPage />}
        {route === "case-studies" && <CaseStudiesPage />}
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
};
