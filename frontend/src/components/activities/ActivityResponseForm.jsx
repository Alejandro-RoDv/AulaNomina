import "./activityResponse.css";

export default function ActivityResponseForm({ schema, value, onChange, disabled = false }) {
  if (!schema || schema.type !== "decision") return null;

  const validationState = value?._validation_passed === true
    ? "correct"
    : value?._validation_passed === false
      ? "incorrect"
      : null;
  const referenceAnswer = validationState === "correct"
    ? String(value?._reference_answer || schema.explanation_placeholder || "").trim()
    : "";

  const update = (field, nextValue) => {
    const next = { ...(value || {}), [field]: nextValue };
    delete next._validation_passed;
    delete next._reference_answer;
    onChange(next);
  };

  return (
    <section
      className={`activity-response${validationState ? ` is-${validationState}` : ""}`}
      aria-label="Respuesta del ejercicio"
    >
      <div className="activity-response__heading">
        <span>Tipo test</span>
        <small>La opción se corrige automáticamente. Tu razonamiento escrito no se puntúa.</small>
      </div>

      <fieldset className="activity-response__choices" disabled={disabled}>
        <legend>{schema.prompt || "Selecciona la opción que consideres correcta"}</legend>
        {(schema.options || []).map((option) => {
          const selected = value?.decision === option.value;
          return (
            <label
              key={option.value}
              className={`activity-response__choice${selected ? " is-selected" : ""}${selected && validationState ? ` is-${validationState}` : ""}`}
            >
              <input
                type="radio"
                name="activity-decision"
                value={option.value}
                checked={selected}
                onChange={(event) => update("decision", event.target.value)}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </fieldset>

      {validationState && (
        <div className={`activity-response__quiz-feedback is-${validationState}`} role="status">
          <strong>{validationState === "correct" ? "Respuesta correcta" : "Respuesta tipo test incorrecta"}</strong>
          <span>
            {validationState === "correct"
              ? "El test está superado. Compara ahora tu razonamiento con la solución orientativa."
              : "Revisa los datos del supuesto, selecciona otra opción y vuelve a comprobarla."}
          </span>
        </div>
      )}

      <label className="activity-response__explanation">
        <span>{schema.explanation_label || "Tu razonamiento (opcional)"}</span>
        <textarea
          rows="4"
          value={value?.explanation || ""}
          onChange={(event) => update("explanation", event.target.value)}
          placeholder="Escribe con tus palabras por qué has elegido esa opción."
          disabled={disabled}
        />
      </label>

      {referenceAnswer && (
        <div className="activity-response__reference-answer">
          <strong>Solución orientativa</strong>
          <p>{referenceAnswer}</p>
          <small>Compárala con tu razonamiento. No se exige una redacción literal.</small>
        </div>
      )}
    </section>
  );
}
