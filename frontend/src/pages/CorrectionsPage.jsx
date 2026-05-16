import { useEffect, useMemo, useState } from "react";

import { fetchCaseAssignments } from "../services/caseAssignmentApi";
import {
  createCorrection,
  deleteCorrection,
  fetchCorrections,
  seedDemoCorrections,
  updateCorrection,
} from "../services/correctionApi";

const initialForm = {
  assignment_id: "",
  status: "pending_review",
  grade: "",
  teacher_feedback: "",
  reviewed_by: "Profesor demo",
};

const statusLabels = {
  pending_review: "Pendiente de corregir",
  reviewed: "Corregido",
  approved: "Aprobado",
  needs_revision: "Requiere revisión",
};

const assignmentStatusLabels = {
  assigned: "Asignado",
  in_progress: "En curso",
  submitted: "Entregado",
  reviewed: "Corregido",
  approved: "Aprobado",
  needs_revision: "Requiere revisión",
};

function buildPayload(form) {
  return {
    assignment_id: Number(form.assignment_id),
    status: form.status,
    grade: form.grade === "" ? null : Number(form.grade),
    teacher_feedback: form.teacher_feedback || null,
    reviewed_by: form.reviewed_by || null,
  };
}

function getCorrectionAssignee(correction) {
  return correction.assignee_name || correction.student_name || "Sin destinatario";
}

