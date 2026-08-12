import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Mail,
  RefreshCw,
  X,
} from "lucide-react";

import {
  completeActivityManually,
  fetchActivityCourse,
  validateActivity,
} from "../../services/activityApi.js";
import "./activities.css";

const ACTIVE_CASE_CONTEXT_KEY = "aulanomina:active-case-context";

function findActivity(course, activityId) {
  for (const topic of course?.topics || []) {
    const match = (topic.activities || []).find((activity) => activity.id === activityId);
    if (match) return match;
  }
  return null;
}

function flattenActivities(course) {
  return (course?.topics || []).flatMap((topic) => topic.activities || []);
}

function storedActivityId(course) {
  try {
    const context = JSON.parse(window.localStorage.getItem(ACTIVE_CASE_CONTEXT_KEY) || "null");
    if (!context?.assignmentId || !context?.taskId) return null;
    const id = `${context.assignmentId}:${context.taskId}`;
    return findActivity(course, id) ? id : null;
  } catch {
    return null;
  }
}

function persistActivityContext(activity) {
  if (!activity?.context) return;
  try {
    window.localStorage.setItem(ACTIVE_CASE_CONTEXT_KEY, JSON.stringify(activity.context));
  } catch {
    // El visor debe seguir funcionando aunque el almacenamiento del navegador esté bloqueado.
  }
  window.dispatchEvent(new CustomEvent("aulanomina-case-context", { detail: activity.context }));
}

function ActivityStateIcon({ activity, selected }) {
  if (activity.is_completed) return <CheckCircle2 className="activity-center__state activity-center__state--done" aria-hidden="true" />;
  if (selected || activity.is_current) return <span className="activity-center__current-dot" aria-hidden="true" />;
  return <Circle className="activity-center__state activity-center__state--pending" aria-hidden="true" />;
}

