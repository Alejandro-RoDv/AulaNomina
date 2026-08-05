import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
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
  LoaderCircle,
  Mail,
  MailOpen,
  Menu,
  MoreHorizontal,
  Paperclip,
  PenLine,
  RefreshCw,
  Reply,
  ReplyAll,
  Save,
  Search,
  Send,
  Settings,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import mailLogo from "../../assets/mail-access.svg";
import {
  createMailMessage,
  fetchDemoMailbox,
  fetchMailboxStats,
  fetchMailboxThreads,
  resetDemoMailbox,
  updateMailThread,
} from "../../services/mailApi";
import { openCaseModule } from "../../utils/caseNavigation.js";
import MailAttachmentViewer from "./MailAttachmentViewer.jsx";
import MailNewMessageComposer from "./MailNewMessageComposer.jsx";
import MailScenarioPanel from "./MailScenarioPanel";
import "./mailWorkspace.css";
import "./mailWorkspacePersistence.css";

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
  { id: "waiting", label: "En espera", icon: Clock3 },
  { id: "resolved", label: "Resueltos", icon: CheckCircle2 },
];

const STATUS_LABELS = {
  pending: "Pendiente",
  open: "Pendiente",
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

const EMPTY_STATS = {
  total: 0,
  unread: 0,
  inbox: 0,
  sent: 0,
  drafts: 0,
  archive: 0,
  trash: 0,
  pending: 0,
  in_progress: 0,
  waiting: 0,
  resolved: 0,
};

function filtersForView(view, search) {
  const filters = {};
  if (PRIMARY_FOLDERS.some((folder) => folder.id === view)) filters.folder = view;
  else filters.status = view === "pending" ? "open" : view;
  if (search) filters.search = search;
  return filters;
}

function countForView(stats, viewId) {
  if (viewId === "inbox") return stats.unread;
  return stats[viewId] || 0;
}

function formatMessageDate(value) {
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

function splitBody(value) {
  return String(value || "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function recipientForReply(message) {
  const incoming = [...(message?.messages || [])].reverse().find((item) => item.direction === "incoming");
  if (incoming) {
    return {
      name: incoming.sender_name || message.sender,
      address: incoming.sender_address || message.address,
    };
  }
  return {
    name: message?.recipientName || "Destinatario simulado",
    address: message?.recipientAddress || "destinatario@aulanomina.local",
  };
}

function latestDraftBody(message) {
  const draft = [...(message?.messages || [])].reverse().find((item) => item.message_type === "draft");
  return draft?.body_text || "";
}

export default function MailWorkspace({ onClose }) {
  const [mailbox, setMailbox] = useState(null);
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [activeView, setActiveView] = useState("inbox");
  const [selectedId, setSelectedId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [composer, setComposer] = useState(null);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [attachmentViewer, setAttachmentViewer] = useState(null);
  const requestSequence = useRef(0);

  const mailboxId = mailbox?.id;
  const selectedMessage = messages.find((message) => message.id === selectedId) || null;

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedSearch(searchText.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const publishStatsRefresh = useCallback(() => {
    window.dispatchEvent(new Event("aulanomina-mail-stats-refresh"));
  }, []);

  const loadStats = useCallback(async (currentMailboxId) => {
    const nextStats = await fetchMailboxStats(currentMailboxId);
    setStats(nextStats || EMPTY_STATS);
    publishStatsRefresh();
    return nextStats;
  }, [publishStatsRefresh]);

  const refreshView = useCallback(async ({ silent = false, preferredId = null } = {}) => {
    if (!mailboxId) return;
    const sequence = ++requestSequence.current;
    if (!silent) setListLoading(true);
    setError("");
    try {
      const [nextMessages, nextStats] = await Promise.all([
        fetchMailboxThreads(mailboxId, filtersForView(activeView, appliedSearch)),
        fetchMailboxStats(mailboxId),
      ]);
      if (sequence !== requestSequence.current) return;
      setMessages(nextMessages);
      setStats(nextStats || EMPTY_STATS);
      setSelectedId((current) => {
        const requested = preferredId || current;
        if (requested && nextMessages.some((message) => message.id === requested)) return requested;
        return nextMessages[0]?.id || null;
      });
      publishStatsRefresh();
    } catch (requestError) {
      if (sequence !== requestSequence.current) return;
      setError(requestError.message || "No se ha podido sincronizar la bandeja.");
    } finally {
      if (sequence === requestSequence.current && !silent) setListLoading(false);
    }
  }, [activeView, appliedSearch, mailboxId, publishStatsRefresh]);

  const initializeMailbox = useCallback(async () => {
    setInitialLoading(true);
    setError("");
    try {
      setMailbox(await fetchDemoMailbox());
    } catch (requestError) {
      setError(requestError.message || "No se ha podido cargar el correo simulado.");
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeMailbox();
  }, [initializeMailbox]);

  useEffect(() => {
    if (mailboxId) refreshView();
  }, [mailboxId, activeView, appliedSearch, refreshView]);

  const selectMessage = async (message) => {
    setSelectedId(message.id);
    setComposer(null);
    if (!message.unread) return;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, unread: false } : item));
    try {
      const updated = await updateMailThread(message.id, { is_read: true });
      setMessages((current) => current.map((item) => item.id === updated.id ? updated : item));
      await loadStats(mailboxId);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido marcar el mensaje como leído.");
      await refreshView({ silent: true, preferredId: message.id });
    }
  };

  const persistSelectedThread = async (payload, successMessage) => {
    if (!selectedMessage) return;
    setBusyAction("thread");
    setError("");
    try {
      await updateMailThread(selectedMessage.id, payload);
      setNotice(successMessage);
      setComposer(null);
      await refreshView({ silent: true });
    } catch (requestError) {
      setError(requestError.message || "No se ha podido actualizar el mensaje.");
    } finally {
      setBusyAction("");
    }
  };

  const openComposer = (mode) => {
    if (!selectedMessage || !mailbox) return;
    const recipient = recipientForReply(selectedMessage);
    setComposer({
      mode,
      recipientName: mode === "forward" ? "" : recipient.name,
      recipientAddress: mode === "forward" ? "" : recipient.address,
      ccAddress: "",
      body: selectedMessage.folder === "drafts" ? latestDraftBody(selectedMessage) : "",
    });
  };

  const persistComposer = async (messageType) => {
    if (!selectedMessage || !mailbox || !composer) return;
    if (!composer.body.trim() || !composer.recipientAddress.trim()) {
      setError("Indica destinatario y contenido antes de guardar la comunicación.");
      return;
    }
    const isDraft = messageType === "draft";
    setBusyAction(isDraft ? "draft" : "send");
    setError("");
    try {
      const updated = await createMailMessage(selectedMessage.id, {
        sender_name: mailbox.display_name,
        sender_address: mailbox.address,
        recipient_name: composer.recipientName || null,
        recipient_address: composer.recipientAddress.trim(),
        cc_address: composer.ccAddress.trim() || null,
        body_text: composer.body.trim(),
        body_html: null,
        direction: "outgoing",
        message_type: isDraft ? "draft" : composer.mode === "forward" ? "forward" : "reply",
        attachments: [],
      });
      setNotice(isDraft ? "Borrador guardado." : "Respuesta enviada dentro del entorno simulado.");
      setComposer(null);
      await refreshView({ silent: true, preferredId: updated.id });
    } catch (requestError) {
      setError(requestError.message || "No se ha podido guardar la comunicación.");
    } finally {
      setBusyAction("");
    }
  };

  const resetMailbox = async () => {
    if (!window.confirm("Se restaurarán los mensajes iniciales del buzón demo. ¿Continuar?")) return;
    setBusyAction("reset");
    setError("");
    try {
      const demoMailbox = await resetDemoMailbox();
      setMailbox(demoMailbox);
      setActiveView("inbox");
      setSearchText("");
      setAppliedSearch("");
      setComposer(null);
      setNotice("Buzón de demostración restaurado.");
      await refreshView({ preferredId: null });
    } catch (requestError) {
      setError(requestError.message || "No se ha podido restaurar el buzón.");
    } finally {
      setBusyAction("");
    }
  };

  const handleNewThreadCreated = async (created, savedAsDraft) => {
    setNewMessageOpen(false);
    setNotice(savedAsDraft ? "Correo guardado como borrador." : "Correo enviado.");
    setActiveView(savedAsDraft ? "drafts" : "sent");
    window.setTimeout(() => refreshView({ silent: true, preferredId: created.id }), 0);
  };

  const handleScenarioChanged = async (_scenario, successMessage) => {
    if (successMessage) setNotice(successMessage);
    await refreshView({ silent: true, preferredId: selectedMessage?.id || null });
  };

  const openContextAction = (action) => {
    if (!selectedMessage) return;
    const opened = openCaseModule({
      actionCode: action,
      moduleCode: selectedMessage.categoryCode,
      assignmentId: selectedMessage.caseAssignmentId,
      taskId: selectedMessage.caseTaskId,
      scenarioCode: selectedMessage.caseReference,
      employeeId: selectedMessage.employeeId,
      companyId: selectedMessage.companyId,
      relatedEntityType: selectedMessage.relatedEntityType,
      relatedEntityId: selectedMessage.relatedEntityId,
    });
    if (!opened) setError("El navegador ha bloqueado la apertura del proceso relacionado.");
  };

  if (initialLoading) {
    return <div className="mail-shell mail-shell--centered"><LoaderCircle className="mail-spinner" size={36} /><h1>Cargando correo simulado</h1></div>;
  }

  if (!mailbox) {
    return (
      <div className="mail-shell mail-shell--centered">
        <AlertCircle size={42} />
        <h1>No se ha podido abrir el correo</h1>
        <p>{error || "Comprueba que el backend de AulaNomina esté arrancado."}</p>
        <div className="mail-recovery-actions"><button type="button" onClick={initializeMailbox}>Reintentar</button><button type="button" onClick={onClose}>Volver</button></div>
      </div>
    );
  }

  const viewLabel = [...PRIMARY_FOLDERS, ...CASE_VIEWS].find((item) => item.id === activeView)?.label || "Correo";

  return (
    <div className="mail-shell">
      <header className="mail-app-bar">
        <div className="mail-brand"><img src={mailLogo} alt="" /><div><strong>AulaNomina</strong><span>Correo simulado</span></div></div>
        <label className="mail-search"><Search size={17} /><input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Buscar asuntos o referencias" /></label>
        <div className="mail-user-actions"><button type="button" title="Restaurar buzón demo" onClick={resetMailbox} disabled={busyAction === "reset"}>{busyAction === "reset" ? <LoaderCircle className="mail-spinner" size={18} /> : <Settings size={18} />}</button><span className="mail-user-avatar"><UserRound size={18} /></span><div><strong>{mailbox.display_name}</strong><span>{mailbox.role}</span></div></div>
      </header>

      <nav className="mail-command-bar" aria-label="Acciones de correo">
        <button type="button" className="mail-command-primary" onClick={() => setNewMessageOpen(true)}><PenLine size={16} /> Correo nuevo</button>
        <span className="mail-command-separator" />
        <button type="button" onClick={() => persistSelectedThread({ folder: "trash", is_read: true }, "Mensaje movido a la papelera.")} disabled={!selectedMessage || Boolean(busyAction)}><Trash2 size={16} /> Eliminar</button>
        <button type="button" onClick={() => persistSelectedThread({ folder: "archive", is_read: true }, "Mensaje archivado.")} disabled={!selectedMessage || Boolean(busyAction)}><Archive size={16} /> Archivar</button>
        <button type="button" onClick={() => persistSelectedThread({ is_read: selectedMessage?.unread }, selectedMessage?.unread ? "Mensaje marcado como leído." : "Mensaje marcado como no leído.")} disabled={!selectedMessage || Boolean(busyAction)}>{selectedMessage?.unread ? <MailOpen size={16} /> : <Mail size={16} />} Leído / no leído</button>
        <button type="button" onClick={() => refreshView()} disabled={listLoading}><RefreshCw className={listLoading ? "mail-spinner" : ""} size={16} /> Actualizar</button>
        <span className="mail-command-spacer" />
        <button type="button" onClick={onClose}><ArrowLeft size={16} /> Volver a AulaNomina</button>
      </nav>

      {error && <div className="mail-notice mail-notice--error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")}>Cerrar</button></div>}
      {notice && <div className="mail-notice mail-notice--success" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")}>Cerrar</button></div>}

      <main className="mail-workspace">
        <aside className="mail-folder-pane">
          <button type="button" className="mail-folder-pane__compose" onClick={() => setNewMessageOpen(true)}><PenLine size={17} /> Nueva comunicación</button>
          <div className="mail-folder-account"><span className="mail-folder-account__avatar">AN</span><div><strong>{mailbox.display_name}</strong><span>{mailbox.address}</span></div><ChevronDown size={16} /></div>
          <section className="mail-folder-group"><h2>Carpetas</h2>{PRIMARY_FOLDERS.map((folder) => { const Icon = folder.icon; const count = countForView(stats, folder.id); return <button type="button" key={folder.id} className={activeView === folder.id ? "mail-folder-button is-active" : "mail-folder-button"} onClick={() => { setComposer(null); setActiveView(folder.id); }}><Icon size={17} /><span>{folder.label}</span>{count > 0 && <strong>{count}</strong>}</button>; })}</section>
          <section className="mail-folder-group"><h2>Casos prácticos</h2>{CASE_VIEWS.map((view) => { const Icon = view.icon; return <button type="button" key={view.id} className={activeView === view.id ? "mail-folder-button is-active" : "mail-folder-button"} onClick={() => { setComposer(null); setActiveView(view.id); }}><Icon size={17} /><span>{view.label}</span><strong>{countForView(stats, view.id)}</strong></button>; })}</section>
        </aside>

        <section className="mail-message-list" aria-label="Lista de mensajes">
          <div className="mail-message-list__header"><div><button type="button" aria-label="Mostrar navegación"><Menu size={18} /></button><h1>{viewLabel}</h1></div><button type="button">Filtrar <ChevronDown size={15} /></button></div>
          <div className="mail-message-list__summary"><span>{messages.length} conversaciones</span><span>{messages.filter((message) => message.unread).length} sin leer</span></div>
          <div className="mail-message-scroll" aria-busy={listLoading}>
            {listLoading && <div className="mail-list-loading"><LoaderCircle className="mail-spinner" size={22} /> Sincronizando bandeja...</div>}
            {!listLoading && messages.length === 0 && <div className="mail-empty-list"><p>No hay mensajes en esta vista.</p><button type="button" onClick={() => refreshView()}>Actualizar</button></div>}
            {!listLoading && messages.map((message) => (
              <button type="button" key={message.id} className={`mail-message-card ${message.unread ? "is-unread" : ""} ${selectedId === message.id ? "is-selected" : ""}`} onClick={() => selectMessage(message)}>
                <div className="mail-message-card__top"><strong>{message.sender}</strong><time>{message.receivedAt}</time></div>
                <div className="mail-message-card__subject">{["urgent", "high"].includes(message.priority) && <Flag size={14} />}<span>{message.subject}</span></div>
                <p>{message.preview}</p>
                <div className="mail-message-card__meta"><span>{message.caseReference || "SIN-REFERENCIA"}</span><span className={`mail-case-status mail-case-status--${message.caseStatus}`}>{STATUS_LABELS[message.caseStatus]}</span>{message.attachments.length > 0 && <Paperclip size={14} />}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="mail-reading-pane" aria-label="Lectura del mensaje">
          {!selectedMessage && <div className="mail-reading-empty"><Mail size={42} /><h2>Selecciona un mensaje</h2></div>}
          {selectedMessage && (
            <>
              <div className="mail-reading-toolbar"><button type="button" onClick={() => openComposer("reply")}><Reply size={16} /> Responder</button><button type="button" onClick={() => openComposer("reply-all")}><ReplyAll size={16} /> Responder a todos</button><button type="button" onClick={() => openComposer("forward")}><Forward size={16} /> Reenviar</button><button type="button" aria-label="Más opciones"><MoreHorizontal size={18} /></button></div>
              <article className="mail-reading-content">
                <div className="mail-reading-title-row"><div><span className="mail-reading-category">{selectedMessage.category}</span><h2>{selectedMessage.subject}</h2></div><span className={`mail-priority mail-priority--${selectedMessage.priority}`}>Prioridad {PRIORITY_LABELS[selectedMessage.priority]}</span></div>
                <div className="mail-sender-row"><span className="mail-sender-avatar">{selectedMessage.sender.slice(0, 2).toUpperCase()}</span><div><strong>{selectedMessage.sender}</strong><span>{selectedMessage.address}</span><small>Para: {selectedMessage.recipientAddress}{selectedMessage.ccAddress ? ` · CC: ${selectedMessage.ccAddress}` : ""}</small></div><time>{selectedMessage.receivedAt}</time></div>

                <section className="mail-conversation">
                  <h3>Conversación</h3>
                  {(selectedMessage.messages || []).map((threadMessage) => (
                    <article key={threadMessage.id} className={`mail-conversation-item mail-conversation-item--${threadMessage.direction} ${threadMessage.message_type === "draft" ? "is-draft" : ""}`}>
                      <header><div><strong>{threadMessage.sender_name}</strong><span>{threadMessage.sender_address}</span></div><div>{threadMessage.message_type === "draft" && <span className="mail-draft-label">Borrador</span>}<time>{formatMessageDate(threadMessage.sent_at)}</time></div></header>
                      <div className="mail-conversation-item__body">{splitBody(threadMessage.body_text).map((paragraph, index) => <p key={`${threadMessage.id}-${index}`}>{paragraph}</p>)}</div>
                      {threadMessage.attachments?.length > 0 && <div className="mail-conversation-item__attachments">{threadMessage.attachments.map((attachment) => <button type="button" key={attachment.id} onClick={() => setAttachmentViewer(attachment)}><Paperclip size={14} /> {attachment.filename}</button>)}</div>}
                    </article>
                  ))}
                </section>

                {selectedMessage.attachmentRecords.length > 0 && (
                  <section className="mail-attachments"><h3><Paperclip size={16} /> Adjuntos</h3><div>{selectedMessage.attachmentRecords.map((attachment) => <button type="button" key={attachment.id} onClick={() => setAttachmentViewer(attachment)}><FileText size={20} /><span>{attachment.filename}<small>Abrir vista previa</small></span></button>)}</div></section>
                )}

                {selectedMessage.caseReference && <div className="mail-case-banner"><div><span>Referencia</span><strong>{selectedMessage.caseReference}</strong></div><div><span>Estado</span><strong>{STATUS_LABELS[selectedMessage.caseStatus]}</strong></div><div><span>Área</span><strong>{selectedMessage.category}</strong></div></div>}

                <MailScenarioPanel key={`${selectedMessage.id}-${selectedMessage.caseAssignmentId || "unlinked"}`} message={selectedMessage} onScenarioChanged={handleScenarioChanged} />

                <section className="mail-context-actions"><h3>Abrir proceso relacionado</h3><div>{selectedMessage.contextActions.map((action) => <button type="button" key={action} onClick={() => openContextAction(action)}>{action}</button>)}</div></section>

                {composer && (
                  <section className="mail-composer">
                    <header className="mail-composer__header"><div><strong>{composer.mode === "forward" ? "Reenviar comunicación" : "Responder al hilo"}</strong><span>La comunicación se guarda dentro de AulaNomina.</span></div><button type="button" onClick={() => setComposer(null)} aria-label="Cerrar editor"><X size={18} /></button></header>
                    <label className="mail-composer__field"><span>Destinatario</span><input value={composer.recipientAddress} onChange={(event) => setComposer((current) => ({ ...current, recipientAddress: event.target.value }))} /></label>
                    <label className="mail-composer__field"><span>Nombre</span><input value={composer.recipientName} onChange={(event) => setComposer((current) => ({ ...current, recipientName: event.target.value }))} /></label>
                    <label className="mail-composer__field"><span>CC</span><input value={composer.ccAddress} onChange={(event) => setComposer((current) => ({ ...current, ccAddress: event.target.value }))} /></label>
                    <label className="mail-composer__field mail-composer__field--body"><span>Mensaje</span><textarea value={composer.body} onChange={(event) => setComposer((current) => ({ ...current, body: event.target.value }))} /></label>
                    <footer className="mail-composer__actions"><button type="button" className="mail-composer__send" onClick={() => persistComposer("send")} disabled={Boolean(busyAction)}>{busyAction === "send" ? <LoaderCircle className="mail-spinner" size={16} /> : <Send size={16} />} Enviar</button><button type="button" onClick={() => persistComposer("draft")} disabled={Boolean(busyAction)}>{busyAction === "draft" ? <LoaderCircle className="mail-spinner" size={16} /> : <Save size={16} />} Guardar borrador</button><button type="button" onClick={() => setComposer(null)}>Cancelar</button></footer>
                  </section>
                )}
              </article>
            </>
          )}
        </section>
      </main>

      {newMessageOpen && <MailNewMessageComposer mailbox={mailbox} onClose={() => setNewMessageOpen(false)} onCreated={handleNewThreadCreated} />}
      {attachmentViewer && <MailAttachmentViewer attachment={attachmentViewer} onClose={() => setAttachmentViewer(null)} />}
    </div>
  );
}
