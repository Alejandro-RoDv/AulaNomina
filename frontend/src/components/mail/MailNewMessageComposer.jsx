import { useState } from "react";
import { FilePlus2, LoaderCircle, Paperclip, Save, Send, Trash2, X } from "lucide-react";

import { createMailThread } from "../../services/mailApi.js";
import "./mailFunctional.css";

const EMPTY_FORM = {
  recipient_name: "",
  recipient_address: "",
  cc_address: "",
  subject: "",
  body_text: "",
};

async function fileToAttachment(file) {
  const isText = file.type.startsWith("text/") || /\.(txt|csv|xml|json)$/i.test(file.name);
  let contentText = `Adjunto simulado incorporado desde ${file.name}.`;
  if (isText) {
    try {
      contentText = await file.text();
    } catch {
      // Conserva una representación simulada si el navegador no puede leerlo.
    }
  }
  return {
    filename: file.name,
    content_type: file.type || "application/octet-stream",
    document_type: "user_attachment",
    content_text: contentText,
    size_bytes: file.size || 0,
  };
}

export default function MailNewMessageComposer({ mailbox, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [attachments, setAttachments] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const addFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const next = await Promise.all(files.map(fileToAttachment));
    setAttachments((current) => [...current, ...next]);
    event.target.value = "";
  };

  const submit = async (saveAsDraft) => {
    if (!mailbox?.id) return;
    setError("");
    if (!form.recipient_address.trim()) {
      setError("Indica la dirección del destinatario.");
      return;
    }
    if (!form.subject.trim() || !form.body_text.trim()) {
      setError("El asunto y el contenido son obligatorios.");
      return;
    }

    setBusy(saveAsDraft ? "draft" : "send");
    try {
      const created = await createMailThread(mailbox.id, {
        recipient_name: form.recipient_name.trim() || null,
        recipient_address: form.recipient_address.trim(),
        cc_address: form.cc_address.trim() || null,
        subject: form.subject.trim(),
        body_text: form.body_text.trim(),
        priority: "normal",
        category: "general",
        company_id: null,
        employee_id: null,
        case_reference: null,
        related_entity_type: null,
        related_entity_id: null,
        attachments,
        save_as_draft: saveAsDraft,
      });
      await onCreated(created, saveAsDraft);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido guardar el correo.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mail-functional-overlay" role="presentation">
      <section className="mail-new-message" role="dialog" aria-modal="true" aria-label="Correo nuevo">
        <header>
          <div><strong>Correo nuevo</strong></div>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        {error && <div className="mail-functional-error" role="alert">{error}</div>}

        <div className="mail-new-message__fields">
          <label>Para<input name="recipient_address" value={form.recipient_address} onChange={updateField} placeholder="destinatario@empresa.es" /></label>
          <label>Nombre<input name="recipient_name" value={form.recipient_name} onChange={updateField} placeholder="Nombre del destinatario" /></label>
          <label>CC<input name="cc_address" value={form.cc_address} onChange={updateField} placeholder="copia@empresa.es" /></label>
          <label className="is-wide">Asunto<input name="subject" value={form.subject} onChange={updateField} /></label>
          <label className="is-wide mail-new-message__body">Mensaje<textarea name="body_text" value={form.body_text} onChange={updateField} rows={12} /></label>
        </div>

        <div className="mail-new-message__attachments">
          <label className="mail-new-message__file-button">
            <FilePlus2 size={16} /> Añadir adjuntos
            <input type="file" multiple onChange={addFiles} />
          </label>
          {attachments.map((attachment, index) => (
            <div key={`${attachment.filename}-${index}`}>
              <Paperclip size={14} />
              <span>{attachment.filename}</span>
              <button type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Quitar ${attachment.filename}`}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        <footer>
          <button type="button" className="mail-functional-primary" onClick={() => submit(false)} disabled={Boolean(busy)}>
            {busy === "send" ? <LoaderCircle className="mail-spinner" size={16} /> : <Send size={16} />} Enviar
          </button>
          <button type="button" onClick={() => submit(true)} disabled={Boolean(busy)}>
            {busy === "draft" ? <LoaderCircle className="mail-spinner" size={16} /> : <Save size={16} />} Guardar borrador
          </button>
          <button type="button" onClick={onClose} disabled={Boolean(busy)}>Cancelar</button>
        </footer>
      </section>
    </div>
  );
}
