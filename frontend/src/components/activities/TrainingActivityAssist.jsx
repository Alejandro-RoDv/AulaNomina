import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Clock3, History, Lightbulb, LoaderCircle, Route } from "lucide-react";

import {
  fetchActivityAttempts,
  fetchActivityCourse,
  requestActivityHint,
} from "../../services/activityApi.js";
import { fetchAssignmentScenario } from "../../services/caseScenarioApi.js";
import "./trainingActivityAssist.css";

const ACTIVE_CASE_CONTEXT_KEY = "aulanomina:active-case-context";

function readContext() {
  try {
    const value = JSON.parse(window.localStorage.getItem(ACTIVE_CASE_CONTEXT_KEY) || "null");
    if (!value?.assignmentId || !value?.taskId) return null;
    return value;
  } catch {
    return null;
  }
}

function helpStorageKey(context) {
  return context ? `aulanomina:activity-help:${context.assignmentId}:${context.taskId}` : null;
}

function readStoredHelp(context) {
  const key = helpStorageKey(context);
  if (!key) return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeStoredHelp(context, items) {
  const key = helpStorageKey(context);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // El historial visual de ayuda es accesorio; el contador real permanece en backend.
  }
}

function clearStoredHelp(context) {
  const key = helpStorageKey(context);
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Sin almacenamiento local, el backend continúa controlando las ayudas utilizadas.
  }
}

function formatAttemptDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nextHelpLabel(hintsUsed) {
  if (hintsUsed <= 0) return "Pista 1";
  if (hintsUsed === 1) return "Pista 2";
  if (hintsUsed === 2) return "Ver procedimiento";
  return "Ayuda consultada";
}

function HelpIcon({ kind }) {
  if (kind === "procedure") return <Route size={16} aria-hidden="true" />;
  return <Lightbulb size={16} aria-hidden="true" />;
}

