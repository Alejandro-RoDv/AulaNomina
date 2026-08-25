import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BookOpen,
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
import { readTutorialState, tutorialStatusLabel } from "./trainingTutorialState.js";
import "./trainingHelpCenter.css";

const LOCATIONS = [
  {
    title: "Empresas y centros de trabajo",
    path: "Empresa · Empresas / Centros",
    description: "Datos de empresa, CCC y estructura de centros de trabajo.",
    keywords: "empresa empresas centro centros ccc cif estructura",
    page: "companies",
  },
  {
    title: "Listado de trabajadores",
    path: "Personas · Trabajadores",
    description: "Buscar y abrir expedientes de personas trabajadoras.",
    keywords: "trabajador trabajadores persona empleado expediente buscar dni naf",
    page: "employees-list",
  },
  {
    title: "Alta de trabajador",
    path: "Personas · Nuevo trabajador",
    description: "Crear un nuevo expediente laboral.",
    keywords: "alta crear nuevo trabajador empleado persona expediente",
    page: "employees",
  },
  {
    title: "Contratos",
    path: "Contratación · Contratos",
    description: "Alta, revisión y modificación de relaciones contractuales.",
    keywords: "contrato contratos contratación jornada antigüedad sustitución temporal indefinido",
    page: "contracts",
  },
  {
    title: "Convenios colectivos",
    path: "Empresa · Convenios",
    description: "Convenios, categorías, tablas salariales y parametrización.",
    keywords: "convenio convenios colectivo categoria tabla salarial salarios",
    page: "collective-agreements",
  },
  {
    title: "Incidencias laborales",
    path: "Gestión laboral · Incidencias",
    description: "IT, ausencias, vacaciones y otras incidencias del trabajador.",
    keywords: "incidencia incidencias it incapacidad temporal baja medica vacaciones ausencia recaida confirmacion",
    page: "incidents",
  },
  {
    title: "Histórico de nóminas",
    path: "Nómina · Histórico",
    description: "Consultar, calcular y revisar nóminas y periodos.",
    keywords: "nomina nómina nominas nóminas calcular recalcular historico recibo salario liquido bruto",
    page: "payroll-history",
  },
  {
    title: "Conceptos salariales",
    path: "Nómina · Conceptos permanentes",
    description: "Conceptos salariales vinculados al contrato.",
    keywords: "concepto conceptos salarial salariales complemento plus importe permanente",
    page: "permanent-payroll-concepts",
  },
  {
    title: "IRPF del trabajador",
    path: "Fiscalidad · IRPF",
    description: "Perfil fiscal, retención y regularización de IRPF.",
    keywords: "irpf retencion retención modelo 145 fiscal fiscalidad regularizacion",
    page: "irpf",
  },
  {
    title: "Afiliación",
    path: "Seguridad Social · Afiliación",
    description: "Altas, bajas y variaciones de afiliación.",
    keywords: "afiliacion afiliación alta baja variacion variación seguridad social red naf",
    page: "affiliations",
  },
  {
    title: "Ficheros de afiliación",
    path: "Seguridad Social · Ficheros de afiliación",
    description: "Preparar y revisar remesas de movimientos de afiliación.",
    keywords: "afi fichero afiliacion altas bajas masivas remesa",
    page: "affiliation-files",
  },
  {
    title: "Comunicaciones FIE",
    path: "Seguridad Social · Comunicaciones INSS (FIE)",
    description: "Revisar y conciliar comunicaciones recibidas del INSS.",
    keywords: "fie inss comunicación comunicacion baja médica medica incapacidad temporal",
    hash: "#fie-inbox",
  },
  {
    title: "Seguros Sociales",
    path: "Seguridad Social · Seguros Sociales",
    description: "Liquidaciones, bases, RLC/RNT y procesos de cotización.",
    keywords: "seguros sociales cotizacion cotización rlc rnt liquidacion liquidación bases",
    page: "social-security-dashboard",
  },
  {
    title: "SILTRA",
    path: "Seguridad Social · Ficheros / SILTRA",
    description: "Simular envíos y consultar respuestas de ficheros de Seguridad Social.",
    keywords: "siltra fichero ficheros envio envío respuesta seguridad social",
    page: "social-security-files",
  },
  {
    title: "Documentos",
    path: "Documentación · Documentos",
    description: "Expediente documental, pendientes y documentación laboral.",
    keywords: "documento documentos documentación expediente adjunto certificado pendiente",
    hash: "#documents",
  },
  {
    title: "Correo",
    path: "Correo formativo",
    description: "Mensajes de los casos prácticos, adjuntos y respuestas.",
    keywords: "correo email mail mensaje bandeja entrada responder adjunto",
    hash: "#mail",
  },
  {
    title: "Modelo 111",
    path: "Fiscalidad · Modelo 111",
    description: "Preparar y simular la presentación del Modelo 111.",
    keywords: "modelo 111 aeat retenciones trimestral fiscalidad",
    hash: "#model-111",
  },
  {
    title: "Modelo 190",
    path: "Fiscalidad · Modelo 190",
    description: "Resumen anual y simulación de presentación del Modelo 190.",
    keywords: "modelo 190 aeat retenciones anual fiscalidad",
    hash: "#model-190",
  },
];

