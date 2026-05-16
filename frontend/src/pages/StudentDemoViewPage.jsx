import { useEffect, useMemo, useState } from "react";

import { fetchCaseAssignments, updateCaseAssignment } from "../services/caseAssignmentApi";
import { fetchCaseStudies } from "../services/caseStudyApi";
import { fetchCorrections } from "../services/correctionApi";
import { fetchStudents } from "../services/studentApi";

const assignmentStatusLabels = {
  assigned: "Pendiente",
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

function getCaseProgress(caseStudy) {
  const tasks = caseStudy?.tasks || [];
  if (!tasks.length) return 0;
  const completed = tasks.filter((task) => task.status === "completed").length;
  return Math.round((completed / tasks.length) * 100);
}

function formatDate(value) {
  if (!value) return "Sin fecha límite";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha límite";
  return date.toLocaleDateString("es-ES");
}

function isVisibleToStudent(assignment, student) {
  if (!student) return false;
  if (assignment.student_id && Number(assignment.student_id) === Number(student.id)) return true;
  if (assignment.group_id && student.group_id && Number(assignment.group_id) === Number(student.group_id)) return true;
  return false;
}

export default function StudentDemoViewPage() {
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [caseStudies, setCaseStudies] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedStudent = useMemo(
    () => students.find((student) => Number(student.id) === Number(selectedStudentId)),
    [students, selectedStudentId]
  );

  const caseById = useMemo(() => {
    return caseStudies.reduce((acc, caseStudy) => ({ ...acc, [caseStudy.id]: caseStudy }), {});
  }, [caseStudies]);

  const correctionByAssignmentId = useMemo(() => {
    return corrections.reduce((acc, correction) => {
      if (correction.assignment_id) acc[correction.assignment_id] = correction;
      return acc;
    }, {});
  }, [corrections]);

  const myAssignments = useMemo(() => {
    return assignments.filter((assignment) => isVisibleToStudent(assignment, selectedStudent));
  }, [assignments, selectedStudent]);

  const counters = useMemo(() => {
    return myAssignments.reduce(
      (acc, assignment) => ({
        ...acc,
        total: acc.total + 1,
        assigned: acc.assigned + (assignment.status === "assigned" ? 1 : 0),
        in_progress: acc.in_progress + (assignment.status === "in_progress" ? 1 : 0),
        submitted: acc.submitted + (assignment.status === "submitted" ? 1 : 0),
        reviewed: acc.reviewed + (["reviewed", "approved", "needs_revision"].includes(assignment.status) ? 1 : 0),
      }),
      { total: 0, assigned: 0, in_progress: 0, submitted: 0, reviewed: 0 }
    );
  }, [myAssignments]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [studentData, assignmentData, caseData, correctionData] = await Promise.all([
        fetchStudents(),
        fetchCaseAssignments(),
        fetchCaseStudies(),
        fetchCorrections(),
      ]);
      setStudents(studentData);
      setAssignments(assignmentData);
      setCaseStudies(caseData);
      setCorrections(correctionData);
      setSelectedStudentId((current) => current || studentData[0]?.id || "");
    } catch (err) {
      setError(err.message || "Error cargando vista alumno");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStart = async (assignment) => {
    setError("");
    setMessage("");
    try {
      setSubmitting(true);
      await updateCaseAssignment(assignment.id, { status: "in_progress" });
      setMessage("Caso marcado como en curso");
      await loadData();
    } catch (err) {
      setError(err.message || "Error al actualizar el caso");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (assignment) => {
    setError("");
    setMessage("");
    try {
      setSubmitting(true);
      await updateCaseAssignment(assignment.id, { status: "submitted" });
      setMessage("Caso marcado como entregado");
      await loadData();
    } catch (err) {
      setError(err.message || "Error al entregar el caso");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={styles.loading}>Cargando vista alumno...</p>;

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <h2 style={styles.heroTitle}>Vista alumno demo</h2>
          <p style={styles.heroText}>Simulación del portal del alumno: casos asignados, instrucciones, entrega y feedback.</p>
        </div>
        <label style={styles.studentSelector}>
          Alumno demo
          <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} style={styles.input}>
            {students.map((student) => (
              <option key={student.id} value={student.id}>{student.full_name} · {student.group_display_name || student.group_name || "Sin grupo"}</option>
            ))}
          </select>
        </label>
      </section>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.summaryGrid}>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Mis casos</span><strong style={styles.summaryValue}>{counters.total}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Pendientes</span><strong style={styles.summaryValue}>{counters.assigned}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>En curso / entregados</span><strong style={styles.summaryValue}>{counters.in_progress + counters.submitted}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Corregidos</span><strong style={styles.summaryValue}>{counters.reviewed}</strong></div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Mis casos prácticos</h2>
        <div style={styles.assignmentList}>
          {myAssignments.length ? myAssignments.map((assignment) => {
            const caseStudy = caseById[assignment.case_study_id];
            const correction = correctionByAssignmentId[assignment.id];
            const expanded = Number(expandedId) === Number(assignment.id);
            const progress = getCaseProgress(caseStudy);

            return (
              <article key={assignment.id} style={styles.assignmentCard}>
                <div style={styles.assignmentHeader}>
                  <div>
                    <h3 style={styles.assignmentTitle}>{assignment.case_title || caseStudy?.title || "Caso sin título"}</h3>
                    <p style={styles.assignmentMeta}>Fecha límite: {formatDate(assignment.due_date)} · Estado: {assignmentStatusLabels[assignment.status] || assignment.status}</p>
                  </div>
                  <div style={styles.assignmentActions}>
                    <button type="button" style={styles.secondaryButton} onClick={() => setExpandedId(expanded ? null : assignment.id)}>{expanded ? "Ocultar" : "Ver instrucciones"}</button>
                    {assignment.status === "assigned" && <button type="button" style={styles.secondaryButton} disabled={submitting} onClick={() => handleStart(assignment)}>Empezar</button>}
                    {!["submitted", "reviewed", "approved"].includes(assignment.status) && <button type="button" style={styles.primaryButton} disabled={submitting} onClick={() => handleSubmit(assignment)}>Marcar entregado</button>}
                  </div>
                </div>

                <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: `${progress}%` }} /></div>

                {expanded && (
                  <div style={styles.instructions}>
                    <p style={styles.description}>{caseStudy?.description || "Sin instrucciones generales."}</p>
                    <h4 style={styles.sectionTitle}>Tareas del caso</h4>
                    <ol style={styles.taskList}>
                      {[...(caseStudy?.tasks || [])].sort((a, b) => a.task_order - b.task_order).map((task) => (
                        <li key={task.id} style={styles.taskItem}>
                          <strong>{task.title}</strong>
                          <span>{task.description || task.expected_result || "Sin detalle."}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div style={styles.feedbackBox}>
                  <strong>Feedback del profesor</strong>
                  {correction ? (
                    <>
                      <span>{correctionStatusLabels[correction.status] || correction.status} · Nota: {correction.grade ?? "Sin nota"}</span>
                      <p>{correction.teacher_feedback || "Todavía no hay comentario del profesor."}</p>
                    </>
                  ) : (
                    <p>Todavía no hay corrección registrada.</p>
                  )}
                </div>
              </article>
            );
          }) : <p style={styles.empty}>Este alumno no tiene casos asignados.</p>}
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
  studentSelector: { minWidth: "330px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 900 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" },
  summaryCard: { border: "2px solid #111111", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #e6d85c", padding: "14px" },
  summaryLabel: { display: "block", fontSize: "12px", fontWeight: 900, color: "#4b5563", textTransform: "uppercase" },
  summaryValue: { display: "block", marginTop: "4px", fontSize: "32px", fontWeight: 950, color: "#111111" },
  card: { backgroundColor: "#ffffff", border: "2px solid #111111", boxShadow: "4px 4px 0 #e6d85c", padding: "18px", boxSizing: "border-box" },
  cardTitle: { margin: "0 0 14px", fontSize: "22px", fontWeight: 900, color: "#111111" },
  assignmentList: { display: "flex", flexDirection: "column", gap: "14px" },
  assignmentCard: { border: "2px solid #111111", backgroundColor: "#f9fafb", padding: "14px" },
  assignmentHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" },
  assignmentTitle: { margin: 0, fontSize: "19px", fontWeight: 900 },
  assignmentMeta: { margin: "6px 0 0", color: "#4b5563", fontWeight: 700 },
  assignmentActions: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" },
  input: { border: "2px solid #111111", padding: "9px 10px", fontSize: "14px", backgroundColor: "#ffffff" },
  primaryButton: { border: "2px solid #111111", backgroundColor: "#111111", color: "#ffffff", padding: "8px 11px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "2px solid #111111", backgroundColor: "#f8f3b5", color: "#111111", padding: "8px 11px", fontWeight: 900, cursor: "pointer" },
  progressBar: { height: "8px", border: "1px solid #111111", backgroundColor: "#ffffff", marginTop: "12px" },
  progressFill: { height: "100%", backgroundColor: "#e6d85c" },
  instructions: { borderTop: "2px solid #111111", marginTop: "14px", paddingTop: "14px" },
  description: { margin: "0 0 12px", color: "#374151", fontWeight: 700, lineHeight: 1.45 },
  sectionTitle: { margin: "0 0 8px", fontSize: "16px", fontWeight: 900 },
  taskList: { margin: 0, paddingLeft: "22px" },
  taskItem: { marginBottom: "8px" },
  feedbackBox: { borderTop: "1px solid #d1d5db", marginTop: "14px", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "5px" },
  empty: { margin: 0, color: "#4b5563", fontWeight: 700 },
  success: { border: "2px solid #15803d", backgroundColor: "#dcfce7", color: "#14532d", padding: "10px 12px", fontWeight: 800 },
  error: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "10px 12px", fontWeight: 800 },
  loading: { fontWeight: 800 },
};
