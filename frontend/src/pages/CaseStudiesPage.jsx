import { useEffect, useMemo, useState } from "react";

import {
  createCaseStudy,
  createCaseTask,
  deleteCaseStudy,
  deleteCaseTask,
  fetchCaseStudies,
  seedDemoCaseStudies,
  updateCaseStudy,
  updateCaseTask,
} from "../services/caseStudyApi";

const initialCaseForm = {
  title: "",
  description: "",
  difficulty: "basic",
  status: "draft",
  created_by: "Profesor demo",
};

const initialTaskForm = {
  title: "",
  description: "",
  module: "employees",
  expected_result: "",
  task_order: 1,
  is_required: true,
  status: "pending",
};

const difficultyLabels = {
  basic: "Básico",
  intermediate: "Medio",
  advanced: "Avanzado",
};

const caseStatusLabels = {
  draft: "Borrador",
  active: "Activo",
  archived: "Archivado",
};

const taskStatusLabels = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completado",
};

const moduleLabels = {
  employees: "Trabajadores",
  contracts: "Contratos",
  documents: "Documentos",
  incidents: "Incidencias",
  payrolls: "Nóminas",
  companies: "Empresas / centros",
  general: "General",
};

function buildCasePayload(form) {
  return {
    title: form.title,
    description: form.description || null,
    difficulty: form.difficulty,
    status: form.status,
    created_by: form.created_by || null,
    tasks: [],
  };
}

function buildTaskPayload(form) {
  return {
    title: form.title,
    description: form.description || null,
    module: form.module,
    expected_result: form.expected_result || null,
    task_order: Number(form.task_order || 1),
    is_required: Boolean(form.is_required),
    status: form.status,
  };
}

