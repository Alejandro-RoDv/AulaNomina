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
import "./teachingSplit42.css";

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
  if (route === "teacher-dashboard") return "Panel docente";
  if (route === "assignments") return "Asignaciones";
  if (route === "corrections") return "Correcciones";
  if (route === "students") return "Alumnos";
  if (route === "groups") return "Grupos";
  if (route === "progress") return "Seguimiento";
  if (route === "student-demo") return "Mis casos prácticos";
  if (route === "teaching-alerts") return "Alertas docentes";
  return "Casos prácticos";
}

function getRouteSubtitle(route) {
  if (route === "teacher-dashboard") return "Resumen operativo de casos, asignaciones, entregas, correcciones y vencimientos.";
  if (route === "assignments") return "Asigna casos prácticos a grupos o alumnos y controla su estado.";
  if (route === "corrections") return "Revisa entregas, registra resultados y devuelve feedback al alumno.";
  if (route === "students") return "Consulta y gestiona los alumnos disponibles en el entorno docente.";
  if (route === "groups") return "Organiza alumnos por curso, centro o programa formativo.";
  if (route === "progress") return "Seguimiento del avance de casos, tareas, alumnos y correcciones.";
  if (route === "student-demo") return "Accede a los casos asignados y continúa la práctica desde el punto correspondiente.";
  if (route === "teaching-alerts") return "Vencimientos y avisos derivados de casos, entregas y documentación docente.";
  return "Creación, edición y mantenimiento de ejercicios docentes dentro del ERP.";
}

function getModuleLabel(route) {
  return route === "student-demo" ? "Formación" : "Docencia";
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

  const moduleLabel = getModuleLabel(route);

  return (
    <div className="teaching-shell" data-route={route} data-module={moduleLabel.toLowerCase()}>
      <header className="teaching-shell__header">
        <div>
          <span className="teaching-shell__eyebrow">{moduleLabel}</span>
          <h1 className="teaching-shell__title">{getRouteTitle(route)}</h1>
          <p className="teaching-shell__subtitle">{getRouteSubtitle(route)}</p>
        </div>
        <span className="teaching-shell__module-badge">Entorno educativo</span>
      </header>
      <main className="teaching-shell__main">
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
