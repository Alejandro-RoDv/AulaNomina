import { useEffect, useMemo, useState } from "react";

import { fetchCaseAssignments } from "../services/caseAssignmentApi";
import { fetchCaseStudies } from "../services/caseStudyApi";
import { fetchCorrections } from "../services/correctionApi";
import { fetchDocuments } from "../services/documentApi";
import { fetchStudents } from "../services/studentApi";

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-ES");
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isOverdue(value) {
  const date = toDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
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

function goTo(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new Event("aulanomina-route-change"));
}

export default function TeachingAlertsPage() {
  const [assignments, setAssignments] = useState([]);
  const [caseStudies, setCaseStudies] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [students, setStudents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [assignmentData, caseData, correctionData, studentData, documentData] = await Promise.all([
        fetchCaseAssignments(),
        fetchCaseStudies(),
        fetchCorrections(),
        fetchStudents(),
        fetchDocuments(),
      ]);
      setAssignments(assignmentData);
      setCaseStudies(caseData);
      setCorrections(correctionData);
      setStudents(studentData);
      setDocuments(documentData);
    } catch (err) {
      setError(err.message || "Error cargando alertas docentes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const alerts = useMemo(() => {
    const rows = [];

    assignments.forEach((assignment) => {
      if (["assigned", "in_progress"].includes(assignment.status)) {
        rows.push({
          id: `pending-${assignment.id}`,
          type: "pending_delivery",
          severity: "medium",
          title: "Caso pendiente de entregar",
          description: `${assignment.case_title || "Caso sin título"} · ${assignment.assignee_name || "Sin destinatario"}`,
          detail: `Estado actual: ${assignment.status}. Fecha límite: ${formatDate(assignment.due_date)}.`,
          action: "assignments",
        });
      }

      if (assignment.due_date && isOverdue(assignment.due_date) && !["submitted", "reviewed", "approved"].includes(assignment.status)) {
        rows.push({
          id: `overdue-${assignment.id}`,
          type: "overdue",
          severity: "high",
          title: "Entrega fuera de plazo",
          description: `${assignment.case_title || "Caso sin título"} · ${assignment.assignee_name || "Sin destinatario"}`,
          detail: `Vencía el ${formatDate(assignment.due_date)}.`,
          action: "assignments",
        });
      }

      if (assignment.due_date && isDueSoon(assignment.due_date) && ["assigned", "in_progress"].includes(assignment.status)) {
        rows.push({
          id: `due-soon-${assignment.id}`,
          type: "due_soon",
          severity: "low",
          title: "Entrega próxima",
          description: `${assignment.case_title || "Caso sin título"} · ${assignment.assignee_name || "Sin destinatario"}`,
          detail: `Vence el ${formatDate(assignment.due_date)}.`,
          action: "assignments",
        });
      }
    });

    corrections.forEach((correction) => {
      if (correction.status === "pending_review") {
        rows.push({
          id: `correction-${correction.id}`,
          type: "pending_correction",
          severity: "medium",
          title: "Corrección pendiente",
          description: `${correction.case_title || "Caso sin título"} · ${correction.assignee_name || correction.student_name || "Sin destinatario"}`,
          detail: "Entrega registrada pendiente de feedback o nota.",
          action: "corrections",
        });
      }
    });

    caseStudies.forEach((caseStudy) => {
      if (!caseStudy.tasks || caseStudy.tasks.length === 0) {
        rows.push({
          id: `empty-case-${caseStudy.id}`,
          type: "case_without_tasks",
          severity: "low",
          title: "Caso sin tareas",
          description: caseStudy.title,
          detail: "El caso tiene enunciado, pero no tiene pasos prácticos definidos.",
          action: "case-studies",
        });
      }
    });

    students.forEach((student) => {
      if (!student.group_id) {
        rows.push({
          id: `student-no-group-${student.id}`,
          type: "student_without_group",
          severity: "low",
          title: "Alumno sin grupo",
          description: student.full_name,
          detail: "El alumno no está asignado a ningún grupo docente.",
          action: "students",
        });
      }
    });

    documents.forEach((document) => {
      if (["pending", "expired"].includes(document.status)) {
        rows.push({
          id: `document-${document.id}`,
          type: "pending_document",
          severity: document.status === "expired" ? "high" : "medium",
          title: "Documento pendiente dentro de un caso",
          description: `${document.document_name || document.document_type || "Documento"} · Trabajador ${document.employee_id}`,
          detail: `Estado documental: ${document.status}. Puede afectar a ejercicios de expediente documental o alta completa.`,
          action: "progress",
        });
      }
    });

    return rows;
  }, [assignments, caseStudies, corrections, students, documents]);

  const counters = useMemo(() => {
    return alerts.reduce(
      (acc, alert) => ({
        ...acc,
        total: acc.total + 1,
        high: acc.high + (alert.severity === "high" ? 1 : 0),
        medium: acc.medium + (alert.severity === "medium" ? 1 : 0),
        low: acc.low + (alert.severity === "low" ? 1 : 0),
      }),
      { total: 0, high: 0, medium: 0, low: 0 }
    );
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    if (filter === "all") return alerts;
    return alerts.filter((alert) => alert.type === filter || alert.severity === filter);
  }, [alerts, filter]);

  if (loading) return <p style={styles.loading}>Cargando alertas...</p>;

  return (
    <div style={styles.page}>
      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.summaryGrid}>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Alertas</span><strong style={styles.summaryValue}>{counters.total}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Críticas</span><strong style={styles.summaryValue}>{counters.high}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Medias</span><strong style={styles.summaryValue}>{counters.medium}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Bajas</span><strong style={styles.summaryValue}>{counters.low}</strong></div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>Vencimientos y alertas</h2>
            <p style={styles.cardSubtitle}>Avisos docentes derivados de casos, asignaciones, correcciones, alumnos y documentación.</p>
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} style={styles.input}>
            <option value="all">Todas</option>
            <option value="high">Críticas</option>
            <option value="medium">Medias</option>
            <option value="low">Bajas</option>
            <option value="pending_delivery">Caso pendiente</option>
            <option value="overdue">Fuera de plazo</option>
            <option value="pending_correction">Corrección pendiente</option>
            <option value="case_without_tasks">Caso sin tareas</option>
            <option value="student_without_group">Alumno sin grupo</option>
            <option value="pending_document">Documento pendiente</option>
          </select>
        </div>

        <div style={styles.alertList}>
          {filteredAlerts.length ? filteredAlerts.map((alert) => (
            <article key={alert.id} style={{ ...styles.alertItem, ...styles[`${alert.severity}Alert`] }}>
              <div>
                <strong style={styles.alertTitle}>{alert.title}</strong>
                <p style={styles.alertDescription}>{alert.description}</p>
                <p style={styles.alertDetail}>{alert.detail}</p>
              </div>
              <button type="button" style={styles.secondaryButton} onClick={() => goTo(alert.action)}>Ir</button>
            </article>
          )) : <p style={styles.empty}>No hay alertas para este filtro.</p>}
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "20px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" },
  summaryCard: { border: "2px solid #111111", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #e6d85c", padding: "14px" },
  summaryLabel: { display: "block", fontSize: "12px", fontWeight: 900, color: "#4b5563", textTransform: "uppercase" },
  summaryValue: { display: "block", marginTop: "4px", fontSize: "32px", fontWeight: 950, color: "#111111" },
  card: { backgroundColor: "#ffffff", border: "2px solid #111111", boxShadow: "4px 4px 0 #e6d85c", padding: "18px", boxSizing: "border-box" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", marginBottom: "14px" },
  cardTitle: { margin: "0 0 6px", fontSize: "22px", fontWeight: 900, color: "#111111" },
  cardSubtitle: { margin: 0, color: "#4b5563", fontSize: "14px", fontWeight: 700 },
  input: { border: "2px solid #111111", padding: "9px 10px", fontSize: "14px", backgroundColor: "#ffffff", fontWeight: 800 },
  alertList: { display: "flex", flexDirection: "column", gap: "10px" },
  alertItem: { border: "2px solid #111111", padding: "14px", display: "grid", gridTemplateColumns: "1fr 90px", gap: "12px", alignItems: "center" },
  highAlert: { backgroundColor: "#fee2e2" },
  mediumAlert: { backgroundColor: "#fef3c7" },
  lowAlert: { backgroundColor: "#f9fafb" },
  alertTitle: { fontSize: "16px", fontWeight: 900 },
  alertDescription: { margin: "6px 0 0", color: "#111111", fontWeight: 800 },
  alertDetail: { margin: "5px 0 0", color: "#4b5563", fontSize: "13px", fontWeight: 700 },
  secondaryButton: { border: "2px solid #111111", backgroundColor: "#ffffff", color: "#111111", padding: "8px 11px", fontWeight: 900, cursor: "pointer" },
  empty: { margin: 0, color: "#4b5563", fontWeight: 700 },
  error: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "10px 12px", fontWeight: 800 },
  loading: { fontWeight: 800 },
};