export default function CorrectionsPage() {
  const [corrections, setCorrections] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [reviewForm, setReviewForm] = useState({ status: "reviewed", grade: "", teacher_feedback: "", reviewed_by: "Profesor demo" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCorrection = useMemo(
    () => corrections.find((correction) => Number(correction.id) === Number(selectedId)) || corrections[0],
    [corrections, selectedId]
  );

  const availableAssignments = useMemo(() => {
    const usedAssignmentIds = new Set(corrections.map((correction) => correction.assignment_id).filter(Boolean));
    return assignments.filter((assignment) => !usedAssignmentIds.has(assignment.id));
  }, [assignments, corrections]);

  const counters = useMemo(() => {
    return corrections.reduce(
      (acc, correction) => ({ ...acc, [correction.status]: (acc[correction.status] || 0) + 1, total: acc.total + 1 }),
      { total: 0, pending_review: 0, reviewed: 0, approved: 0, needs_revision: 0 }
    );
  }, [corrections]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [correctionsData, assignmentsData] = await Promise.all([fetchCorrections(), fetchCaseAssignments()]);
      setCorrections(correctionsData);
      setAssignments(assignmentsData);

      if (!selectedId && correctionsData.length > 0) setSelectedId(correctionsData[0].id);
      if (!form.assignment_id && assignmentsData.length > 0) {
        const firstAvailable = assignmentsData.find((assignment) => !correctionsData.some((correction) => correction.assignment_id === assignment.id));
        setForm((prev) => ({ ...prev, assignment_id: String(firstAvailable?.id || assignmentsData[0].id) }));
      }
    } catch (err) {
      setError(err.message || "Error cargando correcciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedCorrection) return;

    setReviewForm({
      status: selectedCorrection.status || "reviewed",
      grade: selectedCorrection.grade ?? "",
      teacher_feedback: selectedCorrection.teacher_feedback || "",
      reviewed_by: selectedCorrection.reviewed_by || "Profesor demo",
    });
  }, [selectedCorrection?.id]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleReviewChange = (event) => {
    const { name, value } = event.target;
    setReviewForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      const created = await createCorrection(buildPayload(form));
      setMessage("Entrega registrada correctamente desde asignación");
      setSelectedId(created.id);
      setForm({ ...initialForm, assignment_id: "" });
      await loadData();
    } catch (err) {
      setError(err.message || "Error al registrar entrega");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeedDemo = async () => {
    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      const result = await seedDemoCorrections();
      setMessage(result.message || "Correcciones demo cargadas");
      await loadData();
    } catch (err) {
      setError(err.message || "Error al cargar correcciones demo");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (event) => {
    event.preventDefault();
    if (!selectedCorrection) return;

    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      await updateCorrection(selectedCorrection.id, {
        status: reviewForm.status,
        grade: reviewForm.grade === "" ? null : Number(reviewForm.grade),
        teacher_feedback: reviewForm.teacher_feedback || null,
        reviewed_by: reviewForm.reviewed_by || null,
      });
      setMessage("Corrección actualizada correctamente");
      await loadData();
    } catch (err) {
      setError(err.message || "Error al actualizar corrección");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (correctionId) => {
    if (!window.confirm("¿Eliminar esta entrega/corrección?")) return;

    setError("");
    setMessage("");

    try {
      await deleteCorrection(correctionId);
      setMessage("Corrección eliminada");
      setSelectedId(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Error al eliminar corrección");
    }
  };

  if (loading) return <p style={styles.loading}>Cargando correcciones...</p>;

  return (
    <div style={styles.page}>
      <section style={styles.summaryGrid}>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Total entregas</span><strong style={styles.summaryValue}>{counters.total}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Pendientes</span><strong style={styles.summaryValue}>{counters.pending_review}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Requieren revisión</span><strong style={styles.summaryValue}>{counters.needs_revision}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Aprobadas</span><strong style={styles.summaryValue}>{counters.approved}</strong></div>
      </section>

      <section style={styles.topGrid}>
        <form style={styles.card} onSubmit={handleCreate}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Registrar entrega</h2>
              <p style={styles.cardSubtitle}>La entrega se registra desde una asignación previa de caso práctico.</p>
            </div>
            <button type="button" style={styles.secondaryButton} onClick={handleSeedDemo} disabled={submitting}>Cargar demo</button>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.fieldWide}>
              Asignación
              <select name="assignment_id" value={form.assignment_id} onChange={handleChange} required style={styles.input}>
                <option value="">Selecciona una asignación</option>
                {availableAssignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.case_title} · {assignment.assignee_name} · {assignmentStatusLabels[assignment.status] || assignment.status}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.field}>
              Estado inicial
              <select name="status" value={form.status} onChange={handleChange} style={styles.input}>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label style={styles.field}>
              Nota inicial
              <input type="number" min="0" max="10" step="0.1" name="grade" value={form.grade} onChange={handleChange} style={styles.input} />
            </label>
          </div>
          <label style={styles.field}>Feedback inicial<textarea name="teacher_feedback" value={form.teacher_feedback} onChange={handleChange} rows={3} style={styles.textarea} /></label>
          <button type="submit" style={styles.primaryButton} disabled={submitting || !form.assignment_id}>Registrar entrega</button>
        </form>

        <form style={styles.card} onSubmit={handleReview}>
          <h2 style={styles.cardTitle}>Corregir entrega</h2>
          {selectedCorrection ? (
            <>
              <p style={styles.cardSubtitle}>{getCorrectionAssignee(selectedCorrection)} · {selectedCorrection.case_title || "Caso sin título"}</p>
              <div style={styles.formGrid}>
                <label style={styles.field}>Estado<select name="status" value={reviewForm.status} onChange={handleReviewChange} style={styles.input}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label style={styles.field}>Nota<input type="number" min="0" max="10" step="0.1" name="grade" value={reviewForm.grade} onChange={handleReviewChange} style={styles.input} /></label>
              </div>
              <label style={styles.field}>Profesor<input name="reviewed_by" value={reviewForm.reviewed_by} onChange={handleReviewChange} style={styles.input} /></label>
              <label style={styles.field}>Feedback<textarea name="teacher_feedback" value={reviewForm.teacher_feedback} onChange={handleReviewChange} rows={4} style={styles.textarea} /></label>
              <button type="submit" style={styles.primaryButton} disabled={submitting}>Guardar corrección</button>
            </>
          ) : (
            <p style={styles.cardSubtitle}>No hay entregas pendientes.</p>
          )}
        </form>
      </section>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Bandeja de correcciones</h2>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Destinatario</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Caso</th>
                <th style={styles.th}>Estado corrección</th>
                <th style={styles.th}>Estado asignación</th>
                <th style={styles.th}>Nota</th>
                <th style={styles.th}>Feedback</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {corrections.map((correction) => {
                const isSelected = Number(selectedCorrection?.id) === Number(correction.id);
                return (
                  <tr key={correction.id} style={isSelected ? styles.selectedRow : undefined}>
                    <td style={styles.td}><strong>{getCorrectionAssignee(correction)}</strong></td>
                    <td style={styles.td}>{correction.assignee_type === "group" ? "Grupo" : correction.assignee_type === "student" ? "Alumno" : "Heredado"}</td>
                    <td style={styles.td}>{correction.case_title || "-"}</td>
                    <td style={styles.td}>{statusLabels[correction.status]}</td>
                    <td style={styles.td}>{assignmentStatusLabels[correction.assignment_status] || "-"}</td>
                    <td style={styles.td}>{correction.grade ?? "-"}</td>
                    <td style={styles.td}>{correction.teacher_feedback || "Sin feedback"}</td>
                    <td style={styles.tdActions}>
                      <button type="button" style={styles.smallButton} onClick={() => setSelectedId(correction.id)}>Corregir</button>
                      <button type="button" style={styles.linkButton} onClick={() => handleDelete(correction.id)}>Eliminar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
  topGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", alignItems: "start" },
  card: { backgroundColor: "#ffffff", border: "2px solid #111111", boxShadow: "4px 4px 0 #e6d85c", padding: "18px", boxSizing: "border-box" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" },
  cardTitle: { margin: "0 0 6px", fontSize: "22px", fontWeight: 900, color: "#111111" },
  cardSubtitle: { margin: "0 0 14px", color: "#4b5563", fontSize: "14px", lineHeight: 1.45 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 800, color: "#111111", marginBottom: "12px" },
  fieldWide: { gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 800, color: "#111111", marginBottom: "12px" },
  input: { border: "2px solid #111111", padding: "9px 10px", fontSize: "14px", backgroundColor: "#ffffff" },
  textarea: { border: "2px solid #111111", padding: "9px 10px", fontSize: "14px", backgroundColor: "#ffffff", resize: "vertical" },
  primaryButton: { border: "2px solid #111111", backgroundColor: "#111111", color: "#ffffff", padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "2px solid #111111", backgroundColor: "#f8f3b5", color: "#111111", padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  smallButton: { border: "2px solid #111111", backgroundColor: "#ffffff", color: "#111111", padding: "6px 8px", fontWeight: 900, cursor: "pointer" },
  linkButton: { border: "none", backgroundColor: "transparent", color: "#991b1b", fontWeight: 900, cursor: "pointer" },
  success: { border: "2px solid #15803d", backgroundColor: "#dcfce7", color: "#14532d", padding: "10px 12px", fontWeight: 800 },
  error: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "10px 12px", fontWeight: 800 },
  loading: { fontWeight: 800 },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "14px" },
  th: { borderBottom: "2px solid #111111", textAlign: "left", padding: "10px", fontWeight: 900, color: "#111111" },
  td: { borderBottom: "1px solid #d1d5db", padding: "10px", verticalAlign: "top" },
  tdActions: { borderBottom: "1px solid #d1d5db", padding: "10px", verticalAlign: "top", display: "flex", gap: "8px" },
  selectedRow: { backgroundColor: "#f8f3b5" },
};
