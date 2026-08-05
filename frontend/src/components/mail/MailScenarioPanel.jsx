import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
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
import "./mailScenario.css";


const ASSIGNMENT_STATUS_LABELS = {
  assigned: "Pendiente de iniciar",
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
      setError(requestError.message || "No se ha podido cargar el caso guiado.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    setScenario(null);
    setNotes({});
    setError("");
    setValidationNotice("");
    loadScenario();
  }, [loadScenario]);

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
      await publishChange(nextScenario, "Caso iniciado. El primer paso ya está en curso.");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido iniciar el caso.");
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
          ? "Paso confirmado manualmente."
          : "Se ha registrado una incidencia en el paso."
      );
    } catch (requestError) {
      setError(requestError.message || "No se ha podido actualizar el paso.");
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
      const nextScenario = await recordAssignmentContextEvent(assignmentId, {
        task_id: step.task_id,
        event_type: "module_opened",
        action_code: step.expected_action,
        target: step.module,
        metadata: { source: "mail", scenario_code: scenario.scenario_code },
      });
      setScenario(nextScenario);
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
        result.passed ? "Paso validado automáticamente." : "Validación automática ejecutada."
      );
    } catch (requestError) {
      setError(requestError.message || "No se ha podido validar automáticamente el paso.");
    } finally {
      setBusy("");
    }
  };

  const resetProgress = async () => {
    if (!assignmentId) return;
    if (!window.confirm("Se reiniciará el progreso de este caso. ¿Continuar?")) return;

    setBusy("reset");
    setError("");
    setValidationNotice("");
    try {
      const nextScenario = await resetAssignmentScenario(assignmentId);
      setNotes({});
      await publishChange(nextScenario, "Progreso del caso reiniciado.");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido reiniciar el caso.");
    } finally {
      setBusy("");
    }
  };

  if (!assignmentId) return null;

  if (loading) {
    return (
      <div className="mail-scenario-loading">
        <LoaderCircle className="mail-spinner" size={17} /> Cargando caso práctico guiado...
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

  return (
    <section className="mail-scenario-panel" aria-label="Progreso del caso práctico">
      <header className="mail-scenario-panel__header">
        <div>
          <span className="mail-scenario-panel__eyebrow">Caso práctico guiado</span>
          <h3>{scenario.title}</h3>
          {scenario.description && <p>{scenario.description}</p>}
        </div>
        <span className="mail-scenario-panel__badge">
          {ASSIGNMENT_STATUS_LABELS[scenario.assignment_status] || scenario.assignment_status}
        </span>
      </header>

      <div className="mail-scenario-summary">
        <div><span>Asignado a</span><strong>{scenario.assignee_name}</strong></div>
        <div><span>Dificultad</span><strong>{DIFFICULTY_LABELS[scenario.difficulty] || scenario.difficulty}</strong></div>
        <div><span>Avance</span><strong>{scenario.completed_steps} de {scenario.total_steps} pasos</strong></div>
      </div>

      <div className="mail-scenario-progress">
        <div className="mail-scenario-progress__labels">
          <span>Progreso del ejercicio</span>
          <strong>{scenario.completion_percentage}%</strong>
        </div>
        <div className="mail-scenario-progress__track" aria-label={`Progreso ${scenario.completion_percentage}%`}>
          <div className="mail-scenario-progress__fill" style={{ width: `${scenario.completion_percentage}%` }} />
        </div>
      </div>

      {error && (
        <div className="mail-scenario-error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {validationNotice && (
        <div className="mail-scenario-validation-notice" role="status">
          <ShieldCheck size={16} /> {validationNotice}
        </div>
      )}

      <div className="mail-scenario-actions">
        {scenario.assignment_status === "assigned" && (
          <button type="button" className="mail-scenario-primary" onClick={startScenario} disabled={Boolean(busy)}>
            {busy === "start" ? <LoaderCircle className="mail-spinner" size={15} /> : <Play size={15} />}
            Iniciar caso
          </button>
        )}
        {!isLocked && (
          <button type="button" onClick={resetProgress} disabled={Boolean(busy)}>
            {busy === "reset" ? <LoaderCircle className="mail-spinner" size={15} /> : <RotateCcw size={15} />}
            Reiniciar progreso
          </button>
        )}
      </div>

      {isFinished && (
        <div className="mail-scenario-complete">
          <CheckCircle2 size={16} /> {scenario.completion_message || "Todos los pasos obligatorios se han completado."}
        </div>
      )}

      <div className="mail-scenario-steps">
        <h4>Secuencia de trabajo</h4>
        {scenario.steps.map((step) => {
          const isCurrent = currentStep?.task_id === step.task_id;
          const canEdit = !isLocked && !isFinished && isCurrent && scenario.assignment_status !== "assigned";
          const automaticChecks = step.validation_result?.mode === "automatic"
            ? step.validation_result.checks || []
            : [];
          return (
            <article key={step.task_id} className={stepClassName(step, scenario.current_task_order)}>
              <span className="mail-scenario-step__index">
                {step.progress_status === "completed" ? <CheckCircle2 size={14} /> : step.task_order}
              </span>
              <div className="mail-scenario-step__content">
                <strong>{step.title}</strong>
                {step.description && <p>{step.description}</p>}
                {step.expected_result && <small>Resultado esperado: {step.expected_result}</small>}
                {automaticChecks.length > 0 && (
                  <div className="mail-scenario-checks">
                    {automaticChecks.map((check, index) => (
                      <span key={`${check.rule_type}-${index}`} className={check.passed ? "is-passed" : "is-pending"}>
                        {check.message}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className={`mail-scenario-step__status mail-scenario-step__status--${step.progress_status}`}>
                {STEP_STATUS_LABELS[step.progress_status] || step.progress_status}
              </span>

              {canEdit && (
                <div className="mail-scenario-step__editor">
                  <textarea
                    value={notes[step.task_id] || ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [step.task_id]: event.target.value }))}
                    placeholder="Anotación opcional sobre la acción realizada..."
                  />
                  <div className="mail-scenario-step__actions">
                    <button
                      type="button"
                      className="mail-scenario-open-module"
                      onClick={() => openStepModule(step)}
                      disabled={Boolean(busy)}
                    >
                      {busy === `open-${step.task_id}`
                        ? <LoaderCircle className="mail-spinner" size={15} />
                        : <ExternalLink size={15} />}
                      {getCaseActionLabel(step.expected_action, step.module)}
                    </button>
                    <button
                      type="button"
                      className="mail-scenario-primary"
                      onClick={() => validateStep(step)}
                      disabled={Boolean(busy)}
                    >
                      {busy === `validate-${step.task_id}`
                        ? <LoaderCircle className="mail-spinner" size={15} />
                        : <ShieldCheck size={15} />}
                      Validar automáticamente
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStep(step, "completed")}
                      disabled={Boolean(busy)}
                    >
                      {busy === `step-${step.task_id}-completed`
                        ? <LoaderCircle className="mail-spinner" size={15} />
                        : <CheckCircle2 size={15} />}
                      Confirmar manualmente
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStep(step, "failed")}
                      disabled={Boolean(busy)}
                    >
                      {busy === `step-${step.task_id}-failed`
                        ? <LoaderCircle className="mail-spinner" size={15} />
                        : <AlertTriangle size={15} />}
                      Registrar error
                    </button>
                  </div>
                </div>
              )}

              {step.progress_status === "failed" && !isLocked && (
                <div className="mail-scenario-step__editor">
                  <div className="mail-scenario-step__actions">
                    <button
                      type="button"
                      onClick={() => updateStep(step, "in_progress")}
                      disabled={Boolean(busy)}
                    >
                      <XCircle size={15} /> Reabrir paso
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
