import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  MapPin,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

import { resetTrainingWorkspace } from "../../services/activityApi.js";
import { getStoredAuthUser, refreshAuthUser } from "../../services/authApi.js";
import {
  HELP_LOCATIONS,
  helpLocationPath,
  openHelpLocation,
  readCurrentNavigationContext,
  searchHelpLocations,
} from "./trainingHelpRegistry.js";
import {
  hydrateTutorialState,
  readTutorialState,
  tutorialStatusLabel,
} from "./trainingTutorialState.js";
import "./trainingHelpCenter.css";
import "./trainingHelpContext.css";

const FAQ = [
  {
    question: "¿Por dónde empiezo una actividad?",
    answer: "Lee primero la «Idea clave». Después consulta el correo o los datos que aparecen en la actividad y sigue «Hazlo en AulaNomina». La propia actividad te lleva al módulo que necesitas.",
  },
  {
    question: "¿Cómo sé si he hecho bien una gestión?",
    answer: "Muchas actividades se completan al guardar correctamente la operación. Cuando sea necesaria una revisión adicional verás un único botón «Comprobar». Si algo no coincide, AulaNomina te indicará qué debes revisar.",
  },
  {
    question: "¿Qué ocurre si me equivoco?",
    answer: "Corrige la gestión en el ERP y vuelve a comprobarla. Un error no bloquea el curso.",
  },
  {
    question: "¿Dónde veo mi avance?",
    answer: "Dentro de «Curso». La cabecera muestra el progreso total y el índice lateral muestra cuántas actividades has completado en cada tema.",
  },
  {
    question: "¿Cómo vuelvo a la actividad que estaba realizando?",
    answer: "Pulsa «Curso». AulaNomina conserva la actividad actual para que puedas volver a ella después de trabajar en el ERP o consultar el correo.",
  },
  {
    question: "¿Para qué sirve el correo?",
    answer: "El correo forma parte de las prácticas. Puede contener los datos de una incorporación, una incidencia, un documento o una solicitud que después debes gestionar en AulaNomina. En algunos casos también tendrás que responder.",
  },
  {
    question: "¿Cómo funcionan los casos completos C01–C06?",
    answer: "Son prácticas finales con menos guía. Tendrás que combinar varios módulos de AulaNomina y la información recibida para resolver un proceso de principio a fin.",
  },
  {
    question: "No encuentro una opción del ERP. ¿Qué hago?",
    answer: "Usa el buscador «¿Dónde está…?» de esta ventana. Puedes buscar por nombre o por conceptos relacionados, por ejemplo «IT», «alta», «IRPF», «RNT», «correo» o «modelo 111».",
  },
  {
    question: "¿Puedo repetir el tutorial sin borrar mi curso?",
    answer: "Sí. Repetir o continuar el tutorial no modifica los datos del ERP ni el estado de las actividades.",
  },
  {
    question: "¿El tutorial continúa en otro ordenador?",
    answer: "Sí, cuando utilizas tu cuenta de alumno. AulaNomina guarda el paso del tutorial en el que te encuentras y lo recupera al iniciar sesión desde otro dispositivo.",
  },
];

