import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Mail, Monitor, RotateCcw, X } from "lucide-react";

import {
  readTutorialState,
  restartTutorial,
  writeTutorialState,
} from "./trainingTutorialState.js";
import "./trainingOnboarding.css";

const slides = [
  {
    eyebrow: "Bienvenido a AulaNomina",
    title: "Un laboratorio práctico de gestión laboral",
    body: "Vas a trabajar los contenidos del curso dentro de un ERP simulado: empresas, trabajadores, contratos, nóminas, incidencias, Seguridad Social, fiscalidad y documentación.",
    note: "No necesitas conocer AulaNomina antes de empezar.",
    icon: BookOpen,
  },
  {
    eyebrow: "Cómo funciona el ERP",
    title: "El curso y el ERP son el mismo entorno",
    body: "Cada actividad te plantea un encargo y te lleva al módulo donde debes investigar o realizar la gestión. El botón «Curso» te devuelve siempre a la actividad en la que estás trabajando y muestra también tu avance general y por bloques.",
    note: "Puedes moverte por el ERP con normalidad y regresar al encargo cuando necesites comprobar qué estabas haciendo.",
    icon: Monitor,
  },
  {
    eyebrow: "Actividades y comprobación",
    title: "Haz la gestión y después comprueba el resultado",
    body: "Las actividades muestran el encargo, los datos del caso, tu tarea y el resultado esperado. Cuando aparezca Comprobar, AulaNomina revisará el estado real del ERP y te indicará qué criterio falta si algo no coincide.",
    note: "Equivocarte no bloquea el curso. En las prácticas podrás corregir, volver a comprobar y utilizar ayuda progresiva.",
    icon: RotateCcw,
  },
  {
    eyebrow: "Correo y contexto",
    title: "Algunos casos empiezan en tu bandeja de entrada",
    body: "Si una actividad indica que revises el correo, abre el mensaje relacionado, consulta sus adjuntos y vuelve al ERP para realizar la gestión. Cuando corresponda, responderás desde el mismo hilo.",
    note: "Si no recuerdas dónde está una función, «Tutorial y ayuda» incluye un buscador de módulos y preguntas frecuentes.",
    icon: Mail,
  },
];

const familiarizationSteps = [
  {
    title: "Localiza la empresa de demostración",
    description: "Abre Empresas / Centros y localiza la empresa utilizada en el entorno demo.",
    page: "companies",
    action: "Abrir Empresas / Centros",
    done: "Empresa localizada",
  },
  {
    title: "Abre un trabajador",
    description: "Entra en el listado de trabajadores y abre cualquier expediente de demostración.",
    page: "employees-list",
    action: "Abrir trabajadores",
    done: "Trabajador consultado",
  },
  {
    title: "Consulta su contrato",
    description: "Accede a Contratos e identifica el contrato asociado al trabajador que acabas de revisar.",
    page: "contracts",
    action: "Abrir contratos",
    done: "Contrato consultado",
  },
  {
    title: "Empieza el curso práctico",
    description: "Ya conoces el recorrido básico del ERP. Finaliza la familiarización y abre la primera actividad del curso.",
    page: null,
    action: null,
    done: "Empezar primera actividad",
  },
];

function openErpPage(page) {
  if (!page) return;
  if (window.location.hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    window.dispatchEvent(new Event("aulanomina-route-change"));
  }
  window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page } }));
}

function openActivitiesCenter() {
  const launcher = document.querySelector(".activities-global-launcher");
  if (launcher instanceof HTMLElement) launcher.click();
}

