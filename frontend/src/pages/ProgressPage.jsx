import { useEffect, useMemo, useState } from "react";

import { fetchCaseStudies, updateCaseTask } from "../services/caseStudyApi";
import { fetchCorrections } from "../services/correctionApi";
import { fetchStudents } from "../services/studentApi";
import { fetchStudentGroups } from "../services/studentGroupApi";

const taskStatusLabels = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completado",
};

const correctionStatusLabels = {
  pending_review: "Pendiente de corregir",
  reviewed: "Corregido",
  approved: "Aprobado",
  needs_revision: "Requiere revisión",
};

const difficultyLabels = {
  basic: "Básico",
  intermediate: "Medio",
  advanced: "Avanzado",
};

function getCaseProgress(caseStudy) {
  const tasks = caseStudy.tasks || [];
  if (!tasks.length) return { total: 0, completed: 0, inProgress: 0, pending: 0, percent: 0 };

  const completed = tasks.filter((task) => task.status === "completed").length;
  const inProgress = tasks.filter((task) => task.status === "in_progress").length;
  const pending = tasks.filter((task) => task.status === "pending").length;

  return {
    total: tasks.length,
    completed,
    inProgress,
    pending,
    percent: Math.round((completed / tasks.length) * 100),
  };
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export default function ProgressPage() {
  const [caseStudies, setCaseStudies] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedCase = useMemo(
    () => caseStudies.find((caseStudy) => Number(caseStudy.id) === Number(selectedCaseId)) || caseStudies[0],
    [caseStudies, selectedCaseId]
  );

  const selectedCaseProgress = useMemo(() => getCaseProgress(selectedCase || {}), [selectedCase]);

  const globalProgress = useMemo(() => {
    const allTasks = caseStudies.flatMap((caseStudy) => caseStudy.tasks || []);
    if (!allTasks.length) return { total: 0, completed: 0, percent: 0 };
    const completed = allTasks.filter((task) => task.status === "completed").length;
    return { total: allTasks.length, completed, percent: Math.round((completed / allTasks.length) * 100) };
  }, [caseStudies]);

  const correctionCounters = useMemo(() => {
    return corrections.reduce(
      (acc, correction) => ({
        ...acc,
        total: acc.total + 1,
        pending_review: acc.pending_review + (correction.status === "pending_review" ? 1 : 0),
        approved: acc.approved + (correction.status === "approved" ? 1 : 0),
        needs_revision: acc.needs_revision + (correction.status === "needs_revision" ? 1 : 0),
      }),
      { total: 0, pending_review: 0, approved: 0, needs_revision: 0 }
    );
  }, [corrections]);

  const filteredCases = useMemo(() => {
    const search = normalizeText(filters.search);
    return caseStudies.filter((caseStudy) => {
      const progress = getCaseProgress(caseStudy);
      const text = normalizeText(`${caseStudy.title} ${caseStudy.description} ${caseStudy.created_by}`);
      const progressStatus = progress.percent === 100 ? "completed" : progress.percent > 0 ? "in_progress" : "pending";
      return (!search || text.includes(search)) && (!filters.status || progressStatus === filters.status);
    });
  }, [caseStudies, filters]);

  const selectedCorrections = useMemo(() => {
    if (!selectedCase) return [];
    return corrections.filter((correction) => Number(correction.case_study_id) === Number(selectedCase.id));
  }, [corrections, selectedCase]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [caseData, correctionData, studentData, groupData] = await Promise.all([
        fetchCaseStudies(),
        fetchCorrections(),
        fetchStudents(),
        fetchStudentGroups(),
      ]);
      setCaseStudies(caseData);
      setCorrections(correctionData);
      setStudents(studentData);
      setGroups(groupData);
      if (!selectedCaseId && caseData.length > 0) setSelectedCaseId(caseData[0].id);
    } catch (err) {
      setError(err.message || "Error cargando progreso docente");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleTaskStatus = async (task, status) => {
    setError("");
    setMessage("");

    try {
      await updateCaseTask(task.id, { status });
      setMessage("Progreso actualizado");
      await loadData();
    } catch (err) {
      setError(err.message || "Error al actualizar progreso");
    }
  };

  if (loading) return <p style={styles.loading}>Cargando progreso...</p>;

  return (
    <div style={styles.page}>
      <section style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Progreso global</span>
          <strong style={styles.summaryValue}>{globalProgress.percent}%</strong>
          <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: `${globalProgress.percent}%` }} /></div>
          <span style={styles.summarySub}>{globalProgress.completed} de {globalProgress.total} tareas completadas</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Casos prácticos</span>
          <strong style={styles.summaryValue}>{caseStudies.length}</strong>
          <span style={styles.summarySub}>Plantillas docentes activas o en borrador</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Correcciones pendientes</span>
          <strong style={styles.summaryValue}>{correctionCounters.pending_review}</strong>
          <span style={styles.summarySub}>{correctionCounters.total} entregas registradas</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Alumnos / grupos</span>
          <strong style={styles.summaryValue}>{students.length}/{groups.length}</strong>
          <span style={styles.summarySub}>Alumnos y grupos docentes</span>
        </div>
      </section>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.contentGrid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Seguimiento de casos</h2>
          <div style={styles.filters}>
            <label style={styles.field}>Buscar<input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Caso, descripción o profesor" style={styles.input} /></label>
            <label style={styles.field}>Estado de avance<select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}><option value="">Todos</option><option value="pending">Sin empezar</option><option value="in_progress">En curso</option><option value="completed">Completado</option></select></label>
          </div>

          <div style={styles.caseList}>
            {filteredCases.map((caseStudy) => {
              const progress = getCaseProgress(caseStudy);
              const isSelected = Number(selectedCase?.id) === Number(caseStudy.id);

              return (
                <button key={caseStudy.id} type="button" onClick={() => setSelectedCaseId(caseStudy.id)} style={{ ...styles.caseButton, ...(isSelected ? styles.caseButtonActive : {}) }}>
                  <span style={styles.caseTitle}>{caseStudy.title}</span>
                  <span style={styles.caseMeta}>{difficultyLabels[caseStudy.difficulty]} · {progress.completed}/{progress.total} tareas · {progress.percent}%</span>
                  <div style={styles.miniProgress}><div style={{ ...styles.miniProgressFill, width: `${progress.percent}%` }} /></div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.card}>
          {selectedCase ? (
            <>
              <div style={styles.detailHeader}>
                <div>
                  <h2 style={styles.cardTitle}>{selectedCase.title}</h2>
                  <p style={styles.cardSubtitle}>{selectedCase.description || "Sin descripción."}</p>
                </div>
                <div style={styles.percentBox}>
                  <strong>{selectedCaseProgress.percent}%</strong>
                  <span>{selectedCaseProgress.completed} de {selectedCaseProgress.total}</span>
                </div>
              </div>

              <section style={styles.block}>
                <h3 style={styles.sectionTitle}>Tareas del caso</h3>
                <div style={styles.taskList}>
                  {[...(selectedCase.tasks || [])].sort((a, b) => a.task_order - b.task_order).map((task) => (
                    <article key={task.id} style={styles.taskItem}>
                      <div>
                        <strong>{task.task_order}. {task.title}</strong>
                        <p style={styles.taskDescription}>{task.expected_result || task.description || "Sin resultado esperado."}</p>
                      </div>
                      <select value={task.status} onChange={(event) => handleTaskStatus(task, event.target.value)} style={styles.smallSelect}>
                        {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </article>
                  ))}
                </div>
              </section>

              <section style={styles.block}>
                <h3 style={styles.sectionTitle}>Entregas y correcciones vinculadas</h3>
                {selectedCorrections.length > 0 ? (
                  <div style={styles.correctionList}>
                    {selectedCorrections.map((correction) => (
                      <article key={correction.id} style={styles.correctionItem}>
                        <div>
                          <strong>{correction.student_name}</strong>
                          <p style={styles.taskDescription}>{correction.student_group || "Sin grupo"} · {correctionStatusLabels[correction.status]}</p>
                          {correction.teacher_feedback && <p style={styles.feedback}>{correction.teacher_feedback}</p>}
                        </div>
                        <span style={styles.grade}>{correction.grade ?? "-"}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p style={styles.cardSubtitle}>Este caso todavía no tiene entregas registradas.</p>
                )}
              </section>
            </>
          ) : (
            <p style={styles.cardSubtitle}>No hay casos prácticos registrados.</p>
          )}
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "20px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" },
  summaryCard: { border: "2px solid #111111", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #e6d85c", padding: "14px", minHeight: "120px" },
  summaryLabel: { display: "block", fontSize: "12px", fontWeight: 900, color: "#4b5563", textTransform: "uppercase" },
  summaryValue: { display: "block", marginTop: "4px", fontSize: "32px", fontWeight: 950, color: "#111111" },
  summarySub: { display: "block", marginTop: "6px", color: "#4b5563", fontSize: "13px", fontWeight: 700 },
  contentGrid: { display: "grid", gridTemplateColumns: "380px 1fr", gap: "18px", alignItems: "start" },
  card: { backgroundColor: "#ffffff", border: "2px solid #111111", boxShadow: "4px 4px 0 #e6d85c", padding: "18px", boxSizing: "border-box" },
  cardTitle: { margin: "0 0 6px", fontSize: "22px", fontWeight: 900, color: "#111111" },
  cardSubtitle: { margin: "0 0 14px", color: "#4b5563", fontSize: "14px", lineHeight: 1.45 },
  filters: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 800, color: "#111111" },
  input: { border: "2px solid #111111", padding: "9px 10px", fontSize: "14px", backgroundColor: "#ffffff" },
  smallSelect: { border: "2px solid #111111", padding: "7px", fontWeight: 800, backgroundColor: "#ffffff" },
  caseList: { display: "flex", flexDirection: "column", gap: "8px" },
  caseButton: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: "6px", border: "2px solid #d1d5db", backgroundColor: "#ffffff", padding: "12px", cursor: "pointer", textAlign: "left" },
  caseButtonActive: { borderColor: "#111111", boxShadow: "3px 3px 0 #e6d85c" },
  caseTitle: { fontWeight: 900, color: "#111111" },
  caseMeta: { fontSize: "12px", color: "#4b5563", fontWeight: 800 },
  progressBar: { height: "12px", border: "2px solid #111111", backgroundColor: "#ffffff", marginTop: "8px" },
  progressFill: { height: "100%", backgroundColor: "#e6d85c" },
  miniProgress: { height: "8px", border: "1px solid #111111", backgroundColor: "#ffffff" },
  miniProgressFill: { height: "100%", backgroundColor: "#e6d85c" },
  detailHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", marginBottom: "18px" },
  percentBox: { border: "2px solid #111111", backgroundColor: "#f8f3b5", padding: "10px 14px", minWidth: "110px", textAlign: "center" },
  block: { borderTop: "2px solid #111111", paddingTop: "14px", marginTop: "14px" },
  sectionTitle: { margin: "0 0 12px", fontSize: "18px", fontWeight: 900 },
  taskList: { display: "flex", flexDirection: "column", gap: "10px" },
  taskItem: { display: "grid", gridTemplateColumns: "1fr 180px", gap: "12px", border: "1px solid #d1d5db", padding: "12px", backgroundColor: "#f9fafb", alignItems: "center" },
  taskDescription: { margin: "6px 0 0", color: "#374151", fontSize: "14px" },
  correctionList: { display: "flex", flexDirection: "column", gap: "10px" },
  correctionItem: { display: "grid", gridTemplateColumns: "1fr 70px", gap: "12px", border: "1px solid #d1d5db", padding: "12px", backgroundColor: "#f9fafb", alignItems: "center" },
  feedback: { margin: "8px 0 0", color: "#111111", fontSize: "13px", fontWeight: 700 },
  grade: { border: "2px solid #111111", padding: "8px", textAlign: "center", fontWeight: 900, backgroundColor: "#ffffff" },
  success: { border: "2px solid #15803d", backgroundColor: "#dcfce7", color: "#14532d", padding: "10px 12px", fontWeight: 800 },
  error: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "10px 12px", fontWeight: 800 },
  loading: { fontWeight: 800 },
};
