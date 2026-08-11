import "./DocumentsDetailPolish.css";

export default function DocumentChecklistPanel({
  selectedEmployee,
  checklistLoading,
  checklistMessage,
  checklistError,
  onGenerateChecklist,
}) {
  return (
    <section className="documents-checklist-panel">
      <div className="documents-checklist-copy">
        <span className="documents-checklist-kicker">Documentación base</span>
        <h3>Checklist documental</h3>
        <p>
          Crea de una vez los documentos básicos que todavía falten en este expediente.
        </p>
      </div>

      <button
        type="button"
        className="documents-checklist-button"
        onClick={onGenerateChecklist}
        disabled={!selectedEmployee || checklistLoading}
      >
        {checklistLoading ? "Generando..." : "Generar checklist"}
      </button>

      {checklistMessage ? (
        <p className="documents-checklist-message is-success">{checklistMessage}</p>
      ) : null}
      {checklistError ? (
        <p className="documents-checklist-message is-error">{checklistError}</p>
      ) : null}
    </section>
  );
}
