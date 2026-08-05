import { useEffect, useState } from "react";
import { Download, FileText, LoaderCircle, X } from "lucide-react";

import {
  fetchMailAttachmentPreview,
  getMailAttachmentDownloadUrl,
} from "../../services/mailApi.js";
import "./mailFunctional.css";


export default function MailAttachmentViewer({ attachment, onClose }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchMailAttachmentPreview(attachment.id)
      .then((data) => {
        if (active) setPreview(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "No se ha podido abrir el adjunto.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attachment.id]);

  return (
    <div className="mail-functional-overlay" role="presentation">
      <section className="mail-attachment-viewer" role="dialog" aria-modal="true" aria-label={`Adjunto ${attachment.filename}`}>
        <header>
          <div>
            <FileText size={18} />
            <div><strong>{attachment.filename}</strong><span>{attachment.content_type}</span></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div className="mail-attachment-viewer__content">
          {loading && <div className="mail-functional-loading"><LoaderCircle className="mail-spinner" size={18} /> Preparando vista previa...</div>}
          {error && <div className="mail-functional-error" role="alert">{error}</div>}
          {!loading && preview && <pre>{preview.content_text}</pre>}
        </div>

        <footer>
          <a className="mail-functional-primary" href={getMailAttachmentDownloadUrl(attachment.id)}>
            <Download size={16} /> Descargar archivo
          </a>
          {preview?.linked_document_id && <span>Documento ERP #{preview.linked_document_id}</span>}
          <button type="button" onClick={onClose}>Cerrar</button>
        </footer>
      </section>
    </div>
  );
}
