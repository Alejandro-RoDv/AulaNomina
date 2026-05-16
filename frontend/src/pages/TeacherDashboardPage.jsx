import { useEffect, useMemo, useState } from "react";

import { fetchCaseAssignments } from "../services/caseAssignmentApi";
import { fetchCaseStudies } from "../services/caseStudyApi";
import { fetchCorrections } from "../services/correctionApi";
import { fetchStudents } from "../services/studentApi";
import { fetchStudentGroups } from "../services/studentGroupApi";

const assignmentStatusLabels = {
  assigned: "Asignado",
  in_progress: "En curso",
  submitted: "Entregado",
  reviewed: "Corregido",
  approved: "Aprobado",
  needs_revision: "Requiere revisión",
};

const correctionStatusLabels = {
  pending_review: "Pendiente de corregir",
  reviewed: "Corregido",
  approved: "Aprobado",
  needs_revision: "Requiere revisión",
};

function goTo(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new Event("aulanomina-route-change"));
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "Sin fecha";
  return date.toLocaleDateString("es-ES");
}

function isDueSoon(value) {
  const date = toDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 7);
  return date >= today && date <= limit;
}

function isOverdue(value) {
  const date = toDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function getCaseProgress(caseStudy) {
  const tasks = caseStudy.tasks || [];
  if (!tasks.length) return 0;
  const completed = tasks.filter((task) => task.status === "completed").length;
  return Math.round((completed / tasks.length) * 100);
}

export default function TeacherDashboardPage() {
  const [caseStudies, setCaseStudies] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [caseData, assignmentData, correctionData, studentData, groupData] = await Promise.all([
        fetchCaseStudies(),
        fetchCaseAssignments(),
        fetchCorrections(),
        fetchStudents(),
        fetchStudentGroups(),
      ]);
      setCaseStudies(caseData);
      setAssignments(assignmentData);
      setCorrections(correctionData);
      setStudents(studentData);
      setGroups(groupData);
    } catch (err) {
      setError(err.message || "Error cargando panel del profesor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const metrics = useMemo(() => {
    const activeCases = caseStudies.filter((caseStudy) => caseStudy.status === "active").length;
    const pendingCorrections = corrections.filter((correction) => correction.status === "pending_review").length;
    const needsRevision = corrections.filter((correction) => correction.status === "needs_revision").length;
    const submittedAssignments = assignments.filter((assignment) => assignment.status === "submitted").length;
    const dueSoon = assignments.filter((assignment) => isDueSoon(assignment.due_date)).length;
    const overdue = assignments.filter((assignment) => isOverdue(assignment.due_date) && !["reviewed", "approved"].includes(assignment.status)).length;

    const progressValues = caseStudies.map(getCaseProgress).filter((value) => Number.isFinite(value));
    const averageProgress = progressValues.length
      ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
      : 0;

    return {
      activeCases,
      pendingCorrections,
      needsRevision,
      submittedAssignments,
      dueSoon,
      overdue,
      averageProgress,
      students: students.length,
      groups: groups.length,
    };
  }, [caseStudies, assignments, corrections, students, groups]);

  const pendingCorrectionRows = useMemo(() => {
    return corrections
      .filter((correction) => ["pending_review", "needs_revision"].includes(correction.status))
      .slice(0, 6);
  }, [corrections]);

  const dueAssignmentRows = useMemo(() => {
    return assignments
      .filter((assignment) => assignment.due_date)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 6);
  }, [assignments]);

  const activeCaseRows = useMemo(() => {
    return caseStudies
      .filter((caseStudy) => caseStudy.status !== "archived")
      .slice(0, 6);
  }, [caseStudies]);

  if (loading) return <p style={styles.loading}>Cargando panel del profesor...</p>;

  return (
    <div style={styles.page}>
      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.hero}>
        <div>
          <h2 style={styles.heroTitle}>Panel del profesor</h2>
          <p style={styles.heroText}>Vista rápida de actividad docente: casos activos, asignaciones, entregas, correcciones y vencimientos.</p>
        </div>
        <div style={styles.quickActions}>
          <button type="button" style={styles.primaryButton} onClick={() => goTo("assignments")}>Asignar caso</button>
          <button type="button" style={styles.secondaryButton} onClick={() => goTo("corrections")}>Corregir entregas</button>
          <button type="button" style={styles.secondaryButton} onClick={() => goTo("case-studies")}>Crear caso</button>
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Casos activos</span><strong style={styles.summaryValue}>{metrics.activeCases}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Pendientes de corregir</span><strong style={styles.summaryValue}>{metrics.pendingCorrections}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Vencen esta semana</span><strong style={styles.summaryValue}>{metrics.dueSoon}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Progreso medio</span><strong style={styles.summaryValue}>{metrics.averageProgress}%</strong></div>
      </section>

      <section style={styles.secondaryGrid}>
        <div style={styles.smallMetric}><span>Entregadas</span><strong>{metrics.submittedAssignments}</strong></div>
        <div style={styles.smallMetric}><span>Requieren revisión</span><strong>{metrics.needsRevision}</strong></div>
        <div style={styles.smallMetric}><span>Fuera de plazo</span><strong>{metrics.overdue}</strong></div>
        <div style={styles.smallMetric}><span>Alumnos / grupos</span><strong>{metrics.students}/{metrics.groups}</strong></div>
      </section>

      <section style={styles.contentGrid}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Correcciones prioritarias</h3>
            <button type="button" style={styles.linkButton} onClick={() => goTo("corrections")}>Ver todo</button>
          </div>
          <div style={styles.list}>
            {pendingCorrectionRows.length ? pendingCorrectionRows.map((correction) => (
              <article key={correction.id} style={styles.listItem}>
                <strong>{correction.assignee_name || correction.student_name || "Sin destinatario"}</strong>
                <span>{correction.case_title || "Caso sin título"}</span>
                <small>{correctionStatusLabels[correction.status] || correction.status}</small>
              </article>
            )) : <p style={styles.empty}>No hay correcciones pendientes.</p>}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Vencimientos</h3>
            <button type="button" style={styles.linkButton} onClick={() => goTo("assignments")}>Ver asignaciones</button>
          </div>
          <div style={styles.list}>
            {dueAssignmentRows.length ? dueAssignmentRows.map((assignment) => (
              <article key={assignment.id} style={{ ...styles.listItem, ...(isOverdue(assignment.due_date) ? styles.overdueItem : {}) }}>
                <strong>{assignment.case_title || "Caso sin título"}</strong>
                <span>{assignment.assignee_name || "Sin destinatario"}</span>
                <small>{formatDate(assignment.due_date)} · {assignmentStatusLabels[assignment.status] || assignment.status}</small>
              </article>
            )) : <p style={styles.empty}>No hay fechas límite registradas.</p>}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Casos recientes</h3>
            <button type="button" style={styles.linkButton} onClick={() => goTo("progress")}>Ver progreso</button>
          </div>
          <div style={styles.list}>
            {activeCaseRows.length ? activeCaseRows.map((caseStudy) => {
              const progress = getCaseProgress(caseStudy);
              return (
                <article key={caseStudy.id} style={styles.listItem}>
                  <strong>{caseStudy.title}</strong>
                  <span>{caseStudy.tasks?.length || 0} tareas · {caseStudy.status}</span>
                  <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: `${progress}%` }} /></div>
                </article>
              );
            }) : <p style={styles.empty}>No hay casos registrados.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "20px" },
  hero: { display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "center", border: "2px solid #111111", backgroundColor: "#ffffff", boxShadow: "4px 4px 0 #e6d85c", padding: "20px" },
  heroTitle: { margin: "0 0 6px", fontSize: "28px", fontWeight: 950, color: "#111111" },
  heroText: { margin: 0, color: "#4b5563", fontWeight: 700, lineHeight: 1.45 },
  quickActions: { display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" },
  summaryCard: { border: "2px solid #111111", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #e6d85c", padding: "14px" },
  summaryLabel: { display: "block", fontSize: "12px", fontWeight: 900, color: "#4b5563", textTransform: "uppercase" },
  summaryValue: { display: "block", marginTop: "4px", fontSize: "32px", fontWeight: 950, color: "#111111" },
  secondaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" },
  smallMetric: { border: "2px solid #111111", backgroundColor: "#f8f3b5", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 900 },
  contentGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "18px", alignItems: "start" },
  card: { backgroundColor: "#ffffff", border: "2px solid #111111", boxShadow: "4px 4px 0 #e6d85c", padding: "18px", boxSizing: "border-box" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "12px" },
  cardTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111111" },
  list: { display: "flex", flexDirection: "column", gap: "10px" },
  listItem: { border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" },
  overdueItem: { borderColor: "#991b1b", backgroundColor: "#fee2e2" },
  empty: { margin: 0, color: "#4b5563", fontWeight: 700 },
  progressBar: { height: "8px", border: "1px solid #111111", backgroundColor: "#ffffff", marginTop: "6px" },
  progressFill: { height: "100%", backgroundColor: "#e6d85c" },
  primaryButton: { border: "2px solid #111111", backgroundColor: "#111111", color: "#ffffff", padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "2px solid #111111", backgroundColor: "#f8f3b5", color: "#111111", padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  linkButton: { border: "none", backgroundColor: "transparent", color: "#111111", fontWeight: 900, cursor: "pointer", textDecoration: "underline" },
  error: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "10px 12px", fontWeight: 800 },
  loading: { fontWeight: 800 },
};
