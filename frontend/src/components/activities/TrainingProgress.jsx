import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BarChart3, BookOpen, CheckCircle2, RefreshCw, X } from "lucide-react";

import { fetchActivityCourse } from "../../services/activityApi.js";
import "./trainingProgress.css";

function flattenActivities(course) {
  return (course?.topics || []).flatMap((topic) => topic.activities || []);
}

function latestCompletedActivity(course) {
  const completed = flattenActivities(course)
    .filter((activity) => activity?.is_completed)
    .sort((left, right) => Number(right.course_order || 0) - Number(left.course_order || 0));
  return completed[0] || null;
}

function currentActivity(course) {
  const activities = flattenActivities(course);
  const currentId = course?.course?.current_activity_id;
  return activities.find((activity) => activity.id === currentId)
    || activities.find((activity) => !activity.is_completed)
    || activities[activities.length - 1]
    || null;
}

function openActivitiesCenter() {
  const launcher = document.querySelector(".activities-global-launcher");
  if (launcher instanceof HTMLElement) launcher.click();
}

export default function TrainingProgress() {
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadProgress = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setCourse(await fetchActivityCourse());
    } catch (requestError) {
      setError(requestError.message || "No se ha podido cargar tu progreso.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgress();
    const handleRefresh = () => loadProgress();
    window.addEventListener("aulanomina-case-operation-feedback", handleRefresh);
    window.addEventListener("aulanomina-activities-refresh", handleRefresh);
    return () => {
      window.removeEventListener("aulanomina-case-operation-feedback", handleRefresh);
      window.removeEventListener("aulanomina-activities-refresh", handleRefresh);
    };
  }, [loadProgress]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const latestCompleted = useMemo(() => latestCompletedActivity(course), [course]);
  const current = useMemo(() => currentActivity(course), [course]);
  const summary = course?.course || {};

  const continueCourse = () => {
    setOpen(false);
    window.setTimeout(openActivitiesCenter, 0);
  };

  const overlay = open ? createPortal(
    <div className="training-progress__backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section className="training-progress" role="dialog" aria-modal="true" aria-labelledby="training-progress-title">
        <header className="training-progress__header">
          <div>
            <span>Formación</span>
            <h2 id="training-progress-title">Mi progreso</h2>
            <p>{summary.title || "Curso práctico de gestión laboral"}</p>
          </div>
          <div className="training-progress__header-actions">
            <button type="button" onClick={loadProgress} disabled={loading}>
              <RefreshCw size={16} className={loading ? "is-spinning" : ""} aria-hidden="true" />
              Actualizar
            </button>
            <button type="button" className="training-progress__close" onClick={() => setOpen(false)} aria-label="Cerrar progreso">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {error && <div className="training-progress__error" role="alert">{error}</div>}

        <div className="training-progress__body">
          <section className="training-progress__overview">
            <div className="training-progress__overview-copy">
              <span>Progreso general</span>
              <strong>{summary.progress_percentage || 0}%</strong>
              <small>{summary.completed || 0} de {summary.total || 0} prácticas completadas</small>
            </div>
            <div className="training-progress__ring" style={{ "--training-progress": `${summary.progress_percentage || 0}%` }}>
              <span>{summary.progress_percentage || 0}%</span>
            </div>
          </section>

          <div className="training-progress__track" aria-hidden="true">
            <span style={{ width: `${summary.progress_percentage || 0}%` }} />
          </div>

          <section className="training-progress__modules" aria-label="Progreso por módulo">
            <div className="training-progress__section-heading">
              <h3>Progreso por bloque</h3>
              <span>{course?.topics?.length || 0} bloques formativos</span>
            </div>
            <div className="training-progress__module-list">
              {(course?.topics || []).map((topic) => {
                const complete = topic.total > 0 && topic.completed === topic.total;
                return (
                  <div key={topic.key} className="training-progress__module-row">
                    <div className="training-progress__module-title">
                      {complete ? <CheckCircle2 size={17} aria-hidden="true" /> : <BookOpen size={17} aria-hidden="true" />}
                      <span>{topic.title}</span>
                    </div>
                    <div className="training-progress__module-bar" aria-hidden="true">
                      <span style={{ width: `${topic.progress_percentage || 0}%` }} />
                    </div>
                    <strong>{topic.completed || 0}/{topic.total || 0}</strong>
                    <span>{topic.progress_percentage || 0}%</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="training-progress__continuation">
            <div className="training-progress__activity-card">
              <span>Última actividad completada</span>
              {latestCompleted ? (
                <>
                  <strong>{latestCompleted.display_number} · {latestCompleted.title}</strong>
                  <small>{latestCompleted.topic_title}</small>
                </>
              ) : (
                <strong>Todavía no has completado ninguna actividad.</strong>
              )}
            </div>

            <div className="training-progress__activity-card is-current">
              <span>{summary.progress_percentage >= 100 ? "Curso completado" : "Continuar desde"}</span>
              {current ? (
                <>
                  <strong>{current.display_number} · {current.title}</strong>
                  <small>{current.topic_title}</small>
                </>
              ) : (
                <strong>No hay actividades disponibles.</strong>
              )}
            </div>
          </section>
        </div>

        <footer className="training-progress__footer">
          <span>{summary.pending || 0} prácticas pendientes</span>
          <button type="button" onClick={continueCourse} disabled={!current}>
            {summary.progress_percentage >= 100 ? "Revisar curso" : "Continuar curso"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </footer>
      </section>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button type="button" className="training-progress__launcher" onClick={() => {
        setOpen(true);
        loadProgress();
      }} aria-haspopup="dialog" aria-expanded={open}>
        <BarChart3 size={16} aria-hidden="true" />
        <span>Mi progreso</span>
        <strong>{summary.progress_percentage ?? "—"}%</strong>
      </button>
      {overlay}
    </>
  );
}