export default function TrainingActivityAssist() {
  const [target, setTarget] = useState(null);
  const [context, setContext] = useState(readContext);
  const [activity, setActivity] = useState(null);
  const [scenarioStep, setScenarioStep] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [revealedHelp, setRevealedHelp] = useState(() => readStoredHelp(readContext()));
  const [loading, setLoading] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [error, setError] = useState("");

  const loadActivityState = useCallback(async (activeContext = context) => {
    if (!activeContext?.assignmentId || !activeContext?.taskId) return;
    try {
      setLoading(true);
      setError("");
      const [course, scenario, attemptRows] = await Promise.all([
        fetchActivityCourse(),
        fetchAssignmentScenario(activeContext.assignmentId),
        fetchActivityAttempts(activeContext.assignmentId, activeContext.taskId),
      ]);
      const nextActivity = (course?.topics || [])
        .flatMap((topic) => topic.activities || [])
        .find((item) => Number(item.assignment_id) === Number(activeContext.assignmentId)
          && Number(item.task_id) === Number(activeContext.taskId));
      const nextStep = (scenario?.steps || [])
        .find((step) => Number(step.task_id) === Number(activeContext.taskId));

      setActivity(nextActivity || null);
      setScenarioStep(nextStep || null);
      setAttempts(attemptRows || []);

      const backendHintsUsed = Number(nextStep?.hints_used || 0);
      if (backendHintsUsed === 0) {
        clearStoredHelp(activeContext);
        setRevealedHelp([]);
      } else {
        const stored = readStoredHelp(activeContext).slice(0, backendHintsUsed);
        setRevealedHelp(stored);
      }
    } catch (requestError) {
      setError(requestError.message || "No se ha podido cargar la ayuda de la actividad.");
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    const syncTarget = () => {
      const nextTarget = document.querySelector(".activity-center__help");
      setTarget((current) => current === nextTarget ? current : nextTarget);
    };

    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!target) return undefined;
    const legacyHint = [...target.querySelectorAll(".activity-center__help-item")]
      .find((item) => item.querySelector("summary")?.textContent?.trim() === "Pista");
    if (!legacyHint) return undefined;
    const previousDisplay = legacyHint.style.display;
    legacyHint.style.display = "none";
    return () => {
      legacyHint.style.display = previousDisplay;
    };
  }, [target, context?.assignmentId, context?.taskId]);

  useEffect(() => {
    const handleContext = (event) => {
      const next = event.detail?.assignmentId && event.detail?.taskId ? event.detail : readContext();
      if (!next) return;
      setContext(next);
      setRevealedHelp(readStoredHelp(next));
      loadActivityState(next);
    };
    const handleRefresh = () => loadActivityState(readContext());

    window.addEventListener("aulanomina-case-context", handleContext);
    window.addEventListener("aulanomina-activities-refresh", handleRefresh);
    window.addEventListener("aulanomina-case-operation-feedback", handleRefresh);
    return () => {
      window.removeEventListener("aulanomina-case-context", handleContext);
      window.removeEventListener("aulanomina-activities-refresh", handleRefresh);
      window.removeEventListener("aulanomina-case-operation-feedback", handleRefresh);
    };
  }, [loadActivityState]);

  useEffect(() => {
    if (target && context) loadActivityState(context);
  }, [target, context?.assignmentId, context?.taskId, loadActivityState]);

  const trainingCode = String(activity?.training_code || scenarioStep?.trigger_condition?.training_code || "").toUpperCase();
  const evaluationMode = /^C\d{2}$/.test(trainingCode);
  const hintsUsed = Number(scenarioStep?.hints_used || 0);
  const visibleAttempts = useMemo(() => (attempts || []).slice(0, 3), [attempts]);

  const revealNextHelp = async () => {
    if (!context || evaluationMode || hintsUsed >= 3) return;
    try {
      setHintLoading(true);
      setError("");
      const result = await requestActivityHint(context.assignmentId, context.taskId);
      const nextItems = [
        ...revealedHelp.filter((item) => Number(item.level) !== Number(result.level)),
        result,
      ].sort((left, right) => Number(left.level) - Number(right.level));
      setRevealedHelp(nextItems);
      writeStoredHelp(context, nextItems);
      await loadActivityState(context);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido mostrar la siguiente ayuda.");
    } finally {
      setHintLoading(false);
    }
  };

  if (!target || !context) return null;

  return createPortal(
    <div className="training-activity-assist">
      <div className="training-activity-assist__heading">
        <div>
          <strong>Ayuda progresiva</strong>
          <span>{evaluationMode ? "Evaluación práctica" : `${hintsUsed}/3 ayudas utilizadas`}</span>
        </div>
        {loading && <LoaderCircle size={16} className="is-spinning" aria-label="Actualizando ayuda" />}
      </div>

      {evaluationMode ? (
        <div className="training-activity-assist__evaluation-note">
          <History size={16} aria-hidden="true" />
          <span>Las evaluaciones C01–C06 no muestran pistas ni procedimiento durante la realización.</span>
        </div>
      ) : (
        <>
          {revealedHelp.length > 0 && (
            <div className="training-activity-assist__revealed">
              {revealedHelp.map((item) => (
                <article key={`${item.level}-${item.kind}`} className={item.kind === "procedure" ? "is-procedure" : ""}>
                  <HelpIcon kind={item.kind} />
                  <div>
                    <strong>{item.kind === "procedure" ? "Procedimiento" : `Pista ${item.level}`}</strong>
                    <p>{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          )}

          <button
            type="button"
            className="training-activity-assist__help-button"
            onClick={revealNextHelp}
            disabled={hintLoading || hintsUsed >= 3}
          >
            {hintLoading ? <LoaderCircle size={15} className="is-spinning" aria-hidden="true" /> : <Lightbulb size={15} aria-hidden="true" />}
            <span>{hintLoading ? "Cargando ayuda…" : nextHelpLabel(hintsUsed)}</span>
            {!hintLoading && hintsUsed < 3 && <ChevronRight size={15} aria-hidden="true" />}
          </button>
        </>
      )}

      {error && <div className="training-activity-assist__error">{error}</div>}

      <details className="training-activity-assist__attempts">
        <summary>
          <span><History size={15} aria-hidden="true" /> Historial de intentos</span>
          <strong>{attempts.length}</strong>
        </summary>
        <div className="training-activity-assist__attempt-list">
          {visibleAttempts.length ? visibleAttempts.map((attempt) => (
            <div key={attempt.id} className="training-activity-assist__attempt-row">
              <span>Intento {attempt.attempt_number}</span>
              <strong>{attempt.score == null ? "Sin puntuación" : `${attempt.score}%`}</strong>
              <small><Clock3 size={12} aria-hidden="true" /> {formatAttemptDate(attempt.created_at)}</small>
            </div>
          )) : (
            <p>Todavía no hay comprobaciones registradas para esta actividad.</p>
          )}
        </div>
      </details>
    </div>,
    target
  );
}
