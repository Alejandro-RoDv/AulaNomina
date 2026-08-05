import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  LoaderCircle,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";

import {
  fetchTeacherCaseDashboard,
  fetchTeacherCaseDetail,
} from "../../services/caseAssignmentApi.js";
import "./teacherCaseTraceability.css";


const STATUS_LABELS = {
  assigned: "Asignado",
  in_progress: "En curso",
  submitted: "Entregado",
  reviewed: "Corregido",
  approved: "Aprobado",
  needs_revision: "Requiere revisión",
};

const STEP_STATUS_LABELS = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completado",
  failed: "Con error",
};

const TIMELINE_LABELS = {
  assignment: "Asignación",
  step_started: "Inicio de paso",
  operation: "Operación ERP",
  operation_error: "Error de operación",
  validation: "Validación",
  step_completed: "Paso completado",
  tutor_message: "Tutor automático",
  assignment_completed: "Entrega",
};

const EMPTY_METRICS = {
  total_assignments: 0,
  assigned: 0,
  in_progress: 0,
  submitted: 0,
  reviewed: 0,
  approved: 0,
  needs_revision: 0,
  average_progress: 0,
  failed_operations: 0,
  tutor_messages: 0,
};


function formatDateTime(value) {
  if (!value) return "Sin actividad";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin actividad";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function formatDuration(minutes) {
  const total = Number(minutes || 0);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const remaining = total % 60;
  if (hours < 24) return `${hours} h ${remaining ? `${remaining} min` : ""}`.trim();
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}


function timelineIcon(entryType) {
  if (entryType === "operation_error") return <AlertTriangle size={14} />;
  if (entryType === "tutor_message") return <Bot size={14} />;
  if (["step_completed", "assignment_completed"].includes(entryType)) return <CheckCircle2 size={14} />;
  return <Activity size={14} />;
}


