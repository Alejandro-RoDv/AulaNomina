import "./activityResponse.css";

export default function ActivityResponseForm({ schema, value, onChange, disabled = false }) {
  if (!schema || schema.type !== "decision") return null;

  const update = (field, nextValue) => onChange({ ...(value || {}), [field]: nextValue });

  return (
    <section className="activity-response" aria-label="Respuesta del ejercicio">
      <div className="activity-response__heading">
        <span>Tu respuesta</span>
        <small>Se evaluará junto con los datos del caso.</small>
      </div>

      <fieldset className="activity-response__choices" disabled={disabled}>
        <legend>{schema.prompt || "Selecciona la opción que consideres correcta"}</legend>
        {(schema.options || []).map((option) => (
          <label key={option.value} className={`activity-response__choice${value?.decision === option.value ? " is-selected" : ""}`}>
            <input
              type="radio"
              name="activity-decision"
              value={option.value}
              checked={value?.decision === option.value}
              onChange={(event) => update("decision", event.target.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <label className="activity-response__explanation">
        <span>{schema.explanation_label || "Justificación"}</span>
        <textarea
          rows="4"
          value={value?.explanation || ""}
          onChange={(event) => update("explanation", event.target.value)}
          placeholder={schema.explanation_placeholder || "Explica brevemente el criterio utilizado."}
          disabled={disabled}
        />
      </label>
    </section>
  );
}
