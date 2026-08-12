import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  FileText,
  Inbox,
  LoaderCircle,
  Mail,
  MailOpen,
  Paperclip,
  PenLine,
  RefreshCw,
  Reply,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";

import mailLogo from "../../assets/mail-access.svg";
import {
  createMailMessage,
  fetchDemoMailbox,
  fetchMailboxStats,
  fetchMailboxThreads,
  updateMailThread,
} from "../../services/mailApi";
import MailAttachmentViewer from "./MailAttachmentViewer.jsx";
import MailNewMessageComposer from "./MailNewMessageComposer.jsx";
import "./simpleMailWorkspace.css";

const FOLDERS = [
  { id: "inbox", label: "Bandeja de entrada", icon: Inbox },
  { id: "sent", label: "Enviados", icon: Send },
  { id: "drafts", label: "Borradores", icon: FileText },
  { id: "archive", label: "Archivados", icon: Archive },
  { id: "trash", label: "Papelera", icon: Trash2 },
];

const EMPTY_STATS = { total: 0, unread: 0, inbox: 0, sent: 0, drafts: 0, archive: 0, trash: 0 };

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

function visibleConversation(message) {
  return (message?.messages || []).filter((item) => (
    item.sender_address !== "tutor@aulanomina.local"
    && item.message_type !== "automatic"
  ));
}

function isProfessionalUnread(message) {
  if (!message?.unread) return false;
  const latest = [...(message.messages || [])].reverse()[0];
  return latest?.sender_address !== "tutor@aulanomina.local" && latest?.message_type !== "automatic";
}

function professionalPreview(message) {
  const latest = [...visibleConversation(message)].reverse().find((item) => item.body_text);
  return String(latest?.body_text || "").replace(/\s+/g, " ").trim().slice(0, 140);
}

