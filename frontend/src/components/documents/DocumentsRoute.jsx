import { useEffect, useState } from "react";

import DocumentsPage from "../../pages/DocumentsPage";
import { fetchCompanies } from "../../services/companyApi";
import { createDocument, deleteDocument, fetchDocuments, updateDocument } from "../../services/documentApi";
import { fetchAllEmployees } from "../../services/employeeApi";
import { fetchWorkCenters } from "../../services/workCenterApi";

const initialDocumentForm = {
  employee_id: "",
  company_id: "",
  center_id: "",
  document_type: "",
  document_name: "",
  status: "pending",
  issue_date: "",
  expiry_date: "",
  notes: "",
};

function isDocumentsRoute() {
  return window.location.hash === "#documents";
}

function buildDocumentPayload(form) {
  return {
    employee_id: Number(form.employee_id),
    company_id: form.company_id ? Number(form.company_id) : null,
    center_id: form.center_id ? Number(form.center_id) : null,
    document_type: form.document_type,
    document_name: form.document_name,
    status: form.status,
    issue_date: form.issue_date || null,
    expiry_date: form.expiry_date || null,
    notes: form.notes || null,
  };
}

export default function DocumentsRoute() {
  const [active, setActive] = useState(isDocumentsRoute());
  const [loading, setLoading] = useState(false);
  const [documentSubmitting, setDocumentSubmitting] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [documentSuccess, setDocumentSuccess] = useState("");
  const [documentForm, setDocumentForm] = useState(initialDocumentForm);
  const [data, setData] = useState({
    documents: [],
    employees: [],
    companies: [],
    workCenters: [],
  });

  useEffect(() => {
    const handleRouteChange = () => setActive(isDocumentsRoute());
    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("aulanomina-route-change", handleRouteChange);
    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("aulanomina-route-change", handleRouteChange);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setDocumentError("");
      const [documents, employees, companies, workCenters] = await Promise.all([
        fetchDocuments(),
        fetchAllEmployees(),
        fetchCompanies(),
        fetchWorkCenters(),
      ]);
      setData({ documents, employees, companies, workCenters });
    } catch (err) {
      setDocumentError(err.message || "Error cargando documentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (active) loadData();
  }, [active]);

  const handleDocumentChange = (event) => {
    const { name, value } = event.target;
    setDocumentForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDocumentSubmit = async (event) => {
    event.preventDefault();
    setDocumentError("");
    setDocumentSuccess("");
    try {
      setDocumentSubmitting(true);
      await createDocument(buildDocumentPayload(documentForm));
      setDocumentSuccess("Documento creado correctamente");
      setDocumentForm(initialDocumentForm);
      await loadData();
    } catch (err) {
      setDocumentError(err.message || "Error al crear documento");
    } finally {
      setDocumentSubmitting(false);
    }
  };

  const handleUpdateDocument = async (documentId, payload) => {
    setDocumentError("");
    setDocumentSuccess("");
    try {
      setDocumentSubmitting(true);
      const updatedDocument = await updateDocument(documentId, payload);
      setDocumentSuccess("Documento actualizado correctamente");
      await loadData();
      return updatedDocument;
    } catch (err) {
      setDocumentError(err.message || "Error al actualizar documento");
      throw err;
    } finally {
      setDocumentSubmitting(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    setDocumentError("");
    setDocumentSuccess("");
    try {
      setDocumentSubmitting(true);
      await deleteDocument(documentId);
      setDocumentSuccess("Documento eliminado correctamente");
      await loadData();
    } catch (err) {
      setDocumentError(err.message || "Error al eliminar documento");
      throw err;
    } finally {
      setDocumentSubmitting(false);
    }
  };

  if (!active) return null;

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Documentos</h1>
          <p style={styles.subtitle}>Gestión documental del expediente laboral simulado.</p>
        </div>
      </header>
      <main style={styles.main}>
        <DocumentsPage
          loading={loading}
          documents={data.documents}
          employees={data.employees}
          companies={data.companies}
          workCenters={data.workCenters}
          documentForm={documentForm}
          onDocumentChange={handleDocumentChange}
          onDocumentSubmit={handleDocumentSubmit}
          onUpdateDocument={handleUpdateDocument}
          onDeleteDocument={handleDeleteDocument}
          documentSubmitting={documentSubmitting}
          documentError={documentError}
          documentSuccess={documentSuccess}
        />
      </main>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "fixed",
    top: "56px",
    left: "272px",
    right: 0,
    bottom: 0,
    zIndex: 20,
    backgroundColor: "#ffffff",
    overflowY: "auto",
  },
  header: {
    borderBottom: "3px solid #111111",
    backgroundColor: "#ffffff",
    padding: "24px 42px 18px 32px",
    boxSizing: "border-box",
  },
  title: { margin: 0, color: "#111111", fontSize: "32px", fontWeight: 950 },
  subtitle: { margin: "6px 0 0", color: "#4b5563", fontSize: "15px", fontWeight: 700 },
  main: { padding: "26px 42px 48px 32px", boxSizing: "border-box", maxWidth: "1320px", width: "100%" },
};