export default function TrainingOnboarding() {
  const initialState = useMemo(() => readTutorialState(), []);
  const [tutorialState, setTutorialState] = useState(initialState);
  const [visiblePhase, setVisiblePhase] = useState(() => (
    initialState.completed || initialState.dismissed ? "hidden" : initialState.phase
  ));

  const slideIndex = tutorialState.slideIndex;
  const familiarizationIndex = tutorialState.familiarizationIndex;
  const slide = slides[slideIndex];
  const familiarizationStep = familiarizationSteps[familiarizationIndex];
  const SlideIcon = slide?.icon || BookOpen;
  const onboardingProgress = ((slideIndex + 1) / slides.length) * 100;
  const isLastFamiliarizationStep = familiarizationIndex >= familiarizationSteps.length - 1;

  const persist = (patch) => {
    setTutorialState((current) => writeTutorialState({ ...current, ...patch }));
  };

  useEffect(() => {
    const handleTutorialRequest = (event) => {
      const mode = event.detail?.mode || "resume";
      if (mode === "restart") {
        const restarted = restartTutorial();
        setTutorialState(restarted);
        setVisiblePhase("onboarding");
        return;
      }

      const stored = readTutorialState();
      const resumable = stored.completed ? restartTutorial() : writeTutorialState({ ...stored, dismissed: false });
      setTutorialState(resumable);
      setVisiblePhase(resumable.phase === "hidden" ? "onboarding" : resumable.phase);
    };

    window.addEventListener("aulanomina-tutorial-open", handleTutorialRequest);
    return () => window.removeEventListener("aulanomina-tutorial-open", handleTutorialRequest);
  }, []);

  const dismissTutorial = () => {
    persist({ dismissed: true });
    setVisiblePhase("hidden");
    window.dispatchEvent(new Event("aulanomina-tutorial-state-changed"));
  };

  const finishOnboarding = () => {
    const next = writeTutorialState({
      ...tutorialState,
      phase: "familiarization",
      slideIndex: slides.length - 1,
      familiarizationIndex: 0,
      completed: false,
      dismissed: false,
    });
    setTutorialState(next);
    setVisiblePhase("familiarization");
    window.dispatchEvent(new Event("aulanomina-tutorial-state-changed"));
  };

  const finishFamiliarization = () => {
    const next = writeTutorialState({
      ...tutorialState,
      phase: "hidden",
      familiarizationIndex: familiarizationSteps.length - 1,
      completed: true,
      dismissed: false,
    });
    setTutorialState(next);
    setVisiblePhase("hidden");
    window.dispatchEvent(new Event("aulanomina-tutorial-state-changed"));
    window.setTimeout(openActivitiesCenter, 0);
  };

  const confirmFamiliarizationStep = () => {
    if (isLastFamiliarizationStep) {
      finishFamiliarization();
      return;
    }
    persist({
      phase: "familiarization",
      familiarizationIndex: Math.min(familiarizationSteps.length - 1, familiarizationIndex + 1),
      dismissed: false,
    });
  };

  if (visiblePhase === "hidden") return null;

  if (visiblePhase === "onboarding") {
    return createPortal(
      <div className="training-onboarding__backdrop" role="presentation">
        <section className="training-onboarding" role="dialog" aria-modal="true" aria-labelledby="training-onboarding-title">
          <div className="training-onboarding__visual" aria-hidden="true">
            <div className="training-onboarding__icon"><SlideIcon size={34} /></div>
            <span>AulaNomina</span>
            <strong>Curso práctico de gestión laboral</strong>
          </div>

          <div className="training-onboarding__content">
            <div className="training-onboarding__topline">
              <span>{slide.eyebrow}</span>
              <div className="training-onboarding__top-actions">
                <small>{slideIndex + 1} / {slides.length}</small>
                <button type="button" className="training-onboarding__dismiss" onClick={dismissTutorial} aria-label="Cerrar tutorial por ahora" title="Cerrar por ahora">
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="training-onboarding__progress" aria-hidden="true">
              <span style={{ width: `${onboardingProgress}%` }} />
            </div>

            <div className="training-onboarding__copy">
              <h2 id="training-onboarding-title">{slide.title}</h2>
              <p>{slide.body}</p>
              <div className="training-onboarding__note">
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>{slide.note}</span>
              </div>
            </div>

            <div className="training-onboarding__actions">
              <button
                type="button"
                className="training-onboarding__button is-secondary"
                onClick={() => persist({ slideIndex: Math.max(0, slideIndex - 1) })}
                disabled={slideIndex === 0}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <button
                type="button"
                className="training-onboarding__button is-primary"
                onClick={() => slideIndex === slides.length - 1
                  ? finishOnboarding()
                  : persist({ slideIndex: Math.min(slides.length - 1, slideIndex + 1) })}
              >
                {slideIndex === slides.length - 1 ? "Empezar familiarización" : "Siguiente"}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </div>,
      document.body
    );
  }

  return createPortal(
    <aside className="training-familiarization" aria-label="Actividad 0 de familiarización">
      <header className="training-familiarization__header">
        <div>
          <span>Actividad 0 · No evaluable</span>
          <strong>Familiarización con AulaNomina</strong>
        </div>
        <button type="button" onClick={dismissTutorial} aria-label="Cerrar tutorial por ahora" title="Cerrar por ahora">
          <X size={17} aria-hidden="true" />
        </button>
      </header>

      <div className="training-familiarization__progress">
        {familiarizationSteps.map((step, index) => (
          <span key={step.title} className={index <= familiarizationIndex ? "is-active" : ""} />
        ))}
      </div>
      <div className="training-familiarization__body">
        <small>Paso {familiarizationIndex + 1} de {familiarizationSteps.length}</small>
        <h3>{familiarizationStep.title}</h3>
        <p>{familiarizationStep.description}</p>
        <div className="training-familiarization__actions">
          {familiarizationStep.page && (
            <button
              type="button"
              className="training-onboarding__button is-secondary"
              onClick={() => openErpPage(familiarizationStep.page)}
            >
              {familiarizationStep.action}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="training-onboarding__button is-primary" onClick={confirmFamiliarizationStep}>
            <CheckCircle2 size={15} aria-hidden="true" />
            {familiarizationStep.done}
          </button>
        </div>
      </div>
    </aside>,
    document.body
  );
}
