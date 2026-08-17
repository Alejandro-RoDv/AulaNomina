import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Mail, Monitor, RotateCcw, X } from "lucide-react";

import "./trainingOnboarding.css";

const ONBOARDING_KEY = "aulanomina:training-onboarding-v1";
const FAMILIARIZATION_KEY = "aulanomina:training-familiarization-v1";

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
    body: "Cada actividad te plantea un encargo y te lleva al módulo donde debes investigar o realizar la gestión. Puedes moverte por el menú con normalidad y volver al curso desde el botón Actividades de la barra superior.",
    note: "No hay un recorrido rígido: el objetivo es aprender a orientarte como en una aplicación profesional.",
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
    note: "AulaNomina relaciona el correo con la actividad para que siempre sepas qué expediente estás trabajando.",
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
    title: "Vuelve al Centro de Actividades",
    description: "Ya conoces el recorrido básico. Regresa al curso para comenzar la primera práctica evaluable.",
    page: null,
    action: "Abrir Centro de Actividades",
    done: "Familiarización completada",
  },
];

function readStoredState(key) {
  try {
    return window.localStorage.getItem(key) === "completed";
  } catch {
    return false;
  }
}

function storeCompleted(key) {
  try {
    window.localStorage.setItem(key, "completed");
  } catch {
    // La experiencia sigue funcionando aunque el navegador bloquee almacenamiento local.
  }
}

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
  const [phase, setPhase] = useState(() => {
    if (!readStoredState(ONBOARDING_KEY)) return "onboarding";
    if (!readStoredState(FAMILIARIZATION_KEY)) return "familiarization";
    return "hidden";
  });
  const [slideIndex, setSlideIndex] = useState(0);
  const [familiarizationIndex, setFamiliarizationIndex] = useState(0);
  const [coachMinimized, setCoachMinimized] = useState(false);

  const slide = slides[slideIndex];
  const familiarizationStep = familiarizationSteps[familiarizationIndex];
  const SlideIcon = slide?.icon || BookOpen;
  const onboardingProgress = useMemo(() => ((slideIndex + 1) / slides.length) * 100, [slideIndex]);

  const finishOnboarding = () => {
    storeCompleted(ONBOARDING_KEY);
    setPhase("familiarization");
    setFamiliarizationIndex(0);
  };

  const finishFamiliarization = () => {
    storeCompleted(FAMILIARIZATION_KEY);
    setPhase("hidden");
    window.setTimeout(openActivitiesCenter, 0);
  };

  const confirmFamiliarizationStep = () => {
    if (familiarizationIndex >= familiarizationSteps.length - 1) {
      finishFamiliarization();
      return;
    }
    setFamiliarizationIndex((current) => current + 1);
    setCoachMinimized(false);
  };

  if (phase === "hidden") return null;

  if (phase === "onboarding") {
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
              <small>{slideIndex + 1} / {slides.length}</small>
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
                onClick={() => setSlideIndex((current) => Math.max(0, current - 1))}
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
                  : setSlideIndex((current) => Math.min(slides.length - 1, current + 1))}
              >
                {slideIndex === slides.length - 1 ? "Empezar Actividad 0" : "Siguiente"}
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
    <aside className={`training-familiarization${coachMinimized ? " is-minimized" : ""}`} aria-label="Actividad 0 de familiarización">
      <header className="training-familiarization__header">
        <div>
          <span>Actividad 0 · No evaluable</span>
          <strong>Familiarización con AulaNomina</strong>
        </div>
        <button type="button" onClick={() => setCoachMinimized((current) => !current)} aria-label={coachMinimized ? "Mostrar actividad" : "Minimizar actividad"}>
          {coachMinimized ? <BookOpen size={17} /> : <X size={17} />}
        </button>
      </header>

      {!coachMinimized && (
        <>
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
              <button
                type="button"
                className="training-onboarding__button is-secondary"
                onClick={() => {
                  if (familiarizationStep.page) openErpPage(familiarizationStep.page);
                  else openActivitiesCenter();
                }}
              >
                {familiarizationStep.action}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              <button type="button" className="training-onboarding__button is-primary" onClick={confirmFamiliarizationStep}>
                <CheckCircle2 size={15} aria-hidden="true" />
                {familiarizationStep.done}
              </button>
            </div>
          </div>
        </>
      )}
    </aside>,
    document.body
  );
}
