import { useEffect, useState } from "react";
import { Download, FileText, Link2, LoaderCircle, X } from "lucide-react";

import {
  fetchEmployeeDocumentsForMail,
  fetchMailAttachmentPreview,
  getMailAttachmentDownloadUrl,
  linkMailAttachmentToDocument,
} from "../../services/mailApi.js";
import "./mailFunctional.css";


export default function MailAttachmentViewer({ attachment, employeeId = null, onClose }) {
  const [preview, setPreview] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setNotice("");
    Promise.all([
      fetchMailAttachmentPreview(attachment.id),
      fetchEmployeeDocumentsForMail(employeeId),
    ])
      .then(([data, employeeDocuments]) => {
        if (!active) return;
        setPreview(data);
        setDocuments(employeeDocuments || []);
        setSelectedDocumentId(data?.linked_document_id ? String(data.linked_document_id) : "");
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
  }, [attachment.id, employeeId]);

  const linkDocument = async () => {
    if (!selectedDocumentId) return;
    setLinking(true);
    setError("");
    setNotice("");
    try {
      const updated = await linkMailAttachmentToDocument(attachment.id, selectedDocumentId);
      setPreview(updated);
      setNotice("Adjunto vinculado al documento del expediente.");
      window.dispatchEvent(new Event("aulanomina-activities-refresh"));
    } catch (requestError) {
      setError(requestError.message || "No se ha podido vincular el adjunto.");
    } finally {
      setLinking(false);
    }
  };

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
          {notice && <div className="mail-functional-success" role="status">{notice}</div>}
          {!loading && preview && <pre>{preview.content_text}</pre>}
        </div>

        <footer>
          <a className="mail-functional-primary" href={getMailAttachmentDownloadUrl(attachment.id)}>
            <Download size={16} /> Descargar archivo
          </a>
          {employeeId && documents.length > 0 && (
            <>
              <select
                aria-label="Documento ERP relacionado"
                value={selectedDocumentId}
                onChange={(event) => setSelectedDocumentId(event.target.value)}
              >
                <option value="">Vincular a documento ERP…</option>
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.document_name} · {document.status}
                  </option>
                ))}
              </select>
              <button type="button" onClick={linkDocument} disabled={!selectedDocumentId || linking}>
                {linking ? <LoaderCircle className="mail-spinner" size={16} /> : <Link2 size={16} />}
                {preview?.linked_document_id ? "Actualizar vínculo" : "Vincular evidencia"}
              </button>
            </>
          )}
          {preview?.linked_document_id && <span>Documento ERP #{preview.linked_document_id}</span>}
          <button type="button" onClick={onClose}>Cerrar</button>
        </footer>
      </section>
    </div>
  );
}