export default function CaseStudiesPage() {
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [caseForm, setCaseForm] = useState(initialCaseForm);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCase = useMemo(
    () => cases.find((caseStudy) => Number(caseStudy.id) === Number(selectedCaseId)) || cases[0],
    [cases, selectedCaseId]
  );

  const progress = useMemo(() => {
    if (!selectedCase?.tasks?.length) return 0;
    const completed = selectedCase.tasks.filter((task) => task.status === "completed").length;
    return Math.round((completed / selectedCase.tasks.length) * 100);
  }, [selectedCase]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const data = await fetchCaseStudies();
      setCases(data);
      if (!selectedCaseId && data.length > 0) setSelectedCaseId(data[0].id);
    } catch (err) {
      setError(err.message || "Error cargando casos prácticos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const handleCaseChange = (event) => {
    const { name, value } = event.target;
    setCaseForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTaskChange = (event) => {
    const { name, value, type, checked } = event.target;
    setTaskForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleCreateCase = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      const created = await createCaseStudy(buildCasePayload(caseForm));
      setMessage("Caso práctico creado correctamente");
      setCaseForm(initialCaseForm);
      await loadCases();
      setSelectedCaseId(created.id);
    } catch (err) {
      setError(err.message || "Error al crear caso práctico");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeedDemo = async () => {
    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      const result = await seedDemoCaseStudies();
      setMessage(result.message || "Casos demo cargados");
      await loadCases();
    } catch (err) {
      setError(err.message || "Error al cargar casos demo");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();
    if (!selectedCase) return;

    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      await createCaseTask(selectedCase.id, buildTaskPayload(taskForm));
      setMessage("Tarea creada correctamente");
      setTaskForm({ ...initialTaskForm, task_order: (selectedCase.tasks?.length || 0) + 2 });
      await loadCases();
    } catch (err) {
      setError(err.message || "Error al crear tarea");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaskStatus = async (task, status) => {
    setError("");
    setMessage("");

    try {
      await updateCaseTask(task.id, { status });
      await loadCases();
    } catch (err) {
      setError(err.message || "Error al actualizar tarea");
    }
  };

  const handleCaseStatus = async (caseStudy, status) => {
    setError("");
    setMessage("");

    try {
      await updateCaseStudy(caseStudy.id, { status });
      await loadCases();
    } catch (err) {
      setError(err.message || "Error al actualizar caso");
    }
  };

  const handleDeleteCase = async (caseStudyId) => {
    if (!window.confirm("¿Eliminar este caso práctico y sus tareas?")) return;

    setError("");
    setMessage("");

    try {
      await deleteCaseStudy(caseStudyId);
      setMessage("Caso práctico eliminado");
      setSelectedCaseId(null);
      await loadCases();
    } catch (err) {
      setError(err.message || "Error al eliminar caso práctico");
    }
  };

  const handleDeleteTask = async (taskId) => {
    setError("");
    setMessage("");

    try {
      await deleteCaseTask(taskId);
      setMessage("Tarea eliminada");
      await loadCases();
    } catch (err) {
      setError(err.message || "Error al eliminar tarea");
    }
  };

  if (loading) return <p style={styles.loading}>Cargando casos prácticos...</p>;

  return (
    <div style={styles.page}>
      <section style={styles.topGrid}>
        <form style={styles.card} onSubmit={handleCreateCase}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Crear caso práctico</h2>
              <p style={styles.cardSubtitle}>Ejercicio docente manual para el profesor.</p>
            </div>
            <button type="button" style={styles.secondaryButton} onClick={handleSeedDemo} disabled={submitting}>
              Cargar demo
            </button>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.field}>
              Título
              <input name="title" value={caseForm.title} onChange={handleCaseChange} required style={styles.input} />
            </label>
            <label style={styles.field}>
              Dificultad
              <select name="difficulty" value={caseForm.difficulty} onChange={handleCaseChange} style={styles.input}>
                <option value="basic">Básico</option>
                <option value="intermediate">Medio</option>
                <option value="advanced">Avanzado</option>
              </select>
            </label>
            <label style={styles.field}>
              Estado
              <select name="status" value={caseForm.status} onChange={handleCaseChange} style={styles.input}>
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </select>
            </label>
            <label style={styles.field}>
              Creado por
              <input name="created_by" value={caseForm.created_by} onChange={handleCaseChange} style={styles.input} />
            </label>
          </div>

          <label style={styles.field}>
            Descripción
            <textarea name="description" value={caseForm.description} onChange={handleCaseChange} rows={3} style={styles.textarea} />
          </label>

          <button type="submit" style={styles.primaryButton} disabled={submitting}>
            Crear caso
          </button>
        </form>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Estado del caso</h2>
          {selectedCase ? (
            <>
              <p style={styles.bigNumber}>{progress}%</p>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${progress}%` }} />
              </div>
              <p style={styles.cardSubtitle}>{selectedCase.tasks?.filter((task) => task.status === "completed").length || 0} de {selectedCase.tasks?.length || 0} tareas completadas</p>
            </>
          ) : (
            <p style={styles.cardSubtitle}>Sin caso seleccionado.</p>
          )}
        </div>
      </section>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.contentGrid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Listado de casos</h2>
          <div style={styles.caseList}>
            {cases.map((caseStudy) => {
              const completed = caseStudy.tasks?.filter((task) => task.status === "completed").length || 0;
              const total = caseStudy.tasks?.length || 0;
              const isSelected = Number(selectedCase?.id) === Number(caseStudy.id);

              return (
                <button
                  key={caseStudy.id}
                  type="button"
                  onClick={() => setSelectedCaseId(caseStudy.id)}
                  style={{ ...styles.caseButton, ...(isSelected ? styles.caseButtonActive : {}) }}
                >
                  <span style={styles.caseTitle}>{caseStudy.title}</span>
                  <span style={styles.caseMeta}>{difficultyLabels[caseStudy.difficulty]} · {caseStatusLabels[caseStudy.status]} · {completed}/{total}</span>
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
                  <div style={styles.badges}>
                    <span style={styles.badge}>{difficultyLabels[selectedCase.difficulty]}</span>
                    <span style={styles.badge}>{caseStatusLabels[selectedCase.status]}</span>
                    <span style={styles.badge}>{selectedCase.created_by || "Sin autor"}</span>
                  </div>
                </div>
                <div style={styles.headerActions}>
                  <select value={selectedCase.status} onChange={(event) => handleCaseStatus(selectedCase, event.target.value)} style={styles.smallSelect}>
                    <option value="draft">Borrador</option>
                    <option value="active">Activo</option>
                    <option value="archived">Archivado</option>
                  </select>
                  <button type="button" style={styles.dangerButton} onClick={() => handleDeleteCase(selectedCase.id)}>
                    Eliminar
                  </button>
                </div>
              </div>

              <div style={styles.taskList}>
                {[...(selectedCase.tasks || [])]
                  .sort((a, b) => a.task_order - b.task_order)
                  .map((task) => (
                    <article key={task.id} style={styles.taskItem}>
                      <div>
                        <div style={styles.taskTopLine}>
                          <strong>{task.task_order}. {task.title}</strong>
                          <span style={styles.moduleBadge}>{moduleLabels[task.module]}</span>
                          {task.is_required && <span style={styles.requiredBadge}>Obligatoria</span>}
                        </div>
                        <p style={styles.taskDescription}>{task.description || "Sin descripción."}</p>
                        {task.expected_result && <p style={styles.expected}>Resultado esperado: {task.expected_result}</p>}
                      </div>
                      <div style={styles.taskActions}>
                        <select value={task.status} onChange={(event) => handleTaskStatus(task, event.target.value)} style={styles.smallSelect}>
                          <option value="pending">Pendiente</option>
                          <option value="in_progress">En curso</option>
                          <option value="completed">Completado</option>
                        </select>
                        <button type="button" style={styles.linkButton} onClick={() => handleDeleteTask(task.id)}>
                          Quitar
                        </button>
                      </div>
                    </article>
                  ))}
              </div>

              <form style={styles.taskForm} onSubmit={handleCreateTask}>
                <h3 style={styles.sectionTitle}>Añadir tarea</h3>
                <div style={styles.formGrid}>
                  <label style={styles.field}>
                    Título
                    <input name="title" value={taskForm.title} onChange={handleTaskChange} required style={styles.input} />
                  </label>
                  <label style={styles.field}>
                    Módulo
                    <select name="module" value={taskForm.module} onChange={handleTaskChange} style={styles.input}>
                      {Object.entries(moduleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label style={styles.field}>
                    Orden
                    <input type="number" name="task_order" value={taskForm.task_order} onChange={handleTaskChange} min="1" style={styles.input} />
                  </label>
                  <label style={styles.field}>
                    Estado
                    <select name="status" value={taskForm.status} onChange={handleTaskChange} style={styles.input}>
                      <option value="pending">Pendiente</option>
                      <option value="in_progress">En curso</option>
                      <option value="completed">Completado</option>
                    </select>
                  </label>
                </div>
                <label style={styles.field}>
                  Descripción
                  <textarea name="description" value={taskForm.description} onChange={handleTaskChange} rows={2} style={styles.textarea} />
                </label>
                <label style={styles.field}>
                  Resultado esperado
                  <textarea name="expected_result" value={taskForm.expected_result} onChange={handleTaskChange} rows={2} style={styles.textarea} />
                </label>
                <label style={styles.checkboxField}>
                  <input type="checkbox" name="is_required" checked={taskForm.is_required} onChange={handleTaskChange} />
                  Tarea obligatoria
                </label>
                <button type="submit" style={styles.primaryButton} disabled={submitting}>
                  Añadir tarea
                </button>
              </form>
            </>
          ) : (
            <p style={styles.cardSubtitle}>Crea o carga un caso práctico para empezar.</p>
          )}
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "20px" },
  topGrid: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "18px" },
  contentGrid: { display: "grid", gridTemplateColumns: "360px 1fr", gap: "18px", alignItems: "start" },
  card: { backgroundColor: "#ffffff", border: "2px solid #111111", boxShadow: "4px 4px 0 #e6d85c", padding: "18px", boxSizing: "border-box" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" },
  cardTitle: { margin: "0 0 6px", fontSize: "22px", fontWeight: 900, color: "#111111" },
  cardSubtitle: { margin: "0 0 14px", color: "#4b5563", fontSize: "14px", lineHeight: 1.45 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 800, color: "#111111", marginBottom: "12px" },
  checkboxField: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 800, marginBottom: "12px" },
  input: { border: "2px solid #111111", padding: "9px 10px", fontSize: "14px", backgroundColor: "#ffffff" },
  textarea: { border: "2px solid #111111", padding: "9px 10px", fontSize: "14px", backgroundColor: "#ffffff", resize: "vertical" },
  primaryButton: { border: "2px solid #111111", backgroundColor: "#111111", color: "#ffffff", padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "2px solid #111111", backgroundColor: "#f8f3b5", color: "#111111", padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  dangerButton: { border: "2px solid #991b1b", backgroundColor: "#ffffff", color: "#991b1b", padding: "8px 10px", fontWeight: 900, cursor: "pointer" },
  linkButton: { border: "none", backgroundColor: "transparent", color: "#991b1b", fontWeight: 900, cursor: "pointer" },
  success: { border: "2px solid #15803d", backgroundColor: "#dcfce7", color: "#14532d", padding: "10px 12px", fontWeight: 800 },
  error: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "10px 12px", fontWeight: 800 },
  loading: { fontWeight: 800 },
  bigNumber: { margin: "8px 0", fontSize: "46px", fontWeight: 950, color: "#111111" },
  progressBar: { height: "16px", border: "2px solid #111111", backgroundColor: "#ffffff", marginBottom: "10px" },
  progressFill: { height: "100%", backgroundColor: "#e6d85c" },
  caseList: { display: "flex", flexDirection: "column", gap: "8px" },
  caseButton: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px", border: "2px solid #d1d5db", backgroundColor: "#ffffff", padding: "12px", cursor: "pointer", textAlign: "left" },
  caseButtonActive: { borderColor: "#111111", boxShadow: "3px 3px 0 #e6d85c" },
  caseTitle: { fontWeight: 900, color: "#111111" },
  caseMeta: { fontSize: "12px", color: "#4b5563", fontWeight: 800 },
  detailHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", marginBottom: "16px" },
  headerActions: { display: "flex", gap: "8px", alignItems: "center" },
  badges: { display: "flex", gap: "8px", flexWrap: "wrap" },
  badge: { border: "2px solid #111111", backgroundColor: "#f8f3b5", padding: "4px 8px", fontSize: "12px", fontWeight: 900 },
  taskList: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" },
  taskItem: { display: "grid", gridTemplateColumns: "1fr 190px", gap: "12px", border: "1px solid #d1d5db", padding: "12px", backgroundColor: "#f9fafb" },
  taskTopLine: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  taskDescription: { margin: "6px 0", color: "#374151", fontSize: "14px" },
  expected: { margin: 0, color: "#111111", fontSize: "13px", fontWeight: 800 },
  moduleBadge: { backgroundColor: "#111111", color: "#ffffff", padding: "3px 7px", fontSize: "11px", fontWeight: 900 },
  requiredBadge: { border: "1px solid #111111", padding: "2px 6px", fontSize: "11px", fontWeight: 900 },
  taskActions: { display: "flex", flexDirection: "column", gap: "8px", alignItems: "stretch" },
  smallSelect: { border: "2px solid #111111", padding: "7px", fontWeight: 800, backgroundColor: "#ffffff" },
  taskForm: { borderTop: "2px solid #111111", paddingTop: "16px" },
  sectionTitle: { margin: "0 0 12px", fontSize: "18px", fontWeight: 900 },
};
