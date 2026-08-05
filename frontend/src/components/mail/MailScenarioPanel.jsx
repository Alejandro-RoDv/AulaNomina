import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import {
  fetchAssignmentScenario,
  recordAssignmentContextEvent,
  startAssignmentScenario,
  updateAssignmentScenarioStep,
} from "../../services/caseScenarioApi.js";
import { getCaseActionLabel, openCaseModule } from "../../utils/caseNavigation.js";
import { LAST_CASE_FEEDBACK_KEY } from "../../utils/caseOperationBridge.js";
import "./mailScenario.css";


const ASSIGNMENT_STATUS_LABELS = {
  assigned: "Pendiente",
  in_progress: "En curso",
  submitted: "Completado",
  reviewed: "Revisado",
  approved: "Finalizado",
  needs_revision: "Requiere revisión",
};


export default function MailScenarioPanel({ message, onScenarioChanged }) {
  const assignmentId = message?.caseAssignmentId || null;
  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(message?.latestTutorNotice || "");
  const [hintVisible, setHintVisible] = useState(false);
  const autoStartRef = useRef(null);

  const publishChange = useCallback(async (nextScenario, successMessage) => {
    setScenario(nextScenario);
    if (onScenarioChanged) await onScenarioChanged(nextScenario, successMessage);
  }, [onScenarioChanged]);

  const loadScenario = useCallback(async () => {
    if (!assignmentId) {
      setScenario(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      let data = await fetchAssignmentScenario(assignmentId);
      if (data.assignment_status === "assigned" && autoStartRef.current !== assignmentId) {
        autoStartRef.current = assignmentId;
        data = await startAssignmentScenario(assignmentId);
      }
      setScenario(data);
    } catch (requestError) {
      setScenario(null);
      setError(requestError.message || "No se ha podido cargar la ayuda del caso.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    setScenario(null);
    setError("");
    setNotice(message?.latestTutorNotice || "");
    setHintVisible(false);
    loadScenario();
  }, [loadScenario, message?.latestTutorNotice]);

  useEffect(() => {
    if (!assignmentId) return undefined;

    const applyFeedback = (detail) => {
      if (Number(detail?.assignmentId) !== Number(assignmentId)) return;
      if (detail.scenario) setScenario(detail.scenario);
      if (detail.feedbackNotice) setNotice(detail.feedbackNotice);
      else if (detail.validation?.message) setNotice(detail.validation.message);
      else if (detail.operationStatus === "error") setNotice("La operación no se ha completado. Revisa los datos e inténtalo de nuevo.");
      if (detail.scenario && onScenarioChanged) {
        void onScenarioChanged(detail.scenario, detail.professionalMessageId
          ? "Se ha recibido una nueva comunicación relacionada con el proceso."
          : "El seguimiento del caso se ha actualizado.");
      }
    };

    const handleFeedback = (event) => applyFeedback(event.detail);
    const handleStorage = (event) => {
      if (event.key !== LAST_CASE_FEEDBACK_KEY || !event.newValue) return;
      try {
        applyFeedback(JSON.parse(event.newValue));
      } catch {
        // La ayuda no debe bloquearse por un evento de sincronización corrupto.
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

  const openStepModule = async () => {
    if (!assignmentId || !scenario || !currentStep) return;
    setError("");

    const context = {
      actionCode: currentStep.expected_action,
      moduleCode: currentStep.module,
      assignmentId,
      taskId: currentStep.task_id,
      scenarioCode: scenario.scenario_code,
      employeeName: scenario.initial_state?.employee || scenario.initial_state?.substitute || null,
      employeeId: message?.employeeId || scenario.initial_state?.employee_id || null,
      companyId: message?.companyId || scenario.initial_state?.company_id || null,
      period: scenario.initial_state?.payroll_period || scenario.initial_state?.period || null,
      startDate: scenario.initial_state?.leave_start || scenario.initial_state?.start_date || null,
      relatedEntityType: message?.relatedEntityType || null,
      relatedEntityId: message?.relatedEntityId || null,
    };
    const openedWindow = openCaseModule(context);
    if (!openedWindow) {
      setError("El navegador ha bloqueado la apertura del módulo relacionado.");
      return;
    }

    setBusy("open");
    try {
      const result = await recordAssignmentContextEvent(assignmentId, {
        task_id: currentStep.task_id,
        event_type: "module_opened",
        action_code: currentStep.expected_action,
        target: currentStep.module,
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

  const confirmManualReview = async () => {
    if (!assignmentId || !currentStep) return;
    setBusy("manual");
    setError("");
    try {
      const nextScenario = await updateAssignmentScenarioStep(assignmentId, currentStep.task_id, {
        status: "completed",
        student_notes: null,
        validation_result: {
          ...(currentStep.validation_result || {}),
          mode: "manual_required",
          confirmed_from_mail: true,
          confirmed_at: new Date().toISOString(),
        },
      });
      setNotice("La revisión manual ha quedado registrada.");
      await publishChange(nextScenario, "Revisión manual registrada.");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido registrar la revisión manual.");
    } finally {
      setBusy("");
    }
  };

  if (!assignmentId) return null;

  if (loading) {
    return (
      <section className="mail-scenario-panel mail-scenario-panel--loading">
        <LoaderCircle className="mail-spinner" size={16} /> Preparando la ayuda del caso...
      </section>
    );
  }

  if (error && !scenario) {
    return (
      <section className="mail-scenario-panel mail-scenario-panel--error" role="alert">
        <span>{error}</span>
        <button type="button" onClick={loadScenario}>Reintentar</button>
      </section>
    );
  }

  if (!scenario) return null;

  const isFinished = scenario.completion_percentage === 100;
  const manualRequired = Boolean(currentStep?.validation_result?.manual_required);
  const hint = currentStep?.description || currentStep?.title || "Revisa los datos descritos en el correo y localiza el proceso relacionado.";

  return (
    <section className="mail-scenario-panel" aria-label="Ayuda opcional del caso">
      <header className="mail-scenario-panel__header">
        <div>
          <span className="mail-scenario-panel__eyebrow">Ayuda del caso</span>
          <strong>{scenario.title}</strong>
        </div>
        <span className="mail-scenario-panel__badge">
          {ASSIGNMENT_STATUS_LABELS[scenario.assignment_status] || scenario.assignment_status}
        </span>
      </header>

      <p className="mail-scenario-panel__intro">
        Interpreta primero la comunicación y los adjuntos. Abre la ayuda únicamente cuando necesites orientación.
      </p>

      {notice && (
        <div className="mail-scenario-validation-notice" role="status">
          <ShieldCheck size={15} /> {notice}
        </div>
      )}

      {error && <div className="mail-scenario-error" role="alert">{error}</div>}

      {isFinished ? (
        <div className="mail-scenario-complete">
          <CheckCircle2 size={16} /> {scenario.completion_message || "El caso se ha completado."}
        </div>
      ) : (
        <div className="mail-scenario-actions">
          <button type="button" onClick={() => setHintVisible((current) => !current)}>
            <Lightbulb size={15} /> {hintVisible ? "Ocultar pista" : "Ver una pista"}
          </button>
          <button type="button" className="mail-scenario-primary" onClick={openStepModule} disabled={Boolean(busy) || !currentStep}>
            {busy === "open" ? <LoaderCircle className="mail-spinner" size={15} /> : <ExternalLink size={15} />}
            {currentStep ? getCaseActionLabel(currentStep.expected_action, currentStep.module) : "Abrir módulo relacionado"}
          </button>
          {manualRequired && (
            <button type="button" onClick={confirmManualReview} disabled={Boolean(busy)}>
              {busy === "manual" ? <LoaderCircle className="mail-spinner" size={15} /> : <CheckCircle2 size={15} />}
              Confirmar revisión
            </button>
          )}
        </div>
      )}

      {hintVisible && !isFinished && (
        <div className="mail-scenario-hint">
          <strong>Pista</strong>
          <p>{hint}</p>
        </div>
      )}
    </section>
  );
}
