import { useEffect, useState } from "react";

import "./activityResponse.css";

export default function ActivityResponseForm({ schema, value, onChange, disabled = false }) {
  const [showReferenceAnswer, setShowReferenceAnswer] = useState(false);

  useEffect(() => {
    setShowReferenceAnswer(false);
  }, [schema?.prompt]);

  if (!schema || schema.type !== "decision") return null;

  const update = (field, nextValue) => onChange({ ...(value || {}), [field]: nextValue });
  const referenceAnswer = String(schema.explanation_placeholder || "").trim();

  return (
    <section className="activity-response" aria-label="Respuesta del ejercicio">
      <div className="activity-response__heading">
        <span>Tipo test</span>
        <small>La opción se corrige automáticamente. Tu razonamiento escrito no se puntúa.</small>
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
        <div className="activity-response__self-review">
          <button
            type="button"
            className="activity-response__answer-button"
            onClick={() => setShowReferenceAnswer((current) => !current)}
          >
            {showReferenceAnswer ? "Ocultar respuesta" : "Mostrar respuesta"}
          </button>
          {showReferenceAnswer && (
            <div className="activity-response__reference-answer">
              <strong>Respuesta orientativa</strong>
              <p>{referenceAnswer}</p>
              <small>Compárala con tu razonamiento. No se exige una redacción literal.</small>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
