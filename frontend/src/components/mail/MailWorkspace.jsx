import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  FileText,
  Flag,
  Forward,
  Inbox,
  Mail,
  MailOpen,
  Menu,
  MoreHorizontal,
  Paperclip,
  PenLine,
  RefreshCw,
  Reply,
  ReplyAll,
  Search,
  Send,
  Settings,
  Trash2,
  UserRound,
} from "lucide-react";

import mailLogo from "../../assets/mail-access.svg";
import "./mailWorkspace.css";

const INITIAL_MESSAGES = [
  {
    id: 1,
    folder: "inbox",
    sender: "María López · Administración",
    address: "administracion@empresa-demo.es",
    subject: "Revisión de antigüedad en la nómina de Ana Martín",
    preview: "La trabajadora indica que su nómina de julio no incluye el complemento de antigüedad...",
    receivedAt: "Hoy, 08:12",
    unread: true,
    priority: "high",
    category: "Nómina",
    caseReference: "NOM-2026-014",
    caseStatus: "pending",
    attachments: ["Solicitud_Ana_Martin.pdf"],
    body: [
      "Buenos días:",
      "La trabajadora Ana Martín nos comunica que su nómina de julio no incluye el complemento de antigüedad que le corresponde desde el 1 de julio de 2026.",
      "Revisa su expediente, comprueba la fecha de antigüedad, regulariza el concepto y recalcula la nómina. El caso no debe cerrarse hasta que la diferencia quede correctamente reflejada.",
      "Gracias.",
    ],
    requirements: ["Comprobar la antigüedad del contrato", "Añadir o corregir el concepto", "Recalcular la nómina", "Generar la regularización correspondiente"],
    contextActions: ["Abrir trabajadora", "Abrir nómina", "Abrir regularizaciones"],
  },
  {
    id: 2,
    folder: "inbox",
    sender: "Comunicaciones INSS",
    address: "fie@inss.aulanomina.local",
    subject: "FIE disponible: proceso de incapacidad temporal",
    preview: "Se ha recibido una comunicación FIE relativa a una baja médica con fecha de efectos 03/08/2026...",
    receivedAt: "Hoy, 07:46",
    unread: true,
    priority: "urgent",
    category: "Seguridad Social",
    caseReference: "IT-2026-008",
    caseStatus: "in_progress",
    attachments: ["FIE_IT_03082026.txt", "Parte_baja_Ana_Martin.pdf"],
    body: [
      "Se ha recibido una comunicación FIE relativa a una baja médica con fecha de efectos 03/08/2026.",
      "Comprueba que la incidencia registrada coincide con el parte adjunto y concilia la comunicación antes de continuar con el cálculo de nómina.",
    ],
    requirements: ["Revisar fechas del parte", "Conciliar la comunicación FIE", "Comprobar el impacto en nómina"],
    contextActions: ["Abrir FIE", "Abrir incidencia", "Abrir nómina"],
  },
  {
    id: 3,
    folder: "inbox",
    sender: "Dirección del centro Norte",
    address: "direccion.norte@empresa-demo.es",
    subject: "Alta de sustitución por incapacidad temporal",
    preview: "Necesitamos tramitar la incorporación de Laura Sánchez como sustituta durante la ausencia...",
    receivedAt: "Ayer, 16:28",
    unread: true,
    priority: "normal",
    category: "Contratación",
    caseReference: "ALT-2026-021",
    caseStatus: "pending",
    attachments: ["Datos_sustituta_Laura_Sanchez.pdf"],
    body: [
      "Buenas tardes:",
      "Necesitamos tramitar la incorporación de Laura Sánchez como sustituta durante la ausencia de Ana Martín.",
      "Los datos necesarios se encuentran en el documento adjunto. La fecha de alta prevista es el 06/08/2026 y la jornada debe coincidir con la persona sustituida.",
    ],
    requirements: ["Crear el expediente", "Registrar el contrato de sustitución", "Preparar el movimiento de alta"],
    contextActions: ["Nuevo trabajador", "Nuevo contrato", "Abrir afiliación"],
  },
  {
    id: 4,
    folder: "inbox",
    sender: "Departamento fiscal",
    address: "fiscal@empresa-demo.es",
    subject: "Diferencia detectada en el Modelo 111 del segundo trimestre",
    preview: "La suma de las retenciones de profesionales no coincide con el importe declarado...",
    receivedAt: "Lun, 11:03",
    unread: false,
    priority: "high",
    category: "Fiscal",
    caseReference: "FIS-2026-006",
    caseStatus: "waiting",
    attachments: ["Detalle_retenciones_Q2.xlsx"],
    body: [
      "La suma de las retenciones de profesionales no coincide con el importe declarado en el Modelo 111 del segundo trimestre.",
      "Revisa las facturas registradas, identifica la diferencia y prepara una declaración complementaria cuando proceda.",
    ],
    requirements: ["Conciliar facturas profesionales", "Recalcular el Modelo 111", "Documentar la corrección"],
    contextActions: ["Abrir profesionales", "Abrir Modelo 111"],
  },
  {
    id: 5,
    folder: "inbox",
    sender: "Archivo laboral",
    address: "documentos@empresa-demo.es",
    subject: "Certificado de empresa incorporado al expediente",
    preview: "El certificado solicitado ha sido generado y está disponible en el gestor documental...",
    receivedAt: "Vie, 13:20",
    unread: false,
    priority: "low",
    category: "Documentación",
    caseReference: "DOC-2026-003",
    caseStatus: "resolved",
    attachments: ["Certificado_empresa.pdf"],
    body: [
      "El certificado solicitado ha sido generado y está disponible en el gestor documental.",
      "No quedan acciones pendientes. El caso puede mantenerse archivado como evidencia del ejercicio.",
    ],
    requirements: ["Documento generado", "Expediente actualizado"],
    contextActions: ["Abrir documentos"],
  },
  {
    id: 6,
    folder: "sent",
    sender: "Alejandro Ros",
    address: "usuario.demo@aulanomina.local",
    subject: "Regularización de antigüedad completada",
    preview: "Se ha revisado el expediente y recalculado la nómina con el complemento correspondiente...",
    receivedAt: "Ayer, 12:06",
    unread: false,
    priority: "normal",
    category: "Nómina",
    caseReference: "NOM-2026-009",
    caseStatus: "resolved",
    attachments: [],
    body: ["Se ha revisado el expediente y recalculado la nómina con el complemento correspondiente. Adjunto la trazabilidad de la regularización."],
    requirements: ["Respuesta enviada"],
    contextActions: ["Abrir regularización"],
  },
  {
    id: 7,
    folder: "drafts",
    sender: "Borrador",
    address: "usuario.demo@aulanomina.local",
    subject: "Respuesta pendiente: discrepancia de bases",
    preview: "He revisado el fichero de respuesta de SILTRA y la diferencia se debe a...",
    receivedAt: "Ayer, 09:40",
    unread: false,
    priority: "normal",
    category: "Seguridad Social",
    caseReference: "SS-2026-011",
    caseStatus: "in_progress",
    attachments: [],
    body: ["He revisado el fichero de respuesta de SILTRA y la diferencia se debe a..."],
    requirements: ["Completar respuesta"],
    contextActions: ["Abrir SILTRA"],
  },
  {
    id: 8,
    folder: "archive",
    sender: "Agencia Tributaria simulada",
    address: "notificaciones@aeat.aulanomina.local",
    subject: "Presentación del Modelo 190 aceptada",
    preview: "La declaración anual ha sido recibida correctamente y se ha generado el justificante...",
    receivedAt: "31/07/2026",
    unread: false,
    priority: "low",
    category: "Fiscal",
    caseReference: "FIS-2026-002",
    caseStatus: "resolved",
    attachments: ["Justificante_Modelo_190.pdf"],
    body: ["La declaración anual ha sido recibida correctamente y se ha generado el justificante de presentación."],
    requirements: ["Presentación aceptada"],
    contextActions: ["Abrir Modelo 190"],
  },
];

