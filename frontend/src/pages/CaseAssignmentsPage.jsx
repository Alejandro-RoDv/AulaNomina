import { useEffect, useMemo, useState } from "react";

import { fetchCaseStudies } from "../services/caseStudyApi";
import {
  createCaseAssignment,
  deleteCaseAssignment,
  fetchCaseAssignments,
  seedDemoCaseAssignments,
  updateCaseAssignment,
} from "../services/caseAssignmentApi";
import { fetchStudents } from "../services/studentApi";
import { fetchStudentGroups } from "../services/studentGroupApi";

const initialForm = {
  case_study_id: "",
  assignee_type: "group",
  student_id: "",
  group_id: "",
  assigned_by: "Profesor demo",
  due_date: "",
  status: "assigned",
  notes: "",
};

const statusLabels = {
  assigned: "Asignado",
  in_progress: "En curso",
  submitted: "Entregado",
  reviewed: "Corregido",
  approved: "Aprobado",
  needs_revision: "Requiere revisión",
};

const assigneeTypeLabels = {
  student: "Alumno",
  group: "Grupo",
};

function toApiDate(value) {
  if (!value) return null;
  return `${value}T23:59:00`;
}

function toInputDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function buildPayload(form) {
  return {
    case_study_id: Number(form.case_study_id),
    student_id: form.assignee_type === "student" && form.student_id ? Number(form.student_id) : null,
    group_id: form.assignee_type === "group" && form.group_id ? Number(form.group_id) : null,
    assigned_by: form.assigned_by || null,
    due_date: toApiDate(form.due_date),
    status: form.status,
    notes: form.notes || null,
  };
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export default function CaseAssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [caseStudies, setCaseStudies] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "", assignee_type: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const counters = useMemo(() => {
    return assignments.reduce(
      (acc, assignment) => ({
        ...acc,
        total: acc.total + 1,
        assigned: acc.assigned + (assignment.status === "assigned" ? 1 : 0),
        in_progress: acc.in_progress + (assignment.status === "in_progress" ? 1 : 0),
        submitted: acc.submitted + (assignment.status === "submitted" ? 1 : 0),
        approved: acc.approved + (assignment.status === "approved" ? 1 : 0),
      }),
      { total: 0, assigned: 0, in_progress: 0, submitted: 0, approved: 0 }
    );
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    const search = normalizeText(filters.search);
    return assignments.filter((assignment) => {
      const fullText = normalizeText(`${assignment.case_title} ${assignment.assignee_name} ${assignment.assigned_by} ${assignment.notes}`);
      return (
        (!search || fullText.includes(search)) &&
        (!filters.status || assignment.status === filters.status) &&
        (!filters.assignee_type || assignment.assignee_type === filters.assignee_type)
      );
    });
  }, [assignments, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [assignmentsData, casesData, studentsData, groupsData] = await Promise.all([
        fetchCaseAssignments(),
        fetchCaseStudies(),
        fetchStudents(),
        fetchStudentGroups(),
      ]);
      setAssignments(assignmentsData);
      setCaseStudies(casesData);
      setStudents(studentsData);
      setGroups(groupsData);

      setForm((prev) => ({
        ...prev,
        case_study_id: prev.case_study_id || casesData[0]?.id || "",
        group_id: prev.group_id || groupsData[0]?.id || "",
        student_id: prev.student_id || studentsData[0]?.id || "",
      }));
    } catch (err) {
      setError(err.message || "Error cargando asignaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "assignee_type") {
      setForm((prev) => ({ ...prev, assignee_type: value }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      ...initialForm,
      case_study_id: caseStudies[0]?.id || "",
      group_id: groups[0]?.id || "",
      student_id: students[0]?.id || "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      if (editingId) {
        await updateCaseAssignment(editingId, buildPayload(form));
        setMessage("Asignación actualizada correctamente");
      } else {
        await createCaseAssignment(buildPayload(form));
        setMessage("Caso asignado correctamente");
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(err.message || "Error guardando asignación");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (assignment) => {
    setEditingId(assignment.id);
    setForm({
      case_study_id: assignment.case_study_id || "",
      assignee_type: assignment.assignee_type || "group",
      student_id: assignment.student_id || "",
      group_id: assignment.group_id || "",
      assigned_by: assignment.assigned_by || "Profesor demo",
      due_date: toInputDate(assignment.due_date),
      status: assignment.status || "assigned",
      notes: assignment.notes || "",
    });
  };

  const handleDelete = async (assignmentId) => {
    if (!window.confirm("¿Eliminar esta asignación?")) return;
    setError("");
    setMessage("");

    try {
      await deleteCaseAssignment(assignmentId);
      setMessage("Asignación eliminada");
      await loadData();
    } catch (err) {
      setError(err.message || "Error al eliminar asignación");
    }
  };

  const handleSeedDemo = async () => {
    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      const result = await seedDemoCaseAssignments();
      setMessage(result.message || "Asignaciones demo cargadas");
      await loadData();
    } catch (err) {
      setError(err.message || "Error al cargar demo");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={styles.loading}>Cargando asignaciones...</p>;

  return (
    <div style={styles.page}>
      <section style={styles.summaryGrid}>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Total</span><strong style={styles.summaryValue}>{counters.total}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Asignadas</span><strong style={styles.summaryValue}>{counters.assigned}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>En curso</span><strong style={styles.summaryValue}>{counters.in_progress}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Entregadas</span><strong style={styles.summaryValue}>{counters.submitted}</strong></div>
      </section>

      <section style={styles.topGrid}>
        <form style={styles.card} onSubmit={handleSubmit}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>{editingId ? "Editar asignación" : "Asignar caso"}</h2>
              <p style={styles.cardSubtitle}>Asigna un caso práctico a un grupo completo o a un alumno concreto.</p>
            </div>
            <button type="button" style={styles.secondaryButton} onClick={handleSeedDemo} disabled={submitting}>Cargar demo</button>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.field}>Caso práctico<select name="case_study_id" value={form.case_study_id} onChange={handleChange} required style={styles.input}>{caseStudies.map((caseStudy) => <option key={caseStudy.id} value={caseStudy.id}>{caseStudy.title}</option>)}</select></label>
            <label style={styles.field}>Asignar a<select name="assignee_type" value={form.assignee_type} onChange={handleChange} style={styles.input}><option value="group">Grupo</option><option value="student">Alumno</option></select></label>
            {form.assignee_type === "group" ? (
              <label style={styles.field}>Grupo<select name="group_id" value={form.group_id} onChange={handleChange} required style={styles.input}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            ) : (
              <label style={styles.field}>Alumno<select name="student_id" value={form.student_id} onChange={handleChange} required style={styles.input}>{students.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select></label>
            )}
            <label style={styles.field}>Estado<select name="status" value={form.status} onChange={handleChange} style={styles.input}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={styles.field}>Fecha límite<input type="date" name="due_date" value={form.due_date} onChange={handleChange} style={styles.input} /></label>
            <label style={styles.field}>Asignado por<input name="assigned_by" value={form.assigned_by} onChange={handleChange} style={styles.input} /></label>
          </div>

          <label style={styles.field}>Notas<textarea name="notes" value={form.notes} onChange={handleChange} rows={3} style={styles.textarea} /></label>

          <div style={styles.actions}>
            <button type="submit" style={styles.primaryButton} disabled={submitting || !caseStudies.length || (!groups.length && form.assignee_type === "group") || (!students.length && form.assignee_type === "student")}>{editingId ? "Guardar cambios" : "Asignar caso"}</button>
            {editingId && <button type="button" style={styles.secondaryButton} onClick={resetForm}>Cancelar</button>}
          </div>
        </form>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Filtros</h2>
          <label style={styles.field}>Buscar<input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Caso, alumno, grupo o profesor" style={styles.input} /></label>
          <label style={styles.field}>Estado<select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}><option value="">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label style={styles.field}>Tipo destinatario<select name="assignee_type" value={filters.assignee_type} onChange={handleFilterChange} style={styles.input}><option value="">Todos</option><option value="group">Grupo</option><option value="student">Alumno</option></select></label>
        </div>
      </section>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Listado de asignaciones</h2>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Caso</th><th style={styles.th}>Destinatario</th><th style={styles.th}>Tipo</th><th style={styles.th}>Estado</th><th style={styles.th}>Fecha límite</th><th style={styles.th}>Asignado por</th><th style={styles.th}>Acciones</th></tr></thead>
            <tbody>
              {filteredAssignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td style={styles.td}><strong>{assignment.case_title || "-"}</strong></td>
                  <td style={styles.td}>{assignment.assignee_name || "-"}</td>
                  <td style={styles.td}>{assigneeTypeLabels[assignment.assignee_type] || "-"}</td>
                  <td style={styles.td}>{statusLabels[assignment.status] || assignment.status}</td>
                  <td style={styles.td}>{assignment.due_date ? toInputDate(assignment.due_date) : "Sin fecha"}</td>
                  <td style={styles.td}>{assignment.assigned_by || "-"}</td>
                  <td style={styles.tdActions}><button type="button" style={styles.smallButton} onClick={() => handleEdit(assignment)}>Editar</button><button type="button" style={styles.linkButton} onClick={() => handleDelete(assignment.id)}>Eliminar</button></td>
                </tr>
              ))}
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
  topGrid: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "18px", alignItems: "start" },
  card: { backgroundColor: "#ffffff", border: "2px solid #111111", boxShadow: "4px 4px 0 #e6d85c", padding: "18px", boxSizing: "border-box" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" },
  cardTitle: { margin: "0 0 6px", fontSize: "22px", fontWeight: 900, color: "#111111" },
  cardSubtitle: { margin: "0 0 14px", color: "#4b5563", fontSize: "14px", lineHeight: 1.45 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 800, color: "#111111", marginBottom: "12px" },
  input: { border: "2px solid #111111", padding: "9px 10px", fontSize: "14px", backgroundColor: "#ffffff" },
  textarea: { border: "2px solid #111111", padding: "9px 10px", fontSize: "14px", backgroundColor: "#ffffff", resize: "vertical" },
  actions: { display: "flex", gap: "10px" },
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
};