function splitBody(value) {
  return String(value || "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function replyRecipient(message) {
  const incoming = [...visibleConversation(message)].reverse().find((item) => item.direction === "incoming");
  return {
    name: incoming?.sender_name || message?.sender || "Destinatario",
    address: incoming?.sender_address || message?.address || "",
  };
}

function countForFolder(stats, folder) {
  return folder === "inbox" ? stats.unread || 0 : stats[folder] || 0;
}

export default function SimpleMailWorkspace({ onClose }) {
  const [mailbox, setMailbox] = useState(null);
  const [threads, setThreads] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [folder, setFolder] = useState("inbox");
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [composer, setComposer] = useState(null);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [attachmentViewer, setAttachmentViewer] = useState(null);
  const requestSequence = useRef(0);

  const selected = threads.find((thread) => thread.id === selectedId) || null;

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const publishStats = useCallback(() => {
    window.dispatchEvent(new Event("aulanomina-mail-stats-refresh"));
  }, []);

  const loadThreads = useCallback(async ({ quiet = false, preferredId = null } = {}) => {
    if (!mailbox?.id) return;
    const sequence = ++requestSequence.current;
    if (!quiet) setLoading(true);
    setError("");
    try {
      const filters = { folder };
      if (appliedSearch) filters.search = appliedSearch;
      const [nextThreads, nextStats, inboxThreads] = await Promise.all([
        fetchMailboxThreads(mailbox.id, filters),
        fetchMailboxStats(mailbox.id),
        fetchMailboxThreads(mailbox.id, { folder: "inbox" }),
      ]);
      if (sequence !== requestSequence.current) return;
      const visibleThreads = (nextThreads || []).map((thread) => ({ ...thread, unread: isProfessionalUnread(thread) }));
      const professionalUnread = (inboxThreads || []).filter(isProfessionalUnread).length;
      setThreads(visibleThreads);
      setStats({ ...(nextStats || EMPTY_STATS), unread: professionalUnread });
      setSelectedId((current) => {
        const wanted = preferredId || current;
        if (wanted && visibleThreads.some((thread) => thread.id === wanted)) return wanted;
        return visibleThreads[0]?.id || null;
      });
      publishStats();
    } catch (requestError) {
      if (sequence === requestSequence.current) setError(requestError.message || "No se ha podido cargar el correo.");
    } finally {
      if (sequence === requestSequence.current && !quiet) setLoading(false);
    }
  }, [appliedSearch, folder, mailbox?.id, publishStats]);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        setMailbox(await fetchDemoMailbox());
      } catch (requestError) {
        setError(requestError.message || "No se ha podido abrir el buzón.");
        setLoading(false);
      }
    };
    initialize();
  }, []);

  useEffect(() => {
    if (mailbox?.id) loadThreads();
  }, [mailbox?.id, folder, appliedSearch, loadThreads]);

  const selectThread = async (thread) => {
    setSelectedId(thread.id);
    setComposer(null);
    if (!thread.unread) return;
    setThreads((current) => current.map((item) => item.id === thread.id ? { ...item, unread: false } : item));
    try {
      await updateMailThread(thread.id, { is_read: true });
      await loadThreads({ quiet: true, preferredId: thread.id });
    } catch (requestError) {
      setError(requestError.message || "No se ha podido marcar el mensaje como leído.");
    }
  };

  const moveSelected = async (payload) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await updateMailThread(selected.id, payload);
      setComposer(null);
      await loadThreads({ quiet: true });
    } catch (requestError) {
      setError(requestError.message || "No se ha podido actualizar el mensaje.");
    } finally {
      setBusy(false);
    }
  };

  const openReply = () => {
    if (!selected) return;
    const recipient = replyRecipient(selected);
    setComposer({ recipientName: recipient.name, recipientAddress: recipient.address, body: "" });
  };

  const saveReply = async (messageType) => {
    if (!selected || !composer?.recipientAddress.trim() || !composer?.body.trim()) return;
    setBusy(true);
    setError("");
    try {
      await createMailMessage(selected.id, {
        sender_name: mailbox.display_name,
        sender_address: mailbox.address,
        recipient_name: composer.recipientName || null,
        recipient_address: composer.recipientAddress.trim(),
        cc_address: null,
        body_text: composer.body.trim(),
        body_html: null,
        direction: "outgoing",
        message_type: messageType,
        attachments: [],
      });
      setComposer(null);
      await loadThreads({ quiet: true, preferredId: selected.id });
    } catch (requestError) {
      setError(requestError.message || "No se ha podido guardar la respuesta.");
    } finally {
      setBusy(false);
    }
  };

  const handleNewMessage = async (created, savedAsDraft) => {
    setNewMessageOpen(false);
    setFolder(savedAsDraft ? "drafts" : "sent");
    window.setTimeout(() => loadThreads({ quiet: true, preferredId: created.id }), 0);
  };

  if (!mailbox && loading) {
    return <div className="simple-mail simple-mail--loading"><LoaderCircle className="simple-mail__spinner" /><span>Cargando correo…</span></div>;
  }

  return (
    <div className="simple-mail">
      <header className="simple-mail__topbar">
        <div className="simple-mail__brand">
          <img src={mailLogo} alt="" />
          <div><strong>Correo</strong><span>AulaNomina</span></div>
        </div>
        <label className="simple-mail__search">
          <Search size={17} aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en el correo" />
        </label>
        <button type="button" className="simple-mail__back" onClick={onClose}><ArrowLeft size={16} /> Volver a AulaNomina</button>
      </header>

      {error && <div className="simple-mail__error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")}><X size={15} /></button></div>}

      <main className="simple-mail__workspace">
        <aside className="simple-mail__folders">
          <button type="button" className="simple-mail__compose" onClick={() => setNewMessageOpen(true)}><PenLine size={16} /> Nuevo correo</button>
          <div className="simple-mail__account"><strong>{mailbox?.display_name}</strong><span>{mailbox?.address}</span></div>
          <nav aria-label="Carpetas de correo">
            {FOLDERS.map((item) => {
              const Icon = item.icon;
              const count = countForFolder(stats, item.id);
              return (
                <button type="button" key={item.id} className={folder === item.id ? "is-active" : ""} onClick={() => { setFolder(item.id); setComposer(null); }}>
                  <Icon size={16} aria-hidden="true" /><span>{item.label}</span>{count > 0 && <small>{count}</small>}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="simple-mail__list" aria-label="Mensajes">
          <header>
            <div><h1>{FOLDERS.find((item) => item.id === folder)?.label || "Correo"}</h1><span>{threads.length} mensajes</span></div>
            <button type="button" onClick={() => loadThreads()} disabled={loading}><RefreshCw size={16} className={loading ? "simple-mail__spinner" : ""} /></button>
          </header>
          <div className="simple-mail__thread-scroll">
            {loading && <div className="simple-mail__list-state"><LoaderCircle className="simple-mail__spinner" /> Actualizando…</div>}
            {!loading && threads.length === 0 && <div className="simple-mail__list-state">No hay mensajes en esta carpeta.</div>}
            {!loading && threads.map((thread) => (
              <button type="button" key={thread.id} className={`simple-mail__thread${thread.unread ? " is-unread" : ""}${selectedId === thread.id ? " is-selected" : ""}`} onClick={() => selectThread(thread)}>
                <div><strong>{thread.sender}</strong><time>{thread.receivedAt}</time></div>
                <span className="simple-mail__subject">{thread.subject}</span>
                <p>{professionalPreview(thread)}</p>
                {thread.attachments?.length > 0 && <small><Paperclip size={12} /> {thread.attachments.length} adjunto{thread.attachments.length > 1 ? "s" : ""}</small>}
              </button>
            ))}
          </div>
        </section>

        <section className="simple-mail__reading" aria-label="Vista del mensaje">
          {!selected && <div className="simple-mail__empty"><Mail size={34} /><h2>Selecciona un mensaje</h2><p>El contenido aparecerá en esta zona.</p></div>}
          {selected && (
            <>
              <div className="simple-mail__toolbar">
                <button type="button" onClick={openReply}><Reply size={15} /> Responder</button>
                <button type="button" onClick={() => moveSelected({ folder: "archive", is_read: true })} disabled={busy}><Archive size={15} /> Archivar</button>
                <button type="button" onClick={() => moveSelected({ is_read: selected.unread })} disabled={busy}>{selected.unread ? <MailOpen size={15} /> : <Mail size={15} />} Leído / no leído</button>
                <button type="button" onClick={() => moveSelected({ folder: "trash", is_read: true })} disabled={busy}><Trash2 size={15} /> Eliminar</button>
              </div>

              <article className="simple-mail__message">
                <header className="simple-mail__message-heading">
                  <h2>{selected.subject}</h2>
                  <div className="simple-mail__sender"><div><strong>{selected.sender}</strong><span>{selected.address}</span><small>Para: {selected.recipientAddress}</small></div><time>{selected.receivedAt}</time></div>
                </header>

                <div className="simple-mail__conversation">
                  {visibleConversation(selected).map((message) => (
                    <section key={message.id} className={`simple-mail__conversation-item simple-mail__conversation-item--${message.direction}`}>
                      <header><div><strong>{message.sender_name}</strong><span>{message.sender_address}</span></div><time>{formatMessageDate(message.sent_at)}</time></header>
                      <div>{splitBody(message.body_text).map((paragraph, index) => <p key={`${message.id}-${index}`}>{paragraph}</p>)}</div>
                    </section>
                  ))}
                </div>

                {selected.attachmentRecords?.length > 0 && (
                  <section className="simple-mail__attachments simple-mail__attachments--thread">
                    <span>Adjuntos</span>
                    <div>{selected.attachmentRecords.map((attachment) => <button type="button" key={attachment.id} onClick={() => setAttachmentViewer(attachment)}><FileText size={16} /> {attachment.filename}</button>)}</div>
                  </section>
                )}

                {composer && (
                  <section className="simple-mail__reply-box">
                    <header><strong>Responder</strong><button type="button" onClick={() => setComposer(null)}><X size={16} /></button></header>
                    <label><span>Para</span><input value={composer.recipientAddress} onChange={(event) => setComposer((current) => ({ ...current, recipientAddress: event.target.value }))} /></label>
                    <textarea value={composer.body} onChange={(event) => setComposer((current) => ({ ...current, body: event.target.value }))} placeholder="Escribe tu respuesta" />
                    <footer><button type="button" className="is-primary" onClick={() => saveReply("reply")} disabled={busy || !composer.body.trim()}><Send size={15} /> Enviar</button><button type="button" onClick={() => saveReply("draft")} disabled={busy || !composer.body.trim()}><Save size={15} /> Guardar borrador</button></footer>
                  </section>
                )}
              </article>
            </>
          )}
        </section>
      </main>

      {newMessageOpen && <MailNewMessageComposer mailbox={mailbox} onClose={() => setNewMessageOpen(false)} onCreated={handleNewMessage} />}
      {attachmentViewer && <MailAttachmentViewer attachment={attachmentViewer} onClose={() => setAttachmentViewer(null)} />}
    </div>
  );
}
