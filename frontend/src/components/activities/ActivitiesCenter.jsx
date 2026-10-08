import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Mail,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";

import {
  completeActivityManually,
  deliverA02Briefing,
  deliverActivityBriefing,
  fetchActivityCourse,
  saveActivityResponse,
  validateActivity,
} from "../../services/activityApi.js";
import { updateMailThread } from "../../services/mailApi.js";
import { getCaseActionLabel, openCaseModule } from "../../utils/caseNavigation.js";
import ActivityResponseForm from "./ActivityResponseForm.jsx";
import "./activities.css";
import "./activityMail.css";

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
    if (!context?.trainingCode) return null;
    const id = `practice:${context.trainingCode}`;
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
    // El curso debe seguir funcionando aunque el navegador bloquee localStorage.
  }
  window.dispatchEvent(new CustomEvent("aulanomina-case-context", { detail: activity.context }));
}

function ActivityStateIcon({ activity, selected }) {
  if (activity.is_completed) return <CheckCircle2 className="activity-center__state activity-center__state--done" aria-hidden="true" />;
  if (selected) return <span className="activity-center__current-dot" aria-hidden="true" />;
  return <Circle className="activity-center__state activity-center__state--pending" aria-hidden="true" />;
}

function requiresExplicitReview(activity) {
  return activity?.validation_interaction === "explicit_review";
}

function hasValidationAttempt(activity) {
  const operationAttempt = (activity?.validation_result?.events || []).some((event) => (
    event?.operation_status === "success" || event?.operation_status === "error"
  ));
  return operationAttempt || Boolean(
    requiresExplicitReview(activity) && activity?.validation_result?.validated_at
  );
}

function failedValidationMessages(activity) {
  if (!hasValidationAttempt(activity) || activity?.is_completed) return [];
  return (activity?.validation_result?.checks || [])
    .filter((check) => check?.supported !== false && !check?.passed)
    .flatMap((check) => (
      Array.isArray(check?.issues) && check.issues.length > 0
        ? check.issues
        : (check?.message ? [check.message] : [])
    ))
    .filter((message, index, messages) => messages.indexOf(message) === index)
    .map((message) => String(message).includes("No se encuentra el centro con código F.01")
      ? "Este resultado es anterior a los cambios en la actividad. Vuelve a comprobar la gestión."
      : message)
    .slice(0, 8);
}

function mailUrl(threadId) {
  const url = new URL(window.location.href);
  url.searchParams.set("mailThread", String(threadId));
  url.hash = "mail";
  return url.toString();
}

function cleanMailSubject(subject) {
  return String(subject || "").replace(/^[A-Z]\d+\s*·\s*/i, "");
}