export default function TrainingHelpCenter() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tutorialState, setTutorialState] = useState(() => readTutorialState());
  const [screenContext, setScreenContext] = useState(() => readCurrentNavigationContext());
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState("");
  const user = getStoredAuthUser();
  const canResetWorkspace = Boolean(user?.workspace_id && user?.role === "student");

  useEffect(() => {
    const refreshTutorialState = () => setTutorialState(readTutorialState());
    window.addEventListener("aulanomina-tutorial-state-changed", refreshTutorialState);
    return () => window.removeEventListener("aulanomina-tutorial-state-changed", refreshTutorialState);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setTutorialState(readTutorialState());
    setScreenContext(readCurrentNavigationContext());
    hydrateTutorialState().then((state) => {
      if (!cancelled) setTutorialState(state);
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        if (resetConfirm) setResetConfirm(false);
        else setOpen(false);
      }
    };
    const refreshContext = () => setScreenContext(readCurrentNavigationContext());
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("aulanomina-route-change", refreshContext);
    window.addEventListener("hashchange", refreshContext);
    window.addEventListener("aulanomina-contract-mode", refreshContext);
    window.addEventListener("aulanomina-incidents-mode", refreshContext);
    window.addEventListener("aulanomina-incident-category", refreshContext);
    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("aulanomina-route-change", refreshContext);
      window.removeEventListener("hashchange", refreshContext);
      window.removeEventListener("aulanomina-contract-mode", refreshContext);
      window.removeEventListener("aulanomina-incidents-mode", refreshContext);
      window.removeEventListener("aulanomina-incident-category", refreshContext);
    };
  }, [open, resetConfirm]);

  const results = useMemo(() => searchHelpLocations(query, HELP_LOCATIONS), [query]);

  const launchTutorial = (mode) => {
    setOpen(false);
    setResetConfirm(false);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("aulanomina-tutorial-open", { detail: { mode } }));
    }, 0);
  };

  const navigateTo = (location) => {
    setOpen(false);
    window.setTimeout(() => openHelpLocation(location), 0);
  };

  const handleReset = async () => {
    try {
      setResetting(true);
      setNotice("");
      await resetTrainingWorkspace();
      await refreshAuthUser();
      try {
        window.localStorage.removeItem("aulanomina:active-case-context");
        window.sessionStorage.removeItem("aulanomina:active-case-context");
      } catch {
        // El reset del backend ya se ha completado aunque no pueda limpiarse el almacenamiento local.
      }
      setResetConfirm(false);
      setNotice("Entorno práctico restaurado al estado inicial. El tutorial se conserva.");
      window.dispatchEvent(new Event("aulanomina-activities-refresh"));
    } catch (error) {
      setNotice(error.message || "No se ha podido restablecer el entorno práctico.");
    } finally {
      setResetting(false);
    }
  };

  const currentLocation = screenContext.location;

  const overlay = open ? createPortal(
    <div className="training-help__backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !resetting) setOpen(false);
    }}>
      <section className="training-help" role="dialog" aria-modal="true" aria-labelledby="training-help-title">
        <header className="training-help__header">
          <div>
            <span>Orientación</span>
            <h2 id="training-help-title">Tutorial y ayuda</h2>
            <p>Consulta cómo funciona AulaNomina o localiza cualquier área del ERP sin salir del ejercicio.</p>
          </div>
          <button type="button" className="training-help__close" onClick={() => setOpen(false)} aria-label="Cerrar tutorial y ayuda">
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="training-help__body">
          {notice && <div className="training-help__notice" role="status">{notice}</div>}

          {currentLocation && (
            <section className="training-help-context" aria-labelledby="training-help-context-title">
              <div className="training-help-context__heading">
                <div>
                  <span>Ayuda sobre esta pantalla</span>
                  <h3 id="training-help-context-title">{screenContext.path || helpLocationPath(currentLocation)}</h3>
                  <p>{currentLocation.description}</p>
                </div>
                <CheckCircle2 size={22} aria-hidden="true" />
              </div>
              <div className="training-help-context__actions">
                <strong>Acciones habituales</strong>
                <ul>
                  {(currentLocation.actions || []).slice(0, 3).map((action) => <li key={action}>{action}</li>)}
                </ul>
              </div>
            </section>
          )}

          <section className="training-help__tutorial-card">
            <div className="training-help__tutorial-icon"><PlayCircle size={24} aria-hidden="true" /></div>
            <div className="training-help__tutorial-copy">
              <span>Tutorial guiado</span>
              <strong>{tutorialStatusLabel(tutorialState)}</strong>
              <p>Repasa la introducción y la familiarización inicial. Con tu cuenta de alumno, el punto del tutorial se sincroniza entre dispositivos.</p>
            </div>
            <div className="training-help__tutorial-actions">
              {!tutorialState.completed && (
                <button type="button" className="is-primary" onClick={() => launchTutorial("resume")}>
                  <PlayCircle size={16} aria-hidden="true" />
                  Continuar donde lo dejé
                </button>
              )}
              <button type="button" className={tutorialState.completed ? "is-primary" : ""} onClick={() => launchTutorial("restart")}>
                <RotateCcw size={16} aria-hidden="true" />
                {tutorialState.completed ? "Repetir tutorial" : "Empezar desde el principio"}
              </button>
            </div>
          </section>

          <section className="training-help__locator" aria-labelledby="training-help-locator-title">
            <div className="training-help__section-heading">
              <div>
                <span>Localizador</span>
                <h3 id="training-help-locator-title">¿Dónde está…?</h3>
              </div>
              <small>Busca por función, trámite o concepto</small>
            </div>

            <label className="training-help__search">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ej.: IT, alta trabajador, RNT, IRPF, correo…"
                autoComplete="off"
              />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda"><X size={15} /></button>}
            </label>

            <div className="training-help__results" aria-live="polite">
              {results.length > 0 ? results.map((location) => (
                <button type="button" key={location.id} className="training-help__result" onClick={() => navigateTo(location)}>
                  <MapPin size={17} aria-hidden="true" />
                  <span>
                    <strong>{location.title}</strong>
                    <small>{helpLocationPath(location)}</small>
                    <p>{location.description}</p>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              )) : (
                <div className="training-help__empty">
                  <Search size={21} aria-hidden="true" />
                  <strong>No encuentro esa función</strong>
                  <span>Prueba con un término más general, por ejemplo «nómina», «Seguridad Social» o «documentos».</span>
                </div>
              )}
            </div>
          </section>

          <section className="training-help__faq" aria-labelledby="training-help-faq-title">
            <div className="training-help__section-heading">
              <div>
                <span>Ayuda rápida</span>
                <h3 id="training-help-faq-title">Preguntas frecuentes</h3>
              </div>
              <small>{FAQ.length} respuestas de uso</small>
            </div>
            <div className="training-help__faq-list">
              {FAQ.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}<span>+</span></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          {canResetWorkspace && (
            <section className="training-help__environment">
              <div>
                <span>Entorno de prácticas</span>
                <strong>Restablecer escenario</strong>
                <p>Devuelve los datos del ERP y el progreso práctico al estado inicial. El tutorial no se reinicia.</p>
              </div>
              {!resetConfirm ? (
                <button type="button" onClick={() => setResetConfirm(true)}>
                  <RefreshCw size={15} aria-hidden="true" />
                  Restablecer entorno
                </button>
              ) : (
                <div className="training-help__reset-confirm">
                  <button type="button" onClick={() => setResetConfirm(false)} disabled={resetting}>Cancelar</button>
                  <button type="button" className="is-danger" onClick={handleReset} disabled={resetting}>
                    <RotateCcw size={15} className={resetting ? "is-spinning" : ""} aria-hidden="true" />
                    {resetting ? "Restableciendo…" : "Confirmar reset"}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </section>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button type="button" className="training-help__launcher" onClick={() => {
        setTutorialState(readTutorialState());
        setScreenContext(readCurrentNavigationContext());
        setNotice("");
        setResetConfirm(false);
        setOpen(true);
      }} aria-haspopup="dialog" aria-expanded={open}>
        <CircleHelp size={16} aria-hidden="true" />
        <span>Tutorial</span>
      </button>
      {overlay}
    </>
  );
}