export default function TeacherCaseTraceabilityPanel() {
  const [dashboard, setDashboard] = useState({ metrics: EMPTY_METRICS, assignments: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "", assignee_type: "" });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async ({ silent = false, preferredId = null } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await fetchTeacherCaseDashboard(filters);
      setDashboard(data || { metrics: EMPTY_METRICS, assignments: [] });
      setSelectedId((current) => {
        const candidate = preferredId || current;
        if (candidate && data.assignments.some((item) => item.assignment_id === candidate)) return candidate;
        return data.assignments[0]?.assignment_id || null;
      });
    } catch (requestError) {
      setError(requestError.message || "No se ha podido cargar el seguimiento docente.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadDashboard(), filters.search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard, filters.search]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    fetchTeacherCaseDetail(selectedId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "No se ha podido cargar la cronología del caso.");
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    const handleCaseOperation = () => loadDashboard({ silent: true, preferredId: selectedId });
    window.addEventListener("storage", handleCaseOperation);
    window.addEventListener("aulanomina-case-operation-result", handleCaseOperation);
    return () => {
      window.removeEventListener("storage", handleCaseOperation);
      window.removeEventListener("aulanomina-case-operation-result", handleCaseOperation);
    };
  }, [loadDashboard, selectedId]);

  const selectedSummary = useMemo(
    () => dashboard.assignments.find((item) => item.assignment_id === selectedId) || null,
    [dashboard.assignments, selectedId]
  );

  const handleFilter = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  return (
    <section className="teacher-trace" aria-label="Seguimiento detallado de casos prácticos">
      <header className="teacher-trace__header">
        <div>
          <span className="teacher-trace__eyebrow">Supervisión de ejercicios</span>
          <h3>Trazabilidad de casos prácticos</h3>
          <p>Operaciones realizadas, intentos fallidos, validaciones, respuestas del tutor y tiempo empleado por alumno o grupo.</p>
        </div>
        <button type="button" className="teacher-trace__refresh" onClick={() => loadDashboard()} disabled={loading}>
          <RefreshCw className={loading ? "teacher-trace__spinner" : ""} size={16} /> Actualizar
        </button>
      </header>

      {error && <div className="teacher-trace__error" role="alert">{error}</div>}

      <div className="teacher-trace__metrics">
        <article><Activity size={18} /><span>Asignaciones</span><strong>{dashboard.metrics.total_assignments}</strong></article>
        <article><CheckCircle2 size={18} /><span>Progreso medio</span><strong>{dashboard.metrics.average_progress}%</strong></article>
        <article className={dashboard.metrics.failed_operations ? "is-warning" : ""}><AlertTriangle size={18} /><span>Operaciones fallidas</span><strong>{dashboard.metrics.failed_operations}</strong></article>
        <article><Bot size={18} /><span>Respuestas del tutor</span><strong>{dashboard.metrics.tutor_messages}</strong></article>
      </div>

      <div className="teacher-trace__filters">
        <label>
          <Search size={15} />
          <input name="search" value={filters.search} onChange={handleFilter} placeholder="Buscar caso, escenario o destinatario" />
        </label>
        <label>
          <Filter size={15} />
          <select name="status" value={filters.status} onChange={handleFilter}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <select name="assignee_type" value={filters.assignee_type} onChange={handleFilter}>
          <option value="">Alumnos y grupos</option>
          <option value="student">Alumnos</option>
          <option value="group">Grupos</option>
        </select>
      </div>

      <div className="teacher-trace__workspace">
        <div className="teacher-trace__assignment-list">
          {loading && (
            <div className="teacher-trace__loading"><LoaderCircle className="teacher-trace__spinner" size={20} /> Cargando asignaciones...</div>
          )}
          {!loading && dashboard.assignments.length === 0 && (
            <div className="teacher-trace__empty">No hay asignaciones que coincidan con los filtros.</div>
          )}
          {!loading && dashboard.assignments.map((assignment) => (
            <button
              type="button"
              key={assignment.assignment_id}
              className={`teacher-trace__assignment ${selectedId === assignment.assignment_id ? "is-selected" : ""}`}
              onClick={() => setSelectedId(assignment.assignment_id)}
            >
              <div className="teacher-trace__assignment-top">
                <span>{assignment.scenario_code || `CASO-${assignment.assignment_id}`}</span>
                <span className={`teacher-trace__status teacher-trace__status--${assignment.status}`}>
                  {STATUS_LABELS[assignment.status] || assignment.status}
                </span>
              </div>
              <strong>{assignment.case_title}</strong>
              <div className="teacher-trace__assignee"><UserRound size={13} /> {assignment.assignee_name}</div>
              <div className="teacher-trace__progress-row">
                <div><span style={{ width: `${assignment.completion_percentage}%` }} /></div>
                <strong>{assignment.completion_percentage}%</strong>
              </div>
              <div className="teacher-trace__assignment-meta">
                <span><Clock3 size={12} /> {formatDuration(assignment.elapsed_minutes)}</span>
                {assignment.failed_operations > 0 && <span className="is-failed"><AlertTriangle size={12} /> {assignment.failed_operations}</span>}
                <span>{assignment.completed_steps}/{assignment.total_steps} pasos</span>
                <ChevronRight size={15} />
              </div>
            </button>
          ))}
        </div>

        <div className="teacher-trace__detail">
          {!selectedSummary && !detailLoading && (
            <div className="teacher-trace__empty teacher-trace__empty--detail">Selecciona una asignación para consultar su trazabilidad.</div>
          )}
          {detailLoading && (
            <div className="teacher-trace__loading teacher-trace__loading--detail"><LoaderCircle className="teacher-trace__spinner" size={22} /> Cargando cronología...</div>
          )}
          {!detailLoading && detail && (
            <>
              <header className="teacher-trace__detail-header">
                <div>
                  <span>{detail.scenario_code || `CASO-${detail.assignment_id}`}</span>
                  <h4>{detail.case_title}</h4>
                  <p>{detail.assignee_name} · {detail.completed_steps} de {detail.total_steps} pasos · {formatDuration(detail.elapsed_minutes)}</p>
                </div>
                <strong>{detail.completion_percentage}%</strong>
              </header>

              <div className="teacher-trace__step-grid">
                {detail.steps.map((step) => (
                  <article key={step.task_id} className={`teacher-trace__step teacher-trace__step--${step.progress_status}`}>
                    <div><span>{step.task_order}</span><strong>{step.title}</strong></div>
                    <small>{STEP_STATUS_LABELS[step.progress_status] || step.progress_status}</small>
                    <p>{step.module} · {step.event_count} eventos · {step.attempts} intentos</p>
                    {step.failed_operations > 0 && <em>{step.failed_operations} operación fallida</em>}
                  </article>
                ))}
              </div>

              <section className="teacher-trace__timeline">
                <div className="teacher-trace__timeline-title">
                  <h5>Cronología del ejercicio</h5>
                  <span>Última actividad: {formatDateTime(detail.last_activity_at)}</span>
                </div>
                {detail.timeline.length === 0 && <div className="teacher-trace__empty">Todavía no hay actividad registrada.</div>}
                {detail.timeline.map((entry, index) => (
                  <article key={`${entry.entry_type}-${entry.timestamp}-${index}`} className={`teacher-trace__timeline-entry teacher-trace__timeline-entry--${entry.entry_type}`}>
                    <span className="teacher-trace__timeline-icon">{timelineIcon(entry.entry_type)}</span>
                    <div>
                      <div className="teacher-trace__timeline-entry-top">
                        <strong>{entry.title}</strong>
                        <time>{formatDateTime(entry.timestamp)}</time>
                      </div>
                      <small>{TIMELINE_LABELS[entry.entry_type] || entry.entry_type}{entry.actor ? ` · ${entry.actor}` : ""}</small>
                      {entry.detail && <p>{entry.detail}</p>}
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