export default function ActivitiesCenter() {
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [expandedTopicKey, setExpandedTopicKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingId, setCheckingId] = useState(null);
  const [openingMailId, setOpeningMailId] = useState(null);
  const [responseDraft, setResponseDraft] = useState({});
  const requestedBriefings = useRef(new Set());

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
      setError(requestError.message || "No se ha podido cargar el curso.");
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

  const activities = useMemo(() => flattenActivities(course), [course]);
  const selectedActivity = useMemo(() => findActivity(course, selectedId), [course, selectedId]);
  const currentCourseActivity = useMemo(
    () => findActivity(course, course?.course?.current_activity_id) || selectedActivity,
    [course, selectedActivity]
  );
  const currentTopic = useMemo(
    () => (course?.topics || []).find((topic) => topic.key === currentCourseActivity?.topic_key) || null,
    [course, currentCourseActivity]
  );
  const selectedIndex = useMemo(
    () => activities.findIndex((activity) => activity.id === selectedId),
    [activities, selectedId]
  );
  const previousActivity = selectedIndex > 0 ? activities[selectedIndex - 1] : null;
  const nextActivity = selectedIndex >= 0 && selectedIndex < activities.length - 1 ? activities[selectedIndex + 1] : null;
  const topicCount = course?.topics?.length || 0;
  const moduleProgress = currentTopic?.total > 0
    ? `${currentTopic.completed || 0}/${currentTopic.total}`
    : "—";
  const moduleProgressLabel = currentTopic?.total > 0
    ? `${currentTopic.completed || 0} de ${currentTopic.total} actividades completadas en el tema actual`
    : "Progreso del tema actual no disponible";
  const failedMessages = failedValidationMessages(selectedActivity);
  const isOrganizationCase = selectedActivity?.context?.trainingCode === "A02" || selectedActivity?.training_code === "A02";
  const moduleActionLabel = selectedActivity?.context
    && selectedActivity.context.moduleCode !== "general"
    ? getCaseActionLabel(selectedActivity.context.actionCode, selectedActivity.context.moduleCode)
    : null;

  useEffect(() => {
    if (selectedActivity?.topic_key) setExpandedTopicKey(selectedActivity.topic_key);
    setResponseDraft(selectedActivity?.validation_result?.student_response || {});
  }, [selectedActivity?.id, selectedActivity?.topic_key, selectedActivity?.validation_result?.student_response]);

  useEffect(() => {
    const threadId = selectedActivity?.mail_context?.thread_id;
    if (!threadId || !selectedActivity?.mail_context?.locked) return undefined;
    let cancelled = false;
    const unlock = async () => {
      try {
        await updateMailThread(threadId, { folder: "inbox" });
        if (cancelled) return;
        window.dispatchEvent(new Event("aulanomina-mail-stats-refresh"));
        await loadCourse({ preserveSelection: true });
      } catch {
        // El alumno podrá volver a intentarlo al abrir el correo.
      }
    };
    unlock();
    return () => { cancelled = true; };
  }, [selectedActivity?.id, selectedActivity?.mail_context?.thread_id, selectedActivity?.mail_context?.locked, loadCourse]);

  useEffect(() => {
    if (!open || !selectedActivity?.assignment_id || !selectedActivity?.task_id || selectedActivity.mail_context) return;
    const assignmentId = selectedActivity.assignment_id;
    const taskId = selectedActivity.task_id;
    const trainingCode = selectedActivity.training_code || selectedActivity.context?.trainingCode || taskId;
    const requestKey = `${assignmentId}:${trainingCode}`;
    if (requestedBriefings.current.has(requestKey)) return;

    requestedBriefings.current.add(requestKey);
    let cancelled = false;

    const sendBriefing = async () => {
      try {
        if (isOrganizationCase) {
          await deliverA02Briefing(assignmentId);
        } else {
          await deliverActivityBriefing(assignmentId, taskId);
        }
        window.dispatchEvent(new Event("aulanomina-mail-stats-refresh"));
        if (!cancelled) await loadCourse({ preserveSelection: true });
      } catch (requestError) {
        requestedBriefings.current.delete(requestKey);
        if (!cancelled) {
          setError(requestError.message || "No se ha podido recibir el correo del ejercicio.");
        }
      }
    };
    sendBriefing();
    return () => { cancelled = true; };
  }, [
    open,
    isOrganizationCase,
    selectedActivity?.assignment_id,
    selectedActivity?.task_id,
    selectedActivity?.training_code,
    selectedActivity?.mail_context,
    loadCourse,
  ]);

  const openCenter = async () => {
    setOpen(true);
    await loadCourse({ preserveSelection: true });
  };

  const selectActivity = (activity) => {
    if (!activity) return;
    setSelectedId(activity.id);
    setExpandedTopicKey(activity.topic_key);
    persistActivityContext(activity);
  };

  const openSelectedModule = () => {
    if (!selectedActivity?.context) return;
    persistActivityContext(selectedActivity);
    openCaseModule({ ...selectedActivity.context, mailThreadId: selectedActivity.mail_context?.thread_id });
  };

  const openSelectedMail = async () => {
    const activity = selectedActivity;
    if (!activity) return;
    persistActivityContext(activity);

    const existingThreadId = activity.mail_context?.thread_id;
    if (existingThreadId) {
      window.open(mailUrl(existingThreadId), "_blank", "noopener,noreferrer");
      return;
    }

    // Reservar la pestaña durante el clic para que el navegador no bloquee
    // la navegación mientras se genera el correo por primera vez.
    const mailTab = window.open("about:blank", "_blank");
    if (mailTab) mailTab.opener = null;
    try {
      setOpeningMailId(activity.id);
      setError("");
      const thread = await deliverActivityBriefing(activity.assignment_id, activity.task_id);
      if (!thread?.id) throw new Error("No se ha podido localizar el correo de esta actividad.");
      window.dispatchEvent(new Event("aulanomina-mail-stats-refresh"));
      if (mailTab && !mailTab.closed) {
        mailTab.location.replace(mailUrl(thread.id));
        await loadCourse({ preserveSelection: true });
      } else {
        // Si se bloquearon las ventanas emergentes, navegar en la pestaña actual.
        window.location.assign(mailUrl(thread.id));
      }
    } catch (requestError) {
      if (mailTab && !mailTab.closed) mailTab.close();
      setError(requestError.message || "No se ha podido abrir el correo del ejercicio.");
    } finally {
      setOpeningMailId(null);
    }
  };

  const validateSelectedExplicitly = async () => {
    if (!selectedActivity || selectedActivity.is_completed || !selectedActivity.completion_condition?.automatic) return;
    const responseSchema = selectedActivity.response_schema;
    if (responseSchema && !responseDraft?.decision) {
      setError("Selecciona una respuesta antes de comprobar.");
      return;
    }

    try {
      setCheckingId(selectedActivity.id);
      setError("");
      persistActivityContext(selectedActivity);
      if (responseSchema) {
        await saveActivityResponse(
          selectedActivity.assignment_id,
          selectedActivity.task_id,
          responseDraft,
          selectedActivity.validation_result || {}
        );
      }
      await validateActivity(selectedActivity.assignment_id, selectedActivity.task_id);
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
      setError(requestError.message || "No se ha podido completar la actividad.");
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
            <span className="activity-center__eyebrow">Curso</span>
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
            <button type="button" className="activity-center__close" onClick={() => setOpen(false)} aria-label="Cerrar curso">
              <X size={19} aria-hidden="true" />
            </button>
          </div>
        </header>

        {error && <div className="activity-center__error" role="alert">{error}</div>}

        <div className="activity-center__workspace">
          <aside className="activity-center__outline" aria-label="Temas del curso">
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
                        {topic.total > 0 ? `${topic.completed}/${topic.total}` : "Sin actividades"}
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
              <div className="activity-center__empty"><RefreshCw className="is-spinning" aria-hidden="true" /><p>Cargando curso…</p></div>
            )}

            {!loading && !selectedActivity && (
              <div className="activity-center__empty"><BookOpen aria-hidden="true" /><h3>No hay actividades disponibles</h3></div>
            )}

            {selectedActivity && (
              <article className="activity-center__activity-detail">
                <div className="activity-center__detail-heading">
                  <div>
                    <span className="activity-center__unit">Tema {selectedActivity.topic_order} · {selectedActivity.topic_title}</span>
                    <h3>{selectedActivity.display_number} · {selectedActivity.title}</h3>
                    <p className="activity-center__detail-meta">Actividad {selectedActivity.course_order || selectedIndex + 1} de {activities.length}</p>
                  </div>
                  <span className={`activity-center__status${selectedActivity.is_completed ? " is-done" : ""}`}>
                    {selectedActivity.is_completed ? <Check size={14} aria-hidden="true" /> : null}
                    {selectedActivity.is_completed ? "Completada" : "Pendiente"}
                  </span>
                </div>

                <section className="activity-center__brief-card">
                  <span className="activity-center__section-label">Idea clave</span>
                  <p className="activity-center__brief-text">{selectedActivity.theory || selectedActivity.objective}</p>
                </section>

                <section className="activity-center__task-block">
                  <span className="activity-center__section-label">Información del caso</span>
                  <p className="activity-center__mail-summary">
                    {selectedActivity.mail_context
                      ? `${selectedActivity.mail_context.sender} · ${cleanMailSubject(selectedActivity.mail_context.subject)}`
                      : "Los datos y documentos del ejercicio están en el correo de AulaNómina."}
                  </p>
                  <button
                    type="button"
                    className="activity-center__mail-direct-button"
                    onClick={openSelectedMail}
                    disabled={openingMailId === selectedActivity.id}
                  >
                    {openingMailId === selectedActivity.id
                      ? <RefreshCw size={15} className="is-spinning" aria-hidden="true" />
                      : <Mail size={15} aria-hidden="true" />}
                    {openingMailId === selectedActivity.id ? "Abriendo correo…" : "Abrir correo del ejercicio"}
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </section>

                <section className="activity-center__task-block">
                  <span className="activity-center__section-label">Hazlo en AulaNomina</span>
                  <p>{selectedActivity.instructions}</p>
                  {moduleActionLabel && (
                    <button type="button" className="activity-center__quiet-button" onClick={openSelectedModule}>
                      {moduleActionLabel}
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  )}
                </section>

                {selectedActivity.response_schema && (
                  <ActivityResponseForm
                    schema={selectedActivity.response_schema}
                    value={responseDraft}
                    onChange={setResponseDraft}
                    disabled={selectedActivity.is_completed || checkingId === selectedActivity.id}
                  />
                )}

                {selectedActivity.is_completed && (
                  <div className="activity-center__validation-feedback is-success">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <div><strong>Actividad completada</strong><span>Puedes continuar con la siguiente.</span></div>
                  </div>
                )}

                {!selectedActivity.is_completed && failedMessages.length > 0 && (
                  <div className="activity-center__validation-feedback is-error">
                    <XCircle size={16} aria-hidden="true" />
                    <div>
                      <strong>Revisa la gestión</strong>
                      {failedMessages.map((message) => <span key={message}>{message}</span>)}
                    </div>
                  </div>
                )}

                {!selectedActivity.is_completed && selectedActivity.completion_condition?.automatic && requiresExplicitReview(selectedActivity) && (
                  <section className="activity-center__manual-action">
                    <div>
                      <strong>Cuando termines, comprueba la actividad</strong>
                      <span>AulaNomina revisará los datos que has guardado.</span>
                    </div>
                    <button type="button" className="activity-center__quiet-button" onClick={validateSelectedExplicitly} disabled={checkingId === selectedActivity.id}>
                      <Check size={15} aria-hidden="true" />
                      {checkingId === selectedActivity.id ? "Comprobando…" : "Comprobar"}
                    </button>
                  </section>
                )}

                {!selectedActivity.is_completed && selectedActivity.completion_condition?.automatic && !requiresExplicitReview(selectedActivity) && (
                  <div className="activity-center__validation-feedback">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <div><strong>Se comprobará al guardar la gestión</strong><span>Vuelve al curso después de realizar la operación.</span></div>
                  </div>
                )}

                {!selectedActivity.is_completed && !selectedActivity.completion_condition?.automatic && (
                  <section className="activity-center__manual-action">
                    <div><strong>¿Has terminado?</strong></div>
                    <button type="button" className="activity-center__quiet-button" onClick={completeSelectedManually} disabled={checkingId === selectedActivity.id}>
                      <Check size={15} aria-hidden="true" />
                      {checkingId === selectedActivity.id ? "Guardando…" : "Marcar como completada"}
                    </button>
                  </section>
                )}

                <nav className="activity-center__navigation" aria-label="Navegación entre actividades">
                  <button type="button" onClick={() => selectActivity(previousActivity)} disabled={!previousActivity}>
                    <ArrowLeft size={15} aria-hidden="true" />
                    <span>Anterior</span>
                  </button>
                  <span className="activity-center__navigation-position">
                    {selectedActivity.course_order || selectedIndex + 1} / {activities.length}
                  </span>
                  <button
                    type="button"
                    className={selectedActivity.is_completed ? "is-primary" : ""}
                    onClick={() => selectActivity(nextActivity)}
                    disabled={!nextActivity}
                  >
                    <span>Siguiente</span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </nav>
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
        <span>Curso</span>
        <strong className="activities-global-launcher__counter" aria-label={moduleProgressLabel}>
          {moduleProgress}
        </strong>
      </button>
      {overlay}
    </>
  );
}