const PRIMARY_FOLDERS = [
  { id: "inbox", label: "Bandeja de entrada", icon: Inbox },
  { id: "sent", label: "Enviados", icon: Send },
  { id: "drafts", label: "Borradores", icon: FileText },
  { id: "archive", label: "Archivados", icon: Archive },
  { id: "trash", label: "Papelera", icon: Trash2 },
];

const CASE_VIEWS = [
  { id: "pending", label: "Casos pendientes", icon: Circle },
  { id: "in_progress", label: "En progreso", icon: Clock3 },
  { id: "resolved", label: "Resueltos", icon: CheckCircle2 },
];

const STATUS_LABELS = {
  pending: "Pendiente",
  in_progress: "En progreso",
  waiting: "En espera",
  resolved: "Resuelto",
};

const PRIORITY_LABELS = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

function messageMatchesView(message, view) {
  if (PRIMARY_FOLDERS.some((folder) => folder.id === view)) return message.folder === view;
  return message.caseStatus === view;
}

export default function MailWorkspace({ onClose }) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [activeView, setActiveView] = useState("inbox");
  const [selectedId, setSelectedId] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [notice, setNotice] = useState("");

  const visibleMessages = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase("es");
    return messages.filter((message) => {
      if (!messageMatchesView(message, activeView)) return false;
      if (!query) return true;
      return [message.sender, message.subject, message.preview, message.caseReference, message.category]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(query);
    });
  }, [activeView, messages, searchText]);

  const selectedMessage = messages.find((message) => message.id === selectedId) || null;
  const inboxUnread = messages.filter((message) => message.folder === "inbox" && message.unread).length;

  useEffect(() => {
    if (visibleMessages.some((message) => message.id === selectedId)) return;
    setSelectedId(visibleMessages[0]?.id || null);
  }, [selectedId, visibleMessages]);

  const selectMessage = (messageId) => {
    setSelectedId(messageId);
    setMessages((current) => current.map((message) => (
      message.id === messageId ? { ...message, unread: false } : message
    )));
  };

  const countForView = (viewId) => messages.filter((message) => messageMatchesView(message, viewId)).length;

  const toggleRead = () => {
    if (!selectedMessage) return;
    setMessages((current) => current.map((message) => (
      message.id === selectedMessage.id ? { ...message, unread: !message.unread } : message
    )));
  };

  const archiveSelected = () => {
    if (!selectedMessage) return;
    setMessages((current) => current.map((message) => (
      message.id === selectedMessage.id ? { ...message, folder: "archive", unread: false } : message
    )));
    setNotice("Mensaje archivado dentro del entorno simulado.");
  };

  const moveToTrash = () => {
    if (!selectedMessage) return;
    setMessages((current) => current.map((message) => (
      message.id === selectedMessage.id ? { ...message, folder: "trash", unread: false } : message
    )));
    setNotice("Mensaje movido a la papelera simulada.");
  };

  const showPlaceholder = (text) => setNotice(`${text}. La acción quedará conectada al motor de casos en los siguientes pasos del split.`);

  return (
    <div className="mail-shell">
      <header className="mail-app-bar">
        <div className="mail-brand">
          <img src={mailLogo} alt="" />
          <div>
            <strong>AulaNomina</strong>
            <span>Correo educativo</span>
          </div>
        </div>

        <label className="mail-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Buscar mensajes, trabajadores o casos"
          />
        </label>

        <div className="mail-user-actions">
          <button type="button" title="Configuración del correo" onClick={() => showPlaceholder("Configuración")}> <Settings size={18} /> </button>
          <span className="mail-user-avatar"><UserRound size={18} /></span>
          <div><strong>Usuario demo</strong><span>Docente</span></div>
        </div>
      </header>

      <nav className="mail-command-bar" aria-label="Acciones de correo">
        <button type="button" className="mail-command-primary" onClick={() => showPlaceholder("Nuevo correo")}><PenLine size={16} /> Correo nuevo</button>
        <span className="mail-command-separator" />
        <button type="button" onClick={moveToTrash} disabled={!selectedMessage}><Trash2 size={16} /> Eliminar</button>
        <button type="button" onClick={archiveSelected} disabled={!selectedMessage}><Archive size={16} /> Archivar</button>
        <button type="button" onClick={toggleRead} disabled={!selectedMessage}>{selectedMessage?.unread ? <MailOpen size={16} /> : <Mail size={16} />} Leído / no leído</button>
        <button type="button" onClick={() => showPlaceholder("Actualizar bandeja")}><RefreshCw size={16} /> Actualizar</button>
        <span className="mail-command-spacer" />
        <button type="button" onClick={onClose}><ArrowLeft size={16} /> Volver a AulaNomina</button>
        <button type="button" aria-label="Más acciones" onClick={() => showPlaceholder("Más acciones")}><MoreHorizontal size={18} /></button>
      </nav>

      {notice && (
        <div className="mail-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>Cerrar</button>
        </div>
      )}

      <main className="mail-workspace">
        <aside className="mail-folder-pane">
          <button type="button" className="mail-folder-pane__compose" onClick={() => showPlaceholder("Nuevo correo")}><PenLine size={17} /> Nueva comunicación</button>

          <div className="mail-folder-account">
            <span className="mail-folder-account__avatar">AN</span>
            <div><strong>Correo AulaNomina</strong><span>usuario.demo@aulanomina.local</span></div>
            <ChevronDown size={16} />
          </div>

          <section className="mail-folder-group">
            <h2>Carpetas</h2>
            {PRIMARY_FOLDERS.map((folder) => {
              const Icon = folder.icon;
              const count = folder.id === "inbox" ? inboxUnread : countForView(folder.id);
              return (
                <button
                  type="button"
                  key={folder.id}
                  className={activeView === folder.id ? "mail-folder-button is-active" : "mail-folder-button"}
                  onClick={() => setActiveView(folder.id)}
                >
                  <Icon size={17} />
                  <span>{folder.label}</span>
                  {count > 0 && <strong>{count}</strong>}
                </button>
              );
            })}
          </section>

          <section className="mail-folder-group">
            <h2>Casos prácticos</h2>
            {CASE_VIEWS.map((view) => {
              const Icon = view.icon;
              return (
                <button
                  type="button"
                  key={view.id}
                  className={activeView === view.id ? "mail-folder-button is-active" : "mail-folder-button"}
                  onClick={() => setActiveView(view.id)}
                >
                  <Icon size={17} />
                  <span>{view.label}</span>
                  <strong>{countForView(view.id)}</strong>
                </button>
              );
            })}
          </section>
        </aside>

        <section className="mail-message-list" aria-label="Lista de mensajes">
          <div className="mail-message-list__header">
            <div>
              <button type="button" aria-label="Mostrar navegación"><Menu size={18} /></button>
              <h1>{[...PRIMARY_FOLDERS, ...CASE_VIEWS].find((item) => item.id === activeView)?.label}</h1>
            </div>
            <button type="button" onClick={() => showPlaceholder("Ordenar y filtrar")}>Filtrar <ChevronDown size={15} /></button>
          </div>

          <div className="mail-message-list__summary">
            <span>{visibleMessages.length} mensajes</span>
            <span>{visibleMessages.filter((message) => message.unread).length} sin leer</span>
          </div>

          <div className="mail-message-scroll">
            {visibleMessages.length === 0 && <div className="mail-empty-list">No hay mensajes en esta vista.</div>}
            {visibleMessages.map((message) => (
              <button
                type="button"
                key={message.id}
                className={`mail-message-card ${message.unread ? "is-unread" : ""} ${selectedId === message.id ? "is-selected" : ""}`}
                onClick={() => selectMessage(message.id)}
              >
                <div className="mail-message-card__top">
                  <strong>{message.sender}</strong>
                  <time>{message.receivedAt}</time>
                </div>
                <div className="mail-message-card__subject">
                  {message.priority === "urgent" || message.priority === "high" ? <Flag size={14} aria-label={`Prioridad ${PRIORITY_LABELS[message.priority]}`} /> : null}
                  <span>{message.subject}</span>
                </div>
                <p>{message.preview}</p>
                <div className="mail-message-card__meta">
                  <span>{message.caseReference}</span>
                  <span className={`mail-case-status mail-case-status--${message.caseStatus}`}>{STATUS_LABELS[message.caseStatus]}</span>
                  {message.attachments.length > 0 && <Paperclip size={14} aria-label="Con adjuntos" />}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mail-reading-pane" aria-label="Lectura del mensaje">
          {!selectedMessage && <div className="mail-reading-empty"><Mail size={42} /><h2>Selecciona un mensaje</h2><p>El contenido y las acciones del caso aparecerán aquí.</p></div>}

          {selectedMessage && (
            <>
              <div className="mail-reading-toolbar">
                <button type="button" onClick={() => showPlaceholder("Responder")}><Reply size={16} /> Responder</button>
                <button type="button" onClick={() => showPlaceholder("Responder a todos")}><ReplyAll size={16} /> Responder a todos</button>
                <button type="button" onClick={() => showPlaceholder("Reenviar")}><Forward size={16} /> Reenviar</button>
                <button type="button" aria-label="Más opciones" onClick={() => showPlaceholder("Más opciones")}><MoreHorizontal size={18} /></button>
              </div>

              <article className="mail-reading-content">
                <div className="mail-reading-title-row">
                  <div>
                    <span className="mail-reading-category">{selectedMessage.category}</span>
                    <h2>{selectedMessage.subject}</h2>
                  </div>
                  <span className={`mail-priority mail-priority--${selectedMessage.priority}`}>Prioridad {PRIORITY_LABELS[selectedMessage.priority]}</span>
                </div>

                <div className="mail-sender-row">
                  <span className="mail-sender-avatar">{selectedMessage.sender.slice(0, 2).toUpperCase()}</span>
                  <div><strong>{selectedMessage.sender}</strong><span>{selectedMessage.address}</span><small>Para: usuario.demo@aulanomina.local</small></div>
                  <time>{selectedMessage.receivedAt}</time>
                </div>

                <div className="mail-case-banner">
                  <div><span>Caso práctico</span><strong>{selectedMessage.caseReference}</strong></div>
                  <div><span>Estado</span><strong>{STATUS_LABELS[selectedMessage.caseStatus]}</strong></div>
                  <div><span>Área</span><strong>{selectedMessage.category}</strong></div>
                </div>

                <div className="mail-body-copy">
                  {selectedMessage.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>

                {selectedMessage.attachments.length > 0 && (
                  <section className="mail-attachments">
                    <h3><Paperclip size={16} /> {selectedMessage.attachments.length} adjunto{selectedMessage.attachments.length > 1 ? "s" : ""}</h3>
                    <div>
                      {selectedMessage.attachments.map((attachment) => (
                        <button type="button" key={attachment} onClick={() => showPlaceholder(`Abrir ${attachment}`)}><FileText size={20} /><span>{attachment}<small>Documento simulado</small></span></button>
                      ))}
                    </div>
                  </section>
                )}

                <section className="mail-case-checklist">
                  <h3>Acciones esperadas</h3>
                  {selectedMessage.requirements.map((requirement) => <div key={requirement}><Circle size={15} /><span>{requirement}</span></div>)}
                </section>

                <section className="mail-context-actions">
                  <h3>Abrir proceso relacionado</h3>
                  <div>
                    {selectedMessage.contextActions.map((action) => <button type="button" key={action} onClick={() => showPlaceholder(action)}>{action}</button>)}
                  </div>
                </section>
              </article>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
