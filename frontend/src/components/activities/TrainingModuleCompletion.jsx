import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CheckCircle2, X } from "lucide-react";

import { fetchActivityCourse } from "../../services/activityApi.js";
import "./trainingModuleCompletion.css";


function completedTopicKeys(course) {
  return new Set(
    (course?.topics || [])
      .filter((topic) => Number(topic.total || 0) > 0 && Number(topic.completed || 0) === Number(topic.total || 0))
      .map((topic) => topic.key)
  );
}

function openActivitiesCenter() {
  const launcher = document.querySelector(".activities-global-launcher");
  if (launcher instanceof HTMLElement) launcher.click();
}

function topicHighlights(topic) {
  const seen = new Set();
  const rows = [];
  for (const activity of topic?.activities || []) {
    const label = String(activity.title || "").trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    rows.push(label);
    if (rows.length >= 4) break;
  }
  return rows;
}

export default function TrainingModuleCompletion() {
  const [course, setCourse] = useState(null);
  const [completedTopic, setCompletedTopic] = useState(null);
  const previousCompletedRef = useRef(null);

  const loadCourse = useCallback(async ({ detectCompletion = true } = {}) => {
    try {
      const nextCourse = await fetchActivityCourse();
      const nextCompleted = completedTopicKeys(nextCourse);

      if (previousCompletedRef.current === null) {
        previousCompletedRef.current = nextCompleted;
        setCourse(nextCourse);
        return;
      }

      if (detectCompletion) {
        const newlyCompleted = (nextCourse?.topics || [])
          .filter((topic) => nextCompleted.has(topic.key) && !previousCompletedRef.current.has(topic.key))
          .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
        if (newlyCompleted.length) setCompletedTopic(newlyCompleted[0]);
      }

      previousCompletedRef.current = nextCompleted;
      setCourse(nextCourse);
    } catch {
      // El resumen de cierre no debe interferir con el trabajo del alumno.
    }
  }, []);

  useEffect(() => {
    loadCourse({ detectCompletion: false });
    const handleRefresh = () => loadCourse({ detectCompletion: true });
    window.addEventListener("aulanomina-case-operation-feedback", handleRefresh);
    window.addEventListener("aulanomina-activities-refresh", handleRefresh);
    return () => {
      window.removeEventListener("aulanomina-case-operation-feedback", handleRefresh);
      window.removeEventListener("aulanomina-activities-refresh", handleRefresh);
    };
  }, [loadCourse]);

  useEffect(() => {
    if (!completedTopic) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape") setCompletedTopic(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [completedTopic]);

  const nextTopic = useMemo(() => {
    if (!completedTopic) return null;
    return (course?.topics || [])
      .filter((topic) => Number(topic.order || 0) > Number(completedTopic.order || 0) && Number(topic.total || 0) > 0)
      .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))[0] || null;
  }, [course, completedTopic]);

  if (!completedTopic) return null;

  const highlights = topicHighlights(completedTopic);
  return createPortal(
    <div className="training-module-completion__backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setCompletedTopic(null);
    }}>
      <section className="training-module-completion" role="dialog" aria-modal="true" aria-labelledby="training-module-completion-title">
        <button type="button" className="training-module-completion__close" onClick={() => setCompletedTopic(null)} aria-label="Cerrar resumen">
          <X size={18} aria-hidden="true" />
        </button>

        <div className="training-module-completion__icon" aria-hidden="true">
          <CheckCircle2 size={28} />
        </div>
        <span className="training-module-completion__eyebrow">Bloque completado</span>
        <h2 id="training-module-completion-title">{completedTopic.title}</h2>
        <p>Has completado {completedTopic.completed}/{completedTopic.total} actividades de este bloque.</p>

        {highlights.length > 0 && (
          <div className="training-module-completion__worked">
            <strong>Has trabajado</strong>
            <ul>
              {highlights.map((label) => <li key={label}>{label}</li>)}
            </ul>
          </div>
        )}

        <div className="training-module-completion__result">
          <span>Progreso del bloque</span>
          <strong>100%</strong>
        </div>

        <button type="button" className="training-module-completion__continue" onClick={() => {
          setCompletedTopic(null);
          window.setTimeout(openActivitiesCenter, 0);
        }}>
          <span>{nextTopic ? `Continuar con ${nextTopic.title}` : "Revisar curso"}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </section>
    </div>,
    document.body
  );
}