const FAQ = [
  {
    question: "¿Por dónde empiezo una actividad?",
    answer: "Abre «Curso» y revisa el Encargo, los Datos del caso, Tu tarea y el Resultado esperado. Desde esa misma actividad tendrás el acceso al módulo del ERP en el que debes trabajar.",
  },
  {
    question: "¿Cómo sé si he hecho bien una gestión?",
    answer: "Cuando la actividad permita comprobación, AulaNomina revisará los datos reales guardados en el ERP. Si falta algo, mostrará los criterios pendientes para que puedas corregirlo y volver a comprobar.",
  },
  {
    question: "¿Qué ocurre si me equivoco?",
    answer: "En las prácticas normales puedes corregir los datos y volver a intentarlo. Los intentos quedan registrados con finalidad formativa, pero equivocarte no bloquea el curso.",
  },
  {
    question: "¿Dónde veo mi avance?",
    answer: "Dentro de «Curso». La cabecera muestra el progreso total y el índice lateral muestra cuántas actividades has completado en cada bloque. No necesitas una pantalla de progreso separada.",
  },
  {
    question: "¿Cómo vuelvo a la actividad que estaba realizando?",
    answer: "Pulsa «Curso». AulaNomina conserva el contexto de la actividad actual y la selecciona al volver al centro de actividades.",
  },
  {
    question: "¿Para qué sirve el correo?",
    answer: "Algunos casos comienzan con una comunicación simulada. El mensaje puede aportar datos, documentos o instrucciones que debes utilizar después en el ERP y, cuando proceda, responder desde el mismo hilo.",
  },
  {
    question: "¿Las evaluaciones C01–C06 tienen pistas?",
    answer: "No. Las evaluaciones prácticas no muestran pistas ni procedimiento guiado. Sí puedes consultar el ERP y la información disponible en el propio caso.",
  },
  {
    question: "No encuentro una opción del ERP. ¿Qué hago?",
    answer: "Usa el buscador «¿Dónde está…?» de esta ventana. Puedes buscar por nombre o por conceptos relacionados, por ejemplo «IT», «alta», «IRPF», «RNT», «correo» o «modelo 111».",
  },
  {
    question: "¿Puedo repetir el tutorial sin borrar mi curso?",
    answer: "Sí. Repetir o continuar el tutorial no modifica empresas, trabajadores, actividades, intentos ni progreso. Es únicamente una guía de uso de AulaNomina.",
  },
];

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function openLocation(location) {
  if (location.page) {
    if (window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      window.dispatchEvent(new Event("aulanomina-route-change"));
    }
    window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: location.page } }));
    return;
  }
  if (location.hash) {
    window.location.hash = location.hash;
  }
}

export default function TrainingHelpCenter() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tutorialState, setTutorialState] = useState(() => readTutorialState());
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
    setTutorialState(readTutorialState());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        if (resetConfirm) setResetConfirm(false);
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, resetConfirm]);

  const results = useMemo(() => {
    const term = normalize(query);
    if (!term) return LOCATIONS;
    return LOCATIONS.filter((item) => normalize(
      `${item.title} ${item.path} ${item.description} ${item.keywords}`
    ).includes(term));
  }, [query]);

  const launchTutorial = (mode) => {
    setOpen(false);
    setResetConfirm(false);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("aulanomina-tutorial-open", { detail: { mode } }));
    }, 0);
  };

  const navigateTo = (location) => {
    setOpen(false);
    window.setTimeout(() => openLocation(location), 0);
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
      setNotice("Entorno práctico restaurado al estado inicial. El historial de intentos se conserva.");
      window.dispatchEvent(new Event("aulanomina-activities-refresh"));
    } catch (error) {
      setNotice(error.message || "No se ha podido restablecer el entorno práctico.");
    } finally {
      setResetting(false);
    }
  };

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

          <section className="training-help__tutorial-card">
            <div className="training-help__tutorial-icon"><PlayCircle size={24} aria-hidden="true" /></div>
            <div className="training-help__tutorial-copy">
              <span>Tutorial guiado</span>
              <strong>{tutorialStatusLabel(tutorialState)}</strong>
              <p>Repasa la introducción y la familiarización inicial sin modificar el estado del curso.</p>
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
                <button type="button" key={location.title} className="training-help__result" onClick={() => navigateTo(location)}>
                  <MapPin size={17} aria-hidden="true" />
                  <span>
                    <strong>{location.title}</strong>
                    <small>{location.path}</small>
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
                <p>Úsalo solo si necesitas volver a los datos iniciales del ERP. Los intentos y puntuaciones históricas no se eliminan.</p>
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
