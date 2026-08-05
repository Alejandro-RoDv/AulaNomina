import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  LoaderCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  fetchAssignmentScenario,
  recordAssignmentContextEvent,
  resetAssignmentScenario,
  startAssignmentScenario,
  updateAssignmentScenarioStep,
  validateAssignmentScenarioStep,
} from "../../services/caseScenarioApi.js";
import { getCaseActionLabel, openCaseModule } from "../../utils/caseNavigation.js";
import { LAST_CASE_FEEDBACK_KEY } from "../../utils/caseOperationBridge.js";
import "./mailScenario.css";


const ASSIGNMENT_STATUS_LABELS = {
  assigned: "Sin iniciar",
  in_progress: "En curso",
  submitted: "Completado",
  reviewed: "Revisado",
  approved: "Aprobado",
  needs_revision: "Requiere revisión",
};

const STEP_STATUS_LABELS = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completado",
  failed: "Con error",
};

const DIFFICULTY_LABELS = {
  basic: "Básico",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};


function stepClassName(step, currentTaskOrder) {
  const classes = ["mail-scenario-step"];
  if (step.task_order === currentTaskOrder && step.progress_status !== "completed") classes.push("is-current");
  if (step.progress_status === "completed") classes.push("is-completed");
  if (step.progress_status === "failed") classes.push("is-failed");
  return classes.join(" ");
}