export default function ActivitiesCenter() {
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [expandedTopicKey, setExpandedTopicKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingId, setCheckingId] = useState(null);

  const loadCourse = useCallback(async ({ preserveSelection = true } = {}) => {
    try {
      setLoading(true);
      setError("");
      const next = await fetchActivityCourse();
      setCourse(next);
      setSelectedId((current) => {
        if (preserveSelection && current && findActivity(next, current)) return current;
        return storedActivityId(next) || next?.course?.current_activity_id || flattenActivities(next)[0]?.id || null;
      });
      return next;
    } catch (requestError) {
      setError(requestError.message || "No se han podido cargar las actividades.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourse({ preserveSelection: false });
    const handleProgress = () => loadCourse({ preserveSelection: true });
    window.addEventListener("aulanomina-case-operation-feedback", handleProgress);
    window.addEventListener("aulanomina-activities-refresh", handleProgress);
    return () => {
      window.removeEventListener("aulanomina-case-operation-feedback", handleProgress);
      window.removeEventListener("aulanomina-activities-refresh", handleProgress);
    };
  }, [loadCourse]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectedActivity = useMemo(() => findActivity(course, selectedId), [course, selectedId]);
  const pending = course?.course?.pending;
  const topicCount = course?.topics?.length || 0;

  useEffect(() => {
    if (selectedActivity?.topic_key) setExpandedTopicKey(selectedActivity.topic_key);
  }, [selectedActivity?.id, selectedActivity?.topic_key]);

  const openCenter = async () => {
    setOpen(true);
    await loadCourse({ preserveSelection: true });
  };

  const selectActivity = async (activity) => {
    setSelectedId(activity.id);
    setExpandedTopicKey(activity.topic_key);
    persistActivityContext(activity);

    if (activity.is_completed || !activity.completion_condition?.automatic) return;
    try {
      setCheckingId(activity.id);
      await validateActivity(activity.assignment_id, activity.task_id);
      await loadCourse({ preserveSelection: true });
    } catch (requestError) {
      if (requestError?.code !== "BLOCKING_STEP_PENDING" && requestError?.status !== 409) {
        setError(requestError.message || "No se ha podido comprobar la actividad.");
      }
    } finally {
      setCheckingId(null);
    }
  };

  const completeSelectedManually = async () => {
    if (!selectedActivity || selectedActivity.is_completed || selectedActivity.completion_condition?.automatic) return;
    try {
      setCheckingId(selectedActivity.id);
      setError("");
      persistActivityContext(selectedActivity);
      await completeActivityManually(selectedActivity.assignment_id, selectedActivity.task_id);
      await loadCourse({ preserveSelection: true });
    } catch (requestError) {
      setError(requestError.message || "No se ha podido confirmar la actividad.");
    } finally {
      setCheckingId(null);
    }
  };

  const overlay = open ? createPortal(
    <div className="activity-center__backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section className="activity-center" role="dialog" aria-modal="true" aria-labelledby="activities-title">
        <header className="activity-center__header">
          <div className="activity-center__course-heading">
            <span className="activity-center__eyebrow">Formación integrada</span>
            <h2 id="activities-title">{course?.course?.title || "Curso práctico de gestión laboral"}</h2>
            <div className="activity-center__progress-line">
              <span>{course?.course?.completed || 0} de {course?.course?.total || 0} actividades completadas</span>
              <strong>{course?.course?.progress_percentage || 0}%</strong>
            </div>
            <div className="activity-center__progress-track" aria-hidden="true">
              <span style={{ width: `${course?.course?.progress_percentage || 0}%` }} />
            </div>
          </div>
          <div className="activity-center__header-actions">
            <button type="button" className="activity-center__quiet-button" onClick={() => loadCourse()} disabled={loading}>
              <RefreshCw size={16} className={loading ? "is-spinning" : ""} aria-hidden="true" />
              Actualizar
            </button>
            <button type="button" className="activity-center__close" onClick={() => setOpen(false)} aria-label="Cerrar actividades">
              <X size={19} aria-hidden="true" />
            </button>
          </div>
        </header>

        {error && <div className="activity-center__error" role="alert">{error}</div>}

        <div className="activity-center__workspace">
          <aside className="activity-center__outline" aria-label="Temario y actividades">
            <div className="activity-center__outline-title">
              <span>Contenido</span>
              <small>{topicCount} temas · {course?.course?.total || 0} actividades</small>
            </div>
            <div className="activity-center__outline-scroll">
              {(course?.topics || []).map((topic) => {
                const isExpanded = expandedTopicKey === topic.key;
                const isComplete = topic.total > 0 && topic.completed === topic.total;
                return (
                  <section key={topic.key} className={`activity-center__topic${isExpanded ? " is-open" : ""}${isComplete ? " is-complete" : ""}`}>
                    <button
                      type="button"
                      className="activity-center__topic-header"
                      onClick={() => topic.total > 0 && setExpandedTopicKey((current) => current === topic.key ? null : topic.key)}
                      aria-expanded={isExpanded}
                      disabled={topic.total === 0}
                    >
                      <span className="activity-center__topic-name">{topic.order}. {topic.title}</span>
                      <span className="activity-center__topic-summary">
                        {topic.total > 0 ? `${topic.completed}/${topic.total} · ${topic.progress_percentage}%` : "Sin actividades"}
                      </span>
                      <ChevronDown className="activity-center__topic-chevron" size={15} aria-hidden="true" />
                    </button>

                    {isExpanded && topic.total > 0 && (
                      <div className="activity-center__topic-list">
                        {topic.activities.map((activity) => {
                          const selected = activity.id === selectedId;
                          return (
                            <button
                              type="button"
                              key={activity.id}
                              className={`activity-center__activity${selected ? " is-selected" : ""}${activity.is_completed ? " is-completed" : ""}`}
                              onClick={() => selectActivity(activity)}
                            >
                              <ActivityStateIcon activity={activity} selected={selected} />
                              <span className="activity-center__activity-copy">
                                <small>{activity.display_number}</small>
                                <strong title={activity.title}>{activity.title}</strong>
                              </span>
                              <ChevronRight size={14} aria-hidden="true" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </aside>

          <main className="activity-center__detail">
            {loading && !selectedActivity && (
              <div className="activity-center__empty"><RefreshCw className="is-spinning" aria-hidden="true" /><p>Cargando actividades…</p></div>
            )}

            {!loading && !selectedActivity && (
              <div className="activity-center__empty"><BookOpen aria-hidden="true" /><h3>No hay actividades disponibles</h3><p>El curso aparecerá aquí cuando existan casos activos asignados.</p></div>
            )}

            {selectedActivity && (
              <article className="activity-center__activity-detail">
                <div className="activity-center__detail-heading">
                  <div>
                    <span className="activity-center__unit">{selectedActivity.unit}</span>
                    <h3>{selectedActivity.display_number} · {selectedActivity.title}</h3>
                    <p className="activity-center__detail-meta">
                      Tema {selectedActivity.topic_order} · {selectedActivity.topic_title}
                      {selectedActivity.case_total_steps ? ` · Paso ${selectedActivity.case_step} de ${selectedActivity.case_total_steps}` : ""}
                    </p>
                  </div>
                  <span className={`activity-center__status${selectedActivity.is_completed ? " is-done" : ""}`}>
                    {selectedActivity.is_completed ? <Check size={14} aria-hidden="true" /> : null}
                    {selectedActivity.is_completed ? "Completada" : "Pendiente"}
                  </span>
                </div>

                <section className="activity-center__brief-card">
                  <span className="activity-center__section-label">Encargo</span>
                  <p className="activity-center__brief-text">{selectedActivity.situation}</p>

                  {selectedActivity.case_data?.length > 0 && (
                    <div className="activity-center__case-data">
                      <span className="activity-center__case-data-title">Datos del caso</span>
                      <dl>
                        {selectedActivity.case_data.map((item) => (
                          <div key={`${item.label}-${item.value}`}>
                            <dt>{item.label}</dt>
                            <dd>{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {selectedActivity.requires_mail && (
                    <div className="activity-center__mail-note">
                      <Mail size={17} aria-hidden="true" />
                      <span>La información necesaria parte de una comunicación recibida. Consulta Correo antes de resolver la actividad.</span>
                    </div>
                  )}
                </section>

                <section className="activity-center__task-block">
                  <span className="activity-center__section-label">Tu tarea</span>
                  <p>{selectedActivity.instructions}</p>
                </section>

                <section className={`activity-center__result-card${selectedActivity.is_completed ? " is-completed" : ""}`}>
                  <div className="activity-center__result-heading">
                    <span className="activity-center__section-label">Resultado esperado</span>
                    <span className={`activity-center__validation-mode${selectedActivity.is_completed ? " is-done" : ""}`}>
                      {selectedActivity.is_completed
                        ? "Completado"
                        : selectedActivity.completion_condition?.automatic
                          ? "Comprobación automática"
                          : "Verificación manual"}
                    </span>
                  </div>

                  <ul className="activity-center__expected-list">
                    {(selectedActivity.expected_items?.length ? selectedActivity.expected_items : [selectedActivity.objective]).map((item) => (
                      <li key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></li>
                    ))}
                  </ul>

                  {!selectedActivity.is_completed && selectedActivity.completion_condition?.automatic && (
                    <small className="activity-center__result-note">
                      {checkingId === selectedActivity.id
                        ? "Comprobando el resultado actual…"
                        : "AulaNomina comprobará el resultado automáticamente al realizar la operación correspondiente."}
                    </small>
                  )}
                </section>

                <section className="activity-center__help">
                  <span className="activity-center__section-label">Ayuda</span>
                  <details className="activity-center__help-item">
                    <summary>
                      <span>Conceptos relacionados</span>
                      <ChevronDown size={16} aria-hidden="true" />
                    </summary>
                    <div className="activity-center__help-content">
                      <strong>{selectedActivity.concepts?.title}</strong>
                      <p>{selectedActivity.concepts?.body}</p>
                    </div>
                  </details>
                  <details className="activity-center__help-item">
                    <summary>
                      <span>Pista</span>
                      <ChevronDown size={16} aria-hidden="true" />
                    </summary>
                    <div className="activity-center__help-content">
                      <p>{selectedActivity.hint}</p>
                    </div>
                  </details>
                </section>

                {!selectedActivity.is_completed && !selectedActivity.completion_condition?.automatic && (
                  <section className="activity-center__manual-action">
                    <div>
                      <strong>¿Has terminado la actividad?</strong>
                      <span>Esta actividad no dispone todavía de una comprobación automática fiable.</span>
                    </div>
                    <button type="button" className="activity-center__quiet-button" onClick={completeSelectedManually} disabled={checkingId === selectedActivity.id}>
                      <Check size={15} aria-hidden="true" />
                      {checkingId === selectedActivity.id ? "Confirmando…" : "Confirmar que he terminado"}
                    </button>
                  </section>
                )}
              </article>
            )}
          </main>
        </div>
      </section>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button type="button" className="activities-global-launcher" onClick={openCenter} aria-haspopup="dialog" aria-expanded={open}>
        <BookOpen size={16} aria-hidden="true" />
        <span>Actividades</span>
        <strong className="activities-global-launcher__counter" aria-label={`${pending ?? 0} actividades pendientes`}>
          {pending ?? "—"}
        </strong>
      </button>
      {overlay}
    </>
  );
}
