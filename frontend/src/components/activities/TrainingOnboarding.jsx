import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Mail, Monitor, RotateCcw, X } from "lucide-react";

import {
  hydrateTutorialState,
  persistTutorialState,
  readTutorialState,
  restartTutorial,
} from "./trainingTutorialState.js";
import "./trainingOnboarding.css";

const slides = [
  {
    eyebrow: "Bienvenido a AulaNomina",
    title: "Aprende gestión laboral trabajando",
    body: "El curso combina explicaciones breves con gestiones reales dentro de un ERP simulado: trabajadores, contratos, nóminas, incidencias, Seguridad Social, fiscalidad y documentación.",
    note: "No necesitas conocer AulaNomina antes de empezar.",
    icon: BookOpen,
  },
  {
    eyebrow: "Cómo funciona el curso",
    title: "Una idea y una gestión en cada actividad",
    body: "Cada actividad empieza con una idea clave. Después recibirás solo los datos necesarios y realizarás una gestión concreta en AulaNomina.",
    note: "El botón «Curso» te devuelve a la actividad actual y muestra tu avance por temas.",
    icon: Monitor,
  },
  {
    eyebrow: "Práctica",
    title: "Hazlo en AulaNomina",
    body: "Cuando la actividad te indique una operación, abre el módulo correspondiente y realiza la gestión. AulaNomina comprobará el resultado automáticamente o te mostrará un único botón de comprobación cuando sea necesario.",
    note: "Si algo no coincide, corrige la gestión y vuelve a comprobar. No necesitas seguir una lista de pistas ni criterios técnicos.",
    icon: RotateCcw,
  },
  {
    eyebrow: "Correo",
    title: "Parte del trabajo llega por email",
    body: "En muchas actividades recibirás un correo como ocurriría en un entorno de trabajo. Léelo, toma de él los datos necesarios y realiza después la gestión en el ERP. En algunos casos también tendrás que responder.",
    note: "Si no encuentras una función, «Tutorial y ayuda» incluye un buscador de módulos y preguntas frecuentes.",
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
    description: "Ya conoces el recorrido básico del ERP. La primera actividad explica qué es un trabajador por cuenta ajena y te pide crear su expediente a partir de un correo de incorporación.",
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

function visiblePhaseFor(state) {
  if (state.completed || state.dismissed) return "hidden";
  return state.phase === "hidden" ? "onboarding" : state.phase;
}

export default function TrainingOnboarding() {
  const initialState = useMemo(() => readTutorialState(), []);
  const [tutorialState, setTutorialState] = useState(initialState);
  const [visiblePhase, setVisiblePhase] = useState(() => visiblePhaseFor(initialState));

  const slideIndex = tutorialState.slideIndex;
  const familiarizationIndex = tutorialState.familiarizationIndex;
  const slide = slides[slideIndex];
  const familiarizationStep = familiarizationSteps[familiarizationIndex];
  const SlideIcon = slide?.icon || BookOpen;
  const onboardingProgress = ((slideIndex + 1) / slides.length) * 100;
  const isLastFamiliarizationStep = familiarizationIndex >= familiarizationSteps.length - 1;

  const persist = (patch) => {
    setTutorialState((current) => persistTutorialState({ ...current, ...patch }));
  };

  useEffect(() => {
    let cancelled = false;
    hydrateTutorialState().then((hydrated) => {
      if (cancelled) return;
      setTutorialState(hydrated);
      setVisiblePhase(visiblePhaseFor(hydrated));
      window.dispatchEvent(new Event("aulanomina-tutorial-state-changed"));
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      const resumable = stored.completed
        ? restartTutorial()
        : persistTutorialState({ ...stored, dismissed: false });
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
    const next = persistTutorialState({
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
    const next = persistTutorialState({
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