export default function MailScenarioPanel({ message, onScenarioChanged }) {
  const assignmentId = message?.caseAssignmentId || null;
  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [validationNotice, setValidationNotice] = useState("");
  const [notes, setNotes] = useState({});
  const [expanded, setExpanded] = useState(false);

  const loadScenario = useCallback(async () => {
    if (!assignmentId) {
      setScenario(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await fetchAssignmentScenario(assignmentId);
      setScenario(data);
    } catch (requestError) {
      setScenario(null);
      setError(requestError.message || "No se ha podido cargar la guía del caso.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    setScenario(null);
    setNotes({});
    setError("");
    setValidationNotice("");
    setExpanded(false);
    loadScenario();
  }, [loadScenario]);

  useEffect(() => {
    if (!assignmentId) return undefined;

    const applyFeedback = (detail) => {
      if (Number(detail?.assignmentId) !== Number(assignmentId)) return;
      if (detail.scenario) setScenario(detail.scenario);
      if (detail.validation?.message) setValidationNotice(detail.validation.message);
      else if (detail.operationStatus === "error") {
        setValidationNotice("La operación se ha registrado con error. Revisa el último mensaje del hilo.");
      }
      if (detail.scenario && onScenarioChanged) {
        void onScenarioChanged(
          detail.scenario,
          detail.operationStatus === "error"
            ? "Operación registrada con error. Revisa la respuesta recibida."
            : "La operación del caso se ha comprobado."
        );
      }
    };

    const handleFeedback = (event) => applyFeedback(event.detail);
    const handleStorage = (event) => {
      if (event.key !== LAST_CASE_FEEDBACK_KEY || !event.newValue) return;
      try {
        applyFeedback(JSON.parse(event.newValue));
      } catch {
        // Ignora mensajes de sincronización corruptos.
      }
    };

    window.addEventListener("aulanomina-case-operation-feedback", handleFeedback);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("aulanomina-case-operation-feedback", handleFeedback);
      window.removeEventListener("storage", handleStorage);
    };
  }, [assignmentId, onScenarioChanged]);

  const currentStep = useMemo(() => {
    if (!scenario) return null;
    return scenario.steps.find(
      (step) => step.task_order === scenario.current_task_order && step.progress_status !== "completed"
    ) || scenario.steps.find((step) => step.progress_status !== "completed") || null;
  }, [scenario]);

  const publishChange = async (nextScenario, successMessage) => {
    setScenario(nextScenario);
    if (onScenarioChanged) await onScenarioChanged(nextScenario, successMessage);
  };

  const startScenario = async () => {
    if (!assignmentId) return;
    setBusy("start");
    setError("");
    setValidationNotice("");
    try {
      const nextScenario = await startAssignmentScenario(assignmentId);
      await publishChange(nextScenario, "Seguimiento iniciado. Ya puedes trabajar sobre el primer punto.");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido iniciar el seguimiento.");
    } finally {
      setBusy("");
    }
  };

  const updateStep = async (step, status) => {
    if (!assignmentId) return;
    setBusy(`step-${step.task_id}-${status}`);
    setError("");
    setValidationNotice("");
    try {
      const nextScenario = await updateAssignmentScenarioStep(assignmentId, step.task_id, {
        status,
        student_notes: notes[step.task_id]?.trim() || null,
        validation_result: {
          ...(step.validation_result || {}),
          mode: "manual_demo",
          confirmed_from_mail: true,
          confirmed_at: new Date().toISOString(),
        },
      });
      setNotes((current) => ({ ...current, [step.task_id]: "" }));
      await publishChange(
        nextScenario,
        status === "completed"
          ? "Punto confirmado manualmente."
          : "Se ha registrado una incidencia en este punto."
      );
    } catch (requestError) {
      setError(requestError.message || "No se ha podido actualizar la guía.");
    } finally {
      setBusy("");
    }
  };

  const openStepModule = async (step) => {
    if (!assignmentId || !scenario) return;
    setError("");
    setValidationNotice("");

    const context = {
      actionCode: step.expected_action,
      moduleCode: step.module,
      assignmentId,
      taskId: step.task_id,
      scenarioCode: scenario.scenario_code,
      employeeName: scenario.initial_state?.employee || scenario.initial_state?.substitute || null,
    };
    const openedWindow = openCaseModule(context);
    if (!openedWindow) {
      setError("El navegador ha bloqueado la apertura del módulo. Permite las ventanas emergentes para AulaNomina.");
      return;
    }

    setBusy(`open-${step.task_id}`);
    try {
      const result = await recordAssignmentContextEvent(assignmentId, {
        task_id: step.task_id,
        event_type: "module_opened",
        action_code: step.expected_action,
        target: step.module,
        operation_status: "opened",
        auto_validate: false,
        metadata: { source: "mail", scenario_code: scenario.scenario_code },
      });
      setScenario(result.scenario);
    } catch (requestError) {
      setError(requestError.message || "El módulo se ha abierto, pero no se ha podido registrar la navegación.");
    } finally {
      setBusy("");
    }
  };

  const validateStep = async (step) => {
    if (!assignmentId) return;
    setBusy(`validate-${step.task_id}`);
    setError("");
    setValidationNotice("");
    try {
      const result = await validateAssignmentScenarioStep(assignmentId, step.task_id);
      setValidationNotice(result.message);
      await publishChange(
        result.scenario,
        result.passed ? "Punto comprobado automáticamente." : "Comprobación ejecutada."
      );
    } catch (requestError) {
      setError(requestError.message || "No se ha podido comprobar automáticamente este punto.");
    } finally {
      setBusy("");
    }
  };

  const resetProgress = async () => {
    if (!assignmentId) return;
    if (!window.confirm("Se reiniciará el seguimiento de este caso. ¿Continuar?")) return;

    setBusy("reset");
    setError("");
    setValidationNotice("");
    try {
      const nextScenario = await resetAssignmentScenario(assignmentId);
      setNotes({});
      await publishChange(nextScenario, "Seguimiento del caso reiniciado.");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido reiniciar el seguimiento.");
    } finally {
      setBusy("");
    }
  };

  if (!assignmentId) return null;

  if (loading) {
    return (
      <div className="mail-scenario-loading">
        <LoaderCircle className="mail-spinner" size={17} /> Cargando guía opcional...
      </div>
    );
  }

  if (error && !scenario) {
    return (
      <div className="mail-scenario-error" role="alert">
        <p>{error}</p>
        <button type="button" className="mail-scenario-retry" onClick={loadScenario}>Reintentar</button>
      </div>
    );
  }

  if (!scenario) return null;

  const isLocked = ["reviewed", "approved"].includes(scenario.assignment_status);
  const isFinished = scenario.completion_percentage === 100;
  const canAct = !isLocked && !isFinished && currentStep && scenario.assignment_status !== "assigned";
  const automaticChecks = currentStep?.validation_result?.mode === "automatic"
    ? currentStep.validation_result.checks || []
    : [];

  return (
    <section className={`mail-scenario-panel ${expanded ? "is-expanded" : ""}`} aria-label="Guía opcional del caso">
      <header className="mail-scenario-panel__header">
        <div className="mail-scenario-panel__main">
          <span className="mail-scenario-panel__eyebrow">Guía opcional</span>
          <div className="mail-scenario-panel__title-row">
            <h3>
              {isFinished
                ? "Caso completado"
                : currentStep
                  ? `Siguiente punto: ${currentStep.title}`
                  : scenario.title}
            </h3>
            <span className="mail-scenario-panel__badge">
              {ASSIGNMENT_STATUS_LABELS[scenario.assignment_status] || scenario.assignment_status}
            </span>
          </div>
          <p>
            {scenario.assignment_status === "assigned"
              ? "Lee primero el correo, interpreta la solicitud y utiliza esta guía solo como apoyo."
              : isFinished
                ? scenario.completion_message || "Se han completado todos los puntos previstos."
                : currentStep?.description || "Continúa con el siguiente punto del caso."}
          </p>
          <div className="mail-scenario-panel__meta">
            <span>{scenario.completed_steps} de {scenario.total_steps} puntos</span>
            <span>{DIFFICULTY_LABELS[scenario.difficulty] || scenario.difficulty}</span>
            <strong>{scenario.completion_percentage}%</strong>
          </div>
        </div>
        <button
          type="button"
          className="mail-scenario-toggle"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {expanded ? "Ocultar detalle" : "Ver guía completa"}
        </button>
      </header>

      <div className="mail-scenario-progress__track" aria-label={`Progreso ${scenario.completion_percentage}%`}>
        <div className="mail-scenario-progress__fill" style={{ width: `${scenario.completion_percentage}%` }} />
      </div>

      {error && (
        <div className="mail-scenario-error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {validationNotice && (
        <div className="mail-scenario-validation-notice" role="status">
          <ShieldCheck size={15} /> {validationNotice}
        </div>
      )}

      {scenario.assignment_status === "assigned" && (
        <div className="mail-scenario-quick-actions">
          <button type="button" className="mail-scenario-primary" onClick={startScenario} disabled={Boolean(busy)}>
            {busy === "start" ? <LoaderCircle className="mail-spinner" size={15} /> : <Play size={15} />}
            Iniciar seguimiento
          </button>
        </div>
      )}

      {canAct && (
        <div className="mail-scenario-current">
          {currentStep.expected_result && (
            <small>Referencia: {currentStep.expected_result}</small>
          )}
          {automaticChecks.length > 0 && (
            <div className="mail-scenario-checks">
              {automaticChecks.map((check, index) => (
                <span key={`${check.rule_type}-${index}`} className={check.passed ? "is-passed" : "is-pending"}>
                  {check.message}
                </span>
              ))}
            </div>
          )}
          <div className="mail-scenario-quick-actions">
            <button
              type="button"
              className="mail-scenario-primary"
              onClick={() => openStepModule(currentStep)}
              disabled={Boolean(busy)}
            >
              {busy === `open-${currentStep.task_id}`
                ? <LoaderCircle className="mail-spinner" size={15} />
                : <ExternalLink size={15} />}
              {getCaseActionLabel(currentStep.expected_action, currentStep.module)}
            </button>
            <button type="button" onClick={() => validateStep(currentStep)} disabled={Boolean(busy)}>
              {busy === `validate-${currentStep.task_id}`
                ? <LoaderCircle className="mail-spinner" size={15} />
                : <ShieldCheck size={15} />}
              Comprobar resultado
            </button>
            {currentStep.progress_status === "failed" && (
              <button type="button" onClick={() => updateStep(currentStep, "in_progress")} disabled={Boolean(busy)}>
                <XCircle size={15} /> Reabrir
              </button>
            )}
          </div>
        </div>
      )}

      {expanded && (
        <div className="mail-scenario-details">
          <h4>Recorrido completo</h4>
          <div className="mail-scenario-steps">
            {scenario.steps.map((step) => (
              <article key={step.task_id} className={stepClassName(step, scenario.current_task_order)}>
                <span className="mail-scenario-step__index">
                  {step.progress_status === "completed" ? <CheckCircle2 size={14} /> : step.task_order}
                </span>
                <div className="mail-scenario-step__content">
                  <strong>{step.title}</strong>
                  {step.description && <p>{step.description}</p>}
                  {step.expected_result && <small>Resultado de referencia: {step.expected_result}</small>}
                </div>
                <span className={`mail-scenario-step__status mail-scenario-step__status--${step.progress_status}`}>
                  {STEP_STATUS_LABELS[step.progress_status] || step.progress_status}
                </span>
              </article>
            ))}
          </div>

          {canAct && (
            <div className="mail-scenario-manual-controls">
              <h4>Controles auxiliares</h4>
              <p>Úsalos únicamente cuando la comprobación automática no sea suficiente.</p>
              <textarea
                value={notes[currentStep.task_id] || ""}
                onChange={(event) => setNotes((current) => ({ ...current, [currentStep.task_id]: event.target.value }))}
                placeholder="Anotación opcional sobre la acción realizada..."
              />
              <div className="mail-scenario-quick-actions">
                <button type="button" onClick={() => updateStep(currentStep, "completed")} disabled={Boolean(busy)}>
                  {busy === `step-${currentStep.task_id}-completed`
                    ? <LoaderCircle className="mail-spinner" size={15} />
                    : <CheckCircle2 size={15} />}
                  Confirmar manualmente
                </button>
                <button type="button" onClick={() => updateStep(currentStep, "failed")} disabled={Boolean(busy)}>
                  {busy === `step-${currentStep.task_id}-failed`
                    ? <LoaderCircle className="mail-spinner" size={15} />
                    : <AlertTriangle size={15} />}
                  Registrar incidencia
                </button>
              </div>
            </div>
          )}

          {!isLocked && scenario.assignment_status !== "assigned" && (
            <div className="mail-scenario-footer">
              <button type="button" onClick={resetProgress} disabled={Boolean(busy)}>
                {busy === "reset" ? <LoaderCircle className="mail-spinner" size={15} /> : <RotateCcw size={15} />}
                Reiniciar seguimiento
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
